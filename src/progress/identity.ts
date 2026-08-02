const DEVICE_ID_KEY = "pianoFriend.deviceId";
const CLASS_CODE_KEY = "pianoFriend.classCode";
const STUDENT_ID_KEY = "pianoFriend.studentId";
const STUDENT_LABEL_KEY = "pianoFriend.studentLabel";
const TEACHER_KEY = "pianoFriend.teacher";

function getOrCreateDeviceId(): string {
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

export function isAuthenticated(): boolean {
  return Boolean(
    localStorage.getItem(CLASS_CODE_KEY) &&
    localStorage.getItem(STUDENT_ID_KEY)
  );
}

export function setIdentity(
  classCode: string,
  studentId: string,
  studentLabel: string,
  teacher: string,
): void {
  localStorage.setItem(CLASS_CODE_KEY, classCode.toUpperCase());
  localStorage.setItem(STUDENT_ID_KEY, studentId);
  localStorage.setItem(STUDENT_LABEL_KEY, studentLabel);
  localStorage.setItem(TEACHER_KEY, teacher);
}

export function clearIdentity(): void {
  localStorage.removeItem(CLASS_CODE_KEY);
  localStorage.removeItem(STUDENT_ID_KEY);
  localStorage.removeItem(STUDENT_LABEL_KEY);
  localStorage.removeItem(TEACHER_KEY);
}

export function getUserId(): string {
  const code = localStorage.getItem(CLASS_CODE_KEY);
  const sid = localStorage.getItem(STUDENT_ID_KEY);
  if (code && sid) return `${code}__${sid}`;
  return getOrCreateDeviceId();
}

export function getTeacherId(): string | null {
  return localStorage.getItem(CLASS_CODE_KEY) ?? "public";
}

export function getStudentId(): string | null {
  const code = localStorage.getItem(CLASS_CODE_KEY);
  const sid = localStorage.getItem(STUDENT_ID_KEY);
  if (code && sid) return `${code}__${sid}`;
  return getOrCreateDeviceId();
}

export function getStudentLabel(): string | null {
  return localStorage.getItem(STUDENT_LABEL_KEY) ?? "Guest";
}

export function getClassCode(): string | null {
  return localStorage.getItem(CLASS_CODE_KEY);
}

export function getTeacherName(): string | null {
  return localStorage.getItem(TEACHER_KEY);
}
