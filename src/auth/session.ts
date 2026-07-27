/**
 * Persists the beta auth session in localStorage so the same email reopens as
 * the same user id. Login checks the email against a server-only allowlist
 * via POST /api/login (emails never ship in the client bundle).
 */

const AUTH_KEY = "pianoFriend.auth";

export interface AuthSession {
  email: string;
  userId: string;
}

export type LoginResult =
  | { ok: true; session: AuthSession }
  | { ok: false; error: string };

function readStoredSession(): AuthSession | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<AuthSession>;
    if (
      typeof parsed.email === "string" &&
      typeof parsed.userId === "string" &&
      parsed.email.length > 0 &&
      parsed.userId.length > 0
    ) {
      return { email: parsed.email, userId: parsed.userId };
    }
  } catch {
    /* corrupt or unavailable storage */
  }
  return null;
}

function writeSession(session: AuthSession): void {
  localStorage.setItem(AUTH_KEY, JSON.stringify(session));
}

/** Returns the persisted session, or null if not logged in. */
export function getSession(): AuthSession | null {
  return readStoredSession();
}

/**
 * Validate email against the server allowlist and persist the session.
 * Returns an error message for unknown emails or network failures.
 */
export async function login(email: string): Promise<LoginResult> {
  const trimmed = email.trim();
  if (!trimmed) {
    return { ok: false, error: "Please enter your email." };
  }

  try {
    const response = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: trimmed }),
    });

    const data = (await response.json()) as {
      email?: string;
      userId?: string;
      error?: string;
    };

    if (!response.ok) {
      return {
        ok: false,
        error:
          typeof data.error === "string"
            ? data.error
            : "This email is not on the beta list. Ask for an invite.",
      };
    }

    if (typeof data.email !== "string" || typeof data.userId !== "string") {
      return { ok: false, error: "Login failed. Please try again." };
    }

    const session: AuthSession = {
      email: data.email,
      userId: data.userId,
    };
    writeSession(session);
    return { ok: true, session };
  } catch {
    return {
      ok: false,
      error: "Could not reach the login server. Please try again.",
    };
  }
}

/** Clear the auth session. Caller should also reset analytics. */
export function logout(): void {
  if (typeof localStorage !== "undefined") {
    localStorage.removeItem(AUTH_KEY);
  }
}
