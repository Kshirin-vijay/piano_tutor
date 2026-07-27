import { useCallback, useEffect, useRef, useState } from "react";
import type { Level, Task } from "../levels/levels";
import type { NoteName } from "../audio/piano";
import {
  playSuccessChime,
  startNote,
  stopNote,
} from "../audio/piano";
import { getConfig } from "../config/appConfig";
import { LevelAttemptTracker } from "../logging/levelAttempt";

/**
 * Length of one count (beat) in milliseconds, read live from config so a
 * caregiver or the agent can slow the tempo for a calmer pace. Read at the
 * moment a task starts. Default is 250ms (1 count = 1/4s).
 */
export function getCountMs(): number {
  return getConfig().tempo.countMs;
}
/** How long the short between-task praise is shown. */
const PRAISE_MS = 1300;
/** How long the end-of-level celebration is shown before advancing. */
const LEVEL_DONE_MS = 2600;

export type Phase = "playing" | "praise" | "levelComplete";

export interface EngineView {
  task: Task | undefined;
  taskIndex: number;
  totalTasks: number;
  phase: Phase;
  /** The note the child should press now (drives the glow), or null. */
  targetNote: NoteName | null;
  /** Tap progress for the current tap task. */
  tapsDone: number;
  tapsRequired: number;
  /** Hold progress for the current hold task. */
  heldMs: number;
  requiredCounts: number;
  /** True when the child released a hold early; progress is frozen, not reset. */
  holdPaused: boolean;
  /** Increments on every successful task, to retrigger praise animations. */
  praiseTick: number;
  /** True at level end when a wrong key was pressed, so the level will replay. */
  repeatPending: boolean;
  onKeyDown: (note: NoteName) => void;
  onKeyUp: (note: NoteName) => void;
}

interface EngineOptions {
  /** Songs play straight through: no per-note chime or praise, only a final celebration. */
  continuous?: boolean;
}

