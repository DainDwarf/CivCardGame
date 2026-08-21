import { resolveCard } from './effects';
import { emitEvent } from './events';
import type { CardInstance, GameState } from './state';

/** Open a trade route: place a played `trade` card into the standing trade zone and resolve its
 *  one-time entry `effect` once (a no-op for the usual `effect`-less route, the same way `addBuilding`
 *  pairs with a placement effect in `moves.ts`). The route's *recurring* exchange is separate — it ticks
 *  every round via the `endTurn` broadcast (`rules/events.ts`'s `dispatchEvent` → `rules/effects.ts`'s
 *  `resolveEndTurn`), which runs its flat `produces` yield and its `upkeep` rent — so there's no
 *  per-tick function here; the card owns its behaviour and the bus drives it.
 *
 *  A route stands until something *else* takes it off the board — no player move does, so the rent is a
 *  one-way commitment and an unpayable one collapses the treasury into bankruptcy (`rules/collapse.ts`).
 *  That rent is the only bound on the zone — a route takes no workers and no territory. */
export function openTradeRoute(G: GameState, inst: CardInstance): void {
  const route = { ...inst, workers: 0 };
  G.tradeRoutes.push(route);
  resolveCard({ G, self: route });
}

/**
 * Cut a standing route: lift it out of `G.tradeRoutes` by instance id and file it to the discard — the
 * counterpart a card effect closes a route *through* rather than splicing the zone itself (the
 * discipline `rules/deck.ts`'s card-facing primitives follow). No-op on an id the zone doesn't hold.
 *
 * Only `workers` comes off, exactly as `upkeep.ts` files a Work box: staffing belongs to the box on the
 * board, while `stickers` and `counters` ride the physical card into the discard — so a route recovered
 * and replayed re-stands with whatever it still carries.
 *
 * Emits the `discard` event like every other pile-entering path, under its own reason so a handler can
 * tell an enemy cut from a routine recycle. Emit, never dispatch: this runs inside a resolver, and the
 * queue drains at the boundary flush that follows.
 */
export function closeTradeRoute(G: GameState, instanceId: number): void {
  const idx = G.tradeRoutes.findIndex((r) => r.id === instanceId);
  if (idx === -1) return;
  const { workers: _workers, ...filed } = G.tradeRoutes[idx];
  G.tradeRoutes.splice(idx, 1);
  G.discard.push(filed);
  emitEvent(G, { type: 'discard', instanceId: filed.id, cardId: filed.cardId, reason: 'routeClosed' });
}
