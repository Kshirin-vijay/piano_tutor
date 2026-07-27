import type { NoteName } from "../audio/piano";

export type FingerNumber = 1 | 2 | 3 | 4 | 5;

/** Tap a key a set number of times. */
export interface TapTask {
  type: "tap";
  note: NoteName;
  /** How many taps complete this task. */
  times: number;
  /** Optional finger-number cue shown with the note. */
  fingerNumber?: FingerNumber;
  /** Optional sing-along syllable shown under this note (used by songs). */
  lyric?: string;
  /** True when this syllable's word continues into the next note (shows a dash). */
  joinNext?: boolean;
}

/** Hold a key for a number of counts (1 count = half a second). */
export interface HoldTask {
  type: "hold";
  note: NoteName;
  /** Required hold length in counts. */
  counts: number;
  /** Optional finger-number cue shown with the note. */
  fingerNumber?: FingerNumber;
  /** Optional sing-along syllable shown under this note (used by songs). */
  lyric?: string;
  /** True when this syllable's word continues into the next note (shows a dash). */
  joinNext?: boolean;
}

/** A silent pause for a number of counts (used between song phrases). */
export interface RestTask {
  type: "rest";
  counts: number;
  /** Optional sing-along syllable shown under this rest (used by songs). */
  lyric?: string;
  /** True when this syllable's word continues into the next note (shows a dash). */
  joinNext?: boolean;
}

export type Task = TapTask | HoldTask | RestTask;

export interface Level {
  /** 1-based number shown to the child. */
  number: number;
  /** Which keys this level focuses on, for the short subtitle. */
  notes: NoteName[];
  /** Plain, encouraging description of the level goal. */
  title: string;
  tasks: Task[];
}

type RightHandNote = "C" | "D" | "E" | "F" | "G";

const RIGHT_HAND_FINGER_BY_NOTE: Record<RightHandNote, FingerNumber> = {
  C: 1,
  D: 2,
  E: 3,
  F: 4,
  G: 5,
};

function fingerTap(note: RightHandNote): TapTask {
  return {
    type: "tap",
    note,
    times: 1,
    fingerNumber: RIGHT_HAND_FINGER_BY_NOTE[note],
  };
}

function fingerHold(note: RightHandNote, counts: number): HoldTask {
  return {
    type: "hold",
    note,
    counts,
    fingerNumber: RIGHT_HAND_FINGER_BY_NOTE[note],
  };
}

/**
 * Build a row of holds on one note from a counts pattern (1 count = half a
 * second). Used by the single-note Hold levels to give longer, mixed-up
 * pattern practice instead of a short, predictable 1-2-3 climb.
 */
function holds(note: NoteName, pattern: number[]): HoldTask[] {
  return pattern.map((counts) => ({ type: "hold", note, counts }));
}

/**
 * Gentle, linear levels. Difficulty rises slowly and predictably.
 */
export const LEVELS: Level[] = [
  {
    number: 1,
    notes: ["C"],
    title: "Meet C",
    tasks: [
      { type: "tap", note: "C", times: 1 },
      { type: "tap", note: "C", times: 1 },
      { type: "tap", note: "C", times: 1 },
    ],
  },
  {
    number: 2,
    notes: ["C"],
    title: "Hold C",
    tasks: holds("C", [1, 2, 3, 2, 4, 1]),
  },
  {
    number: 3,
    notes: ["D"],
    title: "Meet D",
    tasks: [
      { type: "tap", note: "D", times: 1 },
      { type: "tap", note: "D", times: 1 },
      { type: "tap", note: "D", times: 1 },
    ],
  },
  {
    number: 4,
    notes: ["D"],
    title: "Hold D",
    tasks: holds("D", [2, 1, 3, 4, 1, 2]),
  },
  {
    number: 5,
    notes: ["C", "D"],
    title: "C and D together",
    tasks: [
      { type: "tap", note: "C", times: 1 },
      { type: "tap", note: "D", times: 1 },
      { type: "tap", note: "C", times: 1 },
      { type: "tap", note: "D", times: 1 },
    ],
  },
  {
    number: 6,
    notes: ["C", "D"],
    title: "A little song",
    tasks: [
      { type: "hold", note: "C", counts: 1 },
      { type: "hold", note: "D", counts: 2 },
      { type: "hold", note: "C", counts: 1 },
      { type: "hold", note: "D", counts: 3 },
      { type: "hold", note: "C", counts: 4 },
    ],
  },
  {
    number: 7,
    notes: ["E"],
    title: "Meet E",
    tasks: [
      { type: "tap", note: "E", times: 1 },
      { type: "tap", note: "E", times: 1 },
      { type: "tap", note: "E", times: 1 },
    ],
  },
  {
    number: 8,
    notes: ["E"],
    title: "Hold E",
    tasks: holds("E", [1, 3, 2, 1, 4, 2]),
  },
  {
    number: 9,
    notes: ["F"],
    title: "Meet F",
    tasks: [
      { type: "tap", note: "F", times: 1 },
      { type: "tap", note: "F", times: 1 },
      { type: "tap", note: "F", times: 1 },
    ],
  },
  {
    number: 10,
    notes: ["F"],
    title: "Hold F",
    tasks: holds("F", [2, 1, 4, 2, 3, 1]),
  },
  {
    number: 11,
    notes: ["G"],
    title: "Meet G",
    tasks: [
      { type: "tap", note: "G", times: 1 },
      { type: "tap", note: "G", times: 1 },
      { type: "tap", note: "G", times: 1 },
    ],
  },
  {
    number: 12,
    notes: ["G"],
    title: "Hold G",
    tasks: holds("G", [1, 2, 3, 1, 4, 2]),
  },
  {
    number: 13,
    notes: ["A"],
    title: "Meet A",
    tasks: [
      { type: "tap", note: "A", times: 1 },
      { type: "tap", note: "A", times: 1 },
      { type: "tap", note: "A", times: 1 },
    ],
  },
  {
    number: 14,
    notes: ["A"],
    title: "Hold A",
    tasks: holds("A", [2, 3, 1, 4, 1, 2]),
  },
  {
    number: 15,
    notes: ["B"],
    title: "Meet B",
    tasks: [
      { type: "tap", note: "B", times: 1 },
      { type: "tap", note: "B", times: 1 },
      { type: "tap", note: "B", times: 1 },
    ],
  },
  {
    number: 16,
    notes: ["B"],
    title: "Hold B",
    tasks: holds("B", [1, 2, 4, 2, 3, 1]),
  },
];

