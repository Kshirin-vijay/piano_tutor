import { useState } from "react";
import type { ClassRoster } from "./AccessCodeScreen";
import "./Screen.css";
import "./StudentSelectScreen.css";

const API_ENDPOINT = import.meta.env.VITE_API_ENDPOINT as string | undefined;

interface StudentPickerScreenProps {
  roster: ClassRoster;
  onPick: (student: { id: string; label: string }) => void;
  onCancel: () => void;
}

export default function StudentPickerScreen({
  roster: initialRoster,
  onPick,
  onCancel,
}: StudentPickerScreenProps) {
  const [roster, setRoster] = useState(initialRoster);
  const [newName, setNewName] = useState("");
  const [error, setError] = useState("");
  const [adding, setAdding] = useState(false);

  async function handleAdd() {
    const name = newName.trim();
    if (!name) {
      setError("Please type a name.");
      return;
    }
    if (name.length > 30) {
      setError("Name is too long (max 30 characters).");
      return;
    }
    if (!API_ENDPOINT) {
      setError("API not configured.");
      return;
    }

    setAdding(true);
    setError("");

    try {
      const res = await fetch(`${API_ENDPOINT}/auth/student`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: roster.code, name }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(
          (body as { error?: string }).error ?? "Could not add student."
        );
        setAdding(false);
        return;
      }

      const data = await res.json() as ClassRoster & { added: { id: string; label: string } };
      setRoster({
        code: data.code,
        teacher: data.teacher,
        students: data.students,
      });
      setNewName("");
      setAdding(false);

      onPick(data.added);
    } catch {
      setError("Could not reach the server. Try again.");
      setAdding(false);
    }
  }

  return (
    <div className="screen">
      <div className="card student-select-card">
        <h1 className="card__title">{roster.teacher}&apos;s Class</h1>
        <p className="card__subtitle">Who is playing?</p>

        {roster.students.length > 0 ? (
          <ul className="student-list">
            {roster.students.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  className="student-list__button"
                  onClick={() => onPick(s)}
                >
                  <span className="student-list__label">{s.label}</span>
                  <span className="student-list__id">{"\u203A"}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="student-empty">
            No students yet. Add yourself below!
          </p>
        )}

        <div className="student-add">
          <div className="student-add__field">
            <label className="student-add__label" htmlFor="new-student-name">
              New student
            </label>
            <input
              id="new-student-name"
              className="student-add__input"
              type="text"
              placeholder="Your first name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAdd();
              }}
              disabled={adding}
              maxLength={30}
            />
          </div>
          {error && <p className="student-error">{error}</p>}
          <button
            className="big-button"
            type="button"
            onClick={handleAdd}
            disabled={adding || !newName.trim()}
          >
            {adding ? "Adding\u2026" : "Add & Start"}
          </button>
        </div>

        <button
          className="text-button"
          type="button"
          onClick={onCancel}
        >
          Back
        </button>
      </div>
    </div>
  );
}
