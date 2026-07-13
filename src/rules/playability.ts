import { isStructure, type CardDef } from '../content/cards';
import { canAfford, type CoreResources } from './resources';
import { cultureLevel } from './culture';
import { freeTerritory } from './tableau';
import type { CardInstance, GameState } from './state';
import { effectiveCost } from './stickers';

/**
 * Structured reason a card cannot currently be played — one variant per gate `playCard`
 * enforces, checked in the same priority order. `null` means the card is playable.
 * Kept as data (not a formatted string) so the shell can render its own wording/icons
 * while `playCard` and the UI's dimming/rejection messaging share one source of truth.
 */
export type UnplayableReason =
  | { kind: 'cost'; missing: Partial<CoreResources> }
  | { kind: 'cultureLevel'; required: number }
  | { kind: 'territory' }
  | { kind: 'emptyDrawPile' }
  | { kind: 'discardEmpty' };

/** A card's playability descriptor — everything beyond the raw resource `cost` that decides whether
 *  it can be played, interpreted by `unplayableReason`. The declarative fields plus the `check`
 *  closure all compose (a card must clear every one it declares). */
export interface CardGate {
  /** Minimum culture level required to play — a gate, not a cost (culture is not consumed). */
  cultureLevelReq?: number;
  /** Extra cost: number of other cards you must discard from hand to play this. */
  discardCost?: number;
  /** Bespoke precondition the declarative fields can't express (e.g. a peek card needs a non-empty
   *  pile), checked in addition to them. Pure read over `G`; returns the reason it blocks, or null. */
  check?: (G: GameState, self: CardInstance) => UnplayableReason | null;
}

/** Why `card` cannot be played right now, or null if it can. `self` is the exact hand instance
 *  being checked — its own attached sticker (e.g. Efficient) may discount `card.cost` below the
 *  catalogue's raw number (`rules/stickers.ts`'s `effectiveCost`), so affordability is always
 *  checked against *this copy's* actual price, not the static card. */
export function unplayableReason(G: GameState, card: CardDef, self: CardInstance): UnplayableReason | null {
  const cost = effectiveCost(card.cost, self);
  if (!canAfford(G.resources, cost)) {
    const missing: Partial<CoreResources> = {};
    for (const [k, v] of Object.entries(cost) as [keyof CoreResources, number][]) {
      if (v > 0 && G.resources[k] < v) missing[k] = v - G.resources[k];
    }
    return { kind: 'cost', missing };
  }
  if (card.gate?.cultureLevelReq && cultureLevel(G.resources.culture) < card.gate.cultureLevelReq)
    return { kind: 'cultureLevel', required: card.gate.cultureLevelReq };
  if (isStructure(card) && freeTerritory(G) <= 0) return { kind: 'territory' };
  return card.gate?.check?.(G, self) ?? null;
}
