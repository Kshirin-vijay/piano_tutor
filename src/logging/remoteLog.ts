import type { AppEvent } from "../config/events";
import {
  getStudentId,
  getStudentLabel,
  getTeacherId,
} from "../progress/identity";

const LOG_ENDPOINT = import.meta.env.VITE_LOG_ENDPOINT as string | undefined;

function canLog(): boolean {
  return Boolean(LOG_ENDPOINT && getTeacherId() && getStudentId());
}

function postLog(payload: Record<string, unknown>): void {
  if (!canLog()) return;

  void fetch(LOG_ENDPOINT!, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      teacherId: getTeacherId(),
      studentId: getStudentId(),
      studentLabel: getStudentLabel(),
      ...payload,
    }),
  }).catch(() => {
    /* logging must never break gameplay */
  });
}

export function logEvent(event: string, properties?: Record<string, unknown>): void {
  postLog({ event, ...properties });
}

export function logAppEvent(event: AppEvent): void {
  const { type, ...rest } = event;
  postLog({ event: type, ...rest });
}
