import type { Task } from "../levels/levels";

export interface Song {
  id: string;
  title: string;
  /** Available to play now, or a "coming soon" placeholder. */
  available: boolean;
  tasks: Task[];
}

const hotCrossBuns: Task[] = [
  // Phrase 1: "Hot Cross Buns" E E D D C C C (2, 2, 3) then a short rest
  { type: "hold", note: "E", counts: 2, lyric: "Hot" },
  { type: "hold", note: "D", counts: 2, lyric: "Cross" },
  { type: "hold", note: "C", counts: 3, lyric: "Buns" },
  { type: "rest", counts: 1 },
  // Phrase 2: "Hot Cross Buns" again, then a short rest
  { type: "hold", note: "E", counts: 2, lyric: "Hot" },
  { type: "hold", note: "D", counts: 2, lyric: "Cross" },
  { type: "hold", note: "C", counts: 3, lyric: "Buns" },
  { type: "rest", counts: 1 },
  // Phrase 3: "One a penny, two a penny" four C's, then four D's
  { type: "hold", note: "C", counts: 1, lyric: "One" },
  { type: "hold", note: "C", counts: 1, lyric: "a" },
  { type: "hold", note: "C", counts: 1, lyric: "pen", joinNext: true },
  { type: "hold", note: "C", counts: 1, lyric: "ny" },
  { type: "hold", note: "D", counts: 1, lyric: "two" },
  { type: "hold", note: "D", counts: 1, lyric: "a" },
  { type: "hold", note: "D", counts: 1, lyric: "pen", joinNext: true },
  { type: "hold", note: "D", counts: 1, lyric: "ny" },
  // Phrase 4: "Hot Cross Buns" E E D D C C C (2, 2, 3)
  { type: "hold", note: "E", counts: 2, lyric: "Hot" },
  { type: "hold", note: "D", counts: 2, lyric: "Cross" },
  { type: "hold", note: "C", counts: 3, lyric: "Buns" },
];

const maryHadALittleLamb: Task[] = [
  // "Mary had a little lamb": E D C D E E E(2)
  { type: "hold", note: "E", counts: 1, lyric: "Ma", joinNext: true },
  { type: "hold", note: "D", counts: 1, lyric: "ry" },
  { type: "hold", note: "C", counts: 1, lyric: "had" },
  { type: "hold", note: "D", counts: 1, lyric: "a" },
  { type: "hold", note: "E", counts: 1, lyric: "lit", joinNext: true },
  { type: "hold", note: "E", counts: 1, lyric: "tle" },
  { type: "hold", note: "E", counts: 2, lyric: "lamb" },
  // "little lamb": D D D(2)
  { type: "hold", note: "D", counts: 1, lyric: "lit", joinNext: true },
  { type: "hold", note: "D", counts: 1, lyric: "tle" },
  { type: "hold", note: "D", counts: 2, lyric: "lamb" },
  // "little lamb": E E E(2)
  { type: "hold", note: "E", counts: 1, lyric: "lit", joinNext: true },
  { type: "hold", note: "E", counts: 1, lyric: "tle" },
  { type: "hold", note: "E", counts: 2, lyric: "lamb" },
  // "Mary had a little lamb its": E D C D E E E E
  { type: "hold", note: "E", counts: 1, lyric: "Ma", joinNext: true },
  { type: "hold", note: "D", counts: 1, lyric: "ry" },
  { type: "hold", note: "C", counts: 1, lyric: "had" },
  { type: "hold", note: "D", counts: 1, lyric: "a" },
  { type: "hold", note: "E", counts: 1, lyric: "lit", joinNext: true },
  { type: "hold", note: "E", counts: 1, lyric: "tle" },
  { type: "hold", note: "E", counts: 1, lyric: "lamb" },
  { type: "hold", note: "E", counts: 1, lyric: "its" },
  // "fleece was white as snow": D D E D C(3)
  { type: "hold", note: "D", counts: 1, lyric: "fleece" },
  { type: "hold", note: "D", counts: 1, lyric: "was" },
  { type: "hold", note: "E", counts: 1, lyric: "white" },
  { type: "hold", note: "D", counts: 1, lyric: "as" },
  { type: "hold", note: "C", counts: 3, lyric: "snow" },
];

