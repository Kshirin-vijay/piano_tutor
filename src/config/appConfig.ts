/**
 * The single, serializable source of truth for all configurable behavior.
 *
 * Everything an agent (or a caregiver UI, or a self-regulation policy) can
 * change lives here as plain data, persisted to localStorage. Components never
 * mutate this directly: they go through `actions.ts`, which validates against
 * `schema.ts`. Reads can subscribe via `subscribeConfig` (or the `useConfig`
 * hook) so the UI updates when settings change.
 */

const CONFIG_KEY = "pianoFriend.config";
const CONFIG_VERSION = 1;

export interface AppConfig {
  /** Schema/migration version of the stored config. */
  version: number;
  speech: {
    enabled: boolean;
    rate: number;
    pitch: number;
    /** Preferred system voice; falls back to a calm default when unset. */
    voiceURI?: string;
  };
  tempo: {
    /** Length of one beat in milliseconds. */
    countMs: number;
  };
}

export const DEFAULTS: AppConfig = {
  version: CONFIG_VERSION,
  speech: { enabled: false, rate: 0.8, pitch: 1 },
  tempo: { countMs: 250 },
};

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/**
 * Merge persisted values onto the defaults. Only keys that exist in `base`
 * (the current defaults) survive, so stale or unknown keys are dropped and
 * newly added namespaces appear automatically.
 */
function deepMerge<T>(base: T, override: unknown): T {
  if (override === null || typeof override !== "object") return clone(base);
  const out = Array.isArray(base) ? ([...(base as unknown[])] as T) : { ...base };
  const ov = override as Record<string, unknown>;
  for (const key of Object.keys(base as Record<string, unknown>)) {
    const baseVal = (base as Record<string, unknown>)[key];
    const overVal = ov[key];
    if (baseVal && typeof baseVal === "object" && !Array.isArray(baseVal)) {
      (out as Record<string, unknown>)[key] = deepMerge(baseVal, overVal);
    } else if (overVal !== undefined) {
      (out as Record<string, unknown>)[key] = overVal;
    }
  }
  return out;
}

function migrate(parsed: unknown): AppConfig {
  // Future version-specific migrations would branch here on parsed.version.
  const merged = deepMerge(DEFAULTS, parsed);
  merged.version = CONFIG_VERSION;
  return merged;
}

function load(): AppConfig {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    if (!raw) return clone(DEFAULTS);
    return migrate(JSON.parse(raw));
  } catch {
    return clone(DEFAULTS);
  }
}

let config: AppConfig = load();
const listeners = new Set<(c: AppConfig) => void>();

function persist(): void {
  try {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
  } catch {
    /* storage unavailable; keep in-memory only */
  }
}

/** Current config snapshot. Stable reference until `applyConfig` replaces it. */
export function getConfig(): AppConfig {
  return config;
}

/** Replace the whole config (immutably), persist, and notify subscribers. */
export function applyConfig(next: AppConfig): void {
  config = next;
  persist();
  listeners.forEach((l) => l(config));
}

/** Subscribe to config changes. Returns an unsubscribe function. */
export function subscribeConfig(listener: (c: AppConfig) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Read a value by dotted path, e.g. getByPath(cfg, "speech.rate"). */
export function getByPath(obj: unknown, path: string): unknown {
  return path
    .split(".")
    .reduce<unknown>(
      (acc, key) =>
        acc && typeof acc === "object"
          ? (acc as Record<string, unknown>)[key]
          : undefined,
      obj
    );
}

/** Return a new config with the value at `path` replaced (does not mutate). */
export function setByPath(base: AppConfig, path: string, value: unknown): AppConfig {
  const keys = path.split(".");
  const next = clone(base);
  let cursor = next as unknown as Record<string, unknown>;
  for (let i = 0; i < keys.length - 1; i += 1) {
    const key = keys[i];
    cursor[key] = { ...(cursor[key] as Record<string, unknown>) };
    cursor = cursor[key] as Record<string, unknown>;
  }
  cursor[keys[keys.length - 1]] = value;
  return next;
}
