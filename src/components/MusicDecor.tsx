import "./MusicDecor.css";

/** Faint, static music glyphs scattered for a calm, musical feel. Non-interactive. */
const NOTES: { glyph: string; top: string; left: string; size: string; rot: string }[] = [
  { glyph: "\u266A", top: "5%", left: "6%", size: "5rem", rot: "-12deg" },
  { glyph: "\u266B", top: "9%", left: "28%", size: "3.4rem", rot: "8deg" },
  { glyph: "\u2669", top: "4%", left: "52%", size: "4.2rem", rot: "-6deg" },
  { glyph: "\u266C", top: "10%", left: "74%", size: "5.6rem", rot: "10deg" },
  { glyph: "\u266A", top: "6%", left: "92%", size: "3.2rem", rot: "-10deg" },
  { glyph: "\u266B", top: "34%", left: "3%", size: "4rem", rot: "6deg" },
  { glyph: "\u266C", top: "44%", left: "88%", size: "4.6rem", rot: "-8deg" },
  { glyph: "\u2669", top: "40%", left: "48%", size: "3rem", rot: "12deg" },
  { glyph: "\u266A", top: "68%", left: "12%", size: "5rem", rot: "9deg" },
  { glyph: "\u266B", top: "78%", left: "32%", size: "3.6rem", rot: "-12deg" },
  { glyph: "\u266C", top: "72%", left: "55%", size: "4.2rem", rot: "7deg" },
  { glyph: "\u2669", top: "82%", left: "76%", size: "5.4rem", rot: "-6deg" },
  { glyph: "\u266A", top: "90%", left: "92%", size: "3.4rem", rot: "11deg" },
  { glyph: "\u266B", top: "92%", left: "6%", size: "4rem", rot: "-9deg" },
  { glyph: "\u2669", top: "18%", left: "16%", size: "3rem", rot: "10deg" },
  { glyph: "\u266C", top: "22%", left: "63%", size: "3.6rem", rot: "-7deg" },
  { glyph: "\u266A", top: "26%", left: "84%", size: "3rem", rot: "9deg" },
  { glyph: "\u266B", top: "52%", left: "20%", size: "4.4rem", rot: "-11deg" },
  { glyph: "\u2669", top: "56%", left: "68%", size: "3.2rem", rot: "8deg" },
  { glyph: "\u266C", top: "58%", left: "38%", size: "3rem", rot: "-5deg" },
  { glyph: "\u266A", top: "48%", left: "94%", size: "3.4rem", rot: "12deg" },
  { glyph: "\u266B", top: "62%", left: "4%", size: "3rem", rot: "7deg" },
  { glyph: "\u2669", top: "30%", left: "38%", size: "2.8rem", rot: "-10deg" },
  { glyph: "\u266C", top: "84%", left: "44%", size: "3.6rem", rot: "9deg" },
];

export default function MusicDecor() {
  return (
    <div className="music-decor" aria-hidden="true">
      {NOTES.map((n, i) => (
        <span
          key={i}
          className="decor"
          style={{
            top: n.top,
            left: n.left,
            fontSize: n.size,
            transform: `rotate(${n.rot})`,
          }}
        >
          {n.glyph}
        </span>
      ))}
    </div>
  );
}
