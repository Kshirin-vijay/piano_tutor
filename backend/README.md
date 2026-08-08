# Piano Friend Backend (Dashboard Analytics)

Production Node.js 20 ESM AWS Lambda sources for the Private Teacher Dashboard. Runtime Lambdas use only the AWS SDK v3 build included in the Lambda Node 20 runtime (no bundled npm dependencies).

## Layout

```
backend/
  lib/                 Shared normalization, auth, dates, aggregation
  lambdas/
    log/               Enhanced /log handler (S3 + DynamoDB dual-write)
    dashboard/         /dashboard/auth and /dashboard/report
  scripts/
    backfill.mjs       Idempotent S3 -> DynamoDB backfill
    hash-password.mjs  Generate Secrets Manager JSON fields
  test/                Node built-in tests
  template.yaml        SAM stack (events table, rate table, dashboard API)
  deploy.sh            Safe deploy helper
  rollback.sh          Safe rollback helper
```

## Prerequisites

- Node.js 20+
- AWS CLI; AWS SAM CLI is optional (the deploy script falls back to
  `aws cloudformation package/deploy`)
- `AWS_PROFILE=<aws-profile>`
- Existing resources: `<classes-table>`, `<log-function>`, and S3 bucket `<log-bucket>`

## 1. Create dashboard secret

```bash
cd backend
node scripts/hash-password.mjs 'your-strong-password'
```

Store the JSON output in AWS Secrets Manager (e.g. `<dashboard-secret-name>`) with keys:

- `passwordHash`
- `passwordSalt`
- `signingSecret`

Export the ARN:

```bash
export DASHBOARD_SECRET_ARN='arn:aws:secretsmanager:us-east-1:...:secret:piano-friend/dashboard-auth-...'
```

## 2. Deploy dashboard stack (does not replace /log API)

```bash
cd backend
chmod +x deploy.sh rollback.sh
./deploy.sh --stack-only
```

This creates:

| Resource | Name |
|----------|------|
| DynamoDB events | `<events-table>` |
| DynamoDB auth rate limit | `<auth-rate-table>` |
| Lambda | `<dashboard-function>` |
| HTTP API | `/dashboard/auth`, `/dashboard/report` |

**Important:** The SAM template does **not** modify the existing API Gateway `/log` route to avoid accidental API replacement. Update `<log-function>` separately (step 3).

Optional parameters:

```bash
export TEACHER_IDS='DEMO-CLASS,SECOND-CLASS'   # default: all active classes + public
export CORS_ORIGIN='https://example.com'
export LOCAL_CORS_ORIGIN='http://127.0.0.1:5175'
```

## 3. Update existing log Lambda (dual-write)

After the events table exists:

```bash
./deploy.sh --log-only
```

This packages `lambdas/log` + `lib/`, updates `<log-function>`, sets:

- `EVENTS_TABLE=<events-table>`
- `DUAL_WRITE_ENABLED=true`

`deploy.sh --log-only` automatically downloads the current Lambda package and
configuration into `.artifacts/`, preserves existing environment variables, and
adds the narrow DynamoDB `PutItem` permission needed for dual writes.

Or deploy everything:

```bash
./deploy.sh --all
```

## 4. Backfill historical S3 logs

Local run requires devDependencies (AWS SDK for the script only):

```bash
cd backend
npm install
AWS_PROFILE=<aws-profile> npm run backfill:dry-run
AWS_PROFILE=<aws-profile> npm run backfill
```

Environment:

| Variable | Default |
|----------|---------|
| `LOG_BUCKET` | `<log-bucket>` |
| `LOG_PREFIX` | `raw/` |
| `EVENTS_TABLE` | `<events-table>` |
| `BACKFILL_LIMIT` | unlimited |

Backfill is idempotent (`attribute_not_exists(eventKey)`), collapses duplicate `level.started` within 500ms, and derives stable legacy IDs.

## 5. Test locally

```bash
cd backend
npm test
```

Syntax check Lambdas:

```bash
node --check lambdas/log/index.mjs
node --check lambdas/dashboard/index.mjs
```

