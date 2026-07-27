import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import type { NoteName } from "../audio/piano";
import { startNote, stopNote } from "../audio/piano";
import MusicDecor from "./MusicDecor";
import PianoKeyboard, { ALL_KEYS } from "./PianoKeyboard";
import "./FreePlayScreen.css";

const NOTE_COLORS: Record<NoteName, string> = {
  C: "#e23b3b",
  "C#": "#ef7b2d",
  D: "#2f7fd6",
  "D#": "#36a6c9",
  E: "#1f8a4c",
  F: "#d98b16",
  "F#": "#d2aa19",
  G: "#7d54c7",
  "G#": "#9b4fc0",
  A: "#c23d79",
  "A#": "#d94f9c",
  B: "#237d82",
};

const NOTE_ACCENTS: Record<NoteName, [string, string]> = {
  C: ["#ff9f1c", "#ffd93d"],
  "C#": ["#ffd93d", "#ff4fa3"],
  D: ["#39d5ff", "#8d5cff"],
  "D#": ["#4de88b", "#5078ff"],
  E: ["#8de33f", "#20d8c4"],
  F: ["#ffd93d", "#ff5f56"],
  "F#": ["#89e64a", "#ff8c32"],
  G: ["#4f83ff", "#e04bca"],
  "G#": ["#ff4fa3", "#46d8ff"],
  A: ["#ff7a45", "#8d5cff"],
  "A#": ["#9f62e8", "#ffd93d"],
  B: ["#32d6d0", "#67d94c"],
};

const NOTE_POSITIONS: Record<NoteName, number> = {
  C: 7.143,
  "C#": 14.286,
  D: 21.429,
  "D#": 28.571,
  E: 35.714,
  F: 50,
  "F#": 57.143,
  G: 64.286,
  "G#": 71.429,
  A: 78.571,
  "A#": 85.714,
  B: 92.857,
};

const NOTE_SYMBOLS = ["\u266A", "\u266B", "\u2669", "\u266C"];
const NOTE_PARTICLES = [
  { drift: -62, rise: -270, delay: 0, duration: 1450, scale: 1.16 },
  { drift: -22, rise: -225, delay: 55, duration: 1320, scale: 0.82 },
  { drift: 24, rise: -292, delay: 95, duration: 1580, scale: 1.02 },
  { drift: 64, rise: -248, delay: 145, duration: 1420, scale: 0.92 },
];
const BURST_LIFETIME_MS = 1800;
const MAX_VISIBLE_BURSTS = 32;

interface NoteBurst {
  id: number;
  note: NoteName;
  drift: number;
  tilt: number;
  scale: number;
}

interface FreePlayScreenProps {
  onBack: () => void;
}

export default function FreePlayScreen({ onBack }: FreePlayScreenProps) {
  const [bursts, setBursts] = useState<NoteBurst[]>([]);
  const nextBurstIdRef = useRef(0);
  const burstTimersRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    return () => {
      ALL_KEYS.forEach(stopNote);
      burstTimersRef.current.forEach(window.clearTimeout);
      burstTimersRef.current.clear();
    };
  }, []);

  const handleKeyDown = useCallback((note: NoteName) => {
    startNote(note);

    const id = nextBurstIdRef.current++;
    const variation = id % 7;
    const burst: NoteBurst = {
      id,
      note,
      drift: [-54, 36, -24, 58, 18, -42, 46][variation],
      tilt: [-13, 10, -7, 15, 5, -11, 12][variation],
      scale: [0.92, 1.08, 1, 1.15, 0.96, 1.12, 1.04][variation],
    };

    setBursts((current) => [
      ...current.slice(-(MAX_VISIBLE_BURSTS - 1)),
      burst,
    ]);

    const timer = window.setTimeout(() => {
      setBursts((current) => current.filter((item) => item.id !== id));
      burstTimersRef.current.delete(timer);
    }, BURST_LIFETIME_MS);
    burstTimersRef.current.add(timer);
  }, []);

  const handleKeyUp = useCallback((note: NoteName) => {
    stopNote(note);
  }, []);

  return (
    <div className="stage free-play">
      <MusicDecor />
      <header className="free-play__header">
        <button className="free-play__back" type="button" onClick={onBack}>
          {"\u2039"} Home
        </button>
        <div>
          <h1>Free Play</h1>
          <p>Tap any key. Make the music fly!</p>
        </div>
      </header>

      <div className="free-play__piano-zone">
        <div className="free-play__note-effects" aria-hidden="true">
          {bursts.flatMap((burst) => {
            const colors = [
              NOTE_COLORS[burst.note],
              NOTE_ACCENTS[burst.note][0],
              NOTE_ACCENTS[burst.note][1],
              NOTE_COLORS[burst.note],
            ];

            return NOTE_PARTICLES.map((particle, particleIndex) => {
              const particleStyle = {
                "--note-x": `${NOTE_POSITIONS[burst.note]}%`,
                "--particle-color": colors[particleIndex],
                "--particle-accent":
                  colors[(particleIndex + 1) % colors.length],
                "--particle-drift": `${
                  particle.drift + burst.drift * 0.28
                }px`,
                "--particle-rise": `${particle.rise}px`,
                "--particle-tilt": `${
                  (particleIndex % 2 === 0 ? -1 : 1) *
                  (14 + Math.abs(burst.tilt))
                }deg`,
                "--particle-scale": particle.scale * burst.scale,
                "--particle-pop-scale":
                  particle.scale * burst.scale * 1.12,
                "--particle-delay": `${particle.delay}ms`,
                "--particle-duration": `${particle.duration}ms`,
              } as CSSProperties;

              return (
                <span
                  key={`${burst.id}-${particleIndex}`}
                  className="free-play-note"
                  style={particleStyle}
                >
                  <span className="free-play-note__symbol">
                    {NOTE_SYMBOLS[
                      (burst.id + particleIndex) % NOTE_SYMBOLS.length
                    ]}
                  </span>
                </span>
              );
            });
          })}
        </div>

        <PianoKeyboard
          activeNotes={ALL_KEYS}
          glowNote={null}
          onKeyDown={handleKeyDown}
          onKeyUp={handleKeyUp}
        />
      </div>
    </div>
  );
}
