import type { Resources } from '../rules/resources';

export type BoardId = 'tribe' | 'monarchy' | 'republic';

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

export const BOARDS: Record<BoardId, BoardDef> = {
  tribe: {
    id: 'tribe',
    name: 'Tribe',
    description: 'A humble start: even resources and a modest population.',
    resources: { food: 5, production: 5, science: 0, military: 0, money: 0 },
    population: 2,
    territory: 6,
    culture: 0,
  },

  monarchy: {
    id: 'monarchy',
    name: 'Monarchy',
    description: 'A martial court: strong on Military, thin on Population.',
    resources: { food: 3, production: 5, science: 0, military: 4, money: 0 },
    population: 1,
    territory: 6,
    culture: 0,
  },

  republic: {
    id: 'republic',
    name: 'Republic',
    description: 'A mercantile assembly: flush with Money and Territory, short on Production.',
    resources: { food: 4, production: 3, science: 0, military: 0, money: 5 },
    population: 2,
    territory: 8,
    culture: 0,
  },
};
