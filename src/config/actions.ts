/**
 * The command API: the ONLY way to mutate configurable state. The UI calls
 * these today; a future AI agent calls the exact same functions tomorrow.
 * Every mutation is validated against the schema, so callers (including the
 * agent) physically cannot set an out-of-range or unknown value.
 */

import {
  DEFAULTS,
  applyConfig,
  getByPath,
  getConfig,
  setByPath,
} from "./appConfig";
import { validateValue } from "./validate";
import { addPhrase as addPhraseToRegistry } from "../audio/phrases";
import type { PhraseDef } from "../audio/phrases";
import { posthog } from "../analytics/posthog";

export interface ActionResult {
  ok: boolean;
  value?: unknown;
  error?: string;
}

/** Set a single setting by dotted path (e.g. "speech.rate", 0.7). */
export function setConfigValue(path: string, value: unknown): ActionResult {
  const result = validateValue(path, value);
  if (!result.ok) return result;
  applyConfig(setByPath(getConfig(), path, result.value));
  posthog.capture("settings_changed", { setting_path: path });
  return { ok: true, value: result.value };
}

/** Reset one setting to its default, or the whole config when no path given. */
export function resetConfig(path?: string): ActionResult {
  if (!path) {
    applyConfig(JSON.parse(JSON.stringify(DEFAULTS)));
    posthog.capture("config_reset");
    return { ok: true };
  }
  const def = getByPath(DEFAULTS, path);
  if (def === undefined) return { ok: false, error: `Unknown path: ${path}` };
  applyConfig(setByPath(getConfig(), path, def));
  return { ok: true, value: def };
}

/** Add or replace a spoken phrase at runtime (content action). */
export function addPhrase(key: string, def: PhraseDef): ActionResult {
  if (!key || typeof def?.text !== "function") {
    return { ok: false, error: "addPhrase requires a key and a text builder" };
  }
  addPhraseToRegistry(key, def);
  return { ok: true };
}

export { getConfig };
