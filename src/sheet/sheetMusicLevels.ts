import type { NoteName } from "../audio/piano";

export type SheetNoteCounts = 1 | 2 | 3 | 4;

export interface SheetMusicLevel {
  id: string;
  title: string;
  reviewTitle: string;
  reviewText: string;
  introducedNotes: NoteName[];
  targetNotes: NoteName[];
  sequence: NoteName[];
  /** Repeating count pattern. Notes longer than one count must be held. */
  countPattern?: SheetNoteCounts[];
  showLabels: boolean;
  paceMs: number;
  introSpeech?: string;
}

/** A calm progression that introduces longer holds between familiar short notes. */
const READING_COUNT_PATTERN: SheetNoteCounts[] = [1, 1, 2, 1, 3, 1, 2, 1, 4];

export function getSheetNoteCounts(
  level: SheetMusicLevel,
  index: number
): SheetNoteCounts {
  const pattern = level.countPattern;
  return pattern?.[index % pattern.length] ?? 1;
}

function repeatNotes(notes: NoteName[], length: number): NoteName[] {
  return Array.from({ length }, (_, index) => notes[index % notes.length]);
}

const HOT_CROSS_BUNS: NoteName[] = [
  "E",
  "D",
  "C",
  "E",
  "D",
  "C",
  "C",
  "C",
  "C",
  "C",
  "D",
  "D",
  "D",
  "D",
  "E",
  "D",
  "C",
];

const MARY_HAD_A_LITTLE_LAMB: NoteName[] = [
  "E",
  "D",
  "C",
  "D",
  "E",
  "E",
  "E",
  "D",
  "D",
  "D",
  "E",
  "G",
  "G",
  "E",
  "D",
  "C",
  "D",
  "E",
  "E",
  "E",
  "E",
  "D",
  "D",
  "E",
  "D",
  "C",
];

const TWINKLE_TWINKLE: NoteName[] = [
  "C",
  "C",
  "G",
  "G",
  "A",
  "A",
  "G",
  "F",
  "F",
  "E",
  "E",
  "D",
  "D",
  "C",
];

const ODE_TO_JOY: NoteName[] = [
  "E",
  "E",
  "F",
  "G",
  "G",
  "F",
  "E",
  "D",
  "C",
  "C",
  "D",
  "E",
  "E",
  "D",
  "D",
];

const ROW_ROW_YOUR_BOAT: NoteName[] = [
  "C",
  "C",
  "C",
  "D",
  "E",
  "E",
  "D",
  "E",
  "F",
  "G",
];

