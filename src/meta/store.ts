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

/** A fresh player's starting store — no run history, the seed decks. Exported so the
 *  Save submenu's "Clear save" action (`GameMenu.tsx`) can reset to it directly,
 *  besides its use here as `loadStore`'s fallback. */
export function emptyStore(): PlayerStore {
  return { runHistory: [], decks: cloneDecks(DEFAULT_DECKS) };
}

/**
 * Lenient shape-check shared by `loadStore` (reading the live localStorage key, which
 * may predate a field) and `importSave` (reading a pasted/uploaded save file). Returns
 * `null` if `raw` isn't recognizable as a store at all; a missing/invalid `decks` key
 * is *not* fatal — it just means this store predates the deck-editor feature, so it's
 * seeded with the starting decks a fresh install would have had, without losing runHistory.
 */
function parsePlayerStore(raw: unknown): PlayerStore | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  if (!Array.isArray(obj.runHistory)) return null;
  const decks = Array.isArray(obj.decks) ? (obj.decks as DeckDef[]) : cloneDecks(DEFAULT_DECKS);
  return { runHistory: obj.runHistory as RunResult[], decks };
}

/** Reads the store from `localStorage`. Missing, corrupt, or inaccessible data falls back to an empty store. */
export function loadStore(): PlayerStore {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyStore();
    return parsePlayerStore(JSON.parse(raw)) ?? emptyStore();
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

/**
 * The exported-save wire format: a base64-encoded envelope around a `PlayerStore`
 * snapshot. `schemaVersion` exists because `PlayerStore` is documented (above) as a
 * growing shape — collection/progress fields will join it later — and an exported file
 * can sit on a player's disk across several of those changes, unlike the live
 * localStorage key which is migrated in place by `parsePlayerStore`. A future bump adds
 * a migration path keyed off this number rather than re-guessing from field presence.
 */
const SCHEMA_VERSION = 1;

interface SaveFile {
  schemaVersion: typeof SCHEMA_VERSION;
  exportedAt: string;
  store: PlayerStore;
}

/** Unicode-safe base64 encode — plain `btoa` throws on any character outside Latin1, and deck names are free-text. */
function encodeBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function decodeBase64(base64: string): string {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

/** Serializes a `PlayerStore` into a base64 save-file string, for the game menu's Save submenu to hand to the player as a download. */
export function exportSave(store: PlayerStore): string {
  const file: SaveFile = { schemaVersion: SCHEMA_VERSION, exportedAt: new Date().toISOString(), store };
  return encodeBase64(JSON.stringify(file));
}

export type ImportResult = { ok: true; store: PlayerStore } | { ok: false; error: string };

/** Reverses `exportSave`. Never throws — reports a reason instead, since a failed import should be visible to the player rather than silently discarded (unlike `loadStore`'s empty-store fallback). */
export function importSave(base64: string): ImportResult {
  let json: string;
  try {
    json = decodeBase64(base64.trim());
  } catch {
    return { ok: false, error: 'This file is not a valid save (bad encoding).' };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return { ok: false, error: 'This file is not a valid save (corrupt data).' };
  }

  if (!parsed || typeof parsed !== 'object' || (parsed as Record<string, unknown>).schemaVersion !== SCHEMA_VERSION) {
    return { ok: false, error: 'This file is not a recognized CivCardGame save.' };
  }

  const store = parsePlayerStore((parsed as SaveFile).store);
  if (!store) return { ok: false, error: 'This file is not a recognized CivCardGame save.' };
  return { ok: true, store };
}
