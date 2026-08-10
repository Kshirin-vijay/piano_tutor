import { useCallback, useEffect, useMemo, useState } from "react";
import {
  clearDashboardToken,
  getDashboardToken,
  loadReport,
  login,
} from "./api";
import type {
  DashboardReport,
  DayReport,
  LevelReport,
  StudentReport,
  TeacherReport,
} from "./types";
import "./TeacherDashboard.css";

const DEFAULT_TIMEZONE =
  Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Los_Angeles";

function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function initialRange() {
  const to = new Date();
  const from = new Date(to);
  from.setDate(from.getDate() - 29);
  return { from: isoDay(from), to: isoDay(to) };
}

function formatDuration(ms: number): string {
  if (!ms) return "0 min";
  const minutes = Math.max(1, Math.round(ms / 60_000));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
}

function formatDay(date: string): string {
  return new Date(`${date}T12:00:00`).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function completionRate(student: StudentReport): number {
  return student.summary.levelsStarted
    ? Math.round(
        (student.summary.levelsCompleted / student.summary.levelsStarted) * 100
      )
    : 0;
}

function activeStreak(days: DayReport[]): number {
  const active = new Set(
    days
      .filter((day) => day.eventCount > 0 || day.activeTimeMs > 0)
      .map((day) => day.date)
  );
  const cursor = new Date();
  let count = 0;
  while (active.has(isoDay(cursor))) {
    count += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return count;
}

function aggregateLevels(days: DayReport[]): LevelReport[] {
  const levels = new Map<string, LevelReport>();
  for (const source of days.flatMap((day) => day.levels)) {
    const current = levels.get(source.levelKey);
    if (!current) {
      levels.set(source.levelKey, {
        ...source,
        mistakesByExpected: { ...source.mistakesByExpected },
        mistakesByWrongKey: { ...source.mistakesByWrongKey },
      });
      continue;
    }
    current.attempts += source.attempts;
    current.completed ||= source.completed;
    current.abandoned ||= source.abandoned;
    current.durationMs += source.durationMs;
    current.mistakes += source.mistakes;
    current.partialData ||= source.partialData;
    for (const [note, count] of Object.entries(source.mistakesByExpected)) {
      current.mistakesByExpected[note] =
        (current.mistakesByExpected[note] ?? 0) + count;
    }
    for (const [note, count] of Object.entries(source.mistakesByWrongKey)) {
      current.mistakesByWrongKey[note] =
        (current.mistakesByWrongKey[note] ?? 0) + count;
    }
  }
  return [...levels.values()];
}

function Login({ onSuccess }: { onSuccess: () => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await login(password);
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign in.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="teacher-login">
      <form className="teacher-login__card" onSubmit={submit}>
        <span className="teacher-brand">Piano Friend</span>
        <h1>Practice dashboard</h1>
        <p>Private progress reports for parents and teachers.</p>
        <label htmlFor="dashboard-password">Admin password</label>
        <input
          id="dashboard-password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="current-password"
          autoFocus
        />
        {error ? <p className="teacher-error">{error}</p> : null}
        <button type="submit" disabled={busy || !password}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
        <a href="/">Back to Piano Friend</a>
      </form>
    </main>
  );
}

function StudentCard({
  student,
  active,
  onClick,
}: {
  student: StudentReport;
  active: boolean;
  onClick: () => void;
}) {
  const activeDays = student.days.filter((day) => day.eventCount > 0);
  const lastDay = activeDays.at(-1);
  const needsAttention = student.days.some(
    (day) => day.levelsAbandoned > 0 || day.totalMistakes >= 5
  );
  return (
    <button
      className={`student-summary${active ? " is-active" : ""}`}
      type="button"
      onClick={onClick}
    >
      <span className="student-summary__name">{student.label}</span>
      <strong>{formatDuration(student.summary.activeTimeMs)}</strong>
      <span>{completionRate(student)}% completion</span>
      <small>{lastDay ? `Last active ${formatDay(lastDay.date)}` : "No activity yet"}</small>
      {needsAttention ? <em>Needs attention</em> : null}
    </button>
  );
}

function LevelDetails({ level }: { level: LevelReport }) {
  const confusions = Object.entries(level.mistakesByExpected)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);
  return (
    <div className="level-detail">
      <span>{level.attempts} attempt{level.attempts === 1 ? "" : "s"}</span>
      <span>{formatDuration(level.durationMs)}</span>
      <span>{level.mistakes} mistake{level.mistakes === 1 ? "" : "s"}</span>
      <span>
        {level.completed ? "Completed" : level.abandoned ? "Not completed" : "In progress"}
      </span>
      {confusions.length ? (
        <small>
          Difficult notes: {confusions.map(([note, count]) => `${note} (${count})`).join(", ")}
        </small>
      ) : null}
      {level.partialData ? <small>Some historical details are incomplete.</small> : null}
    </div>
  );
}

function StudentDetail({
  student,
  teacher,
}: {
  student: StudentReport;
  teacher: TeacherReport;
}) {
  const activeDays = [...student.days]
    .filter((day) => day.eventCount > 0 || day.levels.length > 0)
    .reverse();
  const levels = aggregateLevels(student.days);
  const hardest = [...levels].sort((a, b) => b.mistakes - a.mistakes)[0];
  const attention = levels.filter(
    (level) => !level.completed && (level.abandoned || level.attempts > 1)
  );
  const kindTotals = levels.reduce<Record<string, number>>((totals, level) => {
    totals[level.kind] = (totals[level.kind] ?? 0) + level.durationMs;
    return totals;
  }, {});

  return (
    <section className="student-detail">
      <div className="student-detail__heading">
        <div>
          <span className="teacher-eyebrow">Student report</span>
          <h2>{student.label}</h2>
          <p className="student-detail__class">
            {teacher.teacherName}
            <span>{teacher.teacherId}</span>
          </p>
        </div>
        <div className="student-metrics">
          <div><strong>{formatDuration(student.summary.activeTimeMs)}</strong><span>Practiced</span></div>
          <div><strong>{student.summary.activeDays}</strong><span>Active days</span></div>
          <div><strong>{completionRate(student)}%</strong><span>Completion</span></div>
          <div><strong>{activeStreak(student.days)}</strong><span>Day streak</span></div>
        </div>
      </div>

      <div className="insight-grid">
        <article>
          <h3>Needs attention</h3>
          <p>
            {attention.length
              ? attention.slice(0, 3).map((level) => level.title).join(", ")
              : "No repeated or abandoned levels in this period."}
          </p>
        </article>
        <article>
          <h3>Hardest level</h3>
          <p>{hardest && hardest.mistakes ? `${hardest.title} · ${hardest.mistakes} mistakes` : "No mistakes recorded."}</p>
        </article>
        <article>
          <h3>Practice mix</h3>
          <p>
            {Object.entries(kindTotals).length
              ? Object.entries(kindTotals)
                  .sort((a, b) => b[1] - a[1])
                  .map(([kind, ms]) => `${kind} ${formatDuration(ms)}`)
                  .join(" · ")
              : "No level time recorded."}
          </p>
        </article>
      </div>

      <div className="daily-bars" aria-label="Daily practice time">
        {student.days.slice(-14).map((day) => {
          const max = Math.max(...student.days.slice(-14).map((item) => item.activeTimeMs), 1);
          return (
            <div className="daily-bar" key={day.date} title={`${formatDay(day.date)}: ${formatDuration(day.activeTimeMs)}`}>
              <span style={{ height: `${Math.max(3, (day.activeTimeMs / max) * 100)}%` }} />
              <small>{day.date.slice(8)}</small>
            </div>
          );
        })}
      </div>

      <div className="day-list">
        {activeDays.length ? activeDays.map((day) => (
          <details key={day.date} className="day-report">
            <summary>
              <strong>{formatDay(day.date)}</strong>
              <span>{formatDuration(day.activeTimeMs)}{day.timeQuality !== "measured" ? "*" : ""}</span>
              <span>{day.levelsStarted} started</span>
              <span>{day.levelsCompleted} finished</span>
              <span>{day.totalMistakes} mistakes</span>
            </summary>
            {day.levels.length ? (
              <div className="level-list">
                {day.levels.map((level) => (
                  <article key={level.levelKey}>
                    <h4>{level.title}</h4>
                    <LevelDetails level={level} />
                  </article>
                ))}
              </div>
            ) : <p className="teacher-muted">No structured level activity.</p>}
          </details>
        )) : <p className="teacher-empty">No practice activity in this date range.</p>}
      </div>
    </section>
  );
}

export default function TeacherDashboard() {
  const range = useMemo(initialRange, []);
  const [authenticated, setAuthenticated] = useState(Boolean(getDashboardToken()));
  const [from, setFrom] = useState(range.from);
  const [to, setTo] = useState(range.to);
  const [timezone, setTimezone] = useState(DEFAULT_TIMEZONE);
  const [report, setReport] = useState<DashboardReport | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    if (!authenticated) return;
    setLoading(true);
    setError("");
    try {
      const next = await loadReport(from, to, timezone);
      setReport(next);
      const first = next.teachers.flatMap((teacher) => teacher.students)[0];
      setSelectedId((current) =>
        next.teachers.some((teacher) =>
          teacher.students.some((student) => student.studentId === current)
        ) ? current : first?.studentId ?? ""
      );
    } catch (err) {
      if (err instanceof Error && err.message === "AUTH_REQUIRED") {
        setAuthenticated(false);
        setReport(null);
      } else {
        setError(err instanceof Error ? err.message : "Could not load report.");
      }
    } finally {
      setLoading(false);
    }
  }, [authenticated, from, to, timezone]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (!authenticated) {
    return <Login onSuccess={() => setAuthenticated(true)} />;
  }

  const classes = report?.teachers.filter((teacher) => teacher.teacherId !== "public") ?? [];
  const students = classes.flatMap((teacher) => teacher.students);
  const selectedTeacher = classes.find((teacher) =>
    teacher.students.some((student) => student.studentId === selectedId)
  );
  const selected = selectedTeacher?.students.find(
    (student) => student.studentId === selectedId
  );
  const publicActive = report?.public.days.filter((day) => day.eventCount > 0) ?? [];

  return (
    <main className="teacher-dashboard">
      <header className="teacher-header">
        <div>
          <span className="teacher-brand">Piano Friend</span>
          <h1>Practice dashboard</h1>
        </div>
        <div className="teacher-header__actions">
          <label>From<input type="date" value={from} max={to} onChange={(event) => setFrom(event.target.value)} /></label>
          <label>To<input type="date" value={to} min={from} onChange={(event) => setTo(event.target.value)} /></label>
          <label>Timezone<input value={timezone} onChange={(event) => setTimezone(event.target.value)} /></label>
          <button type="button" onClick={() => void refresh()} disabled={loading}>Refresh</button>
          <button type="button" className="teacher-link" onClick={() => {
            clearDashboardToken();
            setAuthenticated(false);
          }}>Sign out</button>
        </div>
      </header>

      {report?.partialData ? (
        <div className="teacher-notice">
          Older records are incomplete because session endings and abandoned levels were not previously logged. Estimated values are marked with *.
        </div>
      ) : null}
      {error ? <div className="teacher-error teacher-error--banner">{error}</div> : null}
      {loading && !report ? <div className="teacher-loading">Loading practice reports…</div> : null}

      {report ? (
        <>
          <section className="class-overview">
            <div className="section-title">
              <div><span className="teacher-eyebrow">Class overview</span><h2>Students by class</h2></div>
              <span>{students.length} student{students.length === 1 ? "" : "s"}</span>
            </div>
            <div className="class-groups">
              {classes.map((teacher) => (
                <section className="class-group" key={teacher.teacherId}>
                  <div className="class-group__header">
                    <div>
                      <h3>{teacher.teacherName}</h3>
                      <span className="class-group__code">{teacher.teacherId}</span>
                    </div>
                    <span>
                      {teacher.students.length} student
                      {teacher.students.length === 1 ? "" : "s"}
                    </span>
                  </div>
                  {teacher.students.length ? (
                    <div className="student-grid">
                      {teacher.students.map((student) => (
                        <StudentCard
                          key={student.studentId}
                          student={student}
                          active={student.studentId === selectedId}
                          onClick={() => setSelectedId(student.studentId)}
                        />
                      ))}
                    </div>
                  ) : (
                    <p className="teacher-muted">No students registered.</p>
                  )}
                </section>
              ))}
            </div>
          </section>

          {selected && selectedTeacher ? (
            <StudentDetail student={selected} teacher={selectedTeacher} />
          ) : (
            <p className="teacher-empty">No students are registered yet.</p>
          )}

          <section className="public-report">
            <div className="section-title">
              <div><span className="teacher-eyebrow">Anonymous activity</span><h2>Public practice</h2></div>
            </div>
            {publicActive.length ? (
              <div className="public-days">
                {publicActive.slice(-14).reverse().map((day) => (
                  <div key={day.date}>
                    <strong>{formatDay(day.date)}</strong>
                    <span>{formatDuration(day.activeTimeMs)}{day.timeQuality !== "measured" ? "*" : ""}</span>
                    <small>{day.eventCount} events</small>
                  </div>
                ))}
              </div>
            ) : <p className="teacher-muted">No public practice in this range.</p>}
          </section>
        </>
      ) : null}
    </main>
  );
}
