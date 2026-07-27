/**
 * The single place that resolves "who is this practice for". Returns
 * `teacherId__studentId` when both are set so progress and logs stay per student.
 */

import { getSession } from "../auth/session";
import { getActiveStudent } from "../auth/students";

const LOCAL_USER_ID = "local";

/** Full learner id used for progress storage keys. */
export function getUserId(): string {
  const session = getSession();
  const student = getActiveStudent();
  if (session && student) {
    return `${session.userId}__${student.id}`;
  }
  return LOCAL_USER_ID;
}

export function getTeacherId(): string | null {
  return getSession()?.userId ?? null;
}

export function getStudentId(): string | null {
  return getActiveStudent()?.id ?? null;
}

export function getStudentLabel(): string | null {
  return getActiveStudent()?.label ?? null;
}
