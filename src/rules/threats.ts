import { CARDS } from '../content/cards';
import { nextInstanceId } from './population';
import { scaleResources, subtractResources } from './resources';
import type { GameState } from './state';

/** Seed a new threat onto the board at level 0 (deals no drain until it first ticks). Mission
 *  `setup` is the only caller — a threat is never played by the player. */
export function addThreat(G: GameState, cardId: string): void {
  G.threats.push({ id: nextInstanceId(G), cardId, level: 0 });
}

/** Escalate every threat by one upkeep: drain `level * cardId`'s base `effect.loss` from
 *  resources, *then* increment `level` — apply-then-increment, so the round a threat is added
 *  (level 0) drains nothing, and the drain grows every round after. Called unconditionally from
 *  `applyUpkeep`; a no-op when `G.threats` is empty. */
export function tickThreats(G: GameState): void {
  for (const t of G.threats) {
    const baseLoss = CARDS[t.cardId]?.effect?.loss;
    if (baseLoss) subtractResources(G.resources, scaleResources(baseLoss, t.level));
    t.level += 1;
  }
}
