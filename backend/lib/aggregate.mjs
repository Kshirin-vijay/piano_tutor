import { formatDateInTimezone } from "./dates.mjs";
import { stableHash } from "./crypto.mjs";

const HEARTBEAT_MS = 60_000;
const ACTIVE_GAP_MS = 90_000;
const SESSION_START_EVENTS = new Set(["practice.session_started", "free_play.started"]);
const SESSION_END_EVENTS = new Set([
  "practice.session_ended",
  "free_play.ended",
]);

function eventTimestamp(event) {
  return event.clientSentAt || event.ts;
}

function compareEvents(a, b) {
  return Date.parse(eventTimestamp(a)) - Date.parse(eventTimestamp(b));
}

function levelKey(event) {
  if (event.songId) return `song:${event.songId}`;
  if (event.kind === "song" || event.levelNumber === 0) {
    const title = (event.title || "unknown").toLowerCase().replace(/[^a-z0-9]+/g, "-");
    return `legacy:${title || "unknown"}`;
  }
  if (event.levelNumber !== undefined) return `level:${event.levelNumber}`;
  return "unknown";
}

function ensureMap(map, key, factory) {
  if (!map.has(key)) map.set(key, factory());
  return map.get(key);
}

function deriveAttemptIdForEvent(event) {
  if (event.attemptId) return event.attemptId;
  const ts = eventTimestamp(event);
  const bucket = Math.floor(Date.parse(ts) / 500) * 500;
  return `legacy-attempt-${stableHash([
    event.teacherId,
    event.studentId,
    event.levelNumber,
    event.attemptNumber,
    bucket,
  ])}`;
}

function deriveSessionIdForEvent(event, openSessions) {
  if (event.sessionId) return event.sessionId;
  const ts = Date.parse(eventTimestamp(event));
  for (const [sessionId, meta] of openSessions.entries()) {
    if (meta.studentId === event.studentId && ts >= meta.startedAt && !meta.closed) {
      return sessionId;
    }
  }
  if (SESSION_START_EVENTS.has(event.event)) {
    return `legacy-session-${stableHash([event.teacherId, event.studentId, eventTimestamp(event)])}`;
  }
  return undefined;
}

function initAttempt(event) {
  return {
    attemptId: deriveAttemptIdForEvent(event),
    levelKey: levelKey(event),
    levelNumber: event.levelNumber,
    title: event.title || "Unknown",
    kind: event.kind || "level",
    songId: event.songId,
    startedAt: eventTimestamp(event),
    finishedAt: null,
    outcome: null,
    clean: false,
    durationMs: 0,
    durationQuality: "partial",
    taskSuccesses: 0,
    taskMistakes: 0,
    mistakesByExpected: {},
    mistakesByWrongKey: {},
    completed: false,
    abandoned: false,
    legacy: Boolean(event.legacy),
    summaryCaptured: false,
  };
}

function mergeMistakeMaps(target, source = {}) {
  for (const [note, count] of Object.entries(source)) {
    target[note] = (target[note] || 0) + count;
  }
}

function computeHeartbeatActiveMs(events, sessionEndedDurationMs) {
  const heartbeats = events
    .filter((e) => e.event === "activity.heartbeat")
    .sort(compareEvents);

  if (heartbeats.length === 0) {
    if (sessionEndedDurationMs > 0) {
      return { ms: sessionEndedDurationMs, quality: "estimated" };
    }
    return { ms: 0, quality: "partial" };
  }

  let total = 0;
  let lastElapsed = 0;
  for (const hb of heartbeats) {
    const elapsed = Number(hb.elapsedMs || hb.payload?.elapsedMs || 0);
    const delta = Math.max(0, Math.min(HEARTBEAT_MS, elapsed - lastElapsed));
    total += delta > 0 ? delta : HEARTBEAT_MS;
    lastElapsed = elapsed;
  }

  if (sessionEndedDurationMs > lastElapsed) {
    total += Math.min(HEARTBEAT_MS, sessionEndedDurationMs - lastElapsed);
  }

  return { ms: total, quality: heartbeats.some((h) => h.legacy) ? "estimated" : "measured" };
}

