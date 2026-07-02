import type { RunResult } from '../contract';

/**
 * The persisted player store (`localStorage`). Only `runHistory` exists today;
 * collection, saved decks, and progress will join this shape as those features are
 * built (see docs/TODO.md, Phase 2 steps 6–7), so the store is deliberately typed as
 * a single growing object rather than one key per feature.
 */
export interface PlayerStore {
  runHistory: RunResult[];
}

const STORAGE_KEY = 'civcardgame:player-store';

function emptyStore(): PlayerStore {
  return { runHistory: [] };
}

/** Reads the store from `localStorage`. Missing, corrupt, or inaccessible data falls back to an empty store. */
export function loadStore(): PlayerStore {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyStore();
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.runHistory)) return emptyStore();
    return { runHistory: parsed.runHistory };
  } catch {
    return emptyStore();
  }
}

/** Writes the store to `localStorage`. Failures (quota, private browsing) are swallowed — the run continues in-memory-only. */
export function saveStore(store: PlayerStore): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Ignored — see doc comment above.
  }
}
