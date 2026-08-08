import { useCallback, useEffect, useRef, useState } from "react";
import type { NoteName } from "../audio/piano";
import {
  playSuccessChime,
  startNote,
  stopNote,
} from "../audio/piano";
import { useSpeak } from "../audio/useSpeak";
import { getCountMs } from "../engine/useLevelEngine";
import { LevelAttemptTracker } from "../logging/levelAttempt";
import {
  getSheetNoteCounts,
  type SheetMusicLevel as SheetMusicLevelConfig,
  type SheetNoteCounts,
} from "../sheet/sheetMusicLevels";
import Celebration from "./Celebration";
import PianoKeyboard, { WHITE_KEYS } from "./PianoKeyboard";
import ProgressDots from "./ProgressDots";
import "./SheetMusicLevel.css";

const NOTE_Y: Record<NoteName, number> = {
  C: 242,
  "C#": 234,
  D: 225,
  "D#": 217,
  E: 208,
  F: 191,
  "F#": 183,
  G: 174,
  "G#": 166,
  A: 157,
  "A#": 149,
  B: 140,
};

const NOTE_LABEL: Record<NoteName, string> = {
  C: "C",
  "C#": "C#",
  D: "D",
  "D#": "D#",
  E: "E",
  F: "F",
  "F#": "F#",
  G: "G",
  "G#": "G#",
  A: "A",
  "A#": "A#",
  B: "B",
};

const STAFF_START_X = 595;
const STAFF_END_X = 45;
const ACTIVE_LINE_X = 258;
const HIT_ZONE_BEFORE = 92;
const HIT_ZONE_AFTER = 58;
const FEEDBACK_MS = 360;
const HOLD_TICK_MS = 32;
const NOTE_SPACING_RATIO = 0.44;
const NOTE_ARRIVAL_PROGRESS =
  (STAFF_START_X - ACTIVE_LINE_X) / (STAFF_START_X - STAFF_END_X);

type Phase = "review" | "playing" | "summary";
type ResultStatus = "correct" | "missed";
type FeedbackKind = "correct" | "wrong";

interface NoteResult {
  index: number;
  note: NoteName;
  status: ResultStatus;
}

interface FeedbackState {
  note: NoteName;
  kind: FeedbackKind;
  tick: number;
}

interface ActiveSheetHold {
  note: NoteName;
  index: number;
  startedAt: number;
  requiredMs: number;
}

interface SheetMusicLevelProps {
  level: SheetMusicLevelConfig;
  levelNumber: number;
  onLevelComplete: () => void;
}

function StaticReviewStaff({
  notes,
  showLabels = true,
}: {
  notes: NoteName[];
  showLabels?: boolean;
}) {
  return (
    <svg
      className="sheet-review-staff"
      viewBox="5 30 610 230"
      role="img"
      aria-label={`Review notes ${notes.map((note) => NOTE_LABEL[note]).join(", ")}`}
    >
      <StaffBase />
      {notes.map((note, index) => (
        <StaffNote
          key={`${note}-${index}`}
          note={note}
          x={316 + index * 82 - ((notes.length - 1) * 82) / 2}
          showLabel={showLabels}
          active={false}
          status={null}
        />
      ))}
    </svg>
  );
}

function StaffBase() {
  return (
    <>
      <g className="sheet-staff__lines" aria-hidden="true">
        {[72, 106, 140, 174, 208].map((y) => (
          <line key={y} x1="38" x2="588" y1={y} y2={y} />
        ))}
      </g>
      <text className="sheet-clef" x="76" y="238" aria-hidden="true">
        {"\uD834\uDD1E"}
      </text>
    </>
  );
}

