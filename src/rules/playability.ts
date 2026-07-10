import type { CardDef } from '../content/cards';
import { canAfford, type Resources } from './resources';
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
  | { kind: 'cost'; missing: Partial<Resources> }
  | { kind: 'cultureLevel'; required: number }
  | { kind: 'territory' }
  | { kind: 'noBuildingsToDestroy' }
  | { kind: 'emptyDrawPile' }
  | { kind: 'discardEmpty' }
  | { kind: 'event' };

/** Why `card` cannot be played right now, or null if it can. `self` is the exact hand instance
 *  being checked — its own attached sticker (e.g. Efficient) may discount `card.cost` below the
 *  catalogue's raw number (`rules/stickers.ts`'s `effectiveCost`), so affordability is always
 *  checked against *this copy's* actual price, not the static card. */
export function unplayableReason(G: GameState, card: CardDef, self: CardInstance): UnplayableReason | null {
  // Event cards are never player-playable — they auto-resolve at end of turn.
  if (card.kind === 'event') return { kind: 'event' };
  const cost = effectiveCost(card.cost, self);
  if (!canAfford(G.resources, cost)) {
    const missing: Partial<Resources> = {};
    for (const [k, v] of Object.entries(cost) as [keyof Resources, number][]) {
      if (v > 0 && G.resources[k] < v) missing[k] = v - G.resources[k];
    }
    return { kind: 'cost', missing };
  }
  if (card.cultureLevelReq && cultureLevel(G.culture) < card.cultureLevelReq)
    return { kind: 'cultureLevel', required: card.cultureLevelReq };
  if (card.kind === 'building' && freeTerritory(G) <= 0) return { kind: 'territory' };
  if (card.effect?.destroy && G.tableau.length === 0) return { kind: 'noBuildingsToDestroy' };
  // A peek card (revealsFromDeck) has nothing to reveal when both draw and discard piles are empty —
  // gate it rather than let it fizzle for its cost (mirrors the noBuildingsToDestroy precedent above).
  if (card.revealsFromDeck && G.deck.length + G.discard.length === 0) return { kind: 'emptyDrawPile' };
  // A discard-recovery card (recoversFromDiscard) has nothing to recover from an empty discard —
  // gate it rather than let it fizzle for its cost (mirrors the emptyDrawPile precedent above).
  if (card.recoversFromDiscard && G.discard.length === 0) return { kind: 'discardEmpty' };
  return null;
}