function aggregateSessions(studentEvents) {
  const sorted = [...studentEvents].sort(compareEvents);
  const openSessions = new Map();
  const sessions = [];

  for (const event of sorted) {
    const ts = Date.parse(eventTimestamp(event));
    let sessionId = deriveSessionIdForEvent(event, openSessions);

    if (SESSION_START_EVENTS.has(event.event)) {
      for (const [openId, open] of openSessions.entries()) {
        if (open.studentId === event.studentId && !open.closed) {
          sessions.push({ sessionId: openId, ...open, closed: false });
          openSessions.delete(openId);
        }
      }
      sessionId =
        event.sessionId ||
        `legacy-session-${stableHash([event.teacherId, event.studentId, eventTimestamp(event)])}`;
      openSessions.set(sessionId, {
        studentId: event.studentId,
        mode: event.event === "free_play.started" ? "free_play" : "practice",
        startedAt: ts,
        closed: false,
        events: [event],
        endedDurationMs: 0,
        legacy: Boolean(event.legacy),
      });
      continue;
    }

    if (!sessionId) continue;
    const session = openSessions.get(sessionId);
    if (!session) continue;
    session.events.push(event);
    if (event.legacy) session.legacy = true;

    if (SESSION_END_EVENTS.has(event.event)) {
      session.closed = true;
      session.endedDurationMs = Number(event.durationMs || 0);
      if (event.legacy) session.legacy = true;
      sessions.push({ sessionId, ...session });
      openSessions.delete(sessionId);
    } else if (event.event === "activity.heartbeat") {
      const prev = session.events[session.events.length - 2];
      if (prev) {
        const gap = ts - Date.parse(eventTimestamp(prev));
        if (gap > ACTIVE_GAP_MS) session.gapExceeded = true;
      }
    }
  }

  for (const [sessionId, session] of openSessions.entries()) {
    sessions.push({ sessionId, ...session, closed: false });
  }

  return sessions;
}

function aggregateAttempts(studentEvents) {
  const sorted = [...studentEvents].sort(compareEvents);
  const attempts = new Map();
  let currentLegacyAttemptId;

  for (const event of sorted) {
    const isLevelScoped =
      event.event?.startsWith("level.") || event.event?.startsWith("task.");
    if (!isLevelScoped) continue;

    let attemptId = event.attemptId;
    if (!attemptId && event.event === "level.started") {
      attemptId = deriveAttemptIdForEvent(event);
      currentLegacyAttemptId = attemptId;
    } else if (!attemptId && currentLegacyAttemptId) {
      attemptId = currentLegacyAttemptId;
    } else if (!attemptId) {
      attemptId = deriveAttemptIdForEvent(event);
    }
    const attempt = ensureMap(attempts, attemptId, () => initAttempt(event));

    if (event.event === "level.started") {
      attempt.startedAt = eventTimestamp(event);
      attempt.title = event.title || attempt.title;
      attempt.kind = event.kind || attempt.kind;
      attempt.levelKey = levelKey(event);
      attempt.legacy = attempt.legacy || Boolean(event.legacy);
    }

    if (event.event === "task.succeeded") {
      attempt.taskSuccesses += 1;
    }

    if (event.event === "task.mistake") {
      attempt.taskMistakes += 1;
      if (!attempt.summaryCaptured) {
        if (event.expected) {
          attempt.mistakesByExpected[event.expected] =
            (attempt.mistakesByExpected[event.expected] || 0) + 1;
        }
        if (event.got) {
          attempt.mistakesByWrongKey[event.got] =
            (attempt.mistakesByWrongKey[event.got] || 0) + 1;
        }
      }
    }

    if (event.event === "level.attempt_finished") {
      attempt.finishedAt = eventTimestamp(event);
      attempt.outcome = event.outcome;
      attempt.clean = Boolean(event.clean);
      attempt.durationMs = Number(event.durationMs || 0);
      attempt.durationQuality = event.legacy ? "estimated" : "measured";
      attempt.taskSuccesses = Number(event.taskSuccesses ?? attempt.taskSuccesses);
      attempt.taskMistakes = Number(event.taskMistakes ?? attempt.taskMistakes);
      attempt.mistakesByExpected = { ...(event.mistakesByExpected || {}) };
      attempt.mistakesByWrongKey = { ...(event.mistakesByWrongKey || {}) };
      attempt.summaryCaptured = true;
      if (event.outcome === "passed") attempt.completed = true;
    }

    if (event.event === "level.completed") {
      attempt.completed = true;
      attempt.clean = Boolean(event.clean);
    }

    if (event.event === "level.abandoned") {
      attempt.abandoned = true;
      attempt.finishedAt = eventTimestamp(event);
      attempt.durationMs = Number(event.durationMs || 0);
      attempt.durationQuality = event.legacy ? "estimated" : "measured";
      attempt.taskSuccesses = Number(event.taskSuccesses ?? attempt.taskSuccesses);
      attempt.taskMistakes = Number(event.taskMistakes ?? attempt.taskMistakes);
      attempt.mistakesByExpected = { ...(event.mistakesByExpected || attempt.mistakesByExpected) };
      attempt.mistakesByWrongKey = { ...(event.mistakesByWrongKey || attempt.mistakesByWrongKey) };
      attempt.summaryCaptured = true;
    }
  }

  return [...attempts.values()];
}

