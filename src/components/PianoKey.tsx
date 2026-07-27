import { useCallback, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import type { NoteName } from "../audio/piano";
import "./PianoKey.css";

interface PianoKeyProps {
  note: NoteName;
  /** Whether the key responds to touch in the current level. */
  active: boolean;
  /** Soft, steady glow showing this is the key to press now. */
  glowing: boolean;
  /** Short-lived correctness feedback for real-time games. */
  feedback?: "correct" | "wrong" | null;
  onDown: (note: NoteName) => void;
  onUp: (note: NoteName) => void;
}

export default function PianoKey({
  note,
  active,
  glowing,
  feedback = null,
  onDown,
  onUp,
}: PianoKeyProps) {
  const [pressed, setPressed] = useState(false);
  const pressedRef = useRef(false);

  const handleDown = useCallback(
    (e: ReactPointerEvent<HTMLButtonElement>) => {
      if (!active) return;
      e.preventDefault();
      e.currentTarget.setPointerCapture?.(e.pointerId);
      pressedRef.current = true;
      setPressed(true);
      onDown(note);
    },
    [active, note, onDown]
  );

  const handleUp = useCallback(
    (e: ReactPointerEvent<HTMLButtonElement>) => {
      if (!pressedRef.current) return;
      e.preventDefault();
      pressedRef.current = false;
      setPressed(false);
      onUp(note);
    },
    [note, onUp]
  );

  return (
    <button
      type="button"
      className={[
        "piano-key",
        `key-${note.toLowerCase()}`,
        active ? "is-active" : "is-inactive",
        glowing ? "is-glowing" : "",
        pressed ? "is-pressed" : "",
        feedback ? `is-${feedback}` : "",
      ]
        .filter(Boolean)
        .join(" ")}
      aria-label={`Key ${note}`}
      aria-disabled={!active}
      onPointerDown={handleDown}
      onPointerUp={handleUp}
      onPointerCancel={handleUp}
      onLostPointerCapture={handleUp}
    >
      <span className="piano-key__label">{note}</span>
    </button>
  );
}