export const SHEET_MUSIC_LEVELS: SheetMusicLevel[] = [
  {
    id: "staff-c",
    title: "Read C",
    reviewTitle: "Review Notes",
    reviewText: "This is C. It sits on a small ledger line below the treble staff.",
    introducedNotes: ["C"],
    targetNotes: ["C"],
    sequence: repeatNotes(["C"], 15),
    countPattern: READING_COUNT_PATTERN,
    showLabels: true,
    paceMs: 3100,
    introSpeech: "Review notes. This is C.",
  },
  {
    id: "staff-d",
    title: "Read D",
    reviewTitle: "Review Notes",
    reviewText: "This is D. It sits in the space below the treble staff.",
    introducedNotes: ["D"],
    targetNotes: ["D"],
    sequence: repeatNotes(["D"], 15),
    countPattern: READING_COUNT_PATTERN,
    showLabels: true,
    paceMs: 3050,
    introSpeech: "Review notes. This is D.",
  },
  {
    id: "staff-e",
    title: "Read E",
    reviewTitle: "Review Notes",
    reviewText: "This is E. It sits on the bottom line of the treble staff.",
    introducedNotes: ["E"],
    targetNotes: ["E"],
    sequence: repeatNotes(["E"], 15),
    countPattern: READING_COUNT_PATTERN,
    showLabels: true,
    paceMs: 3000,
    introSpeech: "Review notes. This is E.",
  },
  {
    id: "staff-f",
    title: "Read F",
    reviewTitle: "Review Notes",
    reviewText: "This is F. It sits in the first space of the treble staff.",
    introducedNotes: ["F"],
    targetNotes: ["F"],
    sequence: repeatNotes(["F"], 15),
    countPattern: READING_COUNT_PATTERN,
    showLabels: true,
    paceMs: 2950,
    introSpeech: "Review notes. This is F.",
  },
  {
    id: "staff-g",
    title: "Read G",
    reviewTitle: "Review Notes",
    reviewText: "This is G. It sits on the second line of the treble staff.",
    introducedNotes: ["G"],
    targetNotes: ["G"],
    sequence: repeatNotes(["G"], 15),
    countPattern: READING_COUNT_PATTERN,
    showLabels: true,
    paceMs: 2900,
    introSpeech: "Review notes. This is G.",
  },
  {
    id: "staff-a",
    title: "Read A",
    reviewTitle: "Review Notes",
    reviewText: "This is A. It sits in the second space of the treble staff.",
    introducedNotes: ["A"],
    targetNotes: ["A"],
    sequence: repeatNotes(["A"], 15),
    countPattern: READING_COUNT_PATTERN,
    showLabels: true,
    paceMs: 2850,
    introSpeech: "Review notes. This is A.",
  },
  {
    id: "staff-b",
    title: "Read B",
    reviewTitle: "Review Notes",
    reviewText: "This is B. It sits on the middle line of the treble staff.",
    introducedNotes: ["B"],
    targetNotes: ["B"],
    sequence: repeatNotes(["B"], 15),
    countPattern: READING_COUNT_PATTERN,
    showLabels: true,
    paceMs: 2800,
    introSpeech: "Review notes. This is B.",
  },
  {
    id: "staff-c-d-e",
    title: "C D E mix",
    reviewTitle: "Review Notes",
    reviewText: "Read C, D, and E as they move to the play line.",
    introducedNotes: ["C", "D", "E"],
    targetNotes: ["C", "D", "E"],
    sequence: ["C", "D", "E", "D", "C", "C", "E", "D", "C", "D", "E", "E", "D", "C", "E"],
    countPattern: READING_COUNT_PATTERN,
    showLabels: true,
    paceMs: 2750,
    introSpeech: "Review notes. C, D, and E.",
  },
  {
    id: "staff-f-g-a-b",
    title: "F G A B mix",
    reviewTitle: "Review Notes",
    reviewText: "Read F, G, A, and B on the treble staff.",
    introducedNotes: ["F", "G", "A", "B"],
    targetNotes: ["F", "G", "A", "B"],
    sequence: ["F", "G", "A", "B", "A", "G", "F", "F", "A", "G", "B", "A", "G", "F", "B"],
    countPattern: READING_COUNT_PATTERN,
    showLabels: true,
    paceMs: 2700,
    introSpeech: "Review notes. F, G, A, and B.",
  },
  {
    id: "staff-a-g-all",
    title: "A to G mix",
    reviewTitle: "Review Notes",
    reviewText: "Read all the notes from A to G.",
    introducedNotes: ["A", "B", "C", "D", "E", "F", "G"],
    targetNotes: ["A", "B", "C", "D", "E", "F", "G"],
    sequence: ["C", "D", "E", "F", "G", "A", "B", "A", "G", "F", "E", "D", "C", "E", "G", "B", "A", "F"],
    countPattern: READING_COUNT_PATTERN,
    showLabels: true,
    paceMs: 2650,
    introSpeech: "Review notes. A, B, C, D, E, F, and G.",
  },
  {
    id: "song-hot-cross-buns",
    title: "Song: Hot Cross Buns",
    reviewTitle: "Song Notes",
    reviewText: "Read the notes for Hot Cross Buns.",
    introducedNotes: ["C", "D", "E"],
    targetNotes: ["C", "D", "E"],
    sequence: HOT_CROSS_BUNS,
    showLabels: true,
    paceMs: 2600,
    introSpeech: "Song notes. Hot Cross Buns.",
  },
  {
    id: "song-mary",
    title: "Song: Mary Had a Little Lamb",
    reviewTitle: "Song Notes",
    reviewText: "Read the notes for Mary Had a Little Lamb.",
    introducedNotes: ["C", "D", "E", "G"],
    targetNotes: ["C", "D", "E", "G"],
    sequence: MARY_HAD_A_LITTLE_LAMB,
    showLabels: true,
    paceMs: 2525,
    introSpeech: "Song notes. Mary Had a Little Lamb.",
  },
  {
    id: "song-row-row",
    title: "Song: Row Row Your Boat",
    reviewTitle: "Song Notes",
    reviewText: "Read the notes for Row Row Your Boat.",
    introducedNotes: ["C", "D", "E", "F", "G"],
    targetNotes: ["C", "D", "E", "F", "G"],
    sequence: ROW_ROW_YOUR_BOAT,
    showLabels: true,
    paceMs: 2500,
    introSpeech: "Song notes. Row Row Your Boat.",
  },
  {
    id: "song-ode-to-joy",
    title: "Song: Ode to Joy",
    reviewTitle: "Song Notes",
    reviewText: "Read the notes for Ode to Joy.",
    introducedNotes: ["C", "D", "E", "F", "G"],
    targetNotes: ["C", "D", "E", "F", "G"],
    sequence: ODE_TO_JOY,
    showLabels: true,
    paceMs: 2475,
    introSpeech: "Song notes. Ode to Joy.",
  },
  {
    id: "song-twinkle",
    title: "Song: Twinkle Twinkle",
    reviewTitle: "Song Notes",
    reviewText: "Read the notes for Twinkle Twinkle.",
    introducedNotes: ["C", "D", "E", "F", "G", "A"],
    targetNotes: ["C", "D", "E", "F", "G", "A"],
    sequence: TWINKLE_TWINKLE,
    showLabels: true,
    paceMs: 2450,
    introSpeech: "Song notes. Twinkle Twinkle.",
  },
];