function initDayBucket() {
  return {
    activeTimeMs: 0,
    timeQuality: "measured",
    eventCount: 0,
    levelsStarted: new Set(),
    levelsCompleted: new Set(),
    levelsAbandoned: new Set(),
    totalMistakes: 0,
    lastActivityAt: null,
    levels: new Map(),
    partialData: false,
    attemptDurationFallbackMs: 0,
  };
}

function finalizeLevel(level) {
  return {
    levelKey: level.levelKey,
    title: level.title,
    kind: level.kind,
    attempts: level.attempts,
    completed: level.completed,
    abandoned: level.abandoned,
    durationMs: level.durationMs,
    durationQuality: level.durationQuality,
    mistakes: level.mistakes,
    mistakesByExpected: level.mistakesByExpected,
    mistakesByWrongKey: level.mistakesByWrongKey,
    partialData: level.partialData,
  };
}

function finalizeDay(day) {
  const timeQualities = new Set([day.timeQuality]);
  if (day.partialData) timeQualities.add("partial");
  let timeQuality = "measured";
  if (timeQualities.has("partial")) timeQuality = "partial";
  else if (timeQualities.has("estimated")) timeQuality = "estimated";

  return {
    activeTimeMs: day.activeTimeMs,
    timeQuality,
    eventCount: day.eventCount,
    levelsStarted: day.levelStartedCount ?? day.levelsStarted.size,
    levelsCompleted: day.levelsCompleted.size,
    levelsAbandoned: day.levelsAbandoned.size,
    totalMistakes: day.totalMistakes,
    lastActivityAt: day.lastActivityAt,
    partialData: day.partialData,
    levels: [...day.levels.values()].map(finalizeLevel),
  };
}

