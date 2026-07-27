import { useSyncExternalStore } from "react";
import { getProgress, subscribeProgress } from "./progressStore";
import type { ProgressSnapshot } from "./types";

/** Reactively read the practice-history snapshot in a component. */
export function useProgress(): ProgressSnapshot {
  return useSyncExternalStore(subscribeProgress, getProgress, getProgress);
}
