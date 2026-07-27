import * as Tone from "tone";
import { asset } from "../assets";

export type NoteName =
  | "C"
  | "C#"
  | "D"
  | "D#"
  | "E"
  | "F"
  | "F#"
  | "G"
  | "G#"
  | "A"
  | "A#"
  | "B";

const NOTE_PITCH: Record<NoteName, string> = {
  C: "C4",
  "C#": "C#4",
  D: "D4",
  "D#": "D#4",
  E: "E4",
  F: "F4",
  "F#": "F#4",
  G: "G4",
  "G#": "G#4",
  A: "A4",
  "A#": "A#4",
  B: "B4",
};

// Bundled locally under public/salamander/, resolved against the app base URL
// so it works at the site root or a sub-path. App works offline after load.
const SAMPLE_BASE = asset("salamander/");

type Instrument = Tone.Sampler | Tone.PolySynth<Tone.Synth>;

let sampler: Tone.Sampler | null = null;
let samplerReady = false;
let fallback: Tone.PolySynth<Tone.Synth> | null = null;
let chime: Tone.PolySynth<Tone.Synth> | null = null;
let started = false;

// Remember which instrument actually started each note so we release it on the
// same one, even if the sampler finishes loading mid-session.
const activeInstrument: Partial<Record<NoteName, Instrument>> = {};

function buildSampler(): Tone.Sampler {
  // Real recorded grand-piano samples, pitch-shifted to fill gaps.
  // Near-instant attack + short release/reverb so a note sounds only while held.
  const reverb = new Tone.Reverb({ decay: 1.4, wet: 0.12 }).toDestination();
  return new Tone.Sampler({
    urls: {
      C4: "C4.mp3",
      "D#4": "Ds4.mp3",
      "F#4": "Fs4.mp3",
      A4: "A4.mp3",
    },
    baseUrl: SAMPLE_BASE,
    attack: 0.01,
    release: 0.12,
    volume: 0,
    onload: () => {
      samplerReady = true;
    },
    onerror: () => {
      // Leave samplerReady false so we keep using the gentle synth fallback.
      samplerReady = false;
    },
  }).connect(reverb);
}

function buildFallback(): Tone.PolySynth<Tone.Synth> {
  // Gentle synth piano used immediately and whenever samples are unavailable,
  // so there is always sound. Soft sine tone, short release to match holds.
  const reverb = new Tone.Reverb({ decay: 1.4, wet: 0.12 }).toDestination();
  return new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: "sine" },
    envelope: { attack: 0.01, decay: 0.5, sustain: 0.6, release: 0.12 },
    volume: -3,
  }).connect(reverb);
}

function buildChime(): Tone.PolySynth<Tone.Synth> {
  const reverb = new Tone.Reverb({ decay: 1.6, wet: 0.18 }).toDestination();
  return new Tone.PolySynth(Tone.Synth, {
    // Soft, rounded sine so the reward is gentle, not bright/loud.
    oscillator: { type: "sine" },
    envelope: { attack: 0.02, decay: 0.4, sustain: 0.05, release: 0.7 },
    volume: -26,
  }).connect(reverb);
}

/** The best instrument available right now (real piano once loaded, else synth). */
function instrument(): Instrument | null {
  if (samplerReady && sampler) return sampler;
  return fallback;
}

/**
 * Must be called from within a user gesture (tap/click) before any sound plays,
 * to satisfy browser autoplay policies. Safe to call repeatedly.
 */
export async function ensureAudioReady(): Promise<void> {
  if (!started) {
    await Tone.start();
    started = true;
  }
  // Play live: remove Tone's scheduling look-ahead so a note fires the instant
  // a key is pressed instead of ~100ms later.
  Tone.getContext().lookAhead = 0;
  // Make sure the audio context is actually running (some browsers stay suspended).
  const ctx = Tone.getContext().rawContext;
  if (ctx.state === "suspended") {
    try {
      await ctx.resume();
    } catch {
      /* ignore */
    }
  }
  if (!sampler) sampler = buildSampler();
  if (!fallback) fallback = buildFallback();
  if (!chime) chime = buildChime();
  // Wait for samples, but never hang: the synth fallback covers any delay/failure.
  await Promise.race([
    Tone.loaded(),
    new Promise<void>((resolve) => setTimeout(resolve, 2500)),
  ]);
}

/** A single gentle tone. Duration defaults to a short tap ("8n"). */
export function playNote(note: NoteName, duration: string = "8n"): void {
  instrument()?.triggerAttackRelease(NOTE_PITCH[note], duration);
}

/** Begin a sustained tone (held key). */
export function startNote(note: NoteName): void {
  const inst = instrument();
  if (!inst) return;
  activeInstrument[note] = inst;
  inst.triggerAttack(NOTE_PITCH[note]);
}

/** Release a sustained tone (key lifted). */
export function stopNote(note: NoteName): void {
  const inst = activeInstrument[note] ?? instrument();
  if (!inst) return;
  inst.triggerRelease(NOTE_PITCH[note]);
  delete activeInstrument[note];
}

/** A soft two-note rising chime used for positive feedback. */
export function playSuccessChime(): void {
  if (!chime) return;
  const now = Tone.now();
  // Lower, quieter two-note lift so it reads as a small, calm reward.
  chime.triggerAttackRelease("G4", "16n", now);
  chime.triggerAttackRelease("C5", "8n", now + 0.14);
}
