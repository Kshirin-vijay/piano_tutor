/**
 * Validation + guardrails for any config write. Every mutation (from the UI,
 * an agent, or a self-regulation policy) flows through here, so unsafe or
 * out-of-range values can never reach the running app. Numbers are clamped to
 * their schema bounds rather than rejected, so a well-meaning-but-wrong agent
 * request still produces a safe value.
 */

import { SCHEMA } from "./schema";
import type { Setting } from "./schema";

export interface ValidationResult {
  ok: boolean;
  /** The accepted (possibly clamped) value when ok. */
  value?: unknown;
  error?: string;
}

export function validateValue(path: string, value: unknown): ValidationResult {
  const setting = (SCHEMA as unknown as Record<string, Setting>)[path];
  if (!setting) return { ok: false, error: `Unknown setting: ${path}` };

  switch (setting.type) {
    case "boolean":
      if (typeof value !== "boolean") {
        return { ok: false, error: `${path} must be a boolean` };
      }
      return { ok: true, value };

    case "number": {
      const n = typeof value === "number" ? value : Number(value);
      if (!Number.isFinite(n)) {
        return { ok: false, error: `${path} must be a number` };
      }
      let clamped = n;
      if (setting.min !== undefined) clamped = Math.max(setting.min, clamped);
      if (setting.max !== undefined) clamped = Math.min(setting.max, clamped);
      return { ok: true, value: clamped };
    }

    case "enum":
      if (typeof value !== "string" || !setting.values.includes(value)) {
        return {
          ok: false,
          error: `${path} must be one of: ${setting.values.join(", ")}`,
        };
      }
      return { ok: true, value };

    default:
      return { ok: false, error: "Unsupported setting type" };
  }
}
