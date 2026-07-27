/**
 * The spoken-phrase registry. This decouples *what is spoken* from *what is
 * shown on screen*, and is the content surface an agent can extend at runtime
 * (via `actions.addPhrase`).
 *
 * Each phrase builds its text from arguments. An optional `audioUrl` builder
 * lets a recorded clip (e.g. a parent's voice) override text-to-speech for that
 * phrase with no change to any component: if `audioUrl` is present, the clip is
 * played instead of TTS.
 */

export interface PhraseDef {
  /** Build the spoken text for this phrase. */
  text: (...args: any[]) => string;
  /** Optional recorded-clip URL; when present it overrides TTS. */
  audioUrl?: (...args: any[]) => string | undefined;
}

export interface ResolvedPhrase {
  text: string;
  audioUrl?: string;
}

const REGISTRY: Record<string, PhraseDef> = {
  tap: {
    // The comma/period add a short pause so a single-letter note (e.g. "C")
    // is heard distinctly instead of blending into the verb ("Tap C" -> "taxi").
    text: (note: string, finger?: number) =>
      finger ? `Tap, ${note}, with finger ${finger}.` : `Tap, ${note}.`,
  },
  hold: {
    text: (note: string, counts: number, finger?: number) => {
      const fingerText = finger ? `, with finger ${finger}` : "";
      const unit = counts === 1 ? "count" : "counts";
      return `Hold, ${note}${fingerText}, for ${counts} ${unit}.`;
    },
  },
  rest: { text: () => "Rest" },
  praise: { text: () => "Great job" },
  levelDone: { text: () => "You did it" },
  tryAgain: { text: () => "Let's try again" },
};

/** Add or replace a phrase at runtime (used by the agent/content actions). */
export function addPhrase(key: string, def: PhraseDef): void {
  REGISTRY[key] = def;
}

/** Read a raw phrase definition (e.g. for introspection). */
export function getPhrase(key: string): PhraseDef | undefined {
  return REGISTRY[key];
}

/** All registered phrase keys. */
export function phraseKeys(): string[] {
  return Object.keys(REGISTRY);
}

/** Resolve a phrase to concrete text (and clip URL, if any). */
export function phrase(key: string, ...args: unknown[]): ResolvedPhrase | null {
  const def = REGISTRY[key];
  if (!def) return null;
  return { text: def.text(...args), audioUrl: def.audioUrl?.(...args) };
}
