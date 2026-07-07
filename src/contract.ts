import type { BoardId } from './content/boards';
import type { DeckDef } from './content/decks';
import type { Resources } from './rules/resources';
import { resolveDeckCards } from './rules/deckBuilder';
import type { OwnedCards } from './rules/collection';
import { shuffle } from './rules/rng';

/**
 * The provisional selection a player builds up on the Mission screen
 * (`src/meta/MissionSelect.tsx`, one tab of `src/meta/MetaMenu.tsx`). Lives here, not
 * in the shell, so `buildRunConfig`
 * can promote it into a `RunConfig` without the core reaching into a React module.
 */
export interface RunSelection {
  missionId: string;
  boardId: BoardId;
  /** A `DeckDef.id` from the player's own deck list — every deck is player-editable,
   *  there's no separate closed set of "built-in" ids. */
  deckId: string;
}

/**
 * The spine between the two loops (see docs/DESIGN.md, "The contract"). The meta loop
 * owns durable choices (deck, board); a mission owns per-run modifiers; `RunConfig` is
 * where the two are merged into one immutable starting configuration. Board baseline
 * resources and mission disaster-injection are layered on during run setup, not here
 * (Phase 2 step 4) — this module only owns assembling the config itself.
 */
export interface RunConfig {
  /** Card IDs in draw order, already shuffled deterministically from `seed`. */
  deck: string[];
  board: BoardId;
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
    finalResources: Resources;
    /** The 3 strategic resources at run end — kept separate from `finalResources` since they live on `GameState` directly, not in `Resources`. */
    strategicResources: { population: number; territory: number; culture: number };
  };
}

/**
 * Assemble a `RunConfig` from the player's meta-loop selection, a run seed, the player's
 * own deck list, and their card collection — a deck's `cards` are meta instance ids
 * (Phase 3 Step 7.2), so resolving it to the run's cardId deck needs the collection to
 * translate. There's no static deck registry to fall back on — every deck lives in the
 * player's store. An unresolvable `deckId` (e.g. the source deck was deleted) produces an
 * empty `deck: []` rather than throwing, matching the codebase's general
 * fall-back-don't-throw style (e.g. `meta/store.ts`'s `loadStore`). The player's deck is
 * never mutated, only copied and reordered.
 */
export function buildRunConfig(selection: RunSelection, seed: string, decks: DeckDef[], collection: OwnedCards): RunConfig {
  const cards = resolveDeckCards(selection.deckId, decks, collection) ?? [];
  return {
    deck: shuffle(cards, seed),
    board: selection.boardId,
    missionId: selection.missionId,
    deckId: selection.deckId,
    seed,
  };
}

/**
 * Re-shuffle an existing `RunConfig`'s deck with a fresh seed (used on restart —
 * `src/run/GameContext.tsx`). Operates on `config.deck` directly rather than looking
 * `deckId` back up in the player's store: `shuffle` is a full permutation regardless
 * of input order, so the already-resolved starting deck is all that's needed, and this
 * stays pure core with no dependency on the player's deck list at all.
 */
export function reshuffleRunConfig(config: RunConfig, seed: string): RunConfig {
  return { ...config, deck: shuffle(config.deck, seed), seed };
}
