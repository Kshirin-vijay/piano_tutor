/**
 * Wires the event bus to the practice-history store. Call `initProgressRecorder`
 * once at startup; it hydrates saved history, then records every emitted event.
 * The active session is ended when the page is hidden/closed so practice time
 * is not over-counted across long breaks.
 */

import { onEvent } from "../config/events";
import { initRemoteLogging, logAppEvent } from "../logging/remoteLog";
import { endSession, hydrateProgress, recordEvent } from "./progressStore";

let initialized = false;

export function initProgressRecorder(): void {
  if (initialized) return;
  initialized = true;

  void hydrateProgress();
  initRemoteLogging();
  onEvent(recordEvent);
  onEvent(logAppEvent);

  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") endSession();
    });
  }
  if (typeof window !== "undefined") {
    window.addEventListener("pagehide", endSession);
  }
}