function StaffNote({
  note,
  x,
  showLabel,
  active,
  status,
  counts = 1,
  holdFraction = 0,
}: {
  note: NoteName;
  x: number;
  showLabel: boolean;
  active: boolean;
  status: ResultStatus | null;
  counts?: SheetNoteCounts;
  holdFraction?: number;
}) {
  const y = NOTE_Y[note];
  const isLong = counts > 1;
  const headWidth = isLong ? 54 + (counts - 1) * 28 : 54;
  const headRadiusX = headWidth / 2;
  const stemX = isLong ? x + headRadiusX - 5 : x + 22;
  const progress = Math.max(0, Math.min(1, holdFraction));
  const noteClass = [
    "sheet-note",
    `sheet-note--${note.toLowerCase()}`,
    counts > 1 ? "is-long" : "",
    active ? "is-active" : "",
    status ? `is-${status}` : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <g
      className={noteClass}
      aria-label={`${NOTE_LABEL[note]} note, ${counts} ${counts === 1 ? "count" : "counts"}`}
    >
      {note === "C" ? (
        <line
          className="sheet-note__ledger"
          x1={x - headRadiusX - 9}
          x2={x + headRadiusX + 9}
          y1={y}
          y2={y}
        />
      ) : null}
      {isLong ? (
        <>
          <rect
            className="sheet-note__head sheet-note__head--long"
            x={x - headRadiusX}
            y={y - 17}
            width={headWidth}
            height="34"
            rx="17"
          />
          {active ? (
            <rect
              className="sheet-note__hold-fill"
              x={x - headRadiusX + 4}
              y={y - 13}
              width={Math.max(0, (headWidth - 8) * progress)}
              height="26"
              rx="13"
            />
          ) : null}
          {Array.from({ length: counts - 1 }).map((_, index) => {
            const tickX = x - headRadiusX + (headWidth * (index + 1)) / counts;
            return (
              <line
                key={index}
                className="sheet-note__count-tick"
                x1={tickX}
                x2={tickX}
                y1={y - 13}
                y2={y + 13}
              />
            );
          })}
        </>
      ) : (
        <ellipse
          className="sheet-note__head"
          cx={x}
          cy={y}
          rx={headRadiusX}
          ry="17"
          transform={`rotate(-18 ${x} ${y})`}
        />
      )}
      <line
        className="sheet-note__stem"
        x1={stemX}
        x2={stemX}
        y1={y - 6}
        y2={y - 86}
      />
      {showLabel ? (
        <text className="sheet-note__label" x={x} y={y + 2}>
          {note}
        </text>
      ) : null}
      {counts > 1 ? (
        <g className="sheet-note__duration" transform={`translate(${x} ${y + 39})`}>
          <rect x="-34" y="-12" width="68" height="24" rx="12" />
          <text x="0" y="1">{counts} counts</text>
        </g>
      ) : null}
    </g>
  );
}

function ScrollingStaff({
  level,
  noteIndex,
  gameStartedAt,
  now,
  noteSpacingMs,
  paceMs,
  showLabels,
  results,
  lastResult,
  holdFraction,
}: {
  level: SheetMusicLevelConfig;
  noteIndex: number;
  gameStartedAt: number;
  now: number;
  noteSpacingMs: number;
  paceMs: number;
  showLabels: boolean;
  results: NoteResult[];
  lastResult: NoteResult | null;
  holdFraction: number;
}) {
  const { sequence } = level;
  const statusByIndex = new Map(
    results.map((result) => [result.index, result.status])
  );
  if (lastResult) {
    statusByIndex.set(lastResult.index, lastResult.status);
  }

  const visibleNotes = sequence
    .map((note, index) => {
      const noteElapsed = now - gameStartedAt - index * noteSpacingMs;
      const progress = noteElapsed / paceMs;
      const x = STAFF_START_X - progress * (STAFF_START_X - STAFF_END_X);
      return { index, note, x, counts: getSheetNoteCounts(level, index) };
    })
    .filter(({ x }) => x > 14 && x < 680);

  return (
    <section className="sheet-panel" aria-label="Scrolling treble staff">
      <svg
        className="sheet-staff"
        viewBox="5 30 610 265"
        role="group"
        aria-label="Treble staff with moving notes"
      >
        <title>Treble staff with moving notes</title>
        <StaffBase />
        <rect
          className="sheet-hit-zone"
          x={ACTIVE_LINE_X - HIT_ZONE_AFTER}
          y="38"
          width={HIT_ZONE_BEFORE + HIT_ZONE_AFTER}
          height="220"
          rx="10"
          aria-hidden="true"
        />
        <line
          className="sheet-active-line"
          x1={ACTIVE_LINE_X}
          x2={ACTIVE_LINE_X}
          y1="38"
          y2="258"
          aria-hidden="true"
        />
        {visibleNotes.map(({ index, note, x, counts }) => (
          <StaffNote
            key={index}
            note={note}
            x={x}
            showLabel={showLabels}
            active={index === noteIndex}
            status={statusByIndex.get(index) ?? null}
            counts={counts}
            holdFraction={index === noteIndex ? holdFraction : 0}
          />
        ))}
      </svg>
    </section>
  );
}

