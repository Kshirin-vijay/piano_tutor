/**
 * Students belong to a logged-in teacher. Each student gets their own progress
 * key and daily log file. Stored on-device under the teacher's account.
 */

import { getSession } from "./session";

export interface Student {
  id: string;
  label: string;
  createdAt: number;
}

const studentsKey = (teacherId: string) => `pianoFriend.students.${teacherId}`;
const activeKey = (teacherId: string) => `pianoFriend.activeStudent.${teacherId}`;

const listeners = new Set<() => void>();

function notify(): void {
  listeners.forEach((l) => l());
}

function teacherIdOrNull(): string | null {
  return getSession()?.userId ?? null;
}

function readStudents(teacherId: string): Student[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(studentsKey(teacherId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Student[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (s) =>
        s &&
        typeof s.id === "string" &&
        typeof s.label === "string" &&
        typeof s.createdAt === "number"
    );
  } catch {
    return [];
  }
}

function writeStudents(teacherId: string, students: Student[]): void {
  localStorage.setItem(studentsKey(teacherId), JSON.stringify(students));
  notify();
}

/** All students created by this teacher on this device. */
export function listStudents(): Student[] {
  const teacherId = teacherIdOrNull();
  if (!teacherId) return [];
  return readStudents(teacherId);
}

/** The student currently practicing, or null if none selected. */
export function getActiveStudent(): Student | null {
  const teacherId = teacherIdOrNull();
  if (!teacherId || typeof localStorage === "undefined") return null;
  try {
    const id = localStorage.getItem(activeKey(teacherId));
    if (!id) return null;
    return readStudents(teacherId).find((s) => s.id === id) ?? null;
  } catch {
    return null;
  }
}

/** Select which student is practicing. */
export function setActiveStudent(studentId: string): boolean {
  const teacherId = teacherIdOrNull();
  if (!teacherId) return false;
  const student = readStudents(teacherId).find((s) => s.id === studentId);
  if (!student) return false;
  localStorage.setItem(activeKey(teacherId), studentId);
  notify();
  return true;
}

function nextStudentIds(students: Student[]): { id: string; label: string } {
  let n = 1;
  while (students.some((s) => s.id === `student${n}`)) n++;
  return { id: `student${n}`, label: `Student ${n}` };
}

/** Create a new student profile for this teacher. */
export function createStudent(label?: string): Student | null {
  const teacherId = teacherIdOrNull();
  if (!teacherId) return null;

  const students = readStudents(teacherId);
  const defaults = nextStudentIds(students);
  const trimmed = label?.trim();
  const student: Student = {
    id: defaults.id,
    label: trimmed && trimmed.length > 0 ? trimmed : defaults.label,
    createdAt: Date.now(),
  };
  writeStudents(teacherId, [...students, student]);
  localStorage.setItem(activeKey(teacherId), student.id);
  return student;
}

/** Clear active student (e.g. back to class picker). Keeps the roster. */
export function clearActiveStudent(): void {
  const teacherId = teacherIdOrNull();
  if (!teacherId || typeof localStorage === "undefined") return;
  localStorage.removeItem(activeKey(teacherId));
  notify();
}

export function subscribeStudents(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function hasActiveStudent(): boolean {
  return getActiveStudent() !== null;
}
