/**
 * Persistence abstraction for practice history. The store talks only to this
 * interface, so swapping local storage for a per-user server backend later is a
 * new implementation, not a refactor.
 *
 * Methods are async even though the local implementation is synchronous, so a
 * future `RemoteProgressRepository` (network) drops in with the same signatures.
 */

import type { ProgressSnapshot } from "./types";

export interface ProgressRepository {
  load(userId: string): Promise<ProgressSnapshot | null>;
  persist(userId: string, snapshot: ProgressSnapshot): Promise<void>;
  clear(userId: string): Promise<void>;
}

const KEY_PREFIX = "pianoFriend.progress";

function keyFor(userId: string): string {
  return `${KEY_PREFIX}.${userId}`;
}

/** localStorage-backed repository, namespaced per user. */
export class LocalProgressRepository implements ProgressRepository {
  async load(userId: string): Promise<ProgressSnapshot | null> {
    try {
      const raw = localStorage.getItem(keyFor(userId));
      return raw ? (JSON.parse(raw) as ProgressSnapshot) : null;
    } catch {
      return null;
    }
  }

  async persist(userId: string, snapshot: ProgressSnapshot): Promise<void> {
    try {
      localStorage.setItem(keyFor(userId), JSON.stringify(snapshot));
    } catch {
      /* storage unavailable or full; keep in-memory only */
    }
  }

  async clear(userId: string): Promise<void> {
    try {
      localStorage.removeItem(keyFor(userId));
    } catch {
      /* ignore */
    }
  }
}

/** The repository the app uses today. Swap here in the server phase. */
export const progressRepository: ProgressRepository = new LocalProgressRepository();
