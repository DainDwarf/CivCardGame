import type { RunResult } from '../contract';
import { DEFAULT_DECKS, type DeckDef } from '../content/decks';
import { STARTING_COLLECTION } from '../content/collection';
import type { MissionDef } from '../content/missions';
import { buildSeedDecks } from '../rules/deckBuilder';
import { collectionFromCounts, type OwnedCards } from '../rules/collection';
import type { BoardStickers } from '../rules/boardStickers';
import { applyBoardUpgrade } from '../rules/boardUpgrade';
import { computeRewards } from '../rules/rewards';
import { isCompleted } from '../rules/campaign';
import { ORIGIN_BOARD_ID } from '../content/boards';
import { GAME_NAME } from '../content/about';

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
  /** Card/board stickers the player has *unlocked* (via a mission's `unlockStickerIds` /
   *  `unlockBoardStickerIds` reward — `rules/rewards.ts`). Id-sets shaped like `mapProgress` (a
   *  sticker has no copy identity, so membership is the whole state, unlike `collection`). A sticker
   *  is hidden from its tray until its id is present here; folded in at clear time by `applyRunResult`
   *  so the grant is stable against later reward-list edits. Absent id = still locked. */
  unlockedStickers: Record<string, true>;
  unlockedBoardStickers: Record<string, true>;
  /** The single source of truth for which boards the player may launch on — an id-set shaped like
   *  `mapProgress` (a board is singular — no per-copy identity), read through `boardDisplay.ts`'s
   *  `availableBoardIds`. Seeded with the `ORIGIN_BOARD_ID` on a fresh profile (there is no separate
   *  `starting` flag) and folded at clear time by `applyRunResult`: an `unlockBoardIds` reward *adds*
   *  ids, a `boardUpgrade` reward swaps one for another (add `to`, drop `from`). A board is hidden from
   *  the pickers until its id is present here; an absent id is still locked. `availableBoardIds` falls
   *  back to the origin board if this is ever empty, so a player can never be locked out. */
  unlockedBoards: Record<string, true>;
  /** Lifetime cumulative counters kept as running totals — deliberately *not* derived from
   *  `runHistory`, which is capped at `HISTORY_LIMIT` and would silently undercount once trimmed.
   *  `influenceEarned` is gross Influence *gained* (the sum of every `applyRunResult` payout),
   *  ignoring shop spending — so it only ever grows. Feeds the Stats screen's profile summary. */
  lifetime: { runsPlayed: number; victories: number; influenceEarned: number };
  /** Best score per `'infinite'` mission (each mission's own measure — see `RunResult.stats.score`
   *  and `MissionDef.scoreUnit`) — a persistent per-mission max folded in
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
    unlockedStickers: {},
    unlockedBoardStickers: {},
    unlockedBoards: { [ORIGIN_BOARD_ID]: true },
    lifetime: { runsPlayed: 0, victories: 0, influenceEarned: 0 },
    bestInfinite: {},
  };
}

/**
 * Every persisted `PlayerStore` — the live `localStorage` key and an exported `.civsave` alike —
 * travels inside this envelope, so both carry the schema version the payload was written under.
 * `PlayerStore` is a growing shape, and a save (a file on a player's disk, a browser profile not
 * opened since last month) can predate any change to it; the number is what a migration keys off,
 * instead of re-guessing the vintage from which fields are present. Bump it with the shape, and
 * chain the upgrade in `readSaved`.
 */
const SCHEMA_VERSION = 1;

interface SaveEnvelope {
  schemaVersion: number;
  savedAt: string;
  store: PlayerStore;
}

function wrap(store: PlayerStore): SaveEnvelope {
  return { schemaVersion: SCHEMA_VERSION, savedAt: new Date().toISOString(), store };
}

/**
 * Reads a parsed envelope back into a `PlayerStore`, or `null` when it can't be one — the single
 * seam `loadStore` and `importSave` both read through, which is where a schema migration goes: an
 * older `schemaVersion` is upgraded step by step to the current one *before* the shape check. A
 * payload with no envelope at all is the pre-0.1 `localStorage` shape (a bare `PlayerStore`), read
 * as version 1 so a profile from the beta builds carries over.
 */
export function readSaved(parsed: unknown): PlayerStore | null {
  if (!parsed || typeof parsed !== 'object') return null;
  const obj = parsed as Record<string, unknown>;
  const [schemaVersion, store] = 'schemaVersion' in obj ? [obj.schemaVersion, obj.store] : [1, obj];
  if (schemaVersion !== SCHEMA_VERSION) return null;
  return parsePlayerStore(store);
}

