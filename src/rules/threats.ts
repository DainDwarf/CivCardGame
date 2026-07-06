import { resolveCard } from './effects';
import { nextInstanceId } from './population';
import type { GameState } from './state';

/** Seed a new threat onto the board, bare (no counters yet). Mission `setup` is the only caller —
 *  a threat is never played by the player. */
export function addThreat(G: GameState, cardId: string): void {
  G.threats.push({ id: nextInstanceId(G), cardId });
}

/** Escalate every threat by one upkeep tick: resolves the threat's own card through the same
 *  resolver spine every other card runs through (`resolveCard`) — the card itself computes and
 *  applies its drain and bumps its own escalation counter (mirroring Cornucopia's per-play growth,
 *  just tick-triggered instead of play-triggered), not this function. Called unconditionally from
 *  `applyUpkeep`; a no-op when `G.threats` is empty. */
export function tickThreats(G: GameState): void {
  for (const t of G.threats) resolveCard({ G, self: t });
}
