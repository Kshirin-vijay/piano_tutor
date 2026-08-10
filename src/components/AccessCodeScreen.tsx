import { useState } from "react";
import "./Screen.css";

const API_ENDPOINT = import.meta.env.VITE_API_ENDPOINT as string | undefined;

export interface ClassRoster {
  code: string;
  teacher: string;
  students: { id: string; label: string }[];
}

interface AccessCodeScreenProps {
  onRosterLoaded: (roster: ClassRoster) => void;
  onCancel: () => void;
}

export default function AccessCodeScreen({
  onRosterLoaded,
  onCancel,
}: AccessCodeScreenProps) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) {
      setError("Please enter a class code.");
      return;
    }
    if (!API_ENDPOINT) {
      setError("API not configured.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch(`${API_ENDPOINT}/auth`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: trimmed }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(
          (body as { error?: string }).error ?? "Invalid class code."
        );
        setLoading(false);
        return;
      }

      const roster: ClassRoster = await res.json();
      onRosterLoaded(roster);
    } catch {
      setError("Could not reach the server. Try again.");
      setLoading(false);
    }
  }

  return (
    <div className="screen">
      <div className="card" style={{ gap: 16, maxWidth: "min(420px, 92vw)" }}>
        <h1 className="card__title">Enter Class Code</h1>
        <p className="card__subtitle">
          Ask your teacher for the code
        </p>

        <input
          className="student-add__input"
          type="text"
          placeholder="e.g. SMITH-PIANO"
          value={code}
          autoCapitalize="characters"
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSubmit();
          }}
          disabled={loading}
          autoFocus
        />

        {error && <p className="student-error">{error}</p>}

        <button
          className="big-button"
          type="button"
          onClick={handleSubmit}
          disabled={loading}
        >
          {loading ? "Checking\u2026" : "Go"}
        </button>
        <button
          className="text-button"
          type="button"
          onClick={onCancel}
          disabled={loading}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
