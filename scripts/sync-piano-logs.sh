#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
AWS_PROFILE="${AWS_PROFILE:-kshirin}"
AWS_REGION="${AWS_REGION:-us-east-1}"
LOG_BUCKET="${LOG_BUCKET:-kshirinvijay-piano-logs}"
TEMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TEMP_DIR"' EXIT

aws s3 sync "s3://$LOG_BUCKET/raw/" "$TEMP_DIR/raw/" \
  --profile "$AWS_PROFILE" \
  --region "$AWS_REGION" \
  --only-show-errors

python3 - "$TEMP_DIR/raw" "$ROOT_DIR/piano_logs.json" <<'PY'
import json
import os
import sys

source, destination = sys.argv[1:]
events = []
for root, _, files in os.walk(source):
    for name in files:
        if not name.endswith(".json"):
            continue
        with open(os.path.join(root, name), encoding="utf-8") as handle:
            for line in handle:
                line = line.strip()
                if line:
                    events.append(json.loads(line))

events.sort(key=lambda event: event.get("clientSentAt") or event.get("ts") or "")
with open(destination, "w", encoding="utf-8") as handle:
    json.dump(events, handle, indent=2)
    handle.write("\n")
print(f"Wrote {len(events)} events to {destination}")
PY
