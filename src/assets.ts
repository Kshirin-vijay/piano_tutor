/**
 * Resolve a public asset path against the app's base URL so it works whether
 * the app is served from the site root ("/") or a sub-path (e.g. "/piano/").
 *
 * `import.meta.env.BASE_URL` is "/" by default and "/piano/" when built with
 * VITE_BASE=/piano/. Pass paths relative to the public dir, e.g. "hands/x.png".
 */
export function asset(path: string): string {
  return import.meta.env.BASE_URL + path.replace(/^\/+/, "");
}
