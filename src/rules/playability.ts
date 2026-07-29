import { isStructure, type CardDef } from '../content/cards';
import { costReason, type CostContext, type UnplayableReason } from './cost';
import { freeTerritory } from './territory';
import type { CardInstance, GameState } from './state';

/** Why `card` cannot be played right now, or null if it can. `self` is the exact hand instance being
 *  checked, because price is per-copy: its own `cost.resolve` and its attached stickers both move the
 *  number off the catalogue's (`rules/cost.ts`), so affordability is always checked against *this
 *  copy's* actual price. Board room is checked after the price — a card you can't pay for reports the
 *  price, which is the more actionable of the two. */
export function unplayableReason(G: GameState, card: CardDef, self: CardInstance): UnplayableReason | null {
  const ctx: CostContext = { G, self };
  const priced = costReason(card, ctx);
  if (priced) return priced;
  if (isStructure(card) && freeTerritory(G) <= 0) return { kind: 'territory' };
  return null;
}
