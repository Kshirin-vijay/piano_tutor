/**
 * The practice-history store: an in-memory snapshot (the read model for the UI
 * and the in-browser agent) that is persisted through the `ProgressRepository`
 * for the current user. UI reads stay synchronous even though persistence is
 * async, so a future remote backend changes nothing above this module.
 */

import type { AppEvent } from "../config/events";
import { getUserId } from "./identity";
import { progressRepository } from "./repository";
import {
  PROGRESS_VERSION,
  emptySnapshot,
} from "./types";
import type {
  LevelStat,
  NoteStat,
  ProgressSnapshot,
  RecordedEvent,
  SessionRecord,
  StageKind,
} from "./types";

/** A new session starts when this much idle time has passed since the last event. */
const IDLE_GAP_MS = 5 * 60 * 1000;
const RECENT_EVENTS_MAX = 500;
const SESSIONS_MAX = 100;

let snapshot: ProgressSnapshot = emptySnapshot();
const listeners = new Set<(s: ProgressSnapshot) => void>();

// Session/level tracking that is derived at runtime (not persisted directly).
let currentSessionId: string | null = null;
let lastEventAt = 0;
let currentLevel: { number: number; title: string; kind: StageKind } | null = null;

function makeId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Ensure all fields exist after loading older/partial data. */
function normalize(data: Partial<ProgressSnapshot> | null): ProgressSnapshot {
  const base = emptySnapshot();
  if (!data || data.version !== PROGRESS_VERSION) return base;
  return {
    version: PROGRESS_VERSION,
    totals: { ...base.totals, ...data.totals },
    perLevel: data.perLevel ?? {},
    perNote: data.perNote ?? {},
    sessions: data.sessions ?? [],
    recentEvents: data.recentEvents ?? [],
  };
}

function notify(): void {
  listeners.forEach((l) => l(snapshot));
}

function persist(): void {
  void progressRepository.persist(getUserId(), snapshot);
}

/** Load saved history for the current user. Call once at startup. */
export async function hydrateProgress(): Promise<void> {
  const data = await progressRepository.load(getUserId());
  snapshot = normalize(data);
  notify();
}

export function getProgress(): ProgressSnapshot {
  return snapshot;
}

