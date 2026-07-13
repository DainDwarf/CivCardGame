import { CARDS } from '../content/cards';
import { nextInstanceId } from './population';
import { resolveCard } from './effects';
import type { GameState } from './state';

/** Seed a new threat onto the board (bare, no counters yet) and resolve its one-time entry `effect`
 *  once — a threat's seed is its only "on entry" moment, since it's never played (the `threat`
 *  counterpart to an action resolving its `effect` on play; a no-op for the usual `effect`-less threat).
 *  Its *recurring* drain is separate: a seeded threat ticks every round via the `endTurn` broadcast
 *  (`rules/events.ts`'s `dispatchEvent` → `rules/effects.ts`'s `resolveEndTurn`, which runs the threat's
 *  own `resolveUpkeep` drain), so there's no per-tick function here — the card owns its behaviour and the
 *  bus drives it. Mission `setup` is the only caller. */
export function addThreat(G: GameState, cardId: string): void {
  const threat = { id: nextInstanceId(G), cardId };
  G.threats.push(threat);
  resolveCard({ G, self: threat });
}

/** Whether any seeded threat's own `defeat` predicate is met right now — the threat counterpart to
 *  `rules/objective.ts`'s `objectiveMet`. Fixed threat order, first match wins (today only one card,
 *  `sands_of_time`, ever defines `defeat`, so ordering is moot). `null` when none applies. */
export function defeatMet(G: GameState): { reason: string } | null {
  for (const t of G.threats) {
    const reason = CARDS[t.cardId]?.defeat?.(G, t);
    if (reason) return { reason };
  }
  return null;
}

/** Re-derive the defeat flag from every seeded threat's own `defeat` predicate — the bus's
 *  counterpart to `rules/objective.ts`'s `evaluateObjective`. Called at every `flushEvents` boundary
 *  (`rules/events.ts`), so `G.pendingDefeat` is fresh before every `checkEndIf`. Set-OR-CLEAR every
 *  call (never sticky): a threat's condition can dip and recover within a single broadcast (a
 *  threshold a later subscriber's production tops back up), and the flag must not survive that. */
export function evaluateDefeat(G: GameState): void {
  G.pendingDefeat = defeatMet(G);
}
