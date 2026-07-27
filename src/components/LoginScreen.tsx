import { useState } from "react";
import type { FormEvent } from "react";
import { login } from "../auth/session";
import { hydrateProgress } from "../progress/progressStore";
import MusicDecor from "./MusicDecor";
import "./Screen.css";
import "./LoginScreen.css";

interface LoginScreenProps {
  onLoggedIn: () => void;
}

export default function LoginScreen({ onLoggedIn }: LoginScreenProps) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (submitting) return;
    setError(null);
    setSubmitting(true);

    try {
      const result = await login(email);
      if (!result.ok) {
        setError(result.error);
        return;
      }

      // Reload practice history for this user id (boot may have hydrated "local").
      void hydrateProgress();
      onLoggedIn();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="screen">
      <MusicDecor />
      <form className="card login-card" onSubmit={handleSubmit}>
        <h1 className="card__title">Beta access</h1>
        <p className="card__subtitle">
          Enter the email you were invited with to continue.
        </p>
        <label className="login-field">
          <span className="login-field__label">Email</span>
          <input
            className="login-field__input"
            type="email"
            name="email"
            autoComplete="email"
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
            disabled={submitting}
          />
        </label>
        {error ? (
          <p className="login-error" role="alert">
            {error}
          </p>
        ) : null}
        <button className="big-button" type="submit" disabled={submitting}>
          {submitting ? "Checking…" : "Continue"}
        </button>
      </form>
    </div>
  );
}
