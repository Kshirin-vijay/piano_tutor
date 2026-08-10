import { randomUUID } from "node:crypto";
import { sha256Hex, stableHash } from "./crypto.mjs";
import { ttlEpochMonths, utcDayFromTimestamp } from "./dates.mjs";

const RESERVED_KEYS = new Set(["teacherId", "studentId", "studentLabel", "event"]);

export function deriveClientSentAt(body) {
  if (typeof body.clientSentAt === "string" && body.clientSentAt) return body.clientSentAt;
  if (typeof body.ts === "string" && body.ts) return body.ts;
  return new Date().toISOString();
}

export function deriveEventId(body, clientSentAt) {
  if (typeof body.eventId === "string" && body.eventId.trim()) return body.eventId.trim();
  return `legacy-${sha256Hex(
    JSON.stringify({
      teacherId: body.teacherId,
      studentId: body.studentId,
      event: body.event,
      clientSentAt,
      levelNumber: body.levelNumber ?? null,
      attemptNumber: body.attemptNumber ?? null,
      taskIndex: body.taskIndex ?? null,
      sessionId: body.sessionId ?? null,
    }),
  ).slice(0, 32)}`;
}

export function deriveSessionId(body, clientSentAt) {
  if (typeof body.sessionId === "string" && body.sessionId.trim()) return body.sessionId.trim();
  if (body.event === "practice.session_started" || body.event === "free_play.started") {
    return `legacy-session-${stableHash([body.teacherId, body.studentId, clientSentAt])}`;
  }
  return undefined;
}

export function deriveAttemptId(body, clientSentAt) {
  if (typeof body.attemptId === "string" && body.attemptId.trim()) return body.attemptId.trim();
  void clientSentAt;
  return undefined;
}

export function isLegacyPayload(body) {
  return !body.eventId || !body.clientSentAt;
}

export function buildLogEntry(body, receivedAt = new Date()) {
  const teacherId = String(body.teacherId || "").trim();
  const studentId = String(body.studentId || "").trim();
  const eventName = String(body.event || "").trim();
  const legacy = isLegacyPayload(body);
  const clientSentAt = deriveClientSentAt(body);
  const eventId = deriveEventId(body, clientSentAt);
  const sessionId = deriveSessionId(body, clientSentAt);
  const attemptId = deriveAttemptId(body, clientSentAt);

  const extras = Object.fromEntries(
    Object.entries(body).filter(([key]) => !RESERVED_KEYS.has(key)),
  );

  const logEntry = {
    ts: receivedAt.toISOString(),
    teacherId,
    studentId,
    studentLabel: body.studentLabel || undefined,
    event: eventName,
    clientSentAt,
    eventId,
    timezone: body.timezone || undefined,
    sessionId,
    attemptId,
    legacy,
    ...extras,
  };

  for (const key of ["sessionId", "attemptId", "studentLabel", "timezone"]) {
    if (logEntry[key] === undefined) delete logEntry[key];
  }

  return logEntry;
}

export function buildDynamoItem(logEntry) {
  const clientSentAt = logEntry.clientSentAt || logEntry.ts;
  const eventId = logEntry.eventId || deriveEventId(logEntry, clientSentAt);
  const utcDay = utcDayFromTimestamp(clientSentAt);
  const teacherDay = `${logEntry.teacherId}#${utcDay}`;
  const eventKey = `${clientSentAt}#${logEntry.studentId}#${eventId}`;

  return {
    teacherDay,
    eventKey,
    teacherId: logEntry.teacherId,
    studentId: logEntry.studentId,
    studentLabel: logEntry.studentLabel,
    event: logEntry.event,
    clientSentAt,
    eventId,
    sessionId: logEntry.sessionId,
    attemptId: logEntry.attemptId,
    timezone: logEntry.timezone,
    legacy: Boolean(logEntry.legacy),
    payload: compactPayload(logEntry),
    ttl: ttlEpochMonths(13),
  };
}

function compactPayload(logEntry) {
  const skip = new Set([
    "teacherDay",
    "eventKey",
    "teacherId",
    "studentId",
    "studentLabel",
    "event",
    "clientSentAt",
    "eventId",
    "sessionId",
    "attemptId",
    "timezone",
    "legacy",
    "payload",
    "ttl",
    "ts",
  ]);
  const payload = {};
  for (const [key, value] of Object.entries(logEntry)) {
    if (!skip.has(key) && value !== undefined) payload[key] = value;
  }
  return payload;
}

