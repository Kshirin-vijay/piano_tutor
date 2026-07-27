/**
 * Best-effort landscape lock for phones and tablets.
 *
 * Android Chrome (and installed PWAs) support `screen.orientation.lock`, but
 * only while the page is fullscreen. iOS Safari does not support the API at
 * all, so the CSS-based rotate prompt (see OrientationGate) is the real
 * guarantee. This helper just opportunistically locks where it's allowed.
 */

interface OrientationLock extends ScreenOrientation {
  lock?: (orientation: "landscape") => Promise<void>;
}

/** Coarse pointer + no hover is a reliable signal for phones/tablets. */
export function isTouchDevice(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(pointer: coarse)").matches;
}

/**
 * Attempt to lock the screen to landscape. Must be called from within a user
 * gesture on most browsers. Silently no-ops where unsupported.
 */
export async function lockLandscape(): Promise<void> {
  if (!isTouchDevice()) return;

  const orientation = screen?.orientation as OrientationLock | undefined;
  if (!orientation?.lock) return;

  try {
    await orientation.lock("landscape");
  } catch {
    // Unsupported (e.g. iOS) or not fullscreen — the rotate prompt handles it.
  }
}
