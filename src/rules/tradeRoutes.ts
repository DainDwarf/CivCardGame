import { resolveCard } from './effects';
import type { CardInstance, GameState } from './state';

/** Open a trade route: place a played `trade` card into the standing trade zone and resolve its
 *  one-time entry `effect` once (a no-op for the usual `effect`-less route, the same way `addBuilding`
 *  pairs with a placement effect in `moves.ts`). The route's *recurring* exchange is separate — it ticks
 *  every round via the `endTurn` broadcast (`rules/events.ts`'s `dispatchEvent` → `rules/effects.ts`'s
 *  `resolveEndTurn`), which runs its flat `produces` yield and its `upkeep` rent — so there's no
 *  per-tick function here; the card owns its behaviour and the bus drives it.
 *
 *  A route stands for the rest of the run: nothing removes one, so the rent is a one-way commitment
 *  and an unpayable one collapses the treasury into bankruptcy (`rules/collapse.ts`). It holds a
 *  territory slot for that whole time like a building does, but takes no workers. */
export function openTradeRoute(G: GameState, inst: CardInstance): void {
  const route = { ...inst, workers: 0 };
  G.tradeRoutes.push(route);
  resolveCard({ G, self: route });
}
