import type { BoardId } from './content/boards';
import type { DeckDef } from './content/decks';
import type { Resources } from './rules/resources';
import { resolveDeckCards, type DeckCard } from './rules/deckBuilder';
import type { OwnedCards } from './rules/collection';
import type { BoardStickers } from './rules/boardStickers';
import { shuffle } from './rules/rng';

/**
 * The provisional selection a player builds up on the Mission screen (`meta/CampaignMap.tsx`). Lives
 * here, not in the shell, so `buildRunConfig` can promote it into a `RunConfig` without the core
 * reaching into a React module.
 */
export interface RunSelection {
  missionId: string;
  boardId: BoardId;
  /** A `DeckDef.id` from the player's own deck list — every deck is player-editable,
   *  there's no separate closed set of "built-in" ids. */
  deckId: string;
}

/**
 * The spine between the two loops (see docs/DESIGN.md, "The contract"). The meta loop owns durable
 * choices (deck, board); a mission owns per-run modifiers; `RunConfig` merges the two into one
 * immutable starting configuration. Board baseline resources and mission injection are layered on
 * during run setup, not here — this module only assembles the config.
 */
export interface RunConfig {
  /** Cards in draw order, already shuffled deterministically from `seed` — each carries its cardId
   *  and any permanent stickers from its owning meta instance. */
  deck: DeckCard[];
  board: BoardId;
  /** The board stickers applied to `board`, **snapshotted at launch** — not re-looked-up in
   *  `run/setup.ts` (core can't reach `PlayerStore`), so a sticker bought mid-campaign never
   *  retroactively alters an in-progress or restarted run. `run/setup.ts` folds these onto the
   *  board baseline via `effectiveBoard`. */
  boardStickers: string[];
  missionId: string;
  /** The deck this run was launched with — kept for display/record-keeping. Reshuffling
   *  (e.g. on restart) operates on `deck` directly via `reshuffleRunConfig`, not a
   *  lookup by this id, so a run stays reproducible even if the source deck is later
   *  edited or deleted from the player's store. */
  deckId: string;
  /** Drives every deterministic draw this run makes — same seed, same run. */
  seed: string;
}

/**
 * Deliberately excludes rewards: those are either looked up from the mission (by
 * `missionId`) or derived from `stats` by the meta loop, not carried on the result
 * itself.
 */
export interface RunResult {
  outcome: 'victory' | 'defeat';
  missionId: string;
  stats: {
    turnsTaken: number;
    /** Every resource pool at run end — the five core plus the three strategic
     *  (population/territory/culture), mirroring `GameState.resources`. */
    finalResources: Resources;
  };
}

/**
 * Assemble a `RunConfig` from the player's meta-loop selection, a run seed, their deck list, their
 * collection, and their board-sticker map — a deck's `cards` are meta instance ids, so resolving it
 * to a run's cardId deck needs the collection to translate; the chosen board's stickers are
 * snapshotted off `boardStickers` (see `RunConfig.boardStickers`). There's no static deck registry to
 * fall back on. An unresolvable
 * `deckId` (e.g. the source deck was deleted) yields an empty `deck: []` rather than throwing (the
 * codebase's fall-back-don't-throw style). The player's deck is never mutated, only copied.
 */
export function buildRunConfig(
  selection: RunSelection,
  seed: string,
  decks: DeckDef[],
  collection: OwnedCards,
  boardStickers: BoardStickers,
): RunConfig {
  const cards = resolveDeckCards(selection.deckId, decks, collection) ?? [];
  return {
    deck: shuffle(cards, seed),
    board: selection.boardId,
    boardStickers: boardStickers[selection.boardId] ?? [],
    missionId: selection.missionId,
    deckId: selection.deckId,
    seed,
  };
}

/**
 * Re-shuffle an existing `RunConfig`'s deck with a fresh seed (used on restart —
 * `run/GameContext.tsx`). Operates on `config.deck` directly rather than re-looking up `deckId`:
 * `shuffle` is a full permutation regardless of input order, so the already-resolved deck is all
 * that's needed, keeping this pure core with no dependency on the player's deck list.
 */
export function reshuffleRunConfig(config: RunConfig, seed: string): RunConfig {
  return { ...config, deck: shuffle(config.deck, seed), seed };
}