/**
 * Shape-check behind `readSaved`. Returns `null` if `raw` doesn't parse as a *current*
 * `PlayerStore` — every field is required, since a payload written under an older schema reaches
 * this only after `readSaved` has upgraded it. This also catches a malformed `collection` (a bare
 * `{ cardId: count }` map, not `{ instances, nextId }`): without the nested check it would pass the
 * loose `typeof === 'object'` test and only fail much later, deep inside `copiesOwned`.
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
  if (!obj.unlockedStickers || typeof obj.unlockedStickers !== 'object') return null;
  if (!obj.unlockedBoardStickers || typeof obj.unlockedBoardStickers !== 'object') return null;
  if (!obj.unlockedBoards || typeof obj.unlockedBoards !== 'object') return null;
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
    unlockedStickers: obj.unlockedStickers as Record<string, true>,
    unlockedBoardStickers: obj.unlockedBoardStickers as Record<string, true>,
    unlockedBoards: obj.unlockedBoards as Record<string, true>,
    lifetime: obj.lifetime as PlayerStore['lifetime'],
    bestInfinite: obj.bestInfinite as Record<string, number>,
  };
}

/** Reads the store from `localStorage`. Missing, corrupt, or inaccessible data falls back to an empty store. */
export function loadStore(): PlayerStore {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyStore();
    return readSaved(JSON.parse(raw)) ?? emptyStore();
  } catch {
    return emptyStore();
  }
}

/** Writes the store to `localStorage`. Failures (quota, private browsing) are swallowed — the run continues in-memory-only. */
export function saveStore(store: PlayerStore): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(wrap(store)));
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
 * = the run's score on *every* attempt, win or lose — unless the attempt carries no score at all
 * (an objective declaring no measure, or the `rewardless` sandbox), which pays nothing and keeps
 * no best-score. `alreadyCompleted` is read from
 * `store.mapProgress` as it stood before this result, so a first clear is never masked by
 * its own just-applied update.
 *
 * Also folds the persistent lifetime aggregates the Stats screen reads (`lifetime`,
 * `bestInfinite`) — running totals rather than derivations, since `runHistory` is capped at
 * `HISTORY_LIMIT`. Every run increments `lifetime.runsPlayed`, a victory bumps `victories`, and
 * whatever Influence this run paid is added to `influenceEarned` (gross-of-spending). A *scored*
 * infinite mission additionally raises its `bestInfinite[missionId]` to the max of the old best and
 * this attempt's score; a `rewardless` one records none.
 */
export function applyRunResult(store: PlayerStore, result: RunResult, mission: MissionDef): PlayerStore {
  const infinite = mission.kind === 'infinite';
  const alreadyCompleted = isCompleted(store.mapProgress, result.missionId);
  const mapProgress =
    !infinite && result.outcome === 'victory'
      ? { ...store.mapProgress, [result.missionId]: true as const }
      : store.mapProgress;
  // The player's current unlock state, bundled to pass through `computeRewards` (in unchanged, out
  // with this mission's unlocks folded in) — the field names mirror `PlayerStore`, so it spreads back.
  const progress = {
    collection: store.collection,
    unlockedStickers: store.unlockedStickers,
    unlockedBoardStickers: store.unlockedBoardStickers,
    unlockedBoards: store.unlockedBoards,
  };
  const { influence, progress: nextProgress } = infinite
    ? computeRewards(mission, alreadyCompleted, progress, result.stats.score)
    : result.outcome === 'victory'
      ? computeRewards(mission, alreadyCompleted, progress)
      : { influence: 0, progress };
  const lifetime = {
    runsPlayed: store.lifetime.runsPlayed + 1,
    victories: store.lifetime.victories + (result.outcome === 'victory' ? 1 : 0),
    influenceEarned: store.lifetime.influenceEarned + influence,
  };
  // A `rewardless` infinite mission (the sandbox) keeps no best-score, the same no-stakes opt-out
  // that zeroes its payout — a score is meaningless with nothing bounding the run.
  const score = result.stats.score;
  const bestInfinite =
    infinite && !mission.rewardless && score !== undefined
      ? {
          ...store.bestInfinite,
          [result.missionId]: Math.max(store.bestInfinite[result.missionId] ?? 0, score),
        }
      : store.bestInfinite;
  // A board upgrade fires on the same first-clear victory the unlock rewards do, but sits outside
  // `computeRewards`: it *removes* a board and rewrites `boardStickers`, neither of which the
  // append-only reward path handles. Folded over the just-unlocked board set so an `unlockBoardIds`
  // grant and an upgrade in the same reward compose. See `rules/boardUpgrade.ts`.
  const upgrade =
    !infinite && result.outcome === 'victory' && !alreadyCompleted ? mission.reward?.boardUpgrade : undefined;
  const boards = upgrade
    ? applyBoardUpgrade(nextProgress.unlockedBoards, store.boardStickers, upgrade)
    : { unlockedBoards: nextProgress.unlockedBoards, boardStickers: store.boardStickers };
  return {
    ...store,
    runHistory: [result, ...store.runHistory].slice(0, HISTORY_LIMIT),
    mapProgress,
    influence: store.influence + influence,
    ...nextProgress,
    unlockedBoards: boards.unlockedBoards,
    boardStickers: boards.boardStickers,
    lifetime,
    bestInfinite,
  };
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

/** Serializes a `PlayerStore` into a base64 save-file string — the same envelope `saveStore` writes,
 *  encoded — for the game menu's Save submenu to hand to the player as a download. */
export function exportSave(store: PlayerStore): string {
  return encodeBase64(JSON.stringify(wrap(store)));
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

  const store = readSaved(parsed);
  if (!store) return { ok: false, error: `This file is not a recognized ${GAME_NAME} save.` };
  return { ok: true, store };
}
