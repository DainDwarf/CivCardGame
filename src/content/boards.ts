import type { Resources } from '../rules/resources';

/** A board's catalogue id. A plain `string` (not a union) because the catalogue grows through the
 *  content pass — a fixed union would break every `boardId: BoardId` consumer as boards are added
 *  or renamed. */
export type BoardId = string;

/**
 * A government board is a run's starting configuration — the baseline a run is seeded from, chosen
 * at launch alongside the deck (see docs/DESIGN.md, "Government boards").
 */
export interface BoardDef {
  id: BoardId;
  name: string;
  /** All eight starting pools in one bundle: the five core (spendable) plus the three strategic
   *  gauges (population / territory / culture). Mirrors `GameState.resources`, so `run/setup.ts`
   *  seeds a run by copying it directly. */
  resources: Resources;
}

/** The board every fresh profile starts with, and the guaranteed fallback if the unlocked set is ever
 *  empty (`meta/boardDisplay.ts`'s `availableBoardIds`) — the one board availability can never drop
 *  below, so a player is never locked out. There is no `starting` flag: launchability is purely
 *  membership in `PlayerStore.unlockedBoards`, seeded with this id and grown/replaced by mission
 *  rewards (`unlockBoardIds`, `boardUpgrade`). */
export const ORIGIN_BOARD_ID: BoardId = 'tribe';

/**
 * The government boards a run can be launched on. `tribe` (the `ORIGIN_BOARD_ID`) is the Paleolithic
 * starting configuration matching the buildingless starting deck: a modest food store and nothing
 * else, no fixed territory yet (buildings — and the territory that gates them — arrive with the Stone
 * Age arc). Clearing the first mission *upgrades* it into `settlement` (a `boardUpgrade` reward that
 * retires Tribe for the settled version — see `rules/boardUpgrade.ts`). Other boards land through
 * `unlockBoardIds` rewards — `chiefdom`, the first military-leaning government, is unlocked by the
 * "Raiders at the Border" mission, where the arc teaches board choice (Chiefdom vs. the settled
 * government at launch). `settlement` in turn upgrades into `city` — the Bronze Age government — on
 * clearing the "Masonry" mission. The `chiefdom`/`settlement`/`city` numbers are provisional.
 */
export const BOARDS: Record<BoardId, BoardDef> = {
  tribe: {
    id: 'tribe',
    name: 'Tribe',
    resources: { food: 5, production: 0, science: 0, military: 0, money: 0, population: 2, territory: 0, culture: 0 },
  },
  settlement: {
    id: 'settlement',
    name: 'Settlement',
    resources: { food: 10, production: 2, science: 0, military: 0, money: 0, population: 2, territory: 2, culture: 0 },
  },
  chiefdom: {
    id: 'chiefdom',
    name: 'Chiefdom',
    resources: { food: 6, production: 2, science: 0, military: 6, money: 0, population: 3, territory: 0, culture: 0 },
  },
  city: {
    id: 'city',
    name: 'City',
    resources: { food: 12, production: 6, science: 0, military: 0, money: 2, population: 2, territory: 2, culture: 0 },
  },
};
