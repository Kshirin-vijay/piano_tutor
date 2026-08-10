#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

AWS_PROFILE="${AWS_PROFILE:-kshirin}"
AWS_REGION="${AWS_REGION:-us-east-1}"
STACK_NAME="${STACK_NAME:-piano-friend-dashboard}"
LOG_FUNCTION_NAME="${LOG_FUNCTION_NAME:-piano-friend-log}"
ARTIFACT_DIR="${ARTIFACT_DIR:-$ROOT_DIR/.artifacts}"

usage() {
  cat <<'EOF'
Usage: ./rollback.sh [--log-only | --stack-only]

  --log-only    Restore piano-friend-log code/config from the pre-deploy backup.
  --stack-only  Delete the dashboard SAM stack (does not remove S3 archive data).

Environment:
  AWS_PROFILE
  AWS_REGION
  STACK_NAME
  LOG_FUNCTION_NAME
EOF
}

MODE="log"
if [[ "${1:-}" == "--stack-only" ]]; then
  MODE="stack"
elif [[ "${1:-}" == "--log-only" || "${1:-}" == "" ]]; then
  MODE="log"
elif [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
else
  echo "Unknown argument: $1" >&2
  usage
  exit 1
fi

rollback_log_lambda() {
  if [[ ! -f "$ARTIFACT_DIR/piano-friend-log-before.zip" || ! -f "$ARTIFACT_DIR/log-config-before.json" ]]; then
    echo "Missing pre-deploy Lambda backup in $ARTIFACT_DIR" >&2
    exit 1
  fi

  python3 - "$ARTIFACT_DIR/log-config-before.json" "$ARTIFACT_DIR/log-env-rollback.json" <<'PY'
import json, sys
with open(sys.argv[1]) as handle:
    config = json.load(handle)
with open(sys.argv[2], "w") as handle:
    json.dump({"Variables": config.get("Environment", {}).get("Variables", {})}, handle)
PY
  local previous_handler
  previous_handler="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["Handler"])' "$ARTIFACT_DIR/log-config-before.json")"

  aws lambda update-function-code \
    --function-name "$LOG_FUNCTION_NAME" \
    --region "$AWS_REGION" \
    --profile "$AWS_PROFILE" \
    --zip-file "fileb://$ARTIFACT_DIR/piano-friend-log-before.zip" >/dev/null

  aws lambda update-function-configuration \
    --function-name "$LOG_FUNCTION_NAME" \
    --region "$AWS_REGION" \
    --profile "$AWS_PROFILE" \
    --handler "$previous_handler" \
    --environment "file://$ARTIFACT_DIR/log-env-rollback.json" >/dev/null

  if [[ -f "$ARTIFACT_DIR/log-role-name.txt" ]]; then
    aws iam delete-role-policy \
      --role-name "$(cat "$ARTIFACT_DIR/log-role-name.txt")" \
      --policy-name PianoFriendEventsDualWrite \
      --profile "$AWS_PROFILE" >/dev/null 2>&1 || true
  fi

  echo "Restored $LOG_FUNCTION_NAME code, environment, and IAM from the pre-deploy backup"
}

rollback_stack() {
  read -r -p "Delete stack $STACK_NAME in $AWS_REGION? [y/N] " confirm
  if [[ "$confirm" != "y" && "$confirm" != "Y" ]]; then
    echo "Aborted."
    exit 1
  fi
  aws cloudformation delete-stack \
    --stack-name "$STACK_NAME" \
    --region "$AWS_REGION" \
    --profile "$AWS_PROFILE"
  aws cloudformation wait stack-delete-complete \
    --stack-name "$STACK_NAME" \
    --region "$AWS_REGION" \
    --profile "$AWS_PROFILE"
  echo "Deleted stack $STACK_NAME"
}

case "$MODE" in
  log) rollback_log_lambda ;;
  stack) rollback_stack ;;
esac
