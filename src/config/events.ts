/**
 * A tiny, typed event bus carrying gameplay signals (the "observe" half of a
 * self-regulation loop). Gameplay emits structured events; a future agent or
 * rule-based policy subscribes via `onEvent` and reacts by calling `actions`.
 *
 * Keeping this seam in place now means the agent is added by subscribing here,
 * with no changes to the components that emit.
 */

export type StageKind = "level" | "song" | "ear";

export type AppEvent =
  | { type: "task.succeeded"; note?: string; taskIndex: number }
  | { type: "task.mistake"; expected?: string; got: string }
  | { type: "hesitation"; ms: number }
  | { type: "level.replayed"; levelNumber: number }
  | { type: "level.started"; levelNumber: number; title: string; kind: StageKind }
  | { type: "level.completed"; levelNumber: number; kind: StageKind; clean: boolean };

export type EventType = AppEvent["type"];

type Handler = (event: AppEvent) => void;

const handlers = new Set<Handler>();

/** Broadcast an event to all subscribers. Never throws into the emitter. */
export function emit(event: AppEvent): void {
  handlers.forEach((handler) => {
    try {
      handler(event);
    } catch {
      /* a misbehaving subscriber must not break gameplay */
    }
  });
}

/** Subscribe to all events. Returns an unsubscribe function. */
export function onEvent(handler: Handler): () => void {
  handlers.add(handler);
  return () => {
    handlers.delete(handler);
  };
}
