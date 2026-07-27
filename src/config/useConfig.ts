import { useSyncExternalStore } from "react";
import { getConfig, subscribeConfig } from "./appConfig";
import type { AppConfig } from "./appConfig";

/**
 * Reactively read the current config. Components re-render when any setting
 * changes (via an action), which a caregiver settings UI relies on. Reads that
 * happen at call time (like `speak()`) don't need this.
 */
export function useConfig(): AppConfig {
  return useSyncExternalStore(subscribeConfig, getConfig, getConfig);
}
