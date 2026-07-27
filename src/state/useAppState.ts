import { useCallback, useEffect, useState } from "react";
import { getUserId } from "../progress/identity";

const LEVEL_KEY_PREFIX = "pianoFriend.highestLevel.";

function levelKey(): string {
  return LEVEL_KEY_PREFIX + getUserId();
}

function readLevel(): number {
  try {
    const v = Number(localStorage.getItem(levelKey()));
    return Number.isFinite(v) && v > 0 ? Math.floor(v) : 0;
  } catch {
    return 0;
  }
}

export function useAppState() {
  const [highestLevel, setHighestLevel] = useState<number>(() => readLevel());

  useEffect(() => {
    try {
      localStorage.setItem(levelKey(), String(highestLevel));
    } catch {
      /* storage unavailable; keep in-memory only */
    }
  }, [highestLevel]);

  /** Call after switching students so level progress reloads. */
  const reloadForLearner = useCallback(() => {
    setHighestLevel(readLevel());
  }, []);

  /** Record that a level was completed, unlocking the next one. */
  const completeLevel = useCallback((levelIndex: number) => {
    setHighestLevel((prev) => Math.max(prev, levelIndex + 1));
  }, []);

  /** Clear saved progress so the child starts again from Level 1. */
  const resetProgress = useCallback(() => {
    setHighestLevel(0);
    try {
      localStorage.removeItem(levelKey());
    } catch {
      /* ignore */
    }
  }, []);

  return { highestLevel, completeLevel, resetProgress, reloadForLearner };
}
