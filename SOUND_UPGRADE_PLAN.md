# Plan: Replace synthesized piano with real sampled piano

## Context for the editor
This is a React + TypeScript + Vite app (Tone.js `^15.0.4` already installed) that
teaches autistic children to play piano. All sound goes through one module:
`src/audio/piano.ts`.

**Problem:** the piano currently sounds computerized because `piano.ts` generates
tones from raw `sine`/`triangle` oscillators (`Tone.Synth`). Pure oscillators lack
the hammer transient, overtones, and string inharmonicity of a real piano, so no
envelope/reverb tweak can make them sound real.

**Fix:** replace `Tone.Synth` with `Tone.Sampler`, which plays back actual recorded
piano notes and pitch-shifts between them. Use the free, CC-licensed **Salamander
Grand Piano** samples, bundled locally so the app works offline.

**Audience constraint (important):** these are sound-sensitive autistic kids. Keep
the sound GENTLE — preserve the soft attack, long smooth release, and modest volume
that already exist. Making it realistic must NOT make it harsher or louder. Also make
sure the first key tap is never silent (wait for samples to finish loading before the
app leaves the start screen).

## Scope
The app only ever sounds three notes — C4, D4, E4 (see `NOTE_PITCH` in `piano.ts`).
The four Salamander samples below cover that range; `Tone.Sampler` pitch-shifts to
fill the gaps. Only `src/audio/piano.ts` changes; its exported function signatures
(`ensureAudioReady`, `playNote`, `startNote`, `stopNote`, `playSuccessChime`,
`NoteName`) MUST stay identical so the rest of the app keeps working unchanged.

## Step 1 — Download the samples (you have network permission; I did not)
Create the folder `public/salamander/` at the project root and download these 4 files
into it (~200 KB total). In Vite, anything under `public/` is served at the site root,
so they'll be reachable at `/salamander/<file>.mp3` at runtime.

```
https://tonejs.github.io/audio/salamander/C4.mp3   -> public/salamander/C4.mp3
https://tonejs.github.io/audio/salamander/Ds4.mp3  -> public/salamander/Ds4.mp3
https://tonejs.github.io/audio/salamander/Fs4.mp3  -> public/salamander/Fs4.mp3
https://tonejs.github.io/audio/salamander/A4.mp3   -> public/salamander/A4.mp3
```

Verify each file is a real mp3 (non-trivial byte size, not an HTML error page).

## Step 2 — Rewrite `src/audio/piano.ts`
Replace the entire file with the version below. Key changes:
- `Tone.Sampler` loads the local samples; `baseUrl: "/salamander/"`.
- `ensureAudioReady()` now `await Tone.loaded()` so playback never starts before
  samples are ready (prevents a silent first tap).
- Soft `attack`/`release` and reduced volume preserved for the gentle feel.
- The success chime stays a synth (it's an abstract reward sound, not a piano note),
  but its volume is kept low.

```ts
import * as Tone from "tone";

export type NoteName = "C" | "D" | "E";

const NOTE_PITCH: Record<NoteName, string> = {
  C: "C4",
  D: "D4",
  E: "E4",
};

let piano: Tone.Sampler | null = null;
let chime: Tone.PolySynth<Tone.Synth> | null = null;
let started = false;

function buildPiano(): Tone.Sampler {
  // Real recorded grand-piano samples, pitch-shifted to fill gaps.
  // Gentle reverb + soft release keep it warm and non-startling.
  const reverb = new Tone.Reverb({ decay: 2.4, wet: 0.22 }).toDestination();
  return new Tone.Sampler({
    urls: {
      C4: "C4.mp3",
      "D#4": "Ds4.mp3",
      "F#4": "Fs4.mp3",
      A4: "A4.mp3",
    },
    baseUrl: "/salamander/",
    attack: 0.01,
    release: 1.2,
    volume: -6,
  }).connect(reverb);
}

function buildChime(): Tone.PolySynth<Tone.Synth> {
  const reverb = new Tone.Reverb({ decay: 3, wet: 0.35 }).toDestination();
  return new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: "triangle" },
    envelope: { attack: 0.01, decay: 0.6, sustain: 0.1, release: 1.6 },
    volume: -12,
  }).connect(reverb);
}

/**
 * Must be called from within a user gesture (tap/click) before any sound plays,
 * to satisfy browser autoplay policies. Awaits sample loading so the first tap
 * is never silent. Safe to call repeatedly.
 */
export async function ensureAudioReady(): Promise<void> {
  if (!started) {
    await Tone.start();
    started = true;
  }
  if (!piano) piano = buildPiano();
  if (!chime) chime = buildChime();
  // Wait for the mp3 samples (and reverb impulse) to finish loading.
  await Tone.loaded();
}

/** A single gentle tap tone. */
export function playNote(note: NoteName): void {
  if (!piano) return;
  piano.triggerAttackRelease(NOTE_PITCH[note], "8n");
}

/** Begin a sustained tone (held key). */
export function startNote(note: NoteName): void {
  if (!piano) return;
  piano.triggerAttack(NOTE_PITCH[note]);
}

/** Release a sustained tone (key lifted). */
export function stopNote(note: NoteName): void {
  if (!piano) return;
  piano.triggerRelease(NOTE_PITCH[note]);
}

/** A soft two-note rising chime used for positive feedback. */
export function playSuccessChime(): void {
  if (!chime) return;
  const now = Tone.now();
  chime.triggerAttackRelease("C5", "8n", now);
  chime.triggerAttackRelease("G5", "4n", now + 0.16);
}
```

## Step 3 — (Optional) loading feedback on the start screen
`ensureAudioReady()` is awaited inside `handlePlay()` in
`src/components/StartScreen.tsx` (line ~19). The samples are small, but on a slow
connection the await may take a moment. Optionally show a brief "Loading…" state on
the Play button while the promise resolves so the child isn't left tapping a dead
button. Not required for correctness — the await already guarantees sound is ready.

## Step 4 — Verify
1. `npm run build` — must compile with no TypeScript errors (signatures are unchanged,
   so consuming files in `components/`, `engine/`, `levels/` need no edits).
2. `npm run dev`, open the app, tap **Play**, then tap the piano keys.
   - Confirm the notes now sound like a real piano (clear hammer attack, natural decay),
     not a flutey synth tone.
   - Confirm the very first key tap makes sound (no silent-first-note).
   - Confirm held keys sustain and release smoothly, and the success chime still plays.
3. Confirm volume is comfortable and not startling; if the sampled piano feels even
   slightly loud or sharp for young sound-sensitive users, lower `volume` (e.g. -6 → -9)
   and/or soften `attack` slightly. Do not make it brighter/louder than the old synth.
4. Sanity-check offline: after first load, the mp3s are served locally from `public/`,
   so the app should work without internet.

## Notes
- Do NOT load the samples from the Tone.js CDN in production code — bundle them in
  `public/salamander/` (Step 1) so the app is self-contained and offline-capable.
- Salamander Grand Piano is CC-licensed and free to redistribute; including the 4 mp3s
  in the repo is fine.
- If you later want a wider key range than C/D/E, add more Salamander samples
  (they exist for every note) to the `urls` map — no other code changes needed.