export function subscribeProgress(listener: (s: ProgressSnapshot) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function ensureLevel(
  levelNumber: number,
  now: number,
  title?: string,
  kind?: StageKind
): LevelStat {
  let stat = snapshot.perLevel[levelNumber];
  if (!stat) {
    stat = {
      levelNumber,
      title: title ?? `Level ${levelNumber}`,
      kind: kind ?? "level",
      starts: 0,
      completions: 0,
      cleanCompletions: 0,
      replays: 0,
      successes: 0,
      mistakes: 0,
      firstPlayed: now,
      lastPlayed: now,
    };
    snapshot.perLevel[levelNumber] = stat;
  }
  if (title) stat.title = title;
  if (kind) stat.kind = kind;
  return stat;
}

function ensureNote(note: string): NoteStat {
  let stat = snapshot.perNote[note];
  if (!stat) {
    stat = { note, successes: 0, mistakes: 0, lastPlayed: 0 };
    snapshot.perNote[note] = stat;
  }
  return stat;
}

function currentSession(): SessionRecord | null {
  if (!currentSessionId) return null;
  return snapshot.sessions.find((s) => s.id === currentSessionId) ?? null;
}

function startSession(now: number): SessionRecord {
  const session: SessionRecord = {
    id: makeId(),
    startedAt: now,
    endedAt: now,
    levelsPlayed: [],
    successes: 0,
    mistakes: 0,
    completions: 0,
  };
  snapshot.sessions.push(session);
  if (snapshot.sessions.length > SESSIONS_MAX) {
    snapshot.sessions = snapshot.sessions.slice(-SESSIONS_MAX);
  }
  snapshot.totals.sessions += 1;
  currentSessionId = session.id;
  return session;
}

function touchSession(now: number): SessionRecord {
  const gapSinceLast = now - lastEventAt;
  let session = currentSession();
  if (!session || gapSinceLast > IDLE_GAP_MS) {
    session = startSession(now);
  } else {
    // Count only active time (gaps under the idle threshold) toward practice time.
    snapshot.totals.activeMs += gapSinceLast;
    session.endedAt = now;
  }
  return session;
}

/** Record one gameplay event into the history and persist. */
export function recordEvent(event: AppEvent): void {
  const now = Date.now();
  const session = touchSession(now);
  lastEventAt = now;

  switch (event.type) {
    case "level.started": {
      currentLevel = {
        number: event.levelNumber,
        title: event.title,
        kind: event.kind,
      };
      const stat = ensureLevel(event.levelNumber, now, event.title, event.kind);
      stat.starts += 1;
      stat.lastPlayed = now;
      if (!session.levelsPlayed.includes(event.levelNumber)) {
        session.levelsPlayed.push(event.levelNumber);
      }
      break;
    }
    case "level.completed": {
      const stat = ensureLevel(event.levelNumber, now, undefined, event.kind);
      stat.completions += 1;
      if (event.clean) stat.cleanCompletions += 1;
      stat.lastPlayed = now;
      snapshot.totals.completions += 1;
      session.completions += 1;
      break;
    }
    case "level.replayed": {
      const stat = ensureLevel(event.levelNumber, now);
      stat.replays += 1;
      stat.lastPlayed = now;
      break;
    }
    case "task.succeeded": {
      snapshot.totals.successes += 1;
      session.successes += 1;
      if (currentLevel) {
        const stat = ensureLevel(currentLevel.number, now);
        stat.successes += 1;
        stat.lastPlayed = now;
      }
      if (event.note) {
        const note = ensureNote(event.note);
        note.successes += 1;
        note.lastPlayed = now;
      }
      break;
    }
    case "task.mistake": {
      snapshot.totals.mistakes += 1;
      session.mistakes += 1;
      if (currentLevel) {
        const stat = ensureLevel(currentLevel.number, now);
        stat.mistakes += 1;
        stat.lastPlayed = now;
      }
      if (event.expected) {
        const note = ensureNote(event.expected);
        note.mistakes += 1;
        note.lastPlayed = now;
      }
      break;
    }
    case "hesitation":
      // Not aggregated yet; still kept in the recent-events log below.
      break;
  }

  const recorded: RecordedEvent = {
    at: now,
    event,
    levelNumber: currentLevel?.number,
  };
  snapshot.recentEvents.push(recorded);
  if (snapshot.recentEvents.length > RECENT_EVENTS_MAX) {
    snapshot.recentEvents = snapshot.recentEvents.slice(-RECENT_EVENTS_MAX);
  }

  // Replace the object reference so useSyncExternalStore sees a change.
  snapshot = { ...snapshot };
  persist();
  notify();
}

/** End the active session (e.g. on page hide), so the next event starts fresh. */
export function endSession(): void {
  currentSessionId = null;
  currentLevel = null;
}

/** Read helpers (also re-exported through agentApi). */
export function getSessions(): SessionRecord[] {
  return snapshot.sessions;
}

export function getPerLevelStats(): LevelStat[] {
  return Object.values(snapshot.perLevel).sort(
    (a, b) => a.levelNumber - b.levelNumber
  );
}

export function getPerNoteStats(): NoteStat[] {
  return Object.values(snapshot.perNote);
}

export function getRecentEvents(limit = 100): RecordedEvent[] {
  return snapshot.recentEvents.slice(-limit);
}

/** Wipe all practice history for the current user. */
export function clearProgress(): void {
  snapshot = emptySnapshot();
  currentSessionId = null;
  currentLevel = null;
  lastEventAt = 0;
  void progressRepository.clear(getUserId());
  notify();
}
