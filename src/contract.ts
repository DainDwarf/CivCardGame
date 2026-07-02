import type { BoardId } from './content/boards';
import { DECKS, type DeckId } from './content/decks';
import type { Resources } from './rules/resources';
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
  deckId: DeckId;
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
  /** The saved deck `deck` was shuffled from — kept so a fresh seed can reshuffle it (e.g. on restart) without re-deriving the rest of the config. */
  deckId: DeckId;
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
 * Assemble a `RunConfig` from the player's meta-loop selection and a run seed. The
 * saved deck (looked up by `deckId`) is shuffled deterministically from `seed` into
 * `RunConfig.deck` — the saved deck in `DECKS` is never mutated, only copied and
 * reordered.
 */
export function buildRunConfig(selection: RunSelection, seed: string): RunConfig {
  const deck = DECKS[selection.deckId].cards;
  return {
    deck: shuffle(deck, seed),
    board: selection.boardId,
    missionId: selection.missionId,
    deckId: selection.deckId,
    seed,
  };
}