export function aggregateTeacherReport({
  events,
  rosterByTeacher,
  teacherIds,
  from,
  to,
  timezone,
}) {
  const eventsByTeacher = new Map();
  for (const event of events) {
    if (!event.teacherId || !event.studentId) continue;
    ensureMap(eventsByTeacher, event.teacherId, () => []).push(event);
  }

  const teachers = [];
  let reportPartial = false;

  for (const teacherId of teacherIds) {
    const roster = rosterByTeacher.get(teacherId) || {
      teacherId,
      teacherName: teacherId,
      students: [],
    };
    const teacherEvents = eventsByTeacher.get(teacherId) || [];

    if (teacherId === "public") {
      teachers.push({
        teacherId,
        teacherName: roster.teacherName || "Public practice",
        students: [],
        note: "See public rollup for anonymous aggregate activity.",
      });
      continue;
    }

    const studentIds = new Set(roster.students.map((s) => `${teacherId}__${s.id}`));
    for (const event of teacherEvents) studentIds.add(event.studentId);

    const students = [];
    for (const studentId of studentIds) {
      const rosterStudent = roster.students.find((s) => `${teacherId}__${s.id}` === studentId);
      const label = rosterStudent?.label || inferStudentLabel(teacherEvents, studentId);
      const studentEvents = teacherEvents.filter((e) => e.studentId === studentId);
      const studentReport = aggregateStudent(studentEvents, from, to, timezone);
      if (studentReport.partialData) reportPartial = true;
      students.push({
        studentId,
        label,
        days: studentReport.days,
        summary: studentReport.summary,
        partialData: studentReport.partialData,
      });
    }

    students.sort((a, b) => a.label.localeCompare(b.label));
    teachers.push({
      teacherId,
      teacherName: roster.teacherName || teacherId,
      students,
    });
  }

  const publicReport = aggregatePublic(events, from, to, timezone);
  if (publicReport.partialData) reportPartial = true;

  return {
    from,
    to,
    timezone,
    partialData: reportPartial,
    teachers,
    public: publicReport,
  };
}

function inferStudentLabel(events, studentId) {
  const match = events.find((e) => e.studentId === studentId && e.studentLabel);
  return match?.studentLabel || studentId.split("__").pop() || "Student";
}

