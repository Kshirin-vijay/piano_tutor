/**
 * Serializable shapes for the practice-history "memory". Everything here is
 * plain JSON so it can be persisted locally now, read by an in-browser agent,
 * and (in a later phase) synced to a per-user server backend unchanged.
 */

import type { AppEvent, StageKind } from "../config/events";

export type { StageKind };

/** Durable per-level aggregate (never trimmed). */
export interface LevelStat {
  levelNumber: number;
  title: string;
  kind: StageKind;
  starts: number;
  completions: number;
  cleanCompletions: number;
  replays: number;
  successes: number;
  mistakes: number;
  /** Sum of level.attempt_finished durationMs for this level. */
  totalPracticeMs: number;
  /** epoch ms */
  firstPlayed: number;
  /** epoch ms */
  lastPlayed: number;
}

/** Durable per-note aggregate (never trimmed). */
export interface NoteStat {
  note: string;
  successes: number;
  mistakes: number;
  /** epoch ms */
  lastPlayed: number;
}

/** One practice session, bounded by an idle gap or a page hide. */
export interface SessionRecord {
  id: string;
  /** epoch ms */
  startedAt: number;
  /** epoch ms */
  endedAt: number;
  levelsPlayed: number[];
  successes: number;
  mistakes: number;
  completions: number;
}

/** A single recorded event, kept in a capped rolling log for agent detail. */
export interface RecordedEvent {
  /** epoch ms */
  at: number;
  event: AppEvent;
  /** The level this event was attributed to, when known. */
  levelNumber?: number;
}

/** The whole practice memory for one user. */
export interface ProgressSnapshot {
  version: number;
  totals: {
    sessions: number;
    successes: number;
    mistakes: number;
    completions: number;
    /** Total active practice time in ms. */
    activeMs: number;
  };
  perLevel: Record<number, LevelStat>;
  perNote: Record<string, NoteStat>;
  /** Most recent sessions, capped. */
  sessions: SessionRecord[];
  /** Most recent raw events, capped. */
  recentEvents: RecordedEvent[];
}

export const PROGRESS_VERSION = 1;

export function emptySnapshot(): ProgressSnapshot {
  return {
    version: PROGRESS_VERSION,
    totals: { sessions: 0, successes: 0, mistakes: 0, completions: 0, activeMs: 0 },
    perLevel: {},
    perNote: {},
    sessions: [],
    recentEvents: [],
  };
}
