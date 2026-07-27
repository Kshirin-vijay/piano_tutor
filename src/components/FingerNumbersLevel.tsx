import { useEffect, useMemo, useState } from "react";
import MusicDecor from "./MusicDecor";
import ProgressDots from "./ProgressDots";
import { asset } from "../assets";
import "./FingerNumbersLevel.css";

type HandSide = "right" | "left";
type Phase = "intro" | "teach" | "quiz";

interface FingerNumbersLevelProps {
  levelNumber: number;
  onLevelComplete: () => void;
}

interface Finger {
  number: number;
  ordinal: string;
  name: string;
  className: string;
}

const FINGERS: Finger[] = [
  { number: 1, ordinal: "1st", name: "Thumb", className: "thumb" },
  { number: 2, ordinal: "2nd", name: "Index", className: "index" },
  { number: 3, ordinal: "3rd", name: "Middle", className: "middle" },
  { number: 4, ordinal: "4th", name: "Ring", className: "ring" },
  { number: 5, ordinal: "5th", name: "Pinky", className: "pinky" },
];

const SIDE_LABELS: Record<HandSide, string> = {
  right: "RIGHT HAND",
  left: "LEFT HAND",
};

const BOTH_HANDS_SRC = asset("hands/hands-both.png");
const HAND_IMAGE_SRC: Record<HandSide, string[]> = {
  left: [
    asset("hands/hand-left.png"),
    asset("hands/hand-left-1.png"),
    asset("hands/hand-left-2.png"),
    asset("hands/hand-left-3.png"),
    asset("hands/hand-left-4.png"),
    asset("hands/hand-left-5.png"),
  ],
  right: [
    asset("hands/hand-right.png"),
    asset("hands/hand-right-1.png"),
    asset("hands/hand-right-2.png"),
    asset("hands/hand-right-3.png"),
    asset("hands/hand-right-4.png"),
    asset("hands/hand-right-5.png"),
  ],
};

