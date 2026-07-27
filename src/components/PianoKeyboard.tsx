import { useCallback, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import type { NoteName } from "../audio/piano";
import PianoKey from "./PianoKey";
import "./PianoKeyboard.css";

export const WHITE_KEYS: NoteName[] = ["C", "D", "E", "F", "G", "A", "B"];
export const BLACK_KEYS: NoteName[] = ["C#", "D#", "F#", "G#", "A#"];
export const ALL_KEYS: NoteName[] = [
  "C",
  "C#",
  "D",
  "D#",
  "E",
  "F",
  "F#",
  "G",
  "G#",
  "A",
  "A#",
  "B",
];

const BLACK_KEY_POSITIONS: Array<{ note: NoteName; className: string }> = [
  { note: "C#", className: "black-key--1" },
  { note: "D#", className: "black-key--2" },
  { note: "F#", className: "black-key--3" },
  { note: "G#", className: "black-key--4" },
  { note: "A#", className: "black-key--5" },
];

interface PianoKeyboardProps {
  /** Keys that respond to touch in the current level. */
  activeNotes: NoteName[];
  /** The key to highlight with the glow cue, if any. */
  glowNote: NoteName | null;
  /** Short-lived correctness feedback for real-time games. */
  feedbackNote?: NoteName | null;
  feedbackKind?: "correct" | "wrong" | null;
  onKeyDown: (note: NoteName) => void;
  onKeyUp: (note: NoteName) => void;
}

interface BlackPianoKeyProps {
  note: NoteName;
  positionClassName: string;
  onDown: (note: NoteName) => void;
  onUp: (note: NoteName) => void;
}

function BlackPianoKey({
  note,
  positionClassName,
  onDown,
  onUp,
}: BlackPianoKeyProps) {
  const [pressed, setPressed] = useState(false);
  const pressedRef = useRef(false);

  const handleDown = useCallback(
    (e: ReactPointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.currentTarget.setPointerCapture?.(e.pointerId);
      pressedRef.current = true;
      setPressed(true);
      onDown(note);
    },
    [note, onDown]
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
        "black-key",
        positionClassName,
        `key-${note.toLowerCase().replace("#", "-sharp")}`,
        "is-active",
        pressed ? "is-pressed" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      aria-label={`Key ${note}`}
      onPointerDown={handleDown}
      onPointerUp={handleUp}
      onPointerCancel={handleUp}
      onLostPointerCapture={handleUp}
    >
      <span className="black-key__label">{note}</span>
    </button>
  );
}

export default function PianoKeyboard({
  activeNotes,
  glowNote,
  feedbackNote = null,
  feedbackKind = null,
  onKeyDown,
  onKeyUp,
}: PianoKeyboardProps) {
  const hasPlayableBlackKeys = BLACK_KEYS.some((note) => activeNotes.includes(note));

  return (
    <div className="piano" role="group" aria-label="Piano keys">
      <div className="piano__whites">
        {WHITE_KEYS.map((note) => (
          <PianoKey
            key={note}
            note={note}
            active={activeNotes.includes(note)}
            glowing={glowNote === note}
            feedback={feedbackNote === note ? feedbackKind : null}
            onDown={onKeyDown}
            onUp={onKeyUp}
          />
        ))}
      </div>
      <div className="piano__blacks" aria-hidden={hasPlayableBlackKeys ? undefined : true}>
        {BLACK_KEY_POSITIONS.map(({ note, className }) =>
          activeNotes.includes(note) ? (
            <BlackPianoKey
              key={note}
              note={note}
              positionClassName={className}
              onDown={onKeyDown}
              onUp={onKeyUp}
            />
          ) : (
            <div key={note} className={`black-key ${className}`} />
          )
        )}
      </div>
    </div>
  );
}
