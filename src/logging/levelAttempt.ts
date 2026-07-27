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
}

export class LevelAttemptTracker {
  private readonly config: LevelAttemptConfig;
  private readonly startedAt: number;
  private taskSuccesses = 0;
  private taskMistakes = 0;
  private readonly mistakesByExpected: Record<string, number> = {};
  private readonly mistakesByWrongKey: Record<string, number> = {};

  constructor(config: LevelAttemptConfig) {
    this.config = config;
    this.startedAt = Date.now();
    emit({
      type: "level.started",
      levelNumber: config.levelNumber,
      title: config.title,
      kind: config.kind,
      attemptNumber: config.attemptNumber,
      totalTasks: config.totalTasks,
    });
  }

  recordSuccess(note?: string, taskIndex?: number): void {
    this.taskSuccesses += 1;
    emit({
      type: "task.succeeded",
      note,
      taskIndex: taskIndex ?? 0,
    });
  }

  recordMistake(expected: string, got: string, taskIndex?: number): void {
    this.taskMistakes += 1;
    this.mistakesByExpected[expected] =
      (this.mistakesByExpected[expected] ?? 0) + 1;
    this.mistakesByWrongKey[got] = (this.mistakesByWrongKey[got] ?? 0) + 1;
    emit({
      type: "task.mistake",
      expected,
      got,
      taskIndex: taskIndex ?? 0,
    });
  }

  finishAttempt(outcome: AttemptOutcome): void {
    const { levelNumber, title, kind, attemptNumber, totalTasks } = this.config;
    const clean = outcome === "passed" && this.taskMistakes === 0;

    emit({
      type: "level.attempt_finished",
      levelNumber,
      title,
      kind,
      attemptNumber,
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
      emit({ type: "level.replayed", levelNumber });
      return;
    }

    emit({
      type: "level.completed",
      levelNumber,
      kind,
      clean,
    });
  }
}
