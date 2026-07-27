/**
 * Single facade for a future AI agent (or any external integration).
 *
 * An agent only needs this one module to:
 *   - learn what it can change ............ getSchema()
 *   - read current state .................. getConfig()
 *   - change state safely ................. setConfigValue() / resetConfig()
 *   - author new spoken content ........... addPhrase()
 *   - observe gameplay signals ............ onEvent()
 *   - read past practice (memory) ......... getProgress() and friends
 *
 * Adding the agent later is wiring against this surface, not refactoring the
 * app. The self-regulation loop is: read history + onEvent(...) -> decide ->
 * setConfigValue().
 */

export { getConfig, setConfigValue, resetConfig, addPhrase } from "./actions";
export type { ActionResult } from "./actions";
export { getSchema } from "./schema";
export type { Setting, SettingPath } from "./schema";
export { onEvent } from "./events";
export type { AppEvent, EventType } from "./events";
export type { AppConfig } from "./appConfig";

// Practice history (the "memory of past practice").
export {
  getProgress,
  getSessions,
  getPerLevelStats,
  getPerNoteStats,
  getRecentEvents,
  clearProgress,
} from "../progress/progressStore";
export type {
  ProgressSnapshot,
  LevelStat,
  NoteStat,
  SessionRecord,
  RecordedEvent,
} from "../progress/types";
