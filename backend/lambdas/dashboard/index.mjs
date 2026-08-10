import { DynamoDBClient, QueryCommand, ScanCommand } from "@aws-sdk/client-dynamodb";
import { GetSecretValueCommand, SecretsManagerClient } from "@aws-sdk/client-secrets-manager";
import { unmarshall } from "@aws-sdk/util-dynamodb";
import { aggregateTeacherReport } from "../../lib/aggregate.mjs";
import {
  authenticateDashboardPassword,
  authorizeReportRequest,
  checkAuthRateLimit,
  clientIpFromEvent,
  parseBearerToken,
} from "../../lib/auth.mjs";
import { resolveReportRange, utcPartitionDaysForRange } from "../../lib/dates.mjs";
import { normalizeStoredEvent } from "../../lib/normalize.mjs";
import { emptyResponse, jsonResponse } from "../../lib/response.mjs";

const ddb = new DynamoDBClient({});
const secretsClient = new SecretsManagerClient({});

const EVENTS_TABLE = process.env.EVENTS_TABLE || "piano-friend-events";
const CLASSES_TABLE = process.env.CLASSES_TABLE || "piano-friend-classes";
const AUTH_RATE_TABLE = process.env.AUTH_RATE_TABLE || "piano-friend-dashboard-auth-ratelimit";
const DASHBOARD_SECRET_ARN = process.env.DASHBOARD_SECRET_ARN;
const TEACHER_IDS = (process.env.TEACHER_IDS || "")
  .split(",")
  .map((id) => id.trim())
  .filter(Boolean);

let cachedSecrets;

export async function handler(event) {
  const method = event.requestContext?.http?.method ?? "";
  const path = event.requestContext?.http?.path ?? event.rawPath ?? "";

  if (method === "OPTIONS") {
    return emptyResponse(204);
  }

  if (method === "POST" && (path === "/dashboard/auth" || path.endsWith("/dashboard/auth"))) {
    return handleAuth(event);
  }

  if (method === "GET" && (path === "/dashboard/report" || path.endsWith("/dashboard/report"))) {
    return handleReport(event);
  }

  return jsonResponse(404, { error: "Not found" });
}

async function handleAuth(event) {
  const ip = clientIpFromEvent(event);
  const rate = await checkAuthRateLimit(ddb, AUTH_RATE_TABLE, ip);
  if (!rate.allowed) {
    return jsonResponse(429, { error: "Too many attempts. Try again later." });
  }

  let body;
  try {
    body = event.body ? JSON.parse(event.body) : {};
  } catch {
    return jsonResponse(400, { error: "Invalid JSON body." });
  }

  const secrets = await loadDashboardSecrets();
  const result = authenticateDashboardPassword(body.password, secrets);
  if (!result.ok) {
    return jsonResponse(401, { error: result.error });
  }

  return jsonResponse(200, {
    token: result.token,
    expiresInSeconds: result.expiresInSeconds,
  });
}

async function handleReport(event) {
  const token = parseBearerToken(event.headers || {});
  if (!token) return jsonResponse(401, { error: "Unauthorized" });

  const secrets = await loadDashboardSecrets();
  const auth = authorizeReportRequest(token, secrets.signingSecret);
  if (!auth.ok) return jsonResponse(401, { error: auth.error });

  let range;
  try {
    range = resolveReportRange(event.queryStringParameters || {});
  } catch (err) {
    return jsonResponse(400, { error: err.message });
  }

  const teacherIds = await resolveTeacherIds();
  const rosterByTeacher = await loadRosters(teacherIds);
  const partitionDays = utcPartitionDaysForRange(range.from, range.to, range.timezone);
  const events = await loadEventsForTeachers(teacherIds, partitionDays, range);

  const report = aggregateTeacherReport({
    events,
    rosterByTeacher,
    teacherIds,
    from: range.from,
    to: range.to,
    timezone: range.timezone,
  });

  return jsonResponse(200, {
    generatedAt: new Date().toISOString(),
    ...report,
  });
}

async function loadDashboardSecrets() {
  if (cachedSecrets) return cachedSecrets;
  if (!DASHBOARD_SECRET_ARN) {
    throw new Error("DASHBOARD_SECRET_ARN is not configured");
  }
  const result = await secretsClient.send(
    new GetSecretValueCommand({ SecretId: DASHBOARD_SECRET_ARN }),
  );
  cachedSecrets = JSON.parse(result.SecretString || "{}");
  return cachedSecrets;
}

async function resolveTeacherIds() {
  if (TEACHER_IDS.length > 0) return TEACHER_IDS;
  const roster = await loadAllClassCodes();
  const ids = roster.map((item) => item.code).filter((code) => code !== "__COUNTER__");
  if (!ids.includes("public")) ids.push("public");
  return ids.sort();
}

async function loadAllClassCodes() {
  const items = [];
  let lastKey;
  do {
    const result = await ddb.send(
      new ScanCommand({
        TableName: CLASSES_TABLE,
        ProjectionExpression: "code, teacher, students, active",
        ExclusiveStartKey: lastKey,
      }),
    );
    for (const item of result.Items || []) {
      items.push(unmarshall(item));
    }
    lastKey = result.LastEvaluatedKey;
  } while (lastKey);
  return items.filter((item) => item.active !== false);
}

async function loadRosters(teacherIds) {
  const map = new Map();
  const all = await loadAllClassCodes();
  for (const item of all) {
    if (!teacherIds.includes(item.code)) continue;
    map.set(item.code, {
      teacherId: item.code,
      teacherName: item.teacher || item.code,
      students: item.students || [],
    });
  }
  for (const teacherId of teacherIds) {
    if (!map.has(teacherId)) {
      map.set(teacherId, { teacherId, teacherName: teacherId, students: [] });
    }
  }
  return map;
}

async function loadEventsForTeachers(teacherIds, partitionDays, range) {
  const events = [];
  for (const teacherId of teacherIds) {
    for (const day of partitionDays) {
      const teacherDay = `${teacherId}#${day}`;
      let lastKey;
      do {
        const result = await ddb.send(
          new QueryCommand({
            TableName: EVENTS_TABLE,
            KeyConditionExpression: "teacherDay = :td",
            ExpressionAttributeValues: {
              ":td": { S: teacherDay },
            },
            ExclusiveStartKey: lastKey,
          }),
        );
        for (const item of result.Items || []) {
          const normalized = normalizeStoredEvent(unmarshall(item));
          if (!normalized) continue;
          const localDay = formatLocalDay(normalized.clientSentAt, range.timezone);
          if (localDay < range.from || localDay > range.to) continue;
          events.push(normalized);
        }
        lastKey = result.LastEvaluatedKey;
      } while (lastKey);
    }
  }
  return events;
}

function formatLocalDay(isoTimestamp, timezone) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(isoTimestamp));
}
