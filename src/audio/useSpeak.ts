import { useEffect, useRef } from "react";
import { speak } from "./speech";

/**
 * Speak `text` whenever it changes to a new, non-empty value. Passing an empty
 * string (e.g. between tasks, or for songs) stays silent and resets the guard,
 * so the same prompt spoken again later is read aloud again.
 */
export function useSpeak(text: string): void {
  const last = useRef<string>("");
  useEffect(() => {
    if (!text) {
      last.current = "";
      return;
    }
    if (text !== last.current) {
      last.current = text;
      speak(text);
    }
  }, [text]);
}
