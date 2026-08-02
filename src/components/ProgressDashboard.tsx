import { useProgress } from "../progress/useProgress";
import { clearProgress } from "../progress/progressStore";
import "./Screen.css";
import "./ProgressDashboard.css";

interface ProgressDashboardProps {
  onClose: () => void;
}

const NOTE_ORDER = ["C", "D", "E", "F", "G", "A", "B"];

function formatDuration(ms: number): string {
  const totalMinutes = Math.round(ms / 60000);
  if (totalMinutes < 1) return "under a minute";
  if (totalMinutes < 60) return `${totalMinutes} min`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes ? `${hours} h ${minutes} min` : `${hours} h`;
}

function formatDate(ms: number): string {
  return new Date(ms).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function ProgressDashboard({ onClose }: ProgressDashboardProps) {
  const progress = useProgress();
  const { totals } = progress;

  const levels = Object.values(progress.perLevel).sort(
    (a, b) => a.levelNumber - b.levelNumber
  );
  const notes = NOTE_ORDER.map((note) => progress.perNote[note]).filter(
    (n): n is NonNullable<typeof n> => Boolean(n)
  );
  const sessions = [...progress.sessions].sort((a, b) => b.startedAt - a.startedAt);

  const hasData = totals.sessions > 0 || levels.length > 0;

  function handleClear() {
    if (
      window.confirm(
        "Clear all saved practice history? This cannot be undone."
      )
    ) {
      clearProgress();
    }
  }

  return (
    <div className="screen">
      <div className="card progress-card">
        <h1 className="card__title">Practice progress</h1>
        <p className="card__subtitle">For grown-ups</p>

        {!hasData ? (
          <p className="progress-empty">
            No practice recorded yet. Play a few levels and check back here.
          </p>
        ) : (
          <>
            <section className="progress-stats">
              <div className="progress-stat">
                <strong>{totals.sessions}</strong>
                <span>Sessions</span>
              </div>
              <div className="progress-stat">
                <strong>{formatDuration(totals.activeMs)}</strong>
                <span>Practiced</span>
              </div>
              <div className="progress-stat">
                <strong>{totals.completions}</strong>
                <span>Completed</span>
              </div>
              <div className="progress-stat">
                <strong>{totals.successes}</strong>
                <span>Correct taps</span>
              </div>
            </section>

            {notes.length > 0 ? (
              <section className="progress-group">
                <h2 className="progress-group__title">Notes</h2>
                <div className="progress-notes">
                  {notes.map((note) => {
                    const total = note.successes + note.mistakes;
                    const pct = total ? Math.round((note.successes / total) * 100) : 0;
                    return (
                      <div key={note.note} className="progress-note">
                        <span className="progress-note__name">{note.note}</span>
                        <span className="progress-note__bar">
                          <span
                            className="progress-note__fill"
                            style={{ width: `${pct}%` }}
                          />
                        </span>
                        <span className="progress-note__pct">
                          {pct}%
                          <small>
                            {note.successes}/{total}
                          </small>
                        </span>
                      </div>
                    );
                  })}
                </div>
              </section>
            ) : null}

            {levels.length > 0 ? (
              <section className="progress-group">
                <h2 className="progress-group__title">Levels</h2>
                <ul className="progress-list">
                  {levels.map((level) => (
                    <li key={level.levelNumber} className="progress-row">
                      <span className="progress-row__title">{level.title}</span>
                      <span className="progress-row__meta">
                        {level.completions} done
                        {level.replays > 0 ? ` \u00B7 ${level.replays} replays` : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {sessions.length > 0 ? (
              <section className="progress-group">
                <h2 className="progress-group__title">Recent sessions</h2>
                <ul className="progress-list">
                  {sessions.slice(0, 8).map((session) => (
                    <li key={session.id} className="progress-row">
                      <span className="progress-row__title">
                        {formatDate(session.startedAt)}
                      </span>
                      <span className="progress-row__meta">
                        {formatDuration(session.endedAt - session.startedAt)}
                        {` \u00B7 ${session.completions} done`}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </>
        )}

        <button className="big-button" type="button" onClick={onClose}>
          Done
        </button>
        {hasData ? (
          <button className="text-button" type="button" onClick={handleClear}>
            Clear history
          </button>
        ) : null}
      </div>
    </div>
  );
}
