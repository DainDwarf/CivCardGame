import type { Resources } from '../rules/resources';
import type { CardEffect } from '../rules/effects';

export type CardKind = 'permanent' | 'recurring';

export interface CardDef {
  id: string;
  name: string;
  /**
   * Disposal after play — about the *card*, not what it does:
   * - `permanent`: the card is consumed and goes to the **removed** pile (gone from the deck).
   * - `recurring`: the card recycles to the **discard** pile.
   * A recurring card may still construct a permanent building (the building stays in play;
   * the card recycles) — see `village_settlement`.
   */
  kind: CardKind;
  /** Resources required to play. Absent keys are free (e.g. {} = no cost). */
  cost: Partial<Resources>;
  /** Extra cost: population consumed to play, paid from idle workers. */
  popCost?: number;
  /** Extra cost: number of idle workers to lock for the rest of this turn (released at beginTurn). */
  popReserve?: number;
  /** Extra cost: number of other cards you must discard from hand to play this. */
  discardCost?: number;
  /** Minimum culture level required to play — a gate, not a cost (culture is not consumed). */
  cultureThreshold?: number;
  /** Immediate effect when played: resource gain, draw, population, and/or constructing a building. */
  effect?: CardEffect;
}

/**
 * The card catalogue. Building cards (`permanent`) construct a building via `effect.build`
 * and are then removed from the deck; recurring cards resolve their effect and recycle
 * through the discard. Building stats live in `content/buildings.ts`, not here.
 */
export const CARDS: Record<string, CardDef> = {
  // --- Building cards: erect a building, then the card is removed from the deck. ---
  farm: { id: 'farm', name: 'Farm', kind: 'permanent', cost: { production: 1 }, effect: { build: 'farm' } },
  granary: { id: 'granary', name: 'Granary', kind: 'permanent', cost: { production: 2 }, effect: { build: 'granary' } },
  workshop: { id: 'workshop', name: 'Workshop', kind: 'permanent', cost: { production: 2 }, effect: { build: 'workshop' } },
  library: { id: 'library', name: 'Library', kind: 'permanent', cost: { production: 3 }, effect: { build: 'library' } },
  university: { id: 'university', name: 'University', kind: 'permanent', cost: { production: 4 }, effect: { build: 'university' } },
  walls: { id: 'walls', name: 'City Walls', kind: 'permanent', cost: { production: 2 }, effect: { build: 'walls' } },
  barracks: { id: 'barracks', name: 'Barracks', kind: 'permanent', cost: { production: 2 }, effect: { build: 'barracks' } },
  theater: { id: 'theater', name: 'Theater', kind: 'permanent', cost: { production: 3 }, effect: { build: 'theater' } },
  market: { id: 'market', name: 'Market', kind: 'permanent', cost: { production: 2 }, effect: { build: 'market' } },
  trading_post: { id: 'trading_post', name: 'Trading Post', kind: 'permanent', cost: { production: 3 }, effect: { build: 'trading_post' } },

  // --- Wonder cards. ---
  pyramids: { id: 'pyramids', name: 'The Pyramids', kind: 'permanent', cost: { production: 4 }, effect: { build: 'pyramids' } },
  great_library: { id: 'great_library', name: 'The Great Library', kind: 'permanent', cost: { production: 4 }, effect: { build: 'great_library' } },
  colossus: { id: 'colossus', name: 'The Colossus', kind: 'permanent', cost: { production: 4 }, effect: { build: 'colossus' } },

  // --- Recurring actions (recycle to the discard). ---
  settlers: { id: 'settlers', name: 'Settlers', kind: 'recurring', cost: { food: 2 }, effect: { population: 1 } },
  corvee: { id: 'corvee', name: 'Corvée', kind: 'recurring', cost: {}, popReserve: 1, effect: { gain: { production: 3 } } },
  eureka: { id: 'eureka', name: 'Eureka!', kind: 'recurring', cost: {}, discardCost: 1, effect: { gain: { science: 3 } } },
  harvest: { id: 'harvest', name: 'Harvest', kind: 'recurring', cost: {}, popReserve: 1, effect: { gain: { food: 3 } } },
  inspiration: { id: 'inspiration', name: 'Inspiration', kind: 'recurring', cost: { money: 1 }, effect: { draw: 2 } },

  // --- Territory expansion: recurring cards that raise the building-slot cap. ---
  conquest: { id: 'conquest', name: 'Conquest', kind: 'recurring', cost: { military: 3 }, effect: { territory: 1 } },
  develop: { id: 'develop', name: 'Develop', kind: 'recurring', cost: { production: 3 }, effect: { territory: 1 } },

  // --- Culture cards: generate culture or require a culture threshold. ---
  cultural_festival: { id: 'cultural_festival', name: 'Cultural Festival', kind: 'recurring', cost: { food: 2 }, effect: { culture: 3 } },
  philosopher: { id: 'philosopher', name: 'The Philosopher', kind: 'recurring', cost: { science: 1 }, cultureThreshold: 5, effect: { gain: { science: 3 }, draw: 1 } },

  // --- Territory management: reclaim a slot by demolishing a building. ---
  destroy: { id: 'destroy', name: 'Destroy', kind: 'recurring', cost: { production: 1 }, effect: { destroy: true } },

  // --- Recurring builder: a recycling card that still erects a permanent building. ---
  village_settlement: { id: 'village_settlement', name: 'Village Settlement', kind: 'recurring', cost: { food: 10 }, popCost: 2, effect: { build: 'farm' } },
};
