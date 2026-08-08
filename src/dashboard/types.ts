export type TimeQuality = "measured" | "estimated" | "partial";

export interface LevelReport {
  levelKey: string;
  title: string;
  kind: string;
  attempts: number;
  completed: boolean;
  abandoned: boolean;
  durationMs: number;
  durationQuality: TimeQuality;
  mistakes: number;
  mistakesByExpected: Record<string, number>;
  mistakesByWrongKey: Record<string, number>;
  partialData: boolean;
}

export interface DayReport {
  date: string;
  activeTimeMs: number;
  timeQuality: TimeQuality;
  eventCount: number;
  levelsStarted: number;
  levelsCompleted: number;
  levelsAbandoned: number;
  totalMistakes: number;
  lastActivityAt: string | null;
  partialData: boolean;
  levels: LevelReport[];
}

export interface StudentReport {
  studentId: string;
  label: string;
  days: DayReport[];
  summary: {
    activeTimeMs: number;
    totalMistakes: number;
    levelsStarted: number;
    levelsCompleted: number;
    activeDays: number;
    partialData: boolean;
  };
  partialData: boolean;
}

export interface TeacherReport {
  teacherId: string;
  teacherName: string;
  students: StudentReport[];
}

export interface DashboardReport {
  generatedAt: string;
  from: string;
  to: string;
  timezone: string;
  partialData: boolean;
  teachers: TeacherReport[];
  public: {
    days: Array<{
      date: string;
      activeTimeMs: number;
      eventCount: number;
      timeQuality: TimeQuality;
      partialData: boolean;
    }>;
    partialData: boolean;
  };
}
