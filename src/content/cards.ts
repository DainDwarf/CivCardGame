import type { Resources } from '../rules/resources';
import type { CardEffect } from '../rules/effects';

export type CardKind = 'permanent' | 'recurring';

export interface CardDef {
  id: string;
  name: string;
  kind: CardKind;
  /** Production required to play the card. */
  cost: number;
  /** Permanents only: per-turn output once committed AND staffed. */
  produces?: Partial<Resources>;
  /** Recurring only: immediate effect when played. */
  effect?: CardEffect;
  /** Static defense while operating in the tableau. */
  defense?: number;
  /** Workers required to operate (permanents). 0 = self-sufficient. Defaults to 1. */
  workers?: number;
  /** 'building' | 'wonder' | 'action' | ... */
  tags?: string[];
}

/**
 * The card catalogue. Permanents commit to the tableau and need workers to operate
 * (except self-sufficient ones like City Walls); recurring cards resolve an effect
 * and recycle through the deck.
 */
export const CARDS: Record<string, CardDef> = {
  // --- Permanent buildings (need a worker to operate) ---
  farm: { id: 'farm', name: 'Farm', kind: 'permanent', cost: 1, produces: { food: 2 }, workers: 1, tags: ['building'] },
  granary: { id: 'granary', name: 'Granary', kind: 'permanent', cost: 2, produces: { food: 3 }, workers: 1, tags: ['building'] },
  workshop: { id: 'workshop', name: 'Workshop', kind: 'permanent', cost: 2, produces: { production: 2 }, workers: 1, tags: ['building'] },
  library: { id: 'library', name: 'Library', kind: 'permanent', cost: 3, produces: { science: 2 }, workers: 1, tags: ['building'] },
  university: { id: 'university', name: 'University', kind: 'permanent', cost: 4, produces: { science: 3 }, workers: 1, tags: ['building'] },

  // --- Defensive buildings ---
  walls: { id: 'walls', name: 'City Walls', kind: 'permanent', cost: 2, defense: 3, workers: 0, tags: ['building'] },
  barracks: { id: 'barracks', name: 'Barracks', kind: 'permanent', cost: 2, produces: { production: 1 }, defense: 2, workers: 1, tags: ['building'] },

  // --- Wonders (need a worker to operate) ---
  pyramids: { id: 'pyramids', name: 'The Pyramids', kind: 'permanent', cost: 4, produces: { production: 1 }, defense: 1, workers: 1, tags: ['wonder'] },
  great_library: { id: 'great_library', name: 'The Great Library', kind: 'permanent', cost: 4, produces: { science: 2 }, workers: 1, tags: ['wonder'] },
  colossus: { id: 'colossus', name: 'The Colossus', kind: 'permanent', cost: 4, produces: { food: 1, science: 1 }, defense: 1, workers: 1, tags: ['wonder'] },

  // --- Recurring actions (no workers needed) ---
  house: { id: 'house', name: 'House', kind: 'recurring', cost: 1, effect: { population: 1 }, tags: ['action'] },
  forced_labor: { id: 'forced_labor', name: 'Forced Labor', kind: 'recurring', cost: 0, effect: { gain: { production: 3 } }, tags: ['action'] },
  eureka: { id: 'eureka', name: 'Eureka!', kind: 'recurring', cost: 1, effect: { gain: { science: 3 } }, tags: ['action'] },
  harvest: { id: 'harvest', name: 'Harvest', kind: 'recurring', cost: 0, effect: { gain: { food: 3 } }, tags: ['action'] },
  inspiration: { id: 'inspiration', name: 'Inspiration', kind: 'recurring', cost: 1, effect: { draw: 2 }, tags: ['action'] },
};
