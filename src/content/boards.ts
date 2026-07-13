import type { Resources } from '../rules/resources';

/** A board's catalogue id. A plain `string` (not a union) because the catalogue grows through the
 *  content pass — a fixed union would break every `boardId: BoardId` consumer as boards are added
 *  or renamed. */
export type BoardId = string;

/**
 * A government board is a run's starting configuration — the baseline the mission's
 * `setup` then layers modifiers on top of (see docs/DESIGN.md, "Government boards").
 * It sets all 8 starting resources: the 5 core (spendable) plus the 3 strategic gauges
 * (population / territory / culture).
 */
export interface BoardDef {
  id: BoardId;
  name: string;
  description: string;
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
 * government at launch). The `chiefdom`/`settlement` numbers are provisional.
 */
export const BOARDS: Record<BoardId, BoardDef> = {
  tribe: {
    id: 'tribe',
    name: 'Tribe',
    description: 'A wandering band of hunter-gatherers: a little food, a few hands, and the whole age ahead.',
    resources: { food: 5, production: 0, science: 0, military: 0, money: 0, population: 2, territory: 0, culture: 0 },
  },
  settlement: {
    id: 'settlement',
    name: 'Settlement',
    description: 'The band has put down roots: full granaries, the first worked fields, and a patch of land to call their own.',
    resources: { food: 10, production: 2, science: 0, military: 0, money: 0, population: 2, territory: 1, culture: 0 },
  },
  chiefdom: {
    id: 'chiefdom',
    name: 'Chiefdom',
    description: 'A war-band under a single chief: fewer mouths to feed, but spears ready from the first season.',
    resources: { food: 4, production: 0, science: 0, military: 4, money: 0, population: 1, territory: 1, culture: 0 },
  },
};
