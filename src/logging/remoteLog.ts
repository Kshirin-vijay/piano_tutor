/**
 * Fire-and-forget remote usage logging via POST /api/log.
 * Server writes one JSONL line per event to a daily file per student.
 */

import type { AppEvent } from "../config/events";
import {
  getStudentId,
  getStudentLabel,
  getTeacherId,
} from "../progress/identity";

function canLog(): boolean {
  return Boolean(getTeacherId() && getStudentId());
}

function postLog(payload: Record<string, unknown>): void {
  if (!canLog()) return;

  void fetch("/api/log", {
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
