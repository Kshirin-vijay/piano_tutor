# Piano Friend

A calm, predictable piano-learning web app designed for autistic children. It teaches
the first piano notes on a realistic seven-key keyboard (white C, D, E, F, G, A, B with
decorative black keys) and guides the child linearly through gentle levels with
soft synthesized piano tones.

## Design philosophy (autism-first)

- **Predictable layout**: the keys and the single instruction line stay in the same place.
- **One instruction at a time**, short and literal (e.g. "Tap C!").
- **A single visual cue**: a soft, steady colored glow behind the key to press (red behind
  C on Level 1). No flashing, no countdown timers.
- **Positive-only feedback**: praise and a soft chime on success. Mistakes are silently
  ignored so the child can simply try again, with no error sounds or red marks.
- **Calm visuals**: muted background, large touch targets, slow and minimal motion.

## Levels

1. **C** - tap C a few times.
2. **C** - hold C for 1, then 2, then 3 counts.
3. **D** - tap D a few times.
4. **D** - hold D for 1, then 2, then 3 counts.
5. **C + D** - alternate single taps, one count each.
6. **C + D** - a short mixed sequence with varied 1-4 counts (kept easy).
7. **E** - tap E a few times.
8. **E** - hold E for 1, then 2, then 3 counts.
9. **F** - tap F a few times.
10. **F** - hold F for 1, then 2, then 3 counts.
11. **G** - tap G a few times.
12. **G** - hold G for 1, then 2, then 3 counts.
13. **A** - tap A a few times.
14. **A** - hold A for 1, then 2, then 3 counts.
15. **B** - tap B a few times.
16. **B** - hold B for 1, then 2, then 3 counts.

The app inserts song-choice stages into the child-facing sequence and then teaches
finger numbers on Level 19. After that, Levels 20-27 practice random-feeling note
patterns in right-hand C position. These levels start with C and D, then add E, F,
and G. Each prompt includes the note and the finger number to use.

One count lasts a quarter second by default (so 2 counts = half a second, and so on).
The tempo is now a runtime setting (`tempo.countMs`) read live from the config, so it
can be slowed for a calmer pace by a caregiver or the agent (see below).

## Songs

After finishing the levels, a "Play your first song!" screen appears with a short song
list. The first playable song is **Hot Cross Buns**, performed as a sequence of held
notes and short rests using the same calm play screen. Songs play straight through
(no per-note praise or chime) and celebrate once at the end. More songs can be added later.

## Ear training (connect the key to its sound)

After the levels and songs, a calm "listen, then find the key" section helps the
child link a note's **sound** to its key, not just follow a glow. The app plays a
note and the child finds it on the keyboard. It follows the same gentle pattern as
the levels: one note alone, then combined with the previous one (currently C, then
D, then C + D, then E, then C + D + E).

- **Sound-first**: the note plays on its own, and a large "Hear it again" button
  replays it whenever the child wants.
- **Errorless safety net**: the correct key stays hidden, and only glows if the
  child taps a wrong key or hesitates for a few seconds. It resets each round.
- **Positive-only**: wrong keys simply sound (free exploration) with no error or
  penalty, exactly like the rest of the app.

## Spoken instructions (read-aloud)

Each task prompt ("Tap C", "Hold D for 2 counts") and the praise/celebration are
spoken aloud using the browser's text-to-speech, so a child who does not yet read can
still follow along. Speech is unlocked on the Start screen (inside the Play tap) and is
"cancel-then-speak", so prompts never overlap. Songs play silently (like their lack of
per-note praise), and the ear-training note is never spoken.

The spoken text comes from a phrase registry (`src/audio/phrases.ts`), kept separate
from the on-screen text so wording can change independently. A phrase may carry an
optional `audioUrl`, which lets a recorded clip (for example a parent's voice) replace
text-to-speech for that phrase with no component changes.

## Configuration & agent integration

All configurable behavior lives in one small, serializable, agent-ready core under
`src/config/`. The design separates *what can change* (declarative data) from *who
changes it* (UI now, an AI agent later), so adding the agent is wiring rather than a
rewrite.

- `appConfig.ts` - the single serializable settings store (`speech.*`, `tempo.*`),
  persisted to `localStorage`, with `getConfig` / `subscribeConfig`.
- `schema.ts` - a self-describing registry of every setting (type, safe bounds,
  description). It powers validation, a future settings UI, and the agent's "tool spec".
- `validate.ts` - guardrails: every write is validated and clamped to safe bounds.
- `actions.ts` - the only mutation path: `setConfigValue(path, value)`, `resetConfig`,
  `addPhrase`. The UI and the agent both call these identical functions.
- `events.ts` - a typed event bus of gameplay signals (`task.succeeded`,
  `task.mistake`, `level.replayed`, ...) - the "observe" half of a self-regulation loop.
- `agentApi.ts` - the single facade an agent imports: `getSchema`, `getConfig`,
  `setConfigValue`, `resetConfig`, `addPhrase`, `onEvent`.
- `useConfig.ts` - a React hook for components that must re-render on changes.

To add a new configurable setting: add a field to `AppConfig`/`DEFAULTS` in
`appConfig.ts` and a matching entry in `schema.ts`. It is then immediately readable,
writable (validated), and visible to the agent. The self-regulation loop is, in full:
`onEvent(signal) -> decide -> setConfigValue(...)`, all bounded by the schema.

## Practice history and memory

The app keeps a durable "memory of past practice" under `src/progress/`. A recorder
subscribes to the event bus and aggregates each session into per-level and per-note
stats, plus a capped rolling log of recent events.

- What is stored: totals (sessions, time practiced, correct taps, completions),
  per-level stats (starts, completions, clean vs replayed, last played), per-note
  success/mistake counts, recent sessions, and a capped recent-event log.
- Where it is stored: on-device only, in `localStorage`, keyed by user
  (`pianoFriend.progress.<userId>`). Today there is one local user (`getUserId()`
  returns `"local"`). Nothing leaves the device.
- Caregiver view: the grown-up Settings page has a "View practice progress" button
  that opens a read-only dashboard (and a "Clear history" action).
- Agent access: the in-browser agent reads the full history through the same
  `agentApi` facade: `getProgress`, `getSessions`, `getPerLevelStats`,
  `getPerNoteStats`, `getRecentEvents`. Its loop is: read history -> analyze ->
  `setConfigValue(...)`.

Migration-readiness: the store persists through a `ProgressRepository` interface
(`LocalProgressRepository` today). A future server/native phase swaps in a remote,
per-user implementation and a real `getUserId()`; the store, dashboard, and agent are
unchanged. No accounts, sync, or export/import are built yet.

## Tech

- React + TypeScript + Vite
- [Tone.js](https://tonejs.github.io/) for gentle, synthesized piano tones (Web Audio API)
- The highest level reached is saved in the browser via `localStorage`, so the child resumes
  where they left off.

## Getting started

```bash
npm install
npm run dev
```

Then open the printed local URL (best on a tablet or in full screen).

## Build

```bash
npm run build
npm run preview
```
