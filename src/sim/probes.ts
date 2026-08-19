import {
  CORE_KEYS, cloneState, currentCost, placedCards,
  type CardInstance, type GameState, type Resources,
} from '../rules';
import { realizedGain, resolveCard } from '../rules/effects';
import { effectiveGain } from '../rules/stickers';
import { CARDS, isStructure, type CardDef } from '../content/cards';

/**
 * The **derivation front end** every goal-directed value model reads the catalogue through: what a card
 * charges, what a unit of each pool costs to obtain, and what a card is worth to a quantity that is only
 * available as a closure over `G`.
 *
 * Split out from the models that consume it (`sim/enablers.ts`'s score-point weighting,
 * `sim/race.ts`'s rounds) because it is the half that has no currency of its own — a probe reports what
 * moved and by how much, and the caller decides what that is worth. Two models pricing the same card
 * from two copies of these would be two derivations to keep in step, and the first retune would part
 * them.
 *
 * Everything here is **mechanical over card data**: no per-mission table, no hook on any
 * card/mission/rule (per [[sim-logic-stays-in-sim]]). Output is read through `foldedGain` off the copy a
 * play would really be made with, so a stickered copy and a board bending what a card yields are both
 * priced at what they really do.
 */

/** A number that counts only when it is a gain — the shape `Partial<Resources>` reads are full of. */
export function positive(x: number | undefined): number {
  return x !== undefined && x > 0 ? x : 0;
}

/** Every card id present anywhere in the run — the moves actually available to this deck. Scanning all
 *  of `CARDS` would credit a play the deck can't make (an unlocked-but-undecked card). */
export function runCardIds(G: GameState): Set<string> {
  const ids = new Set<string>();
  for (const zone of runZones(G)) {
    for (const c of zone) ids.add(c.cardId);
  }
  return ids;
}

/** Every zone a run's copies live in — one list, so an id and the copies behind it are read off the same
 *  walk and can never disagree about what the run holds. */
function runZones(G: GameState): CardInstance[][] {
  return [G.deck, G.hand, G.discard, G.removed, placedCards(G)];
}

/** Every copy the run holds of each id in `ids`, sorted by instance id. A per-instance read needs the
 *  copies rather than the id, since a deck holding a stickered copy beside a bare one has two different
 *  real rates and one of them is not the other's. An id with no copy maps to a lone `undefined`: there is
 *  no instance to fold against, and the printed bag is the only reading there is.
 *
 *  Sorted because a zone is an unordered heap (`state.ts`'s `contentKey` canonicalizes on that), so a
 *  relaxation walking these in deal order would let two states the transposition key calls equal derive
 *  different rates. */
export function runInstances(G: GameState, ids: Set<string>): Map<string, (CardInstance | undefined)[]> {
  const out = new Map<string, CardInstance[]>();
  for (const id of ids) out.set(id, []);
  for (const zone of runZones(G)) {
    for (const c of zone) out.get(c.cardId)?.push(c);
  }
  const found = new Map<string, (CardInstance | undefined)[]>();
  for (const [id, copies] of out) {
    found.set(id, copies.length > 0 ? [...copies].sort((a, b) => a.id - b.id) : [undefined]);
  }
  return found;
}

/** A card's printed bag as one copy really yields it: the copy's own stickers, then every standing
 *  `modifyGain` — folded in the order `rules/effects.ts`'s `gainResources` folds a real gain, so a
 *  projection and the payment it projects can't part. With no copy the printed bag is the only reading
 *  there is (the carve-out is having no instance, never being in `sim/`). */
export function foldedGain(
  G: GameState,
  bag: Partial<Resources> | undefined,
  self?: CardInstance,
): Partial<Resources> | undefined {
  return realizedGain(G, self ? effectiveGain(bag, self) : bag);
}

/** What playing a card charges, over all 8 pools: what its `cost` names plus every pool its play `effect`
 *  *takes away*. A negative play delta is semantically a price — the citizen a Voyage sails with is as much
 *  the cost of the launch as its 🪙 — and it has nowhere else to ride: `CardCost.resources` is core-only by
 *  construction, since a strategic pool is gated by the system that owns it rather than spent blind. A
 *  card's recurring `upkeep` is not a price: it buys no play, and the permanent-economy projection each
 *  model runs already charges it.
 *
 *  Handed the copy a play would really be made with, the price is *that copy's*, read through
 *  `rules/cost.ts`'s `currentCost` — the one seam a price may be read through, so the copy's stickers and
 *  the card's own escalation both land, and a caller cannot quote a number the gate wouldn't charge. With
 *  no copy there is no instance to price against and the declarative base is the only number there is, so a
 *  scaling card reads at its floor. */
