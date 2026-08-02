import { useEffect, useMemo, useRef, useCallback } from "react";
import "./MusicDecor.css";

const BG_COLORS = [
  "#FCE4EC", "#E3F2FD", "#E8F5E9", "#FFF8E1", "#F3E5F5",
  "#E0F7FA", "#FBE9E7", "#EDE7F6", "#F1F8E9", "#E8EAF6",
];

const NOTE_COLORS = [
  "#FF6B6B", "#FF9F43", "#FECA57", "#48DBFB", "#1DD1A1",
  "#FF6B81", "#A29BFE", "#6C5CE7", "#00CEC9", "#FD79A8",
];

const GLYPHS = ["\u2669", "\u266A", "\u266B", "\u266C", "\uD834\uDD1E"];

const CHOSEN_BG = BG_COLORS[Math.floor(Math.random() * BG_COLORS.length)];

interface NoteData {
  glyph: string;
  left: number;
  top: number;
  size: number;
  rotation: number;
  color: string;
  opacity: number;
}

function generateNotes(count: number): NoteData[] {
  const out: NoteData[] = [];
  for (let i = 0; i < count; i++) {
    out.push({
      glyph: GLYPHS[i % GLYPHS.length],
      left: Math.random() * 100,
      top: Math.random() * 100,
      size: 50 + Math.random() * 110,
      rotation: -40 + Math.random() * 80,
      color: NOTE_COLORS[i % NOTE_COLORS.length],
      opacity: +(0.18 + Math.random() * 0.22).toFixed(2),
    });
  }
  return out;
}

export default function MusicDecor() {
  const notes = useMemo(() => generateNotes(35), []);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    document.documentElement.style.setProperty("--bg", CHOSEN_BG);
    return () => {
      document.documentElement.style.removeProperty("--bg");
    };
  }, []);

  const handleTouchStart = useCallback(
    (e: React.TouchEvent<HTMLSpanElement>, note: NoteData) => {
      const el = e.currentTarget;
      el.style.transform = `scale(1.5) rotate(${(note.rotation * 0.3).toFixed(1)}deg)`;
      el.style.opacity = "1";
      el.style.filter = "saturate(2) brightness(1.3)";
      el.style.textShadow = `0 0 20px ${note.color}, 0 0 50px ${note.color}`;

      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        el.style.transform = `rotate(${note.rotation}deg)`;
        el.style.opacity = String(note.opacity);
        el.style.filter = "";
        el.style.textShadow = "";
        timerRef.current = null;
      }, 600);
    },
    [],
  );

  return (
    <div className="music-decor" aria-hidden="true">
      {notes.map((n, i) => (
        <span
          key={i}
          className="decor"
          style={{
            left: `${n.left}%`,
            top: `${n.top}%`,
            fontSize: `${n.size}px`,
            transform: `rotate(${n.rotation}deg)`,
            color: n.color,
            opacity: n.opacity,
          }}
          onTouchStart={(e) => handleTouchStart(e, n)}
        >
          {n.glyph}
        </span>
      ))}
    </div>
  );
}
