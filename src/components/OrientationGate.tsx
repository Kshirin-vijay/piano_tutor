import { useEffect, useState } from "react";
import { isTouchDevice } from "../platform/orientation";
import "./OrientationGate.css";

/**
 * On phones/tablets the app is designed for landscape. When such a device is
 * held in portrait we cover the screen with a friendly "turn me sideways"
 * prompt. Desktop and already-landscape devices render their children as-is.
 */
export default function OrientationGate({
  children,
}: {
  children: React.ReactNode;
}) {
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    if (!isTouchDevice()) return;

    const portrait = window.matchMedia("(orientation: portrait)");
    const update = () => setBlocked(portrait.matches);

    update();
    portrait.addEventListener("change", update);
    return () => portrait.removeEventListener("change", update);
  }, []);

  return (
    <>
      {children}
      {blocked && (
        <div className="orientation-gate" role="alertdialog" aria-live="polite">
          <div className="orientation-gate__phone" aria-hidden="true">
            📱
          </div>
          <p className="orientation-gate__title">Turn me sideways!</p>
          <p className="orientation-gate__subtitle">
            Hold your device the wide way to play the piano.
          </p>
        </div>
      )}
    </>
  );
}