export function cardPrice(
  G: GameState,
  card: CardDef,
  self?: CardInstance,
): Partial<Record<keyof Resources, number>> {
  const price: Partial<Record<keyof Resources, number>> = {};
  const cost = self ? currentCost(card, { G, self }).resources : card.cost.resources;
  for (const ck of CORE_KEYS) {
    const amt = positive(cost?.[ck]);
    if (amt > 0) price[ck] = amt;
  }
  const effect = foldedGain(G, card.effect?.resources, self);
  for (const [k, delta] of Object.entries(effect ?? {}) as [keyof Resources, number][]) {
    if (delta < 0) price[k] = (price[k] ?? 0) - delta;
  }
  return price;
}

/** What a unit of each pool costs to *obtain*, in **worker-rounds** — the currency the game's production
 *  actually runs on.
 *
 *  Why it exists: a card's price is a bag of pools, and any question of the form "how much of this price
 *  is this component" answered by *unit count* asserts that a 🪙 and a 🧍 are the same size of thing. They
 *  aren't — a Trader mints 3🪙 a round for free while a citizen exists only if a 6🔨 House is bought — so a
 *  count-based reading systematically under-prices the scarce half of a price and over-prices the cheap
 *  half.
 *
 *  Two sources, in order. A pool with a **staffed producer** costs `1 / its best per-worker output`: the
 *  marginal cost of that output is the worker standing in the box, which is exactly one worker-round, and
 *  the building's own capital cost is deliberately not amortized in (it is paid once and produces for the
 *  rest of the run). A pool with **no per-round source** is priced through the cheapest one-shot grant that
 *  mints it — a House's 6🔨 for 2🧍 — which is why this relaxes rather than reads once: that card's own
 *  price is in pools this same map prices. Two passes past the seed resolve every chain in the catalogue;
 *  the bound is what makes a cyclic pair terminate instead of diverging.
 *
 *  A pool neither source reaches has **no** entry — a gap each caller answers in its own currency.
 *
 *  Both sources read the **copy**, not the card: a route is one instance's, so what it yields and what it
 *  charges are two readings of the same one and a run holding an Irrigated Farm beside a bare one offers
 *  two routes rather than an averaged one. They compose as they always did — the cheapest wins — so the
 *  aggregation over copies is the same `min` the aggregation over cards is. */
export function replacementCost(G: GameState, ids: Set<string>): Partial<Record<keyof Resources, number>> {
  const wr: Partial<Record<keyof Resources, number>> = {};
  const copies = runInstances(G, ids);
  // Read once, ahead of the relaxation: none of the three depends on `wr`, and pricing a copy through
  // `currentCost` once per pass would triple the cost of a derivation the planner re-runs every re-plan.
  const routes = Object.values(CARDS)
    .filter((c) => ids.has(c.id))
    .flatMap((card) => {
      // Staffing *capacity*, which lives on the card — a placed copy's own `workers` is the count assigned
      // to it, a different number that would read an unstaffed producer as needing nobody.
      const staffable = (card.workers ?? 0) >= 1;
      return copies.get(card.id)!.map((self) => ({
        staffable,
        produces: foldedGain(G, card.produces?.resources, self),
        grant: foldedGain(G, card.effect?.resources, self),
        price: cardPrice(G, card, self),
      }));
    });
  for (const route of routes) {
    if (!route.staffable) continue;
    for (const [k, out] of Object.entries(route.produces ?? {}) as [keyof Resources, number][]) {
      if (out > 0 && 1 / out < (wr[k] ?? Infinity)) wr[k] = 1 / out;
    }
  }
  for (let pass = 0; pass < 3; pass++) {
    for (const route of routes) {
      if (!route.grant) continue;
      let priced = 0;
      for (const [k, amt] of Object.entries(route.price) as [keyof Resources, number][]) {
        if (wr[k] === undefined) { priced = NaN; break; }
        priced += amt * wr[k];
      }
      if (!(priced > 0)) continue;
      for (const [k, out] of Object.entries(route.grant) as [keyof Resources, number][]) {
        if (out > 0 && priced / out < (wr[k] ?? Infinity)) wr[k] = priced / out;
      }
    }
  }
  return wr;
}

