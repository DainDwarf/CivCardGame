import type { RunResult } from '../contract';
import { DEFAULT_DECKS, type DeckDef } from '../content/decks';
import { cloneDecks } from '../rules/deckBuilder';

/**
 * The persisted player store (`localStorage`). `runHistory` and `decks` exist today;
 * collection/progress will join this shape as those features are built, so the store
 * is deliberately typed as a single growing object rather than one key per feature.
 */
export interface PlayerStore {
  runHistory: RunResult[];
  decks: DeckDef[];
}

const STORAGE_KEY = 'civcardgame:player-store';

function emptyStore(): PlayerStore {
  return { runHistory: [], decks: cloneDecks(DEFAULT_DECKS) };
}

/** Reads the store from `localStorage`. Missing, corrupt, or inaccessible data falls back to an empty store. */
export function loadStore(): PlayerStore {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyStore();
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.runHistory)) return emptyStore();
    // A missing/invalid `decks` key means this store predates the deck-editor feature —
    // seed it with the starting decks a fresh install would have had, without losing runHistory.
    const decks = Array.isArray(parsed.decks) ? parsed.decks : cloneDecks(DEFAULT_DECKS);
    return { runHistory: parsed.runHistory, decks };
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
