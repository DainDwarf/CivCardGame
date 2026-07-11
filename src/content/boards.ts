import type { Resources } from '../rules/resources';

/** A board's catalogue id. A plain `string` (not a union) because the catalogue is emptied for the
 *  Phase 4 content pass — a fixed union couldn't key an empty `BOARDS` and would break every
 *  `boardId: BoardId` consumer; Step 3 authors the real boards under whatever ids it picks. */
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
  resources: Resources;
  population: number;
  territory: number;
  culture: number;
}

/**
 * The government boards a run can be launched on. **Phase 4 Step 3** authors the first one — `tribe`,
 * the Paleolithic starting configuration matching the buildingless starting deck: a small band
 * (population 2) with a modest food store and nothing else, no fixed territory yet (buildings — and
 * the territory that gates them — arrive with the Stone Age arc). More boards land through mission
 * rewards in later steps.
 */
export const BOARDS: Record<BoardId, BoardDef> = {
  tribe: {
    id: 'tribe',
    name: 'Tribe',
    description: 'A wandering band of hunter-gatherers: a little food, a few hands, and the whole age ahead.',
    resources: { food: 5, production: 0, science: 0, military: 0, money: 0 },
    population: 2,
    territory: 0,
    culture: 0,
  },
};
