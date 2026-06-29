import type { Resources } from '../rules/resources';

/**
 * A building is a permanent entity in the tableau — distinct from the card that built it.
 * Several different cards may construct the same building (e.g. the `farm` card and the
 * `village_settlement` card both erect a Farm), and a building stays in play regardless of
 * where its source card ends up (removed or discard). Building stats live here, not on cards.
 */
export interface BuildingDef {
  id: string;
  name: string;
  /** Per-round output once staffed. */
  produces?: Partial<Resources>;
  /** Per-round culture gained while staffed — accumulates on G.culture, never spent. */
  cultureOutput?: number;
  /** Workers required to operate. 0 = self-sufficient. Defaults to 1. */
  workers?: number;
  /** 'building' | 'wonder' | ... */
  tags?: string[];
}

export const BUILDINGS: Record<string, BuildingDef> = {
  farm: { id: 'farm', name: 'Farm', produces: { food: 2 }, workers: 1, tags: ['building'] },
  granary: { id: 'granary', name: 'Granary', produces: { food: 3 }, workers: 1, tags: ['building'] },
  workshop: { id: 'workshop', name: 'Workshop', produces: { production: 2 }, workers: 1, tags: ['building'] },
  library: { id: 'library', name: 'Library', produces: { science: 2 }, workers: 1, tags: ['building'] },
  university: { id: 'university', name: 'University', produces: { science: 3 }, workers: 1, tags: ['building'] },

  // Culture buildings.
  theater: { id: 'theater', name: 'Theater', cultureOutput: 2, workers: 1, tags: ['building'] },

  // Commerce buildings.
  market: { id: 'market', name: 'Market', produces: { money: 2 }, workers: 1, tags: ['building'] },
  trading_post: { id: 'trading_post', name: 'Trading Post', produces: { money: 3 }, workers: 1, tags: ['building'] },

  // Military buildings.
  walls: { id: 'walls', name: 'City Walls', produces: { military: 3 }, workers: 0, tags: ['building'] },
  barracks: { id: 'barracks', name: 'Barracks', produces: { production: 1, military: 2 }, workers: 1, tags: ['building'] },

  // Wonders.
  pyramids: { id: 'pyramids', name: 'The Pyramids', produces: { production: 1, military: 1 }, workers: 1, tags: ['wonder'] },
  great_library: { id: 'great_library', name: 'The Great Library', produces: { science: 2 }, workers: 1, tags: ['wonder'] },
  colossus: { id: 'colossus', name: 'The Colossus', produces: { food: 1, science: 1, military: 1 }, workers: 1, tags: ['wonder'] },
};
