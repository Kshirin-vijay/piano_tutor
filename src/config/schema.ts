/**
 * Declarative settings schema. This single registry is the source of truth for
 * three consumers:
 *   1. The validator (allowed types and safe bounds).
 *   2. A future caregiver settings UI (auto-rendered from these entries).
 *   3. A future AI agent (its "tool spec": what levers exist and their meaning).
 *
 * Settings are keyed by a dotted path that matches the shape of `AppConfig`
 * (e.g. "speech.rate" -> config.speech.rate). To add a new configurable knob,
 * add a field to `AppConfig`/`DEFAULTS` and a matching entry here.
 */

export type SettingType = "boolean" | "number" | "enum";

interface BaseSetting {
  type: SettingType;
  /** Plain, human-readable explanation (also used as the agent's hint). */
  description: string;
}

export interface BooleanSetting extends BaseSetting {
  type: "boolean";
  default: boolean;
}

export interface NumberSetting extends BaseSetting {
  type: "number";
  default: number;
  /** Hard safe bounds; values are clamped to this range. */
  min?: number;
  max?: number;
  /** Suggested step for a UI slider. */
  step?: number;
}

export interface EnumSetting extends BaseSetting {
  type: "enum";
  default: string;
  values: readonly string[];
}

export type Setting = BooleanSetting | NumberSetting | EnumSetting;

export const SCHEMA = {
  "speech.enabled": {
    type: "boolean",
    default: false,
    description: "Read instructions and praise aloud",
  },
  "speech.rate": {
    type: "number",
    default: 0.8,
    min: 0.3,
    max: 1.3,
    step: 0.1,
    description: "How fast the voice speaks (lower = slower, calmer)",
  },
  "speech.pitch": {
    type: "number",
    default: 1,
    min: 0.5,
    max: 1.5,
    step: 0.1,
    description: "Voice pitch",
  },
  "tempo.countMs": {
    type: "number",
    default: 250,
    min: 200,
    max: 1000,
    step: 50,
    description: "Length of one beat in milliseconds (higher = slower, calmer)",
  },
} as const satisfies Record<string, Setting>;

export type SettingPath = keyof typeof SCHEMA;

/** The full schema, for a settings UI or the agent to introspect. */
export function getSchema(): Record<string, Setting> {
  return SCHEMA as unknown as Record<string, Setting>;
}
