import type { AppEvent } from "../config/events";
import {
  getStudentId,
  getStudentLabel,
  getTeacherId,
} from "../progress/identity";
import { flushLogQueue, queueLog } from "./logQueue";

const LOG_ENDPOINT = import.meta.env.VITE_LOG_ENDPOINT as string | undefined;
const HEARTBEAT_MS = 60_000;
const ACTIVE_WINDOW_MS = 90_000;

type SessionMode = "practice" | "free_play";

let sessionId: string | null = null;
let sessionMode: SessionMode | null = null;
let sessionStartedAt = 0;
let heartbeatTimer: number | null = null;
let lastInteractionAt = Date.now();
let initialized = false;

function canLog(): boolean {
  return Boolean(LOG_ENDPOINT && getTeacherId() && getStudentId());
}

function timezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

function postLog(
  payload: Record<string, unknown>,
  options: { keepalive?: boolean; session?: string | null } = {}
): void {
  if (!canLog()) return;

  const eventId = crypto.randomUUID();
  queueLog({
    eventId,
    endpoint: LOG_ENDPOINT!,
    payload: {
      eventId,
      clientSentAt: new Date().toISOString(),
      timezone: timezone(),
      sessionId: options.session === undefined ? sessionId : options.session,
      teacherId: getTeacherId(),
      studentId: getStudentId(),
      studentLabel: getStudentLabel(),
      ...payload,
    },
  }, options.keepalive);
}

function stopHeartbeat(): void {
  if (heartbeatTimer !== null) window.clearInterval(heartbeatTimer);
  heartbeatTimer = null;
}

function startHeartbeat(): void {
  stopHeartbeat();
  heartbeatTimer = window.setInterval(() => {
    if (
      sessionId &&
      document.visibilityState === "visible" &&
      Date.now() - lastInteractionAt <= ACTIVE_WINDOW_MS
    ) {
      postLog({
        event: "activity.heartbeat",
        mode: sessionMode,
        elapsedMs: Date.now() - sessionStartedAt,
      });
    }
  }, HEARTBEAT_MS);
}

function beginSession(mode: SessionMode): string {
  if (sessionId) endLoggingSession("mode_changed");
  sessionId = crypto.randomUUID();
  sessionMode = mode;
  sessionStartedAt = Date.now();
  lastInteractionAt = Date.now();
  startHeartbeat();
  return sessionId;
}

export function endLoggingSession(
  reason: "mode_changed" | "page_hidden" | "pagehide" | "manual" = "manual"
): void {
  if (!sessionId || !sessionMode) return;
  const endingSessionId = sessionId;
  const endingMode = sessionMode;
  const durationMs = Date.now() - sessionStartedAt;
  sessionId = null;
  sessionMode = null;
  stopHeartbeat();
  postLog(
    {
      event:
        endingMode === "free_play"
          ? "free_play.ended"
          : "practice.session_ended",
      durationMs,
      reason,
    },
    { keepalive: reason === "pagehide" || reason === "page_hidden", session: endingSessionId }
  );
}

export function initRemoteLogging(): void {
  if (initialized || typeof window === "undefined") return;
  initialized = true;
  const markInteraction = () => {
    lastInteractionAt = Date.now();
  };
  window.addEventListener("pointerdown", markInteraction, { passive: true });
  window.addEventListener("keydown", markInteraction);
  window.addEventListener("online", () => void flushLogQueue());
  window.addEventListener("pagehide", () => endLoggingSession("pagehide"));
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      endLoggingSession("page_hidden");
    }
  });
  void flushLogQueue();
}

export function logEvent(event: string, properties?: Record<string, unknown>): void {
  if (event === "practice.session_started") beginSession("practice");
  if (event === "free_play.started") beginSession("free_play");
  postLog({ event, ...properties });
}

export function logAppEvent(event: AppEvent): void {
  if (!sessionId) {
    beginSession("practice");
    postLog({ event: "practice.session_started", resumed: true });
  }
  const { type, ...rest } = event;
  postLog({ event: type, ...rest });
}
