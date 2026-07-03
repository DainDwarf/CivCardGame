import type { CardDef } from '../content/cards';
import { canAfford, type Resources } from './resources';
import { cultureLevel } from './culture';
import { freeTerritory } from './tableau';
import type { GameState } from './state';

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
  | { kind: 'event' };

/** Why `card` cannot be played right now, or null if it can. */
export function unplayableReason(G: GameState, card: CardDef): UnplayableReason | null {
  // Event cards are never player-playable — they auto-resolve at end of turn.
  if (card.kind === 'event') return { kind: 'event' };
  if (!canAfford(G.resources, card.cost)) {
    const missing: Partial<Resources> = {};
    for (const [k, v] of Object.entries(card.cost) as [keyof Resources, number][]) {
      if (v > 0 && G.resources[k] < v) missing[k] = v - G.resources[k];
    }
    return { kind: 'cost', missing };
  }
  if (card.cultureLevelReq && cultureLevel(G.culture) < card.cultureLevelReq)
    return { kind: 'cultureLevel', required: card.cultureLevelReq };
  if (card.effect?.build && freeTerritory(G) <= 0) return { kind: 'territory' };
  if (card.effect?.destroy && G.tableau.length === 0) return { kind: 'noBuildingsToDestroy' };
  return null;
}
