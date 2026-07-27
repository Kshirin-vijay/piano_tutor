/**
 * Closed beta allowlist — server only. Never import this from client code;
 * it must stay out of the Vite browser bundle. Edit and redeploy to change testers.
 */

export interface BetaUser {
  email: string;
  userId: string;
}

export const BETA_USERS: readonly BetaUser[] = [
  { email: "kshirin.vijay@gmail.com", userId: "user1" },
  { email: "vj.sorab@gmail.com", userId: "user2" },
];

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function findBetaUser(email: string): BetaUser | null {
  const normalized = normalizeEmail(email);
  return (
    BETA_USERS.find((user) => normalizeEmail(user.email) === normalized) ?? null
  );
}