function shuffleNumbers(numbers: number[]): number[] {
  const result = [...numbers];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function buildQuizOrder(learnedCount: number): number[] {
  return shuffleNumbers(FINGERS.slice(0, learnedCount).map((finger) => finger.number));
}

function fingerByNumber(number: number): Finger {
  return FINGERS[number - 1];
}

function HandGraphic({
  side,
  highlightedFinger,
  compact = false,
}: {
  side: HandSide;
  highlightedFinger?: number;
  compact?: boolean;
}) {
  const imageSrc = HAND_IMAGE_SRC[side][highlightedFinger ?? 0];

  return (
    <div
      className={`hand-graphic hand-graphic--${side} ${
        compact ? "hand-graphic--compact" : ""
      }`}
      role="img"
      aria-label={`${SIDE_LABELS[side].toLowerCase()} finger numbers`}
    >
      <img src={imageSrc} alt="" aria-hidden="true" />
    </div>
  );
}

function BothHandsGraphic() {
  return (
    <div className="both-hands-graphic" role="img" aria-label="left and right hands">
      <img src={BOTH_HANDS_SRC} alt="" aria-hidden="true" />
    </div>
  );
}

export default function FingerNumbersLevel({
  levelNumber,
  onLevelComplete,
}: FingerNumbersLevelProps) {
  const [phase, setPhase] = useState<Phase>("intro");
  const [side, setSide] = useState<HandSide>("right");
  const [learnedCount, setLearnedCount] = useState(1);
  const [quizOrder, setQuizOrder] = useState<number[]>([]);
  const [quizIndex, setQuizIndex] = useState(0);
  const [chosen, setChosen] = useState<number | null>(null);

  useEffect(() => {
    if (phase !== "intro") return;

    const timer = window.setTimeout(() => {
      setPhase("teach");
    }, 1800);

    return () => window.clearTimeout(timer);
  }, [phase]);

  const learnedFinger = fingerByNumber(learnedCount);
  const quizTarget = quizOrder[quizIndex] ?? learnedCount;
  const completedUnits =
    (side === "left" ? 5 : 0) + (learnedCount - 1) + (phase === "quiz" ? 0.5 : 0);
  const completedDots = Math.min(10, Math.floor(completedUnits));

  const choices = useMemo(
    () => FINGERS.slice(0, learnedCount),
    [learnedCount]
  );

  function startQuiz() {
    setQuizOrder(buildQuizOrder(learnedCount));
    setQuizIndex(0);
    setChosen(null);
    setPhase("quiz");
  }

  function advanceTeaching() {
    if (learnedCount < FINGERS.length) {
      setLearnedCount(learnedCount + 1);
      return;
    }

    startQuiz();
  }

  function advanceAfterCorrect() {
    const nextQuizIndex = quizIndex + 1;
    if (nextQuizIndex < quizOrder.length) {
      setQuizIndex(nextQuizIndex);
      setChosen(null);
      return;
    }

    if (learnedCount < FINGERS.length) {
      setLearnedCount(learnedCount + 1);
      setChosen(null);
      setPhase("teach");
      return;
    }

    if (side === "right") {
      setSide("left");
      setLearnedCount(1);
      setQuizOrder([]);
      setQuizIndex(0);
      setChosen(null);
      setPhase("teach");
      return;
    }

    onLevelComplete();
  }

  function chooseAnswer(answer: number) {
    if (chosen !== null) return;
    setChosen(answer);

    if (answer === quizTarget) {
      window.setTimeout(advanceAfterCorrect, 750);
    } else {
      window.setTimeout(() => setChosen(null), 700);
    }
  }

  return (
    <div className="finger-level">
      <MusicDecor />

      <header className="finger-level__header">
        <div className="finger-level__eyebrow">Level {levelNumber}</div>
        <h1 className="finger-level__title">Finger numbers</h1>
        <ProgressDots total={10} completed={completedDots} />
      </header>

      {phase === "intro" ? (
        <main className="finger-level__intro" aria-live="polite">
          <BothHandsGraphic />
        </main>
      ) : (
        <main
          className={`finger-level__focus finger-level__focus--${side}`}
          aria-live="polite"
        >
          <section className="finger-level__hand-zone">
            <HandGraphic
              side={side}
              highlightedFinger={phase === "teach" ? learnedCount : quizTarget}
            />
          </section>

          <section className="finger-level__panel">
            {phase === "teach" ? (
              <>
                <div className="finger-level__ordinal">{learnedFinger.ordinal}</div>
                <p className="finger-level__prompt">
                  {learnedFinger.name} is finger {learnedFinger.number}.
                </p>
                <button
                  className="big-button"
                  type="button"
                  onClick={advanceTeaching}
                >
                  {learnedCount < FINGERS.length ? "Next finger" : "Quiz me"}
                </button>
              </>
            ) : (
              <>
                <p className="finger-level__prompt">
                  Which finger number is circled?
                </p>
                <div className="finger-level__answers">
                  {choices.map((finger) => {
                    const isCorrectChoice = chosen === finger.number && finger.number === quizTarget;
                    const isWrongChoice = chosen === finger.number && finger.number !== quizTarget;

                    return (
                      <button
                        className={`finger-level__answer ${
                          isCorrectChoice ? "is-correct" : ""
                        } ${isWrongChoice ? "is-wrong" : ""}`}
                        key={finger.number}
                        type="button"
                        onClick={() => chooseAnswer(finger.number)}
                      >
                        <span>{finger.ordinal}</span>
                        <small>{finger.number}</small>
                      </button>
                    );
                  })}
                </div>
                <div className="finger-level__quiz-note" aria-hidden="true">
                  {chosen === null
                    ? "Look at the circled finger."
                    : chosen === quizTarget
                    ? "Great job!"
                    : "Try again."}
                </div>
              </>
            )}
          </section>
        </main>
      )}
    </div>
  );
}