function aggregateStudent(studentEvents, from, to, timezone) {
  const days = new Map();
  const sessions = aggregateSessions(studentEvents);
  const attempts = aggregateAttempts(studentEvents);

  for (const session of sessions) {
    const localDay = formatDateInTimezone(eventTimestamp(session.events[0]), timezone);
    if (localDay < from || localDay > to) continue;
    const day = ensureMap(days, localDay, initDayBucket);
    const { ms, quality } = computeHeartbeatActiveMs(session.events, session.endedDurationMs);
    day.activeTimeMs += ms;
    if (quality !== "measured") day.timeQuality = quality;
    if (!session.closed || session.legacy) day.partialData = true;
    day.eventCount += session.events.length;
    day.lastActivityAt = maxIso(day.lastActivityAt, eventTimestamp(session.events.at(-1)));
  }

  for (const attempt of attempts) {
    const localDay = formatDateInTimezone(attempt.startedAt, timezone);
    if (localDay < from || localDay > to) continue;
    const day = ensureMap(days, localDay, initDayBucket);
    day.levelsStarted.add(attempt.levelKey);
    if (attempt.completed) day.levelsCompleted.add(attempt.levelKey);
    if (attempt.abandoned) day.levelsAbandoned.add(attempt.levelKey);
    day.totalMistakes += attempt.taskMistakes;
    day.attemptDurationFallbackMs += attempt.durationMs;
    day.lastActivityAt = maxIso(day.lastActivityAt, attempt.finishedAt || attempt.startedAt);
    if (attempt.legacy) day.partialData = true;

    const level = ensureMap(day.levels, attempt.levelKey, () => ({
      levelKey: attempt.levelKey,
      title: attempt.title,
      kind: attempt.kind,
      attempts: 0,
      completed: false,
      abandoned: false,
      durationMs: 0,
      durationQuality: "partial",
      mistakes: 0,
      mistakesByExpected: {},
      mistakesByWrongKey: {},
      partialData: false,
    }));

    level.attempts += 1;
    level.completed = level.completed || attempt.completed;
    level.abandoned = level.abandoned || attempt.abandoned;
    level.durationMs += attempt.durationMs;
    level.mistakes += attempt.taskMistakes;
    mergeMistakeMaps(level.mistakesByExpected, attempt.mistakesByExpected);
    mergeMistakeMaps(level.mistakesByWrongKey, attempt.mistakesByWrongKey);
    if (attempt.durationQuality !== "measured") level.durationQuality = attempt.durationQuality;
    if (attempt.legacy) level.partialData = true;
  }

  const dayList = [];
  let summaryActive = 0;
  let summaryMistakes = 0;
  let summaryLevelsStarted = new Set();
  let summaryLevelsCompleted = new Set();
  let partialData = false;

  for (let cursor = from; cursor <= to; cursor = addDay(cursor, 1)) {
    const bucket = days.get(cursor);
    if (!bucket) {
      dayList.push({
        date: cursor,
        activeTimeMs: 0,
        timeQuality: "measured",
        eventCount: 0,
        levelsStarted: 0,
        levelsCompleted: 0,
        levelsAbandoned: 0,
        totalMistakes: 0,
        lastActivityAt: null,
        partialData: false,
        levels: [],
      });
      continue;
    }
    bucket.levelStartedCount = bucket.levelsStarted.size;
    if (bucket.activeTimeMs === 0 && bucket.attemptDurationFallbackMs > 0) {
      bucket.activeTimeMs = bucket.attemptDurationFallbackMs;
      bucket.timeQuality = "estimated";
      bucket.partialData = true;
    }
    const finalized = finalizeDay(bucket);
    dayList.push({ date: cursor, ...finalized });
    summaryActive += finalized.activeTimeMs;
    summaryMistakes += finalized.totalMistakes;
    for (const key of bucket.levelsStarted) summaryLevelsStarted.add(key);
    for (const key of bucket.levelsCompleted) summaryLevelsCompleted.add(key);
    if (finalized.partialData) partialData = true;
  }

  return {
    days: dayList,
    summary: {
      activeTimeMs: summaryActive,
      totalMistakes: summaryMistakes,
      levelsStarted: summaryLevelsStarted.size,
      levelsCompleted: summaryLevelsCompleted.size,
      activeDays: dayList.filter((d) => d.activeTimeMs > 0 || d.eventCount > 0).length,
      partialData,
    },
    partialData,
  };
}

function aggregatePublic(events, from, to, timezone) {
  const publicEvents = events.filter((e) => e.teacherId === "public");
  const days = new Map();

  for (const session of aggregateSessions(publicEvents)) {
    const localDay = formatDateInTimezone(eventTimestamp(session.events[0]), timezone);
    if (localDay < from || localDay > to) continue;
    const day = ensureMap(days, localDay, () => ({
      activeTimeMs: 0,
      eventCount: 0,
      timeQuality: "measured",
      partialData: false,
    }));
    const { ms, quality } = computeHeartbeatActiveMs(session.events, session.endedDurationMs);
    day.activeTimeMs += ms;
    day.eventCount += session.events.length;
    if (quality !== "measured") day.timeQuality = quality;
    if (!session.closed || session.legacy) day.partialData = true;
  }

  const dayList = [];
  let partialData = false;
  for (let cursor = from; cursor <= to; cursor = addDay(cursor, 1)) {
    const bucket = days.get(cursor);
    if (!bucket) {
      dayList.push({
        date: cursor,
        activeTimeMs: 0,
        eventCount: 0,
        timeQuality: "measured",
        partialData: false,
      });
      continue;
    }
    dayList.push({ date: cursor, ...bucket });
    if (bucket.partialData) partialData = true;
  }

  return { days: dayList, partialData };
}

function maxIso(a, b) {
  if (!a) return b || null;
  if (!b) return a;
  return Date.parse(a) >= Date.parse(b) ? a : b;
}

function addDay(isoDate, days) {
  const [y, m, d] = isoDate.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}
