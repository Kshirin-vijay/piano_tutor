import { createDashboardToken, verifyPassword, verifySignedToken } from "./crypto.mjs";

const GENERIC_AUTH_ERROR = "Invalid credentials.";
const RATE_LIMIT_WINDOW_SECONDS = 15 * 60;
const RATE_LIMIT_MAX_ATTEMPTS = 10;

export function parseBearerToken(headers = {}) {
  const auth = headers.authorization || headers.Authorization || "";
  const match = /^Bearer\s+(.+)$/i.exec(auth);
  return match ? match[1].trim() : null;
}

export function authenticateDashboardPassword(password, secrets) {
  if (!password || typeof password !== "string") return { ok: false, error: GENERIC_AUTH_ERROR };
  const valid = verifyPassword(password, secrets.passwordHash, secrets.passwordSalt);
  if (!valid) return { ok: false, error: GENERIC_AUTH_ERROR };
  const token = createDashboardToken(secrets.signingSecret);
  return { ok: true, token, expiresInSeconds: 8 * 60 * 60 };
}

export function authorizeReportRequest(token, signingSecret) {
  const payload = verifySignedToken(token, signingSecret);
  if (!payload) return { ok: false, error: "Unauthorized" };
  return { ok: true, payload };
}

export async function checkAuthRateLimit(ddb, tableName, clientKey) {
  const now = Math.floor(Date.now() / 1000);
  const windowStart = now - (now % RATE_LIMIT_WINDOW_SECONDS);
  const key = `${clientKey}#${windowStart}`;
  const ttl = windowStart + RATE_LIMIT_WINDOW_SECONDS + 60;

  const { UpdateItemCommand } = await import("@aws-sdk/client-dynamodb");
  const { marshall, unmarshall } = await import("@aws-sdk/util-dynamodb");

  try {
    const result = await ddb.send(
      new UpdateItemCommand({
        TableName: tableName,
        Key: marshall({ clientKey: key }),
        UpdateExpression: "ADD attemptCount :one SET #ttl = :ttl",
        ExpressionAttributeNames: { "#ttl": "ttl" },
        ExpressionAttributeValues: marshall({
          ":one": 1,
          ":ttl": ttl,
          ":max": RATE_LIMIT_MAX_ATTEMPTS,
        }),
        ConditionExpression: "attribute_not_exists(attemptCount) OR attemptCount < :max",
        ReturnValues: "ALL_NEW",
      }),
    );
    const item = unmarshall(result.Attributes || {});
    return { allowed: true, attempts: item.attemptCount || 1 };
  } catch (err) {
    if (err.name === "ConditionalCheckFailedException") {
      return { allowed: false, attempts: RATE_LIMIT_MAX_ATTEMPTS };
    }
    console.error("Rate limit check failed:", err);
    return { allowed: true, attempts: 0, degraded: true };
  }
}

export function clientIpFromEvent(event) {
  const forwarded = event.headers?.["x-forwarded-for"] || event.headers?.["X-Forwarded-For"];
  if (forwarded) return String(forwarded).split(",")[0].trim();
  return event.requestContext?.http?.sourceIp || "unknown";
}

export { GENERIC_AUTH_ERROR, RATE_LIMIT_MAX_ATTEMPTS };