const areYouSleeping: Task[] = [
  // A C/D/E-only first-song version of "Are You Sleeping?"
  { type: "hold", note: "C", counts: 1, lyric: "Are" },
  { type: "hold", note: "D", counts: 1, lyric: "you" },
  { type: "hold", note: "E", counts: 1, lyric: "sleep", joinNext: true },
  { type: "hold", note: "C", counts: 2, lyric: "ing" },
  { type: "rest", counts: 1 },
  { type: "hold", note: "C", counts: 1, lyric: "Are" },
  { type: "hold", note: "D", counts: 1, lyric: "you" },
  { type: "hold", note: "E", counts: 1, lyric: "sleep", joinNext: true },
  { type: "hold", note: "C", counts: 2, lyric: "ing" },
  { type: "rest", counts: 1 },
  { type: "hold", note: "C", counts: 1, lyric: "Bro", joinNext: true },
  { type: "hold", note: "D", counts: 1, lyric: "ther" },
  { type: "hold", note: "E", counts: 1, lyric: "John" },
  { type: "hold", note: "C", counts: 2, lyric: "John" },
  { type: "rest", counts: 1 },
  { type: "hold", note: "C", counts: 1, lyric: "Bro", joinNext: true },
  { type: "hold", note: "D", counts: 1, lyric: "ther" },
  { type: "hold", note: "E", counts: 1, lyric: "John" },
  { type: "hold", note: "C", counts: 2, lyric: "John" },
];

const twinkleTwinkleLittleStar: Task[] = [
  { type: "hold", note: "C", counts: 1, lyric: "Twin", joinNext: true },
  { type: "hold", note: "C", counts: 1, lyric: "kle" },
  { type: "hold", note: "G", counts: 1, lyric: "Twin", joinNext: true },
  { type: "hold", note: "G", counts: 1, lyric: "kle" },
  { type: "hold", note: "A", counts: 1, lyric: "Lit", joinNext: true },
  { type: "hold", note: "A", counts: 1, lyric: "tle" },
  { type: "hold", note: "G", counts: 2, lyric: "Star" },
  { type: "rest", counts: 1 },
  { type: "hold", note: "F", counts: 1, lyric: "Twin", joinNext: true },
  { type: "hold", note: "F", counts: 1, lyric: "kle" },
  { type: "hold", note: "E", counts: 1, lyric: "Twin", joinNext: true },
  { type: "hold", note: "E", counts: 1, lyric: "kle" },
  { type: "hold", note: "D", counts: 1, lyric: "Lit", joinNext: true },
  { type: "hold", note: "D", counts: 1, lyric: "tle" },
  { type: "hold", note: "C", counts: 2, lyric: "Star" },
];

const odeToJoy: Task[] = [
  { type: "hold", note: "E", counts: 1, lyric: "Ode" },
  { type: "hold", note: "E", counts: 1, lyric: "to" },
  { type: "hold", note: "F", counts: 1, lyric: "Joy" },
  { type: "hold", note: "G", counts: 1, lyric: "Ode" },
  { type: "hold", note: "G", counts: 1, lyric: "to" },
  { type: "hold", note: "F", counts: 1, lyric: "Joy" },
  { type: "hold", note: "E", counts: 1, lyric: "Ode" },
  { type: "hold", note: "D", counts: 1, lyric: "to" },
  { type: "hold", note: "C", counts: 1, lyric: "Joy" },
  { type: "hold", note: "C", counts: 1, lyric: "Ode" },
  { type: "hold", note: "D", counts: 1, lyric: "to" },
  { type: "hold", note: "E", counts: 1, lyric: "Joy" },
  { type: "hold", note: "E", counts: 2, lyric: "Joy" },
  { type: "hold", note: "D", counts: 2, lyric: "Joy" },
];

const jingleBells: Task[] = [
  { type: "hold", note: "E", counts: 1, lyric: "Jin", joinNext: true },
  { type: "hold", note: "E", counts: 1, lyric: "gle" },
  { type: "hold", note: "E", counts: 2, lyric: "Bells" },
  { type: "rest", counts: 1 },
  { type: "hold", note: "E", counts: 1, lyric: "Jin", joinNext: true },
  { type: "hold", note: "E", counts: 1, lyric: "gle" },
  { type: "hold", note: "E", counts: 2, lyric: "Bells" },
  { type: "rest", counts: 1 },
  { type: "hold", note: "E", counts: 1, lyric: "Jin", joinNext: true },
  { type: "hold", note: "G", counts: 1, lyric: "gle" },
  { type: "hold", note: "C", counts: 1, lyric: "All" },
  { type: "hold", note: "D", counts: 1, lyric: "the" },
  { type: "hold", note: "E", counts: 3, lyric: "Way" },
];

const rowRowYourBoat: Task[] = [
  { type: "hold", note: "C", counts: 1, lyric: "Row" },
  { type: "hold", note: "C", counts: 1, lyric: "Row" },
  { type: "hold", note: "C", counts: 1, lyric: "Your" },
  { type: "hold", note: "D", counts: 1, lyric: "Boat" },
  { type: "hold", note: "E", counts: 2, lyric: "Boat" },
  { type: "rest", counts: 1 },
  { type: "hold", note: "E", counts: 1, lyric: "Gen", joinNext: true },
  { type: "hold", note: "D", counts: 1, lyric: "tly" },
  { type: "hold", note: "E", counts: 1, lyric: "Down" },
  { type: "hold", note: "F", counts: 1, lyric: "the" },
  { type: "hold", note: "G", counts: 3, lyric: "Stream" },
];

