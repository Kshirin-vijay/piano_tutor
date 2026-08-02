import { useCallback, useEffect, useRef, useState } from "react";
import type { NoteName } from "../audio/piano";
import {
  ensureAudioReady,
  playNote,
  playSuccessChime,
  startNote,
  stopNote,
} from "../audio/piano";
import type { EarLevel } from "../ear/earLevels";
import { LevelAttemptTracker } from "../logging/levelAttempt";
import PianoKeyboard, { WHITE_KEYS } from "./PianoKeyboard";
import Instruction from "./Instruction";
import ProgressDots from "./ProgressDots";
import Celebration from "./Celebration";
import "./LevelStage.css";
import "./EarTrainingLevel.css";

/** Keys are always shown the same way for predictability. */
const ACTIVE_NOTES: NoteName[] = WHITE_KEYS;

/** Wait a beat after a round starts before playing, so the change settles. */
const LISTEN_DELAY_MS = 600;
/** A clearer, slightly longer tone for the "what did you hear?" cue. */
const LISTEN_DURATION = "2n";
/** With no correct press for this long, gently reveal the glow safety net. */
const HESITATION_MS = 5000;
/** Short between-round praise. */
const PRAISE_MS = 1300;
/** End-of-level celebration before advancing. */
const LEVEL_DONE_MS = 2600;

type Phase = "playing" | "praise" | "levelComplete";

interface EarTrainingLevelProps {
  earLevel: EarLevel;
  levelNumber: number;
  onLevelComplete: () => void;
}

export default function EarTrainingLevel({
  earLevel,
  levelNumber,
  onLevelComplete,
}: EarTrainingLevelProps) {
  const [roundIndex, setRoundIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>("playing");
  const [showGlow, setShowGlow] = useState(false);
  const [praiseTick, setPraiseTick] = useState(0);
  const [repeatPending, setRepeatPending] = useState(false);
  const [attemptKey, setAttemptKey] = useState(0);

  const playDelayRef = useRef<number | null>(null);
  const hesitationRef = useRef<number | null>(null);
  const advanceRef = useRef<number | null>(null);
  const trackerRef = useRef<LevelAttemptTracker | null>(null);
  // True once a wrong key is tapped this attempt, so the level will replay.
  const hadMistakeRef = useRef(false);

  const target = earLevel.rounds[roundIndex];
  const isLastRound = roundIndex >= earLevel.rounds.length - 1;

  // Reset everything when the level changes or a replay starts.
  useEffect(() => {
    setRoundIndex(0);
    setPhase("playing");
    setShowGlow(false);
    setRepeatPending(false);
    hadMistakeRef.current = false;
  }, [earLevel, attemptKey]);

  useEffect(() => {
    trackerRef.current = new LevelAttemptTracker({
      levelNumber,
      title: earLevel.title,
      kind: "ear",
      attemptNumber: attemptKey + 1,
      totalTasks: earLevel.rounds.length,
    });
  }, [earLevel, levelNumber, attemptKey]);

  // Build audio up front so the listen cue and key taps are ready.
  useEffect(() => {
    void ensureAudioReady();
  }, []);

  // On each new round: stay sound-first, auto-play the target, then arm the
  // hesitation timer that reveals the glow if the child needs help.
  useEffect(() => {
    if (phase !== "playing") return;

    setShowGlow(false);
    playDelayRef.current = window.setTimeout(() => {
      playNote(target, LISTEN_DURATION);
    }, LISTEN_DELAY_MS);
    hesitationRef.current = window.setTimeout(() => {
      setShowGlow(true);
    }, HESITATION_MS);

    return () => {
      if (playDelayRef.current !== null) window.clearTimeout(playDelayRef.current);
      if (hesitationRef.current !== null) window.clearTimeout(hesitationRef.current);
    };
  }, [phase, roundIndex, target]);

  // Cleanup any pending advance timer on unmount.
  useEffect(() => {
    return () => {
      if (advanceRef.current !== null) window.clearTimeout(advanceRef.current);
    };
  }, []);

  const succeed = useCallback(() => {
    if (playDelayRef.current !== null) window.clearTimeout(playDelayRef.current);
    if (hesitationRef.current !== null) window.clearTimeout(hesitationRef.current);
    setShowGlow(false);
    playSuccessChime();
    setPraiseTick((t) => t + 1);

    if (isLastRound) {
      // Advance only on a clean run; otherwise replay this same level.
      const willRepeat = hadMistakeRef.current;
      setRepeatPending(willRepeat);
      setPhase("levelComplete");
      advanceRef.current = window.setTimeout(() => {
        if (willRepeat) {
          trackerRef.current?.finishAttempt("replayed");
          hadMistakeRef.current = false;
          setRepeatPending(false);
          setShowGlow(false);
          setAttemptKey((k) => k + 1);
        } else {
          trackerRef.current?.finishAttempt("passed");
          onLevelComplete();
        }
      }, LEVEL_DONE_MS);
    } else {
      setPhase("praise");
      advanceRef.current = window.setTimeout(() => {
        setRoundIndex((i) => i + 1);
        setPhase("playing");
      }, PRAISE_MS);
    }
  }, [isLastRound, onLevelComplete, levelNumber]);

  const onKeyDown = useCallback(
    (note: NoteName) => {
      // Every key sounds so exploration feels natural.
      startNote(note);
      if (phase !== "playing") return;

      if (note === target) {
        trackerRef.current?.recordSuccess(target, roundIndex);
        succeed();
      } else {
        // Wrong key: no error, just reveal the glow as a gentle safety net.
        // It also marks the attempt, so the level will replay at the end.
        hadMistakeRef.current = true;
        trackerRef.current?.recordMistake(target, note, roundIndex);
        setShowGlow(true);
      }
    },
    [phase, target, succeed, roundIndex]
  );

  const onKeyUp = useCallback((note: NoteName) => {
    stopNote(note);
  }, []);

  const hearAgain = useCallback(() => {
    playNote(target, LISTEN_DURATION);
  }, [target]);

  const completed = phase === "playing" ? roundIndex : roundIndex + 1;
  const instruction = phase === "playing" ? "Listen, then find the key!" : "";

  return (
    <div className="stage">
      <header className="stage__header">
        <div className="stage__level">
          Level {levelNumber}
          <span className="stage__level-title"> &middot; {earLevel.title}</span>
        </div>
        <ProgressDots total={earLevel.rounds.length} completed={completed} />
      </header>

      <div className="stage__main">
        <Instruction text={instruction} />
        {phase === "playing" && (
          <button
            type="button"
            className="ear-listen-button"
            onClick={hearAgain}
            aria-label="Hear it again"
          >
            <span className="ear-listen-button__icon" aria-hidden="true">
              {"\uD83D\uDD0A"}
            </span>
            <span className="ear-listen-button__label">Hear it again</span>
          </button>
        )}
      </div>

      <PianoKeyboard
        activeNotes={ACTIVE_NOTES}
        glowNote={showGlow ? target : null}
        onKeyDown={onKeyDown}
        onKeyUp={onKeyUp}
      />

      <Celebration
        visible={phase !== "playing"}
        big={phase === "levelComplete"}
        title={
          phase === "levelComplete"
            ? repeatPending
              ? "Let's try again!"
              : "You did it!"
            : "Great job!"
        }
        subtitle={
          phase === "levelComplete"
            ? repeatPending
              ? "One more time"
              : `Level ${levelNumber} complete`
            : undefined
        }
        animationKey={praiseTick}
      />
    </div>
  );
}