export function useLevelEngine(
  level: Level,
  onLevelComplete: () => void,
  options: EngineOptions = {}
): EngineView {
  const { continuous = false } = options;
  const [taskIndex, setTaskIndex] = useState(0);
  const [tapsDone, setTapsDone] = useState(0);
  const [heldMs, setHeldMs] = useState(0);
  const [holdPaused, setHoldPaused] = useState(false);
  const [phase, setPhase] = useState<Phase>("playing");
  const [praiseTick, setPraiseTick] = useState(0);
  // Bumped to replay the same level when it was not completed cleanly.
  const [attemptKey, setAttemptKey] = useState(0);
  const [repeatPending, setRepeatPending] = useState(false);
  // True once a wrong key is pressed during this attempt (skip songs).
  const hadMistakeRef = useRef(false);

  const holdRef = useRef<{ note: NoteName; start: number } | null>(null);
  // Time already held for the current task across press/release segments.
  const accumulatedRef = useRef(0);
  const intervalRef = useRef<number | null>(null);
  const timeoutRef = useRef<number | null>(null);
  const tapsRef = useRef(0);
  const trackerRef = useRef<LevelAttemptTracker | null>(null);

  const clearHoldTimer = useCallback(() => {
    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // Reset everything when the level changes or a replay is triggered.
  useEffect(() => {
    setTaskIndex(0);
    setTapsDone(0);
    tapsRef.current = 0;
    setHeldMs(0);
    setHoldPaused(false);
    accumulatedRef.current = 0;
    setPhase("playing");
    setRepeatPending(false);
    hadMistakeRef.current = false;
    holdRef.current = null;
    clearHoldTimer();
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, [level, attemptKey, clearHoldTimer]);

  useEffect(() => {
    trackerRef.current = new LevelAttemptTracker({
      levelNumber: level.number,
      title: level.title,
      kind: continuous ? "song" : "level",
      attemptNumber: attemptKey + 1,
      totalTasks: level.tasks.length,
    });
  }, [level, continuous, attemptKey]);

  // Cleanup timers on unmount.
  useEffect(() => {
    return () => {
      clearHoldTimer();
      if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
    };
  }, [clearHoldTimer]);

  const task = level.tasks[taskIndex];

  const succeedTask = useCallback(() => {
    const current = level.tasks[taskIndex];
    trackerRef.current?.recordSuccess(
      current && current.type !== "rest" ? current.note : undefined,
      taskIndex
    );
    clearHoldTimer();
    holdRef.current = null;
    accumulatedRef.current = 0;
    tapsRef.current = 0;
    setHeldMs(0);
    setHoldPaused(false);
    setTapsDone(0);

    const isLast = taskIndex >= level.tasks.length - 1;

    if (isLast) {
      // Advance only on a clean run; otherwise replay this same level.
      // Songs (continuous) always advance.
      const willRepeat = !continuous && hadMistakeRef.current;
      playSuccessChime();
      setPraiseTick((t) => t + 1);
      setRepeatPending(willRepeat);
      setPhase("levelComplete");
      timeoutRef.current = window.setTimeout(() => {
        if (willRepeat) {
          trackerRef.current?.finishAttempt("replayed");
          setAttemptKey((k) => k + 1);
        } else {
          trackerRef.current?.finishAttempt("passed");
          onLevelComplete();
        }
      }, LEVEL_DONE_MS);
    } else if (continuous) {
      // Songs flow straight to the next note: no chime, no praise.
      setTaskIndex((i) => i + 1);
      setPhase("playing");
    } else {
      // Levels: gentle chime + short "Great job!" between steps.
      playSuccessChime();
      setPraiseTick((t) => t + 1);
      setPhase("praise");
      timeoutRef.current = window.setTimeout(() => {
        setTaskIndex((i) => i + 1);
        setPhase("playing");
      }, PRAISE_MS);
    }
  }, [
    taskIndex,
    level.tasks,
    level.number,
    onLevelComplete,
    clearHoldTimer,
    continuous,
  ]);

  // Auto-advance through a silent rest (no key needed, no glow).
  useEffect(() => {
    if (phase !== "playing" || !task || task.type !== "rest") return;
    const required = task.counts * getCountMs();
    const startedAt = performance.now();
    setHeldMs(0);
    const id = window.setInterval(() => {
      const elapsed = performance.now() - startedAt;
      setHeldMs(elapsed);
      if (elapsed >= required) {
        window.clearInterval(id);
        succeedTask();
      }
    }, 50);
    return () => window.clearInterval(id);
  }, [phase, task, succeedTask]);

  const onKeyDown = useCallback(
    (note: NoteName) => {
      // Sound always plays for an active key so exploration feels natural.
      startNote(note);
      if (phase !== "playing" || !task) return;

      // A wrong key on a tap/hold task marks the attempt (so the level will
      // replay at the end). Songs (continuous) never flag.
      if (
        !continuous &&
        (task.type === "tap" || task.type === "hold") &&
        note !== task.note
      ) {
        hadMistakeRef.current = true;
        trackerRef.current?.recordMistake(task.note, note, taskIndex);
      }

      if (task.type === "hold" && note === task.note) {
        // Each press starts a fresh hold; an early release resets progress.
        setHoldPaused(false);
        holdRef.current = { note, start: performance.now() };
        clearHoldTimer();
        const required = task.counts * getCountMs();
        intervalRef.current = window.setInterval(() => {
          if (!holdRef.current) return;
          const elapsed =
            accumulatedRef.current +
            (performance.now() - holdRef.current.start);
          setHeldMs(elapsed);
          if (elapsed >= required) {
            // Keep the note sounding until the child actually releases the key.
            succeedTask();
          }
        }, 50);
      }
    },
    [phase, task, clearHoldTimer, succeedTask, continuous]
  );

  const onKeyUp = useCallback(
    (note: NoteName) => {
      stopNote(note);
      if (phase !== "playing" || !task) return;

      if (task.type === "tap" && note === task.note) {
        tapsRef.current += 1;
        if (tapsRef.current >= task.times) {
          tapsRef.current = 0;
          succeedTask();
        } else {
          setTapsDone(tapsRef.current);
        }
      } else if (task.type === "hold" && note === task.note) {
        // Released before reaching the count: restart this hold from zero.
        // A hold must be one continuous press (no accumulating across taps).
        if (holdRef.current) {
          holdRef.current = null;
          clearHoldTimer();
          accumulatedRef.current = 0;
          setHeldMs(0);
          setHoldPaused(false);
        }
      }
    },
    [phase, task, succeedTask, clearHoldTimer]
  );

  const targetNote =
    phase === "playing" && task && task.type !== "rest" ? task.note : null;

  return {
    task,
    taskIndex,
    totalTasks: level.tasks.length,
    phase,
    targetNote,
    tapsDone,
    tapsRequired: task?.type === "tap" ? task.times : 0,
    heldMs,
    requiredCounts:
      task?.type === "hold" || task?.type === "rest" ? task.counts : 0,
    holdPaused,
    praiseTick,
    repeatPending,
    onKeyDown,
    onKeyUp,
  };
}
