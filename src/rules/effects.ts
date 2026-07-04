import { addResources, subtractResources, type Resources } from './resources';
import { drawCard } from './deck';
import type { GameState } from './state';

/** The immediate, one-shot effect a card applies when played. */
export interface CardEffect {
  /** Resources gained immediately. */
  gain?: Partial<Resources>;
  /** Resources removed immediately (e.g. a Barbarian event draining Military). No clamp — may go negative. */
  loss?: Partial<Resources>;
  /** Cards drawn immediately. */
  draw?: number;
  /** Population gained immediately (e.g. Settlers). */
  population?: number;
  /** Territory gained immediately — raises the cap on tableau size (e.g. Conquest, Develop). */
  territory?: number;
  /** Culture gained immediately — adds to G.culture (e.g. Cultural Festival). */
  culture?: number;
  /**
   * Remove a player-chosen building from the tableau, freeing its territory slot and
   * returning its workers to the idle pool (the demolished card files to the removed pile).
   * Requires a `destroyInstanceId` argument to `playCard` — handled there, not in `applyEffect`.
   */
  destroy?: true;
  /**
   * Exile *this* card to the removed pile once it resolves, instead of the default discard
   * (e.g. a disaster event you don't want recurring). Currently only set on `event` cards,
   * checked by `rules/upkeep.ts`'s `resolveHandEvents` — without it, a resolved card discards
   * like anything else. Not a trait of any `kind`; it's the effect that decides.
   */
  remove?: true;
}

export function applyEffect(G: GameState, effect?: CardEffect): void {
  if (!effect) return;
  if (effect.gain) addResources(G.resources, effect.gain);
  if (effect.loss) subtractResources(G.resources, effect.loss);
  if (effect.draw) {
    for (let i = 0; i < effect.draw; i++) drawCard(G);
  }
  if (effect.population) G.population += effect.population;
  if (effect.territory) G.territory += effect.territory;
  if (effect.culture) G.culture += effect.culture;
}
