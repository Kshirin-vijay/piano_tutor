import type { NoteName } from "../audio/piano";

/**
 * One ear-training level: the app plays a note and the child finds the key.
 * Sequences are fixed (not random) so the activity feels calm and repeatable.
 */
export interface EarLevel {
  /** Short, literal title shown to the child (e.g. "Hear C"). */
  title: string;
  /** The notes being trained this level; drives the title and progression. */
  choices: NoteName[];
  /** Fixed order of target notes to play and find, one per round. */
  rounds: NoteName[];
}

/**
 * Mirrors the main curriculum's "one note alone, then combined" pattern across
 * all seven white keys. Each new note gets a solo level (hear it alone), then a
 * pair level mixing it with the previous note as a gentle 2-note discrimination.
 * Sequences are fixed and alternating so each level stays calm and predictable.
 */
export const EAR_LEVELS: EarLevel[] = [
  {
    title: "Hear C",
    choices: ["C"],
    rounds: ["C", "C", "C", "C", "C", "C"],
  },
  {
    title: "Hear D",
    choices: ["D"],
    rounds: ["D", "D", "D", "D", "D", "D"],
  },
  {
    title: "Hear C and D",
    choices: ["C", "D"],
    rounds: ["C", "D", "C", "D", "C", "D", "C", "D"],
  },
  {
    title: "Hear E",
    choices: ["E"],
    rounds: ["E", "E", "E", "E", "E", "E"],
  },
  {
    title: "Hear D and E",
    choices: ["D", "E"],
    rounds: ["D", "E", "D", "E", "D", "E", "D", "E"],
  },
  {
    title: "Hear F",
    choices: ["F"],
    rounds: ["F", "F", "F", "F", "F", "F"],
  },
  {
    title: "Hear E and F",
    choices: ["E", "F"],
    rounds: ["E", "F", "E", "F", "E", "F", "E", "F"],
  },
  {
    title: "Hear G",
    choices: ["G"],
    rounds: ["G", "G", "G", "G", "G", "G"],
  },
  {
    title: "Hear F and G",
    choices: ["F", "G"],
    rounds: ["F", "G", "F", "G", "F", "G", "F", "G"],
  },
  {
    title: "Hear A",
    choices: ["A"],
    rounds: ["A", "A", "A", "A", "A", "A"],
  },
  {
    title: "Hear G and A",
    choices: ["G", "A"],
    rounds: ["G", "A", "G", "A", "G", "A", "G", "A"],
  },
  {
    title: "Hear B",
    choices: ["B"],
    rounds: ["B", "B", "B", "B", "B", "B"],
  },
  {
    title: "Hear A and B",
    choices: ["A", "B"],
    rounds: ["A", "B", "A", "B", "A", "B", "A", "B"],
  },
];
