import { useLayoutEffect, useRef, useState } from "react";
import type { NoteName } from "../audio/piano";
import "./HoldTrack.css";

export interface HoldBarItem {
  kind: "hold" | "rest";
  /** Present for holds. */
  note?: NoteName;
  counts: number;
  /** 0..1 fill of this bar. */
  fraction: number;
  status: "done" | "current" | "upcoming";
  /** Released early: freeze and flash gently. */
  paused: boolean;
  /** Optional sing-along syllable shown under the bar. */
  lyric?: string;
  /** True when this syllable's word continues into the next note (shows a dash). */
  joinNext?: boolean;
}

/** Width per count, so longer holds look longer (teaches duration). */
const UNIT = "min(60px, 12vw)";

interface HoldTrackProps {
  items: HoldBarItem[];
}

export default function HoldTrack({ items }: HoldTrackProps) {
  const windowRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const currentRef = useRef<HTMLDivElement>(null);
  const [offset, setOffset] = useState(0);

  // Keep the current bar centered in the window; everything else flows around
  // it and is clipped, so completed bars scroll away and new ones scroll in.
  useLayoutEffect(() => {
    function recenter() {
      const win = windowRef.current;
      const cur = currentRef.current;
      if (!win || !cur) return;
      setOffset(win.clientWidth / 2 - (cur.offsetLeft + cur.offsetWidth / 2));
    }
    recenter();
    window.addEventListener("resize", recenter);
    return () => window.removeEventListener("resize", recenter);
  }, [items]);

  return (
    <div className="hold-track" ref={windowRef} aria-hidden="true">
      <div
        className="hold-track__inner"
        ref={innerRef}
        style={{ transform: `translateX(${offset}px)` }}
      >
        {items.map((it, i) => {
          const colorClass = it.kind === "rest" ? "bar-rest" : `bar-${it.note?.toLowerCase()}`;
          return (
            <div
              key={i}
              ref={it.status === "current" ? currentRef : undefined}
              className={`hold-cell is-${it.status}`}
              style={{ width: `calc(${it.counts} * ${UNIT})` }}
            >
              <div className={["hold-bar", colorClass].join(" ")}>
                <div
                  className={`hold-bar__fill ${it.paused ? "is-paused" : ""}`}
                  style={{
                    width: `${Math.max(0, Math.min(1, it.fraction)) * 100}%`,
                  }}
                />
                {it.kind === "hold" &&
                  Array.from({ length: it.counts - 1 }).map((_, k) => (
                    <span
                      key={k}
                      className="hold-bar__tick"
                      style={{ left: `${((k + 1) / it.counts) * 100}%` }}
                    />
                  ))}
                <span className="hold-bar__label">
                  {it.kind === "rest" ? "\u00B7\u00B7\u00B7" : it.note}
                </span>
              </div>
              {it.lyric && <span className="hold-bar__lyric">{it.lyric}</span>}
              {it.joinNext && (
                <span className="hold-bar__lyric-join" aria-hidden="true">
                  -
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
