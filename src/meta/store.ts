import type { RunResult } from '../contract';
import { DEFAULT_DECKS, type DeckDef } from '../content/decks';
import { STARTING_COLLECTION } from '../content/collection';
import type { MissionDef } from '../content/missions';
import { buildSeedDecks } from '../rules/deckBuilder';
import { collectionFromCounts, type OwnedCards } from '../rules/collection';
import type { BoardStickers } from '../rules/boardStickers';
import { computeRewards } from '../rules/rewards';
import { isCompleted } from '../rules/campaign';

/**
 * The persisted player store (`localStorage`). `mapProgress` is a completed-mission-ids
 * set — `App.tsx`'s `recordResult` marks a mission complete on victory, and
 * `rules/campaign.ts`'s `availableMissions` reads it to gate the campaign map's DAG via each
 * `MissionDef`'s `prereqs`. Just the completion flag: the Influence/unlock reward for clearing a
 * mission lives in `rules/rewards.ts`, paid out separately by `recordResult`.
 */
export interface PlayerStore {
  runHistory: RunResult[];
  decks: DeckDef[];
  influence: number;
  collection: OwnedCards;
  mapProgress: Record<string, true>;
  /** Board stickers attached per board (`rules/boardStickers.ts`) — permanent modifiers bought with
   *  Influence, snapshotted into `RunConfig.boardStickers` at launch. A board with none is absent. */
  boardStickers: BoardStickers;
  /** Lifetime cumulative counters kept as running totals — deliberately *not* derived from
   *  `runHistory`, which is capped at `HISTORY_LIMIT` and would silently undercount once trimmed.
   *  `influenceEarned` is gross Influence *gained* (the sum of every `applyRunResult` payout),
   *  ignoring shop spending — so it only ever grows. Feeds the Stats screen's profile summary. */
  lifetime: { runsPlayed: number; victories: number; influenceEarned: number };
  /** Best rounds survived per `'infinite'` mission — a persistent per-mission max folded in
   *  `applyRunResult`. Persistent for the same reason as `lifetime`: a record set more than
   *  `HISTORY_LIMIT` runs ago must not fall off the capped `runHistory` and make the displayed
   *  best *decrease*. A mission never yet played is absent. */
  bestInfinite: Record<string, number>;
}

/** The lifetime-counter bundle, shared with the Stats screen that renders it. */
export type LifetimeStats = PlayerStore['lifetime'];

const STORAGE_KEY = 'civcardgame:player-store';

/** A fresh player's starting store — no run history, the seed deck, the narrow
 *  starting collection, no Influence, no campaign progress. Exported so the Save
 *  submenu's "Clear save" action (`GameMenu.tsx`) can reset to it directly, besides its
 *  use here as `loadStore`'s fallback. */
export function emptyStore(): PlayerStore {
  const collection = collectionFromCounts(STARTING_COLLECTION);
  return {
    runHistory: [],
    decks: buildSeedDecks(DEFAULT_DECKS, collection),
    influence: 0,
    collection,
    mapProgress: {},
    boardStickers: {},
    lifetime: { runsPlayed: 0, victories: 0, influenceEarned: 0 },
    bestInfinite: {},
  };
}

/**
 * Shape-check shared by `loadStore` (reading the live localStorage key) and `importSave`
 * (reading a pasted/uploaded save file). Returns `null` if `raw` doesn't parse as a
 * `PlayerStore` — every field is required, with no fallback for a missing/old-shaped one
 * (pre-alpha: no save migration, see docs/TODO.md). This also catches a pre-Step-7.2
 * `collection` (a bare `{ cardId: count }` map, not `{ instances, nextId }`): without the
 * nested check it would pass the loose `typeof === 'object'` test and only fail much later,
 * deep inside `copiesOwned`.
 */
