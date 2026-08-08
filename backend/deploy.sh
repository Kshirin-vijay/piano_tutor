#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

AWS_PROFILE="${AWS_PROFILE:-kshirin}"
AWS_REGION="${AWS_REGION:-us-east-1}"
STACK_NAME="${STACK_NAME:-piano-friend-dashboard}"
STAGE_NAME="${STAGE_NAME:-prod}"
LOG_FUNCTION_NAME="${LOG_FUNCTION_NAME:-piano-friend-log}"
ARTIFACT_DIR="${ARTIFACT_DIR:-$ROOT_DIR/.artifacts}"

usage() {
  cat <<'EOF'
Usage: ./deploy.sh [--stack-only | --log-only | --all]

  --stack-only   Deploy SAM stack (events table, dashboard API). Default.
  --log-only     Package and update the existing piano-friend-log Lambda only.
  --all          Deploy stack, then update log Lambda.

Environment:
  AWS_PROFILE           (default: kshirin)
  AWS_REGION            (default: us-east-1)
  STACK_NAME            (default: piano-friend-dashboard)
  DASHBOARD_SECRET_ARN  required for stack deploy
  TEACHER_IDS           optional comma-separated class codes
  CORS_ORIGIN           optional, default https://kshirinvijay.com
  LOCAL_CORS_ORIGIN     optional, default http://127.0.0.1:5175
  DEPLOYMENT_BUCKET     optional, default kshirinvijay-piano-logs
EOF
}

MODE="stack"
if [[ "${1:-}" == "--log-only" ]]; then
  MODE="log"
elif [[ "${1:-}" == "--all" ]]; then
  MODE="all"
elif [[ "${1:-}" == "--stack-only" || "${1:-}" == "" ]]; then
  MODE="stack"
