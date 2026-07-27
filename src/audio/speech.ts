/**
 * Spoken-instruction layer, built on the Web Speech API. Mirrors the shape of
 * `piano.ts`: an `ensureSpeechReady()` unlock (call inside a user gesture), and
 * simple `speak` / `stopSpeech` functions.
 *
 * All behavior reads from the live config (`speech.*`), so a single on/off flag
 * (and rate/pitch/voice) governs every spoken prompt in the app. Speaking is
 * "cancel-then-speak" so prompts never overlap, even at a fast tempo.
 */

import { getConfig } from "../config/appConfig";
import { phrase } from "./phrases";

let voices: SpeechSynthesisVoice[] = [];
let started = false;

function supported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

function loadVoices(): void {
  if (!supported()) return;
  voices = window.speechSynthesis.getVoices();
}

/**
 * Unlock speech within a user gesture and begin loading voices. Safe to call
 * repeatedly. Some browsers populate the voice list asynchronously, so we also
 * listen for `voiceschanged`.
 */
export function ensureSpeechReady(): void {
  if (!supported() || started) return;
  started = true;
  loadVoices();
  try {
    window.speechSynthesis.addEventListener("voiceschanged", loadVoices);
  } catch {
    /* older engines expose only the onvoiceschanged property */
    window.speechSynthesis.onvoiceschanged = loadVoices;
  }
}

function pickVoice(): SpeechSynthesisVoice | null {
  if (voices.length === 0) loadVoices();
  const { voiceURI } = getConfig().speech;
  if (voiceURI) {
    const match = voices.find((v) => v.voiceURI === voiceURI);
    if (match) return match;
  }
  // A calm English default; fall back to whatever exists.
  return voices.find((v) => v.lang?.toLowerCase().startsWith("en")) ?? voices[0] ?? null;
}

/** Speak a literal string. No-op when speech is disabled or unsupported. */
export function speak(text: string): void {
  if (!supported() || !text) return;
  const { enabled, rate, pitch } = getConfig().speech;
  if (!enabled) return;

  const synth = window.speechSynthesis;
  synth.cancel(); // cancel-then-speak: never queue or overlap prompts
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = rate;
  utterance.pitch = pitch;
  const voice = pickVoice();
  if (voice) utterance.voice = voice;
  synth.speak(utterance);
}

function playClip(url: string): void {
  if (!getConfig().speech.enabled) return;
  try {
    const audio = new Audio(url);
    void audio.play().catch(() => {
      /* autoplay/availability issues are non-fatal */
    });
  } catch {
    /* ignore */
  }
}

/**
 * Resolve a registered phrase and speak it. Plays a recorded clip when the
 * phrase provides an `audioUrl`, otherwise falls back to text-to-speech.
 */
export function speakPhrase(key: string, ...args: unknown[]): void {
  const resolved = phrase(key, ...args);
  if (!resolved) return;
  if (resolved.audioUrl) {
    playClip(resolved.audioUrl);
    return;
  }
  speak(resolved.text);
}

/** Stop any in-progress speech (e.g. on a break or screen change). */
export function stopSpeech(): void {
  if (!supported()) return;
  window.speechSynthesis.cancel();
}

/** Available system voices, for a future voice picker or the agent. */
export function listVoices(): SpeechSynthesisVoice[] {
  if (voices.length === 0) loadVoices();
  return voices.slice();
}