function parsePlayerStore(raw: unknown): PlayerStore | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  if (!Array.isArray(obj.runHistory)) return null;
  if (!Array.isArray(obj.decks)) return null;
  if (typeof obj.influence !== 'number') return null;
  if (!obj.collection || typeof obj.collection !== 'object') return null;
  const collectionObj = obj.collection as Record<string, unknown>;
  if (!Array.isArray(collectionObj.instances) || typeof collectionObj.nextId !== 'number') return null;
  if (!obj.mapProgress || typeof obj.mapProgress !== 'object') return null;
  if (!obj.boardStickers || typeof obj.boardStickers !== 'object') return null;
  if (!obj.lifetime || typeof obj.lifetime !== 'object') return null;
  const lifetime = obj.lifetime as Record<string, unknown>;
  if (
    typeof lifetime.runsPlayed !== 'number' ||
    typeof lifetime.victories !== 'number' ||
    typeof lifetime.influenceEarned !== 'number'
  ) {
    return null;
  }
  if (!obj.bestInfinite || typeof obj.bestInfinite !== 'object') return null;
  return {
    runHistory: obj.runHistory as RunResult[],
    decks: obj.decks as DeckDef[],
    influence: obj.influence,
    collection: obj.collection as OwnedCards,
    mapProgress: obj.mapProgress as Record<string, true>,
    boardStickers: obj.boardStickers as BoardStickers,
    lifetime: obj.lifetime as PlayerStore['lifetime'],
    bestInfinite: obj.bestInfinite as Record<string, number>,
  };
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

/** How many past runs the Stats screen shows. */
export const HISTORY_LIMIT = 10;

/**
 * Folds a finished run's `RunResult` into the store — history, `mapProgress`, and the
 * mission's reward (`rules/rewards.ts`). Pulled out of `App.tsx`'s `recordResult` into its
 * own pure function so the standard-vs-infinite payout branching is unit-tested directly
 * rather than buried in a component (see CLAUDE.md's core/shell boundary). A `'standard'`
 * mission marks `mapProgress` and pays its one-time first-clear reward only on a victory
 * outcome; an `'infinite'` mission never touches `mapProgress` and pays Influence
 * = rounds survived on *every* attempt, win or lose. `alreadyCompleted` is read from
 * `store.mapProgress` as it stood before this result, so a first clear is never masked by
 * its own just-applied update.
 *
 * Also folds the persistent lifetime aggregates the Stats screen reads (`lifetime`,
 * `bestInfinite`) — running totals rather than derivations, since `runHistory` is capped at
 * `HISTORY_LIMIT`. Every run increments `lifetime.runsPlayed`, a victory bumps `victories`, and
 * whatever Influence this run paid is added to `influenceEarned` (gross-of-spending). An infinite
 * mission additionally raises its `bestInfinite[missionId]` to the max of the old best and this
 * attempt's rounds survived.
 */
export function applyRunResult(store: PlayerStore, result: RunResult, mission: MissionDef): PlayerStore {
  const infinite = mission.kind === 'infinite';
  const alreadyCompleted = isCompleted(store.mapProgress, result.missionId);
  const mapProgress =
    !infinite && result.outcome === 'victory'
      ? { ...store.mapProgress, [result.missionId]: true as const }
      : store.mapProgress;
  const { influence, collection } = infinite
    ? computeRewards(mission, alreadyCompleted, store.collection, result.stats.turnsTaken)
    : result.outcome === 'victory'
      ? computeRewards(mission, alreadyCompleted, store.collection)
      : { influence: 0, collection: store.collection };
  const lifetime = {
    runsPlayed: store.lifetime.runsPlayed + 1,
    victories: store.lifetime.victories + (result.outcome === 'victory' ? 1 : 0),
    influenceEarned: store.lifetime.influenceEarned + influence,
  };
  const bestInfinite = infinite
    ? {
        ...store.bestInfinite,
        [result.missionId]: Math.max(store.bestInfinite[result.missionId] ?? 0, result.stats.turnsTaken),
      }
    : store.bestInfinite;
  return {
    ...store,
    runHistory: [result, ...store.runHistory].slice(0, HISTORY_LIMIT),
    mapProgress,
    influence: store.influence + influence,
    collection,
    lifetime,
    bestInfinite,
  };
}

/**
 * The exported-save wire format: a base64-encoded envelope around a `PlayerStore`
 * snapshot. `schemaVersion` exists because `PlayerStore` is a growing shape (`decks`,
 * then `influence`/`collection`/`mapProgress`, more to come) and an exported file can
 * sit on a player's disk across several of those changes, unlike the live localStorage
 * key which is migrated in place by `parsePlayerStore`. A future bump adds a migration
 * path keyed off this number rather than re-guessing from field presence.
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