elif [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
else
  echo "Unknown argument: $1" >&2
  usage
  exit 1
fi

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

package_log_lambda() {
  mkdir -p "$ARTIFACT_DIR/log"
  rm -rf "$ARTIFACT_DIR/log"/*
  cp -R lib "$ARTIFACT_DIR/log/lib"
  mkdir -p "$ARTIFACT_DIR/log/lambdas/log"
  cp lambdas/log/index.mjs "$ARTIFACT_DIR/log/lambdas/log/index.mjs"
  (
    cd "$ARTIFACT_DIR/log"
    zip -qr "$ARTIFACT_DIR/piano-friend-log.zip" .
  )
  echo "Packaged log Lambda: $ARTIFACT_DIR/piano-friend-log.zip"
}

deploy_stack() {
  require_cmd aws

  if [[ -z "${DASHBOARD_SECRET_ARN:-}" ]]; then
    echo "DASHBOARD_SECRET_ARN is required for stack deploy." >&2
    echo "Create a secret with scripts/hash-password.mjs output, then export DASHBOARD_SECRET_ARN." >&2
    exit 1
  fi

  local parameters=(
    "StageName=$STAGE_NAME"
    "DashboardSecretArn=$DASHBOARD_SECRET_ARN"
    "TeacherIds=${TEACHER_IDS:-}"
    "CorsOrigin=${CORS_ORIGIN:-https://kshirinvijay.com}"
    "LocalCorsOrigin=${LOCAL_CORS_ORIGIN:-http://127.0.0.1:5175}"
  )

  if command -v sam >/dev/null 2>&1; then
    sam build --template-file template.yaml
    sam deploy \
      --stack-name "$STACK_NAME" \
      --region "$AWS_REGION" \
      --profile "$AWS_PROFILE" \
      --resolve-s3 \
      --capabilities CAPABILITY_IAM \
      --no-fail-on-empty-changeset \
      --parameter-overrides "${parameters[@]}"
  else
    mkdir -p "$ARTIFACT_DIR"
    local packaged_template="$ARTIFACT_DIR/packaged-template.yaml"
    aws cloudformation package \
      --template-file template.yaml \
      --s3-bucket "${DEPLOYMENT_BUCKET:-kshirinvijay-piano-logs}" \
      --s3-prefix "deployments/$STACK_NAME" \
      --output-template-file "$packaged_template" \
      --region "$AWS_REGION" \
      --profile "$AWS_PROFILE"
    aws cloudformation deploy \
      --template-file "$packaged_template" \
      --stack-name "$STACK_NAME" \
      --region "$AWS_REGION" \
      --profile "$AWS_PROFILE" \
      --capabilities CAPABILITY_IAM \
      --no-fail-on-empty-changeset \
      --parameter-overrides "${parameters[@]}"
  fi

  echo "Stack deployed: $STACK_NAME"
  aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --region "$AWS_REGION" \
    --profile "$AWS_PROFILE" \
    --query 'Stacks[0].Outputs' \
    --output table
}

deploy_log_lambda() {
  require_cmd aws
  require_cmd curl
  require_cmd python3
  require_cmd zip
  package_log_lambda
  mkdir -p "$ARTIFACT_DIR"

  aws lambda get-function-configuration \
    --function-name "$LOG_FUNCTION_NAME" \
    --region "$AWS_REGION" \
    --profile "$AWS_PROFILE" \
    > "$ARTIFACT_DIR/log-config-before.json"

  local previous_code_url
  previous_code_url="$(aws lambda get-function \
    --function-name "$LOG_FUNCTION_NAME" \
    --region "$AWS_REGION" \
    --profile "$AWS_PROFILE" \
    --query 'Code.Location' --output text)"
  curl -fsSL "$previous_code_url" -o "$ARTIFACT_DIR/piano-friend-log-before.zip"

  local events_table
  events_table="$(aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --region "$AWS_REGION" \
    --profile "$AWS_PROFILE" \
    --query "Stacks[0].Outputs[?OutputKey=='EventsTableName'].OutputValue | [0]" \
    --output text 2>/dev/null || true)"

  if [[ -z "$events_table" || "$events_table" == "None" ]]; then
    events_table="${EVENTS_TABLE:-piano-friend-events}"
    echo "Warning: stack output unavailable, using EVENTS_TABLE=$events_table"
  fi

  local events_table_arn role_arn role_name
  events_table_arn="$(aws dynamodb describe-table \
    --table-name "$events_table" \
    --region "$AWS_REGION" \
    --profile "$AWS_PROFILE" \
    --query 'Table.TableArn' --output text)"
  role_arn="$(aws lambda get-function-configuration \
    --function-name "$LOG_FUNCTION_NAME" \
    --region "$AWS_REGION" \
    --profile "$AWS_PROFILE" \
    --query 'Role' --output text)"
  role_name="${role_arn##*/}"
  echo "$role_name" > "$ARTIFACT_DIR/log-role-name.txt"
  aws iam put-role-policy \
    --role-name "$role_name" \
    --policy-name PianoFriendEventsDualWrite \
    --profile "$AWS_PROFILE" \
    --policy-document "$(printf '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Action":"dynamodb:PutItem","Resource":"%s"}]}' "$events_table_arn")"

  python3 - "$ARTIFACT_DIR/log-config-before.json" "$ARTIFACT_DIR/log-env-deploy.json" "$events_table" "${LOG_BUCKET:-kshirinvijay-piano-logs}" <<'PY'
import json, sys
source, target, table, bucket = sys.argv[1:]
with open(source) as handle:
    config = json.load(handle)
variables = dict(config.get("Environment", {}).get("Variables", {}))
variables.update(LOG_BUCKET=bucket, EVENTS_TABLE=table, DUAL_WRITE_ENABLED="true")
with open(target, "w") as handle:
    json.dump({"Variables": variables}, handle)
PY

  aws lambda update-function-code \
    --function-name "$LOG_FUNCTION_NAME" \
    --region "$AWS_REGION" \
    --profile "$AWS_PROFILE" \
    --zip-file "fileb://$ARTIFACT_DIR/piano-friend-log.zip" >/dev/null

  aws lambda update-function-configuration \
    --function-name "$LOG_FUNCTION_NAME" \
    --region "$AWS_REGION" \
    --profile "$AWS_PROFILE" \
    --handler "lambdas/log/index.handler" \
    --environment "file://$ARTIFACT_DIR/log-env-deploy.json" >/dev/null

  local version
  version="$(aws lambda publish-version \
    --function-name "$LOG_FUNCTION_NAME" \
    --region "$AWS_REGION" \
    --profile "$AWS_PROFILE" \
    --query Version --output text)"
  echo "$version" > "$ARTIFACT_DIR/log-lambda-version.txt"
  echo "Updated $LOG_FUNCTION_NAME and published version $version"
  echo "Saved version marker: $ARTIFACT_DIR/log-lambda-version.txt"
}

case "$MODE" in
  stack) deploy_stack ;;
  log) deploy_log_lambda ;;
  all) deploy_stack; deploy_log_lambda ;;
esac
