import type { Resources } from '../rules/resources';
import type { CardEffect } from '../rules/effects';

export type CardKind = 'permanent' | 'recurring';

export interface CardDef {
  id: string;
  name: string;
  kind: CardKind;
  /** Resources required to play the card. Absent keys are free (e.g. {} = no cost). */
  cost: Partial<Resources>;
  /** Extra cost: number of other cards you must discard from hand to play this. */
  discardCost?: number;
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
  farm: { id: 'farm', name: 'Farm', kind: 'permanent', cost: { production: 1 }, produces: { food: 2 }, workers: 1, tags: ['building'] },
  granary: { id: 'granary', name: 'Granary', kind: 'permanent', cost: { production: 2 }, produces: { food: 3 }, workers: 1, tags: ['building'] },
  workshop: { id: 'workshop', name: 'Workshop', kind: 'permanent', cost: { production: 2 }, produces: { production: 2 }, workers: 1, tags: ['building'] },
  library: { id: 'library', name: 'Library', kind: 'permanent', cost: { production: 3 }, produces: { science: 2 }, workers: 1, tags: ['building'] },
  university: { id: 'university', name: 'University', kind: 'permanent', cost: { production: 4 }, produces: { science: 3 }, workers: 1, tags: ['building'] },

  // --- Defensive buildings ---
  walls: { id: 'walls', name: 'City Walls', kind: 'permanent', cost: { production: 2 }, defense: 3, workers: 0, tags: ['building'] },
  barracks: { id: 'barracks', name: 'Barracks', kind: 'permanent', cost: { production: 2 }, produces: { production: 1 }, defense: 2, workers: 1, tags: ['building'] },

  // --- Wonders (need a worker to operate) ---
  pyramids: { id: 'pyramids', name: 'The Pyramids', kind: 'permanent', cost: { production: 4 }, produces: { production: 1 }, defense: 1, workers: 1, tags: ['wonder'] },
  great_library: { id: 'great_library', name: 'The Great Library', kind: 'permanent', cost: { production: 4 }, produces: { science: 2 }, workers: 1, tags: ['wonder'] },
  colossus: { id: 'colossus', name: 'The Colossus', kind: 'permanent', cost: { production: 4 }, produces: { food: 1, science: 1 }, defense: 1, workers: 1, tags: ['wonder'] },

  // --- Recurring actions (no workers needed) ---
  settlers: { id: 'settlers', name: 'Settlers', kind: 'recurring', cost: { food: 2 }, effect: { population: 1 }, tags: ['action'] },
  forced_labor: { id: 'forced_labor', name: 'Forced Labor', kind: 'recurring', cost: {}, discardCost: 1, effect: { gain: { production: 3 } }, tags: ['action'] },
  eureka: { id: 'eureka', name: 'Eureka!', kind: 'recurring', cost: { production: 1 }, effect: { gain: { science: 3 } }, tags: ['action'] },
  harvest: { id: 'harvest', name: 'Harvest', kind: 'recurring', cost: {}, discardCost: 1, effect: { gain: { food: 3 } }, tags: ['action'] },
  inspiration: { id: 'inspiration', name: 'Inspiration', kind: 'recurring', cost: { production: 1 }, effect: { draw: 2 }, tags: ['action'] },
};