/**
 * Post-finger-number practice. These use right-hand C position:
 * C=1, D=2, E=3, F=4, G=5.
 */
export const FINGERED_LEVELS: Level[] = [
  {
    number: 20,
    notes: ["C", "D"],
    title: "Fingered random notes 1",
    tasks: [
      fingerTap("C"),
      fingerTap("D"),
      fingerTap("D"),
      fingerTap("C"),
      fingerTap("C"),
      fingerTap("D"),
    ],
  },
  {
    number: 21,
    notes: ["C", "D", "E"],
    title: "Fingered random notes 2",
    tasks: [
      fingerTap("E"),
      fingerTap("C"),
      fingerTap("D"),
      fingerTap("E"),
      fingerTap("D"),
      fingerTap("C"),
      fingerTap("E"),
    ],
  },
  {
    number: 22,
    notes: ["C", "D", "E"],
    title: "Fingered holds",
    tasks: [
      fingerHold("C", 1),
      fingerHold("E", 1),
      fingerHold("D", 2),
      fingerHold("C", 1),
      fingerHold("E", 2),
      fingerHold("D", 1),
    ],
  },
  {
    number: 23,
    notes: ["C", "D", "E", "F"],
    title: "Four finger notes",
    tasks: [
      fingerTap("F"),
      fingerTap("D"),
      fingerTap("C"),
      fingerTap("E"),
      fingerTap("F"),
      fingerTap("C"),
      fingerTap("D"),
      fingerTap("E"),
    ],
  },
  {
    number: 24,
    notes: ["C", "D", "E", "F"],
    title: "Four finger holds",
    tasks: [
      fingerHold("D", 1),
      fingerHold("F", 2),
      fingerHold("C", 1),
      fingerHold("E", 2),
      fingerHold("F", 1),
      fingerHold("D", 2),
      fingerHold("C", 2),
    ],
  },
  {
    number: 25,
    notes: ["C", "D", "E", "F", "G"],
    title: "Five finger notes",
    tasks: [
      fingerTap("G"),
      fingerTap("C"),
      fingerTap("E"),
      fingerTap("D"),
      fingerTap("F"),
      fingerTap("C"),
      fingerTap("G"),
      fingerTap("E"),
      fingerTap("D"),
      fingerTap("F"),
    ],
  },
  {
    number: 26,
    notes: ["C", "D", "E", "F", "G"],
    title: "Five finger mix",
    tasks: [
      fingerHold("C", 1),
      fingerTap("G"),
      fingerHold("E", 2),
      fingerTap("D"),
      fingerHold("F", 1),
      fingerTap("C"),
      fingerHold("G", 2),
      fingerTap("E"),
      fingerHold("D", 1),
      fingerTap("F"),
    ],
  },
  {
    number: 27,
    notes: ["C", "D", "E", "F", "G"],
    title: "Harder finger mix",
    tasks: [
      fingerTap("E"),
      fingerTap("G"),
      fingerHold("D", 1),
      fingerTap("F"),
      fingerHold("C", 2),
      fingerTap("G"),
      fingerTap("D"),
      fingerHold("E", 2),
      fingerTap("C"),
      fingerHold("F", 1),
      fingerTap("D"),
      fingerTap("G"),
    ],
  },
];