const londonBridge: Task[] = [
  { type: "hold", note: "G", counts: 1, lyric: "Lon", joinNext: true },
  { type: "hold", note: "A", counts: 1, lyric: "don" },
  { type: "hold", note: "G", counts: 1, lyric: "Bridge" },
  { type: "hold", note: "F", counts: 1, lyric: "is" },
  { type: "hold", note: "E", counts: 1, lyric: "Fall", joinNext: true },
  { type: "hold", note: "F", counts: 1, lyric: "ing" },
  { type: "hold", note: "G", counts: 2, lyric: "Down" },
  { type: "rest", counts: 1 },
  { type: "hold", note: "D", counts: 1, lyric: "Fall", joinNext: true },
  { type: "hold", note: "E", counts: 1, lyric: "ing" },
  { type: "hold", note: "F", counts: 2, lyric: "Down" },
  { type: "hold", note: "E", counts: 1, lyric: "Fall", joinNext: true },
  { type: "hold", note: "F", counts: 1, lyric: "ing" },
  { type: "hold", note: "G", counts: 2, lyric: "Down" },
];

const lightlyRow: Task[] = [
  { type: "hold", note: "E", counts: 1, lyric: "Light", joinNext: true },
  { type: "hold", note: "D", counts: 1, lyric: "ly" },
  { type: "hold", note: "C", counts: 1, lyric: "row" },
  { type: "hold", note: "D", counts: 1, lyric: "on" },
  { type: "hold", note: "E", counts: 1, lyric: "we" },
  { type: "hold", note: "E", counts: 1, lyric: "go" },
  { type: "hold", note: "E", counts: 2, lyric: "now" },
  { type: "rest", counts: 1 },
  { type: "hold", note: "D", counts: 1, lyric: "Soft", joinNext: true },
  { type: "hold", note: "D", counts: 1, lyric: "ly" },
  { type: "hold", note: "D", counts: 2, lyric: "row" },
  { type: "hold", note: "E", counts: 1, lyric: "here" },
  { type: "hold", note: "G", counts: 1, lyric: "we" },
  { type: "hold", note: "G", counts: 2, lyric: "go" },
  { type: "rest", counts: 1 },
  { type: "hold", note: "E", counts: 1, lyric: "Light", joinNext: true },
  { type: "hold", note: "D", counts: 1, lyric: "ly" },
  { type: "hold", note: "C", counts: 1, lyric: "row" },
  { type: "hold", note: "D", counts: 1, lyric: "back" },
  { type: "hold", note: "E", counts: 1, lyric: "to" },
  { type: "hold", note: "E", counts: 1, lyric: "C" },
  { type: "hold", note: "E", counts: 1, lyric: "with" },
  { type: "hold", note: "E", counts: 1, lyric: "me" },
  { type: "hold", note: "D", counts: 1, lyric: "D" },
  { type: "hold", note: "D", counts: 1, lyric: "D" },
  { type: "hold", note: "E", counts: 1, lyric: "E" },
  { type: "hold", note: "D", counts: 1, lyric: "D" },
  { type: "hold", note: "C", counts: 3, lyric: "C" },
];

export const LIGHTLY_ROW_SONG: Song = {
  id: "lightly-row",
  title: "Lightly Row",
  available: true,
  tasks: lightlyRow,
};

export const SONGS: Song[] = [
  {
    id: "hot-cross-buns",
    title: "Hot Cross Buns",
    available: true,
    tasks: hotCrossBuns,
  },
  {
    id: "mary-had-a-little-lamb",
    title: "Mary Had a Little Lamb",
    available: true,
    tasks: maryHadALittleLamb,
  },
  {
    id: "are-you-sleeping",
    title: "Are You Sleeping?",
    available: true,
    tasks: areYouSleeping,
  },
];

export const LEVEL_18_SONGS: Song[] = [
  {
    id: "twinkle-twinkle-little-star",
    title: "Twinkle, Twinkle Little Star",
    available: true,
    tasks: twinkleTwinkleLittleStar,
  },
  {
    id: "ode-to-joy",
    title: "Ode to Joy",
    available: true,
    tasks: odeToJoy,
  },
  {
    id: "jingle-bells",
    title: "Jingle Bells",
    available: true,
    tasks: jingleBells,
  },
  {
    id: "row-row-your-boat",
    title: "Row Row Your Boat",
    available: true,
    tasks: rowRowYourBoat,
  },
  {
    id: "london-bridge",
    title: "London Bridge Is Falling Down",
    available: true,
    tasks: londonBridge,
  },
];
