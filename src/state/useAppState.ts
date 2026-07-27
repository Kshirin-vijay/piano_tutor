import { useCallback, useEffect, useState } from "react";

const LEVEL_KEY = "pianoFriend.highestLevel";

function readLevel(): number {
  try {
    const v = Number(localStorage.getItem(LEVEL_KEY));
    return Number.isFinite(v) && v > 0 ? Math.floor(v) : 0;
  } catch {
    return 0;
  }
}

export function useAppState() {
  const [highestLevel, setHighestLevel] = useState<number>(() => readLevel());

  useEffect(() => {
    try {
      localStorage.setItem(LEVEL_KEY, String(highestLevel));
    } catch {
      /* storage unavailable; keep in-memory only */
    }
  }, [highestLevel]);

  /** Record that a level was completed, unlocking the next one. */
  const completeLevel = useCallback((levelIndex: number) => {
    setHighestLevel((prev) => Math.max(prev, levelIndex + 1));
  }, []);

  /** Clear saved progress so the child starts again from Level 1. */
  const resetProgress = useCallback(() => {
    setHighestLevel(0);
    try {
      localStorage.removeItem(LEVEL_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  return { highestLevel, completeLevel, resetProgress };
}
