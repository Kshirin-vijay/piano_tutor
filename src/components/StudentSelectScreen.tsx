import { useState } from "react";
import {
  createStudent,
  listStudents,
  setActiveStudent,
  type Student,
} from "../auth/students";
import { hydrateProgress } from "../progress/progressStore";
import { logEvent } from "../logging/remoteLog";
import MusicDecor from "./MusicDecor";
import "./Screen.css";
import "./StudentSelectScreen.css";

interface StudentSelectScreenProps {
  onSelected: () => void;
}

export default function StudentSelectScreen({
  onSelected,
}: StudentSelectScreenProps) {
  const [students, setStudents] = useState<Student[]>(() => listStudents());
  const [customName, setCustomName] = useState("");
  const [error, setError] = useState<string | null>(null);

  function refresh() {
    setStudents(listStudents());
  }

  function pick(studentId: string) {
    if (!setActiveStudent(studentId)) {
      setError("Could not select that student. Try again.");
      return;
    }
    logEvent("student.selected", { studentId });
    void hydrateProgress();
    onSelected();
  }

  function handleCreate() {
    setError(null);
    const student = createStudent(customName || undefined);
    if (!student) {
      setError("Could not add a student. Try again.");
      return;
    }
    setCustomName("");
    refresh();
    logEvent("student.created", {
      studentId: student.id,
      studentLabel: student.label,
    });
    void hydrateProgress();
    onSelected();
  }

  function handleQuickCreate() {
    setError(null);
    const student = createStudent();
    if (!student) {
      setError("Could not add a student. Try again.");
      return;
    }
    refresh();
    logEvent("student.created", {
      studentId: student.id,
      studentLabel: student.label,
    });
    void hydrateProgress();
    onSelected();
  }

  return (
    <div className="screen">
      <MusicDecor />
      <div className="card student-select-card">
        <h1 className="card__title">Who is playing?</h1>
        <p className="card__subtitle">
          Pick a student or add a new one for this class.
        </p>

        {students.length > 0 ? (
          <ul className="student-list">
            {students.map((student) => (
              <li key={student.id}>
                <button
                  type="button"
                  className="student-list__button"
                  onClick={() => pick(student.id)}
                >
                  <span className="student-list__label">{student.label}</span>
                  <span className="student-list__id">{student.id}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="student-empty">No students yet. Add the first one below.</p>
        )}

        <div className="student-add">
          <label className="student-add__field">
            <span className="student-add__label">Name (optional)</span>
            <input
              className="student-add__input"
              type="text"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              placeholder="e.g. Alex"
            />
          </label>
          <button type="button" className="big-button" onClick={handleCreate}>
            Add student
          </button>
          {students.length === 0 ? (
            <button
              type="button"
              className="text-button"
              onClick={handleQuickCreate}
            >
              Quick add Student 1
            </button>
          ) : null}
        </div>

        {error ? (
          <p className="student-error" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}
