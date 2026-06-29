import { addResources, type Resources } from './resources';
import { drawCard } from './deck';
import { addBuilding } from './population';
import type { GameState } from './state';

/** The immediate, one-shot effect a card applies when played. */
export interface CardEffect {
  /** Resources gained immediately. */
  gain?: Partial<Resources>;
  /** Cards drawn immediately. */
  draw?: number;
  /** Population gained immediately (e.g. Settlers). */
  population?: number;
  /** Territory gained immediately — raises the cap on tableau size (e.g. Conquest, Develop). */
  territory?: number;
  /** Culture gained immediately — adds to G.culture (e.g. Cultural Festival). */
  culture?: number;
  /** Construct a building (by id) in the tableau, auto-staffed from idle population. */
  build?: string;
  /**
   * Remove a player-chosen building from the tableau, freeing its territory slot and
   * returning its workers to the idle pool. Requires a `destroyBuildingId` argument
   * to `playCard` — handled there, not in `applyEffect`.
   */
  destroy?: true;
}

export function applyEffect(G: GameState, effect?: CardEffect): void {
  if (!effect) return;
  if (effect.gain) addResources(G.resources, effect.gain);
  if (effect.draw) {
    for (let i = 0; i < effect.draw; i++) drawCard(G);
  }
  if (effect.population) G.population += effect.population;
  if (effect.territory) G.territory += effect.territory;
  if (effect.culture) G.culture += effect.culture;
  if (effect.build) addBuilding(G, effect.build);
}