export function s3ObjectKeyForEntry(logEntry, receivedAt = new Date()) {
  const dt = receivedAt.toISOString().slice(0, 10);
  return `raw/dt=${dt}/${logEntry.eventId || randomUUID()}.json`;
}

/**
 * Collapse duplicate level.started events within 500ms for backfill idempotency.
 */
export function collapseDuplicateStarts(events) {
  const kept = [];
  const seen = new Map();

  const sorted = [...events].sort((a, b) => {
    const at = Date.parse(a.clientSentAt || a.ts || 0);
    const bt = Date.parse(b.clientSentAt || b.ts || 0);
    return at - bt;
  });

  for (const event of sorted) {
    if (event.event !== "level.started") {
      kept.push(event);
      continue;
    }
    const bucket = Math.floor(Date.parse(event.clientSentAt || event.ts) / 500);
    const key = stableHash([
      event.teacherId,
      event.studentId,
      event.levelNumber,
      event.attemptNumber,
      bucket,
    ]);
    if (seen.has(key)) continue;
    seen.set(key, true);
    kept.push(event);
  }
  return kept;
}

/**
 * Legacy events were sent independently without session/attempt IDs and can
 * arrive slightly out of order. Correlate each student's ordered stream before
 * writing it to DynamoDB so task and summary events share the start IDs.
 */
export function correlateLegacyEvents(events) {
  const byStudent = new Map();
  for (const event of events) {
    const key = `${event.teacherId || ""}#${event.studentId || ""}`;
    if (!byStudent.has(key)) byStudent.set(key, []);
    byStudent.get(key).push({ ...event });
  }

  const correlated = [];
  for (const studentEvents of byStudent.values()) {
    studentEvents.sort(
      (a, b) =>
        Date.parse(a.clientSentAt || a.ts || 0) -
        Date.parse(b.clientSentAt || b.ts || 0),
    );
    let sessionId;
    let attempt;
    const attemptsByLevel = new Map();

    for (const event of studentEvents) {
      const sentAt = event.clientSentAt || event.ts;
      if (
        !event.sessionId &&
        (event.event === "practice.session_started" ||
          event.event === "free_play.started")
      ) {
        sessionId = `legacy-session-${stableHash([
          event.teacherId,
          event.studentId,
          sentAt,
        ])}`;
      }
      if (!event.sessionId && sessionId) event.sessionId = sessionId;

      if (event.event === "level.started") {
        const attemptId = `legacy-attempt-${stableHash([
          event.teacherId,
          event.studentId,
          event.levelNumber,
          event.attemptNumber,
          sentAt,
        ])}`;
        attempt = {
          attemptId,
          levelNumber: event.levelNumber,
          title: event.title,
          kind: event.kind,
          attemptNumber: event.attemptNumber,
        };
        attemptsByLevel.set(String(event.levelNumber), attempt);
      }

      const matchingAttempt =
        event.levelNumber !== undefined
          ? attemptsByLevel.get(String(event.levelNumber)) || attempt
          : attempt;
      if (
        !event.attemptId &&
        matchingAttempt &&
        (event.event?.startsWith("level.") || event.event?.startsWith("task."))
      ) {
        event.attemptId = matchingAttempt.attemptId;
        event.levelNumber ??= matchingAttempt.levelNumber;
        event.title ??= matchingAttempt.title;
        event.kind ??= matchingAttempt.kind;
        event.attemptNumber ??= matchingAttempt.attemptNumber;
      }

      correlated.push(event);
      if (
        event.event === "practice.session_ended" ||
        event.event === "free_play.ended"
      ) {
        sessionId = undefined;
      }
    }
  }

  return correlated;
}

export function parseS3JsonLine(raw) {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
}

export function normalizeStoredEvent(item) {
  if (!item) return null;
  return {
    teacherId: item.teacherId,
    studentId: item.studentId,
    studentLabel: item.studentLabel,
    event: item.event,
    clientSentAt: item.clientSentAt,
    eventId: item.eventId,
    sessionId: item.sessionId,
    attemptId: item.attemptId,
    timezone: item.timezone,
    legacy: Boolean(item.legacy),
    ...(item.payload || {}),
  };
}
