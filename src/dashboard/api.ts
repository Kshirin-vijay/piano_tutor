import type { DashboardReport } from "./types";

const DASHBOARD_API = (
  (import.meta.env.VITE_DASHBOARD_API as string | undefined) ??
  (import.meta.env.DEV ? "/api" : undefined)
)?.replace(/\/$/, "");

const TOKEN_KEY = "pianoFriend.dashboardToken";

export function getDashboardToken(): string | null {
  return sessionStorage.getItem(TOKEN_KEY);
}

export function clearDashboardToken(): void {
  sessionStorage.removeItem(TOKEN_KEY);
}

export async function login(password: string): Promise<void> {
  if (!DASHBOARD_API) throw new Error("Dashboard API is not configured.");
  const response = await fetch(`${DASHBOARD_API}/dashboard/auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });
  const body = (await response.json().catch(() => ({}))) as {
    token?: string;
    error?: string;
  };
  if (!response.ok || !body.token) {
    throw new Error(body.error ?? "Could not sign in.");
  }
  sessionStorage.setItem(TOKEN_KEY, body.token);
}

export async function loadReport(
  from: string,
  to: string,
  timezone: string
): Promise<DashboardReport> {
  if (!DASHBOARD_API) throw new Error("Dashboard API is not configured.");
  const token = getDashboardToken();
  if (!token) throw new Error("AUTH_REQUIRED");
  const query = new URLSearchParams({ from, to, timezone });
  const response = await fetch(`${DASHBOARD_API}/dashboard/report?${query}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (response.status === 401) {
    clearDashboardToken();
    throw new Error("AUTH_REQUIRED");
  }
  const body = (await response.json().catch(() => ({}))) as
    | DashboardReport
    | { error?: string };
  if (!response.ok) {
    throw new Error("error" in body ? body.error ?? "Could not load report." : "Could not load report.");
  }
  return body as DashboardReport;
}