## API contracts

### POST `/log` (existing — enhanced handler)

Unchanged client contract:

```json
{
  "teacherId": "DEMO-CLASS",
  "studentId": "DEMO-CLASS__learner-a1b2",
  "studentLabel": "Demo Student",
  "event": "task.succeeded",
  "eventId": "uuid",
  "clientSentAt": "2026-08-08T12:00:00.000Z",
  "sessionId": "uuid",
  "attemptId": "uuid"
}
```

- Max body: **8 KB** (413 if exceeded)
- Still writes immutable S3 JSON under `raw/dt=YYYY-MM-DD/<uuid>.json`
- Additionally writes normalized DynamoDB item:
  - `teacherDay` = `<teacherId>#<UTC YYYY-MM-DD>`
  - `eventKey` = `<clientSentAt>#<studentId>#<eventId>`
  - TTL: 13 months

Legacy events without IDs get deterministic derived IDs.

### POST `/dashboard/auth`

```json
{ "password": "..." }
```

Response:

```json
{ "token": "<jwt-like>", "expiresInSeconds": 28800 }
```

- PBKDF2-SHA256 password verify against Secrets Manager
- Generic `Invalid credentials.` on failure
- DynamoDB rate limit: 10 attempts / 15 min / IP
- 8-hour HMAC-signed token

### GET `/dashboard/report`

Headers: `Authorization: Bearer <token>`

Query:

| Param | Default | Notes |
|-------|---------|-------|
| `from` | today - 29d | `YYYY-MM-DD` |
| `to` | today | max 90-day span |
| `timezone` | `America/Los_Angeles` | IANA timezone for bucketing |

Returns aggregated daily/student/level summaries (no raw events), a roster-table join, `partialData` flags for legacy gaps, and a separate `public` rollup.

## Rollback

Restore the exact pre-deploy log Lambda package, environment, and IAM policy:

```bash
./rollback.sh --log-only
```

Delete dashboard stack (keeps S3 archive):

```bash
./rollback.sh --stack-only
```

## Design notes

1. **S3 remains canonical** — DynamoDB is a query-optimized, TTL-bounded index; S3 raw archive is never deleted by this stack.
2. **Idempotent writes** — Client `eventId` + conditional DynamoDB puts; backfill uses the same keys.
3. **Legacy tolerance** — Missing `eventId`/`sessionId`/`attemptId`/`clientSentAt` derived from `ts` and stable hashes; time marked `estimated` or `partial` when heartbeats/end events are absent.
4. **Active time** — Heartbeat-bounded (60s slices, 90s gap cap) with fallback to `practice.session_ended` / `free_play.ended` `durationMs`.
5. **Mistake attribution** — `task.mistake` rolled into attempts via `attemptId` (or derived legacy attempt key).
6. **Log API isolation** — SAM deploys dashboard resources only; `deploy.sh --log-only` updates the existing function in place.

## Limitations

- Dashboard HTTP API is a **new** API Gateway endpoint; wire the frontend `VITE_DASHBOARD_API` to the stack output URL (or add a manual route on the existing API if desired).
- `GET /dashboard/report` queries UTC `teacherDay` partitions with ±1 day expansion; very large classes over 90 days may approach Lambda timeout (30s).
- Auth rate-limit table fails open on DynamoDB errors to avoid a total lockout.
- Public practice is aggregate-only; device IDs are not treated as roster students.
- No raw event export endpoint by design.
- S3 lifecycle (90d transition / 13mo expiry) must be configured separately on the log bucket if desired.

## Manual smoke test (after deploy)

```bash
API='https://<dashboard-api-id>.execute-api.us-east-1.amazonaws.com/prod'
TOKEN=$(curl -s -X POST "$API/dashboard/auth" \
  -H 'Content-Type: application/json' \
  -d '{"password":"..."}' | jq -r .token)

curl -s "$API/dashboard/report?from=2026-08-08&to=2026-08-08&timezone=America/Los_Angeles" \
  -H "Authorization: Bearer $TOKEN" | jq '.partialData, .teachers[0].teacherId, .public.days | length'
```
