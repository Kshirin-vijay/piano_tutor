import { useEffect } from "react";
import type { NoteName } from "../audio/piano";
import type { Level, Task, HoldTask, RestTask } from "../levels/levels";
import { useLevelEngine, getCountMs } from "../engine/useLevelEngine";
import { useSpeak } from "../audio/useSpeak";
import { speakPhrase } from "../audio/speech";
import { phrase } from "../audio/phrases";
import PianoKeyboard, { WHITE_KEYS } from "./PianoKeyboard";
import Instruction from "./Instruction";
import ProgressDots from "./ProgressDots";
import HoldTrack from "./HoldTrack";
import type { HoldBarItem } from "./HoldTrack";
import Celebration from "./Celebration";
import { asset } from "../assets";
import "./LevelStage.css";

/** Keys are always shown the same way for predictability. */
const ACTIVE_NOTES: NoteName[] = WHITE_KEYS;

interface LevelStageProps {
  level: Level;
  onLevelComplete: () => void;
  /** Shown in the header instead of "Level N" (used for songs). */
  headerText?: string;
  /** Songs play straight through with no per-note praise. */
  continuous?: boolean;
}

function buildInstruction(task: Task | undefined): string {
  if (!task) return "";
  if (task.type === "rest") return "Rest!";
  const fingerText = task.fingerNumber ? ` with finger ${task.fingerNumber}` : "";
  if (task.type === "tap") return `Tap ${task.note}${fingerText}!`;
  const unit = task.counts === 1 ? "count" : "counts";
  return `Hold ${task.note}${fingerText} for ${task.counts} ${unit}!`;
}

/**
 * The text spoken for a task. Sourced from the phrase registry (not the visible
 * instruction), so wording can be reworded/voiced independently of the screen.
 */
function buildSpoken(task: Task | undefined): string {
  if (!task) return "";
  if (task.type === "rest") return phrase("rest")?.text ?? "";
  if (task.type === "tap")
    return phrase("tap", task.note, task.fingerNumber)?.text ?? "";
  return phrase("hold", task.note, task.counts, task.fingerNumber)?.text ?? "";
}

export default function LevelStage({
  level,
  onLevelComplete,
  headerText,
  continuous,
}: LevelStageProps) {
  const engine = useLevelEngine(level, onLevelComplete, { continuous });

  const instruction =
    engine.phase === "playing" ? buildInstruction(engine.task) : "";

  // Speak each new task prompt. Songs (continuous) play straight through and
  // stay silent, matching their lack of per-note praise.
  const spoken =
    engine.phase === "playing" ? buildSpoken(engine.task) : "";
  useSpeak(continuous ? "" : spoken);

  // Speak the celebration just after the success chime. praiseTick bumps once
  // per success (between tasks and at level/song end); for songs it only bumps
  // at the end, so only the final "You did it" is spoken.
  useEffect(() => {
    if (engine.praiseTick === 0) return;
    if (engine.phase === "levelComplete") {
      speakPhrase(engine.repeatPending ? "tryAgain" : "levelDone");
    } else if (engine.phase === "praise") {
      speakPhrase("praise");
    }
  }, [engine.praiseTick, engine.phase, engine.repeatPending]);

  const fingerNumber =
    engine.phase === "playing" && engine.task && engine.task.type !== "rest"
      ? engine.task.fingerNumber
      : undefined;

  const completed =
    engine.phase === "playing" ? engine.taskIndex : engine.taskIndex + 1;

  // Build the full row of timed bars (holds + rests) with done/current/upcoming
  // status. The carousel keeps them all mounted and scrolls the current one to
  // the center.
  const holdItems: HoldBarItem[] = level.tasks
    .map((t, idx) => ({ t, idx }))
    .filter(
      (x): x is { t: HoldTask | RestTask; idx: number } =>
        x.t.type === "hold" || x.t.type === "rest"
    )
    .map(({ t, idx }) => {
      const required = t.counts * getCountMs();
      const status: HoldBarItem["status"] =
        idx < engine.taskIndex
          ? "done"
          : idx === engine.taskIndex
          ? "current"
          : "upcoming";
      const fraction =
        status === "done"
          ? 1
          : status === "current"
          ? engine.phase === "playing"
            ? engine.heldMs / required
            : 1
          : 0;
      return {
        kind: t.type === "rest" ? "rest" : "hold",
        note: t.type === "hold" ? t.note : undefined,
        counts: t.counts,
        fraction,
        status,
        paused: status === "current" && engine.holdPaused,
        lyric: t.lyric,
        joinNext: t.joinNext,
      };
    });

  return (
    <div className="stage">
      {fingerNumber ? (
        <div className="stage__finger-photo">
          <img
            src={asset(`hands/hand-right-${fingerNumber}.png`)}
            alt={`Right hand finger ${fingerNumber} position`}
          />
        </div>
      ) : null}

      <header className="stage__header">
        <div className="stage__level">
          {headerText ?? (
            <>
              Level {level.number}
              <span className="stage__level-title"> &middot; {level.title}</span>
            </>
          )}
        </div>
        <ProgressDots total={engine.totalTasks} completed={completed} />
      </header>

      <div className="stage__top">
        {holdItems.length > 0 && <HoldTrack items={holdItems} />}
      </div>

      <div className="stage__main">
        <Instruction text={instruction} />
        {fingerNumber ? (
          <div className="stage__finger-cue" aria-label={`Use finger ${fingerNumber}`}>
            <span>Finger</span>
            <strong>{fingerNumber}</strong>
          </div>
        ) : null}
      </div>

      <PianoKeyboard
        activeNotes={ACTIVE_NOTES}
        glowNote={engine.targetNote}
        onKeyDown={engine.onKeyDown}
        onKeyUp={engine.onKeyUp}
      />

      <Celebration
        visible={engine.phase !== "playing"}
        big={engine.phase === "levelComplete"}
        title={
          engine.phase === "levelComplete"
            ? engine.repeatPending
              ? "Let's try again!"
              : "You did it!"
            : "Great job!"
        }
        subtitle={
          engine.phase === "levelComplete"
            ? engine.repeatPending
              ? "One more time"
              : headerText
              ? "Song complete"
              : `Level ${level.number} complete`
            : undefined
        }
        animationKey={engine.praiseTick}
      />
    </div>
  );
}
