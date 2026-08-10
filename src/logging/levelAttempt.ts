/**
 * Tracks one level attempt and emits start, per-task, and finish events for
 * remote usage logging and the local progress store.
 */

import { emit } from "../config/events";
import type { AttemptOutcome, StageKind } from "../config/events";

export interface LevelAttemptConfig {
  levelNumber: number;
  title: string;
  kind: StageKind;
  attemptNumber: number;
  totalTasks: number;
  songId?: string;
  stageIndex?: number;
}

export class LevelAttemptTracker {
  private readonly config: LevelAttemptConfig;
  readonly attemptId = crypto.randomUUID();
  private readonly startedAt: number;
  private startTimer: number | null = null;
  private started = false;
  private ended = false;
  private taskSuccesses = 0;
  private taskMistakes = 0;
  private readonly mistakesByExpected: Record<string, number> = {};
  private readonly mistakesByWrongKey: Record<string, number> = {};

  constructor(config: LevelAttemptConfig) {
    this.config = config;
    this.startedAt = Date.now();
    // React StrictMode mounts and immediately unmounts effects once in
    // development. Delaying the start prevents that probe from creating a
    // duplicate attempt while still recording genuinely opened levels.
    this.startTimer = window.setTimeout(() => this.emitStart(), 250);
  }

  private context() {
    const { levelNumber, title, kind, attemptNumber, songId, stageIndex } =
      this.config;
    return {
      attemptId: this.attemptId,
      levelNumber,
      title,
      kind,
      attemptNumber,
      songId,
      stageIndex,
    };
  }

  private emitStart(): void {
    if (this.started || this.ended) return;
    this.started = true;
    if (this.startTimer !== null) {
      window.clearTimeout(this.startTimer);
      this.startTimer = null;
    }
    emit({
      type: "level.started",
      ...this.context(),
      totalTasks: this.config.totalTasks,
    });
  }

  recordSuccess(note?: string, taskIndex?: number): void {
    if (this.ended) return;
    this.emitStart();
    this.taskSuccesses += 1;
    emit({
      type: "task.succeeded",
      ...this.context(),
      note,
      taskIndex: taskIndex ?? 0,
    });
  }

  recordMistake(expected: string, got: string, taskIndex?: number): void {
    if (this.ended) return;
    this.emitStart();
    this.taskMistakes += 1;
    this.mistakesByExpected[expected] =
      (this.mistakesByExpected[expected] ?? 0) + 1;
    this.mistakesByWrongKey[got] = (this.mistakesByWrongKey[got] ?? 0) + 1;
    emit({
      type: "task.mistake",
      ...this.context(),
      expected,
      got,
      taskIndex: taskIndex ?? 0,
    });
  }

  finishAttempt(outcome: AttemptOutcome): void {
    if (this.ended) return;
    this.emitStart();
    this.ended = true;
    const { totalTasks } = this.config;
    const clean = outcome === "passed" && this.taskMistakes === 0;

    emit({
      type: "level.attempt_finished",
      ...this.context(),
      outcome,
      clean,
      durationMs: Date.now() - this.startedAt,
      taskSuccesses: this.taskSuccesses,
      taskMistakes: this.taskMistakes,
      totalTasks,
      mistakesByExpected: { ...this.mistakesByExpected },
      mistakesByWrongKey: { ...this.mistakesByWrongKey },
    });

    if (outcome === "replayed") {
      emit({ type: "level.replayed", ...this.context() });
      return;
    }

    emit({
      type: "level.completed",
      ...this.context(),
      clean,
    });
  }

  abandon(
    reason: "navigation" | "page_hidden" | "unmount" = "unmount"
  ): void {
    if (this.ended) return;
    if (!this.started) {
      if (this.startTimer !== null) window.clearTimeout(this.startTimer);
      this.startTimer = null;
      this.ended = true;
      return;
    }
    this.ended = true;
    emit({
      type: "level.abandoned",
      ...this.context(),
      durationMs: Date.now() - this.startedAt,
      taskSuccesses: this.taskSuccesses,
      taskMistakes: this.taskMistakes,
      totalTasks: this.config.totalTasks,
      reason,
      mistakesByExpected: { ...this.mistakesByExpected },
      mistakesByWrongKey: { ...this.mistakesByWrongKey },
    });
  }
}