function SummaryPanel({
  results,
  onContinue,
}: {
  results: NoteResult[];
  onContinue: () => void;
}) {
  const correct = results.filter((result) => result.status === "correct");
  const missed = results.filter((result) => result.status === "missed");
  const score = Math.round((correct.length / Math.max(1, results.length)) * 100);

  return (
    <section className="sheet-summary" aria-label="Level summary">
      <div className="sheet-summary__score">
        <span>{score}%</span>
        <p>Score</p>
      </div>

      <div className="sheet-summary__columns">
        <div className="sheet-summary__list">
          <h2>Correct</h2>
          <p>{correct.length ? correct.map((result) => NOTE_LABEL[result.note]).join(", ") : "None yet"}</p>
        </div>
        <div className="sheet-summary__list">
          <h2>Missed</h2>
          <p>{missed.length ? missed.map((result) => NOTE_LABEL[result.note]).join(", ") : "None"}</p>
        </div>
      </div>

      <button className="sheet-summary__continue" type="button" onClick={onContinue}>
        Continue
      </button>
    </section>
  );
}

export default function SheetMusicLevel({
  level,
  levelNumber,
  onLevelComplete,
}: SheetMusicLevelProps) {
  const [phase, setPhase] = useState<Phase>("review");
  const [noteIndex, setNoteIndex] = useState(0);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => performance.now());
  const [results, setResults] = useState<NoteResult[]>([]);
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);
  const [lastResult, setLastResult] = useState<NoteResult | null>(null);
  const [showSummaryCelebration, setShowSummaryCelebration] = useState(false);
  const [heldMs, setHeldMs] = useState(0);
  const [isHolding, setIsHolding] = useState(false);
  const [releasedEarly, setReleasedEarly] = useState(false);
  const resolvingRef = useRef(false);
  const phaseRef = useRef<Phase>(phase);
  const noteIndexRef = useRef(noteIndex);
  const feedbackTimeoutRef = useRef<number | null>(null);
  const holdIntervalRef = useRef<number | null>(null);
  const activeHoldRef = useRef<ActiveSheetHold | null>(null);
  const summaryCelebratedRef = useRef(false);
  const trackerRef = useRef<LevelAttemptTracker | null>(null);

  const currentNote = level.sequence[noteIndex] ?? level.sequence[0];
  const currentCounts = getSheetNoteCounts(level, noteIndex);
  const requiredHoldMs = currentCounts * getCountMs();
  const holdFraction = currentCounts > 1 ? heldMs / requiredHoldMs : 0;
  const countsHeld = Math.min(currentCounts, Math.floor(heldMs / getCountMs()));
  const hasLongNotes = Boolean(level.countPattern?.some((counts) => counts > 1));
  const noteSpacingMs = level.paceMs * NOTE_SPACING_RATIO;
  const noteArrivalMs = level.paceMs * NOTE_ARRIVAL_PROGRESS;
  const rawElapsed =
    startedAt === null ? 0 : now - startedAt - noteIndex * noteSpacingMs;
  const displayNow =
    startedAt === null
      ? now
      : Math.min(now, startedAt + noteIndex * noteSpacingMs + noteArrivalMs);
  const noteReady = rawElapsed >= noteArrivalMs;
  const completed = phase === "summary" ? level.sequence.length : results.length;
  const instruction =
    phase === "review"
      ? "Review the notes."
      : phase === "playing"
      ? noteReady
        ? currentCounts > 1
          ? releasedEarly
            ? `Keep holding ${currentNote} until ${currentCounts}!`
            : `Hold ${currentNote} for ${currentCounts} counts!`
          : `Play ${currentNote}!`
        : ""
      : "Level complete.";

  const spoken =
    phase === "review"
      ? `${level.introSpeech ?? level.reviewText}${
          hasLongNotes
            ? " Long notes are stretched. Hold them for the number of counts shown."
            : ""
        }`
      : "";
  useSpeak(spoken);

  const clearHoldTimer = useCallback(() => {
    if (holdIntervalRef.current !== null) {
      window.clearInterval(holdIntervalRef.current);
      holdIntervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  useEffect(() => {
    noteIndexRef.current = noteIndex;
  }, [noteIndex]);

  useEffect(() => {
    setPhase("review");
    setNoteIndex(0);
    setStartedAt(null);
    setResults([]);
    setFeedback(null);
    setLastResult(null);
    setShowSummaryCelebration(false);
    setHeldMs(0);
    setIsHolding(false);
    setReleasedEarly(false);
    resolvingRef.current = false;
    activeHoldRef.current = null;
    clearHoldTimer();
    summaryCelebratedRef.current = false;
  }, [level, clearHoldTimer]);

  useEffect(() => {
    if (phase !== "playing") return;
    let frameId = 0;

    const tick = () => {
      setNow(performance.now());
      frameId = window.requestAnimationFrame(tick);
    };

    frameId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frameId);
  }, [phase]);

  const clearFeedback = useCallback(() => {
    if (feedbackTimeoutRef.current !== null) {
      window.clearTimeout(feedbackTimeoutRef.current);
    }
    feedbackTimeoutRef.current = window.setTimeout(() => {
      setFeedback(null);
      feedbackTimeoutRef.current = null;
    }, FEEDBACK_MS);
  }, []);

  const showFeedback = useCallback(
    (note: NoteName, kind: FeedbackKind) => {
      setFeedback((current) => ({
        note,
        kind,
        tick: (current?.tick ?? 0) + 1,
      }));
      clearFeedback();
    },
    [clearFeedback]
  );

  const advanceNote = useCallback(
    (status: ResultStatus) => {
      if (resolvingRef.current || phaseRef.current !== "playing") return;
      resolvingRef.current = true;
      clearHoldTimer();
      activeHoldRef.current = null;
      setIsHolding(false);

      const index = noteIndexRef.current;
      const result = {
        index,
        note: level.sequence[index] ?? level.sequence[0],
        status,
      };
      setLastResult(result);
      setResults((current) => [...current, result]);

      if (status === "correct") {
        trackerRef.current?.recordSuccess(result.note, index);
        playSuccessChime();
      }

      window.setTimeout(() => {
        if (index >= level.sequence.length - 1) {
          setPhase("summary");
          resolvingRef.current = false;
          return;
        }

        const nextIndex = index + 1;
        const realNow = performance.now();
        const pausedVirtualElapsed = index * noteSpacingMs + noteArrivalMs;
        noteIndexRef.current = nextIndex;
        setNoteIndex(nextIndex);
        setStartedAt(realNow - pausedVirtualElapsed);
        setNow(realNow);
        setLastResult(null);
        setHeldMs(0);
        setReleasedEarly(false);
        resolvingRef.current = false;
      }, status === "correct" ? 150 : 260);
    },
    [level.sequence, noteArrivalMs, noteSpacingMs, clearHoldTimer]
  );

  useEffect(() => {
    if (phase !== "summary" || summaryCelebratedRef.current) return;
    summaryCelebratedRef.current = true;
    setShowSummaryCelebration(true);
    playSuccessChime();

    const celebrationTimeout = window.setTimeout(() => {
      setShowSummaryCelebration(false);
    }, 1450);

    return () => window.clearTimeout(celebrationTimeout);
  }, [phase, results]);

  useEffect(() => {
    return () => {
      if (feedbackTimeoutRef.current !== null) {
        window.clearTimeout(feedbackTimeoutRef.current);
      }
      clearHoldTimer();
      activeHoldRef.current = null;
      trackerRef.current?.abandon("unmount");
      WHITE_KEYS.forEach(stopNote);
    };
  }, [clearHoldTimer]);

  const handleStartGame = useCallback(() => {
    const start = performance.now();
    trackerRef.current = new LevelAttemptTracker({
      levelNumber,
      title: level.title,
      kind: "sheet",
      attemptNumber: 1,
      totalTasks: level.sequence.length,
    });
    setPhase("playing");
    setNoteIndex(0);
    setStartedAt(start);
    setNow(start);
    setResults([]);
    setFeedback(null);
    setLastResult(null);
    setShowSummaryCelebration(false);
    setHeldMs(0);
    setIsHolding(false);
    setReleasedEarly(false);
    activeHoldRef.current = null;
    clearHoldTimer();
    resolvingRef.current = false;
    summaryCelebratedRef.current = false;
  }, [clearHoldTimer, level, levelNumber]);

  const handleContinue = useCallback(() => {
    trackerRef.current?.finishAttempt("passed");
    onLevelComplete();
  }, [onLevelComplete]);

  const handleKeyDown = useCallback(
    (note: NoteName) => {
      startNote(note);

      if (phaseRef.current !== "playing" || resolvingRef.current) return;

      if (!noteReady) {
        const expectedNote = level.sequence[noteIndexRef.current];
        if (expectedNote) {
          trackerRef.current?.recordMistake(expectedNote, note, noteIndexRef.current);
        }
        showFeedback(note, "wrong");
        return;
      }

      const index = noteIndexRef.current;
      const expectedNote = level.sequence[index];
      if (note !== expectedNote) {
        trackerRef.current?.recordMistake(expectedNote, note, index);
        showFeedback(note, "wrong");
        return;
      }

      const counts = getSheetNoteCounts(level, index);
      if (counts === 1) {
        showFeedback(note, "correct");
        advanceNote("correct");
        return;
      }

      // Ignore repeat pointer/key events while this same long note is held.
      if (activeHoldRef.current) return;

      clearHoldTimer();
      const activeHold: ActiveSheetHold = {
        note,
        index,
        startedAt: performance.now(),
        requiredMs: counts * getCountMs(),
      };
      activeHoldRef.current = activeHold;
      setHeldMs(0);
      setIsHolding(true);
      setReleasedEarly(false);

      holdIntervalRef.current = window.setInterval(() => {
        const active = activeHoldRef.current;
        if (!active || active !== activeHold || resolvingRef.current) return;

        const elapsed = performance.now() - active.startedAt;
        setHeldMs(Math.min(elapsed, active.requiredMs));
        if (elapsed < active.requiredMs) return;

        clearHoldTimer();
        activeHoldRef.current = null;
        setIsHolding(false);
        setHeldMs(active.requiredMs);
        showFeedback(note, "correct");
        advanceNote("correct");
      }, HOLD_TICK_MS);
    },
    [advanceNote, clearHoldTimer, level, noteReady, showFeedback]
  );

  const handleKeyUp = useCallback(
    (note: NoteName) => {
      stopNote(note);

      const active = activeHoldRef.current;
      if (!active || active.note !== note || active.index !== noteIndexRef.current) {
        return;
      }

      clearHoldTimer();
      activeHoldRef.current = null;
      setIsHolding(false);
      setHeldMs(0);
      setReleasedEarly(true);
    },
    [clearHoldTimer]
  );

  return (
    <div className="stage sheet-level">
      <header className="stage__header">
        <div className="stage__level">
          Level {levelNumber}
          <span className="stage__level-title"> &middot; {level.title}</span>
        </div>
        <ProgressDots total={level.sequence.length} completed={completed} />
      </header>

      <main className="sheet-level__main" aria-live="polite">
        {phase === "review" ? (
          <section className="sheet-review" role="dialog" aria-label={level.reviewTitle}>
            <div className="sheet-review__copy">
              <p className="sheet-review__eyebrow">{level.reviewTitle}</p>
              <h1>{level.targetNotes.map((note) => NOTE_LABEL[note]).join(" + ")}</h1>
              <p>{level.reviewText}</p>
              {hasLongNotes ? (
                <p className="sheet-review__duration-tip">
                  <span aria-hidden="true">♪</span>
                  Longer notes use a wider bar. Hold the key for 2–4 counts.
                </p>
              ) : null}
            </div>
            <StaticReviewStaff notes={level.introducedNotes} />
            <button className="sheet-review__start" type="button" onClick={handleStartGame}>
              Start
            </button>
          </section>
        ) : phase === "summary" ? (
          <SummaryPanel
            results={results}
            onContinue={handleContinue}
          />
        ) : (
          <ScrollingStaff
            level={level}
            noteIndex={noteIndex}
            gameStartedAt={startedAt ?? now}
            now={displayNow}
            noteSpacingMs={noteSpacingMs}
            paceMs={level.paceMs}
            showLabels={level.showLabels}
            results={results}
            lastResult={lastResult}
            holdFraction={holdFraction}
          />
        )}

        <div className="sheet-game-status">
          <span>
            {phase === "summary" ? level.sequence.length : results.length + 1} /{" "}
            {level.sequence.length}
          </span>
          <span className="sheet-game-status__instruction">
            {instruction || "\u00a0"}
          </span>
          <span>
            {phase === "review"
              ? "Start when ready"
              : phase === "summary"
              ? "Finished"
              : !noteReady
              ? "Get ready"
              : currentCounts === 1
              ? "Play now"
              : isHolding
              ? `Holding ${countsHeld} / ${currentCounts}`
              : `${currentCounts} count hold`}
          </span>
        </div>
      </main>

      <PianoKeyboard
        activeNotes={WHITE_KEYS}
        glowNote={phase === "playing" && noteReady ? currentNote : null}
        feedbackNote={feedback?.note ?? null}
        feedbackKind={feedback?.kind ?? null}
        onKeyDown={handleKeyDown}
        onKeyUp={handleKeyUp}
      />

      <Celebration
        visible={showSummaryCelebration}
        big
        title="Level complete"
        subtitle="Great reading!"
        animationKey={results.length}
      />
    </div>
  );
}