/**
 * Three probes over one quantity — whatever is only readable as a closure over `G`, a goal's `measure` or
 * the whole objective's progress — one per way a card can move it. They are separate because a caller
 * that has a use for one rarely has a use for all three, and because what to do with a card that moves a
 * quantity two ways is the caller's decision. Each leaves `probe` exactly as found.
 */

/** By **standing in a zone**: `copies` synthetic copies injected into each zone the card *stays* in, so a
 *  measure that counts cards registers them. `removed` is not filtered by kind, since any card may
 *  self-exile through its `resolve`; the two standing zones are, because `run/moves.ts`'s `playCard` is
 *  their only writer and routes by kind — probing a card into a zone it can never reach would credit a step
 *  that has no path to happen.
 *
 *  The one probe that reads no copy: it diffs a *count* of cards present, so there is no rate for a
 *  sticker to fold over — and at two copies the run may well hold two differently stickered ones, which a
 *  single representative would misreport as a pair.
 *
 *  `copies` is what tells a caller whether the contribution is a **rate or a ceiling**: a measure counting
 *  the distinct ids present reads the same at one copy and at two, so the second copy buys nothing and no
 *  number of them completes a goal one card cannot. Reading that off the measure is the only way there is —
 *  a goal states what it counts as a closure, never how it saturates. */
export function presenceDelta(
  probe: GameState,
  card: CardDef,
  measure: (G: GameState) => number,
  copies = 1,
): number {
  const base = measure(probe);
  const inject = (zone: { id: number; cardId: string; workers?: number }[], id: number): number => {
    for (let i = 0; i < copies; i++) zone.push({ id: id - i, cardId: card.id, workers: 0 });
    const delta = measure(probe) - base;
    zone.length -= copies;
    return delta;
  };
  let best = inject(probe.removed, -1);
  if (isStructure(card)) best = Math.max(best, inject(probe.tableau, -1 - copies));
  if (card.kind === 'trade') best = Math.max(best, inject(probe.tradeRoutes, -1 - 2 * copies));
  return best;
}

/** Whether playing a card files its own copy to `removed` rather than back into circulation — the one thing
 *  `CardKind` does not settle, since `run/moves.ts`'s action→discard filing is skipped for a copy whose own
 *  `resolve` already exiled it. Run rather than read: a closure states its filing by doing it.
 *
 *  The clone absorbs everything the effect does; a resolver that suspends into a `pendingInteraction` parks
 *  it there and is answered by nobody, which is exactly the read wanted — an unanswered effect files
 *  nothing. */
export function selfExiles(G: GameState, card: CardDef): boolean {
  if (!card.effect?.resolve) return false;
  const probe = cloneState(G);
  resolveCard({ G: probe, self: { id: -1, cardId: card.id } });
  return probe.removed.some((c) => c.id === -1);
}

/** By **what its play adds**: the positive half of the play `effect`, so a measure over resources
 *  registers a card whose whole contribution is one-shot (a Hut's citizens). The negative half is not
 *  netted off — that is the card's price, and `cardPrice` charges it there.
 *
 *  Handed the copy a play would really be made with, the gain is *that copy's* (`foldedGain`) — the same
 *  instance the price is quoted off, so a route cannot promise a stickered output against a bare price. */
export function grantDelta(
  probe: GameState,
  card: CardDef,
  measure: (G: GameState) => number,
  self?: CardInstance,
): number {
  return withGain(probe, foldedGain(probe, card.effect?.resources, self), measure);
}

/** By **standing and producing**, at **one worker** — `produces` is per-worker for a staffable and already
 *  flat for a route, and reading it at capacity would price the population that staffs it into the card.
 *  The only one of the three that is a rate rather than a level. Reads its copy as `grantDelta` does. */
export function outputDelta(
  probe: GameState,
  card: CardDef,
  measure: (G: GameState) => number,
  self?: CardInstance,
): number {
  return withGain(probe, foldedGain(probe, card.produces?.resources, self), measure);
}

function withGain(
  probe: GameState,
  gain: Partial<Resources> | undefined,
  measure: (G: GameState) => number,
): number {
  if (!gain) return 0;
  const base = measure(probe);
  const restore = probe.resources;
  probe.resources = { ...restore };
  for (const [k, v] of Object.entries(gain) as [keyof Resources, number][]) {
    if (v > 0) probe.resources[k] += v;
  }
  const delta = measure(probe) - base;
  probe.resources = restore;
  return delta;
}
