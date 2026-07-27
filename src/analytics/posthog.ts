import posthog from "posthog-js";
import { onEvent } from "../config/events";

const key = import.meta.env.VITE_POSTHOG_KEY as string | undefined;
const host = import.meta.env.VITE_POSTHOG_HOST as string | undefined;

export function initPostHog(): void {
  if (!key || !host) {
    if (import.meta.env.DEV) {
      console.error(
        "VITE_POSTHOG_KEY variable required by PostHog is missing or un-configured, " +
          "this causes events to be silently missed. " +
          "This error stops appearing once VITE_POSTHOG_KEY is configured"
      );
    }
    return;
  }

  posthog.init(key, {
    api_host: host,
    defaults: "2026-05-30",
  });

  // Forward internal gameplay events to PostHog.
  onEvent((event) => {
    switch (event.type) {
      case "level.started":
        posthog.capture("level_started", {
          level_number: event.levelNumber,
          level_title: event.title,
          level_kind: event.kind,
        });
        break;
      case "level.completed":
        posthog.capture("level_completed", {
          level_number: event.levelNumber,
          level_kind: event.kind,
          clean_run: event.clean,
        });
        break;
      case "level.replayed":
        posthog.capture("level_replayed", {
          level_number: event.levelNumber,
        });
        break;
      case "task.mistake":
        posthog.capture("task_mistake", {
          expected_note: event.expected,
          pressed_note: event.got,
        });
        break;
    }
  });
}

export { posthog };
