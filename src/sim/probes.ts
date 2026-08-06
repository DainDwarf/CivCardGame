import { CORE_KEYS, currentCost, placedCards, type CardInstance, type GameState, type Resources } from '../rules';
import { realizedGain } from '../rules/effects';
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
 * card/mission/rule (per [[sim-logic-stays-in-sim]]). Output is read through `rules/effects.ts`'s
 * `realizedGain`, so a board bending what a card yields or takes is priced at what it really does.
 */

/** A number that counts only when it is a gain — the shape `Partial<Resources>` reads are full of. */
export function positive(x: number | undefined): number {
  return x !== undefined && x > 0 ? x : 0;
}

/** Every card id present anywhere in the run — the moves actually available to this deck. Scanning all
 *  of `CARDS` would credit a play the deck can't make (an unlocked-but-undecked card). */
export function runCardIds(G: GameState): Set<string> {
  const ids = new Set<string>();
  for (const zone of [G.deck, G.hand, G.discard, G.removed, placedCards(G)]) {
    for (const c of zone) ids.add(c.cardId);
  }
  return ids;
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
 *  scaling card reads at its floor (the static-derivation carve-out `sim/enablers.ts` lives on). */
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
  const effect = realizedGain(G, card.effect?.resources);
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
 *  A pool neither source reaches has **no** entry — a gap each caller answers in its own currency. */
export function replacementCost(G: GameState, ids: Set<string>): Partial<Record<keyof Resources, number>> {
  const wr: Partial<Record<keyof Resources, number>> = {};
  const runCards = Object.values(CARDS).filter((c) => ids.has(c.id));
  for (const card of runCards) {
    if ((card.workers ?? 0) < 1) continue;
    const produces = realizedGain(G, card.produces?.resources);
    for (const [k, out] of Object.entries(produces ?? {}) as [keyof Resources, number][]) {
      if (out > 0 && 1 / out < (wr[k] ?? Infinity)) wr[k] = 1 / out;
    }
  }
  for (let pass = 0; pass < 3; pass++) {
    for (const card of runCards) {
      const grant = realizedGain(G, card.effect?.resources);
      if (!grant) continue;
      let priced = 0;
      for (const [k, amt] of Object.entries(cardPrice(G, card)) as [keyof Resources, number][]) {
        if (wr[k] === undefined) { priced = NaN; break; }
        priced += amt * wr[k];
      }
      if (!(priced > 0)) continue;
      for (const [k, out] of Object.entries(grant) as [keyof Resources, number][]) {
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

/** By **standing in a zone**: a synthetic copy injected into each zone the card *stays* in, so a measure
 *  that counts cards registers it. `removed` is not filtered by kind, since any card may self-exile
 *  through its `resolve`; the two standing zones are, because `run/moves.ts`'s `playCard` is their only
 *  writer and routes by kind — probing a card into a zone it can never reach would credit a step that has
 *  no path to happen. */
export function presenceDelta(probe: GameState, card: CardDef, measure: (G: GameState) => number): number {
  const base = measure(probe);
  probe.removed.push({ id: -1, cardId: card.id });
  let best = measure(probe) - base;
  probe.removed.pop();
  if (isStructure(card)) {
    probe.tableau.push({ id: -2, cardId: card.id, workers: 0 });
    best = Math.max(best, measure(probe) - base);
    probe.tableau.pop();
  }
  if (card.kind === 'trade') {
    probe.tradeRoutes.push({ id: -3, cardId: card.id, workers: 0 });
    best = Math.max(best, measure(probe) - base);
    probe.tradeRoutes.pop();
  }
  return best;
}

/** By **what its play adds**: the positive half of the play `effect`, so a measure over resources
 *  registers a card whose whole contribution is one-shot (a Hut's citizens). The negative half is not
 *  netted off — that is the card's price, and `cardPrice` charges it there. */
export function grantDelta(probe: GameState, card: CardDef, measure: (G: GameState) => number): number {
  return withGain(probe, realizedGain(probe, card.effect?.resources), measure);
}

/** By **standing and producing**, at **one worker** — `produces` is per-worker for a staffable and already
 *  flat for a route, and reading it at capacity would price the population that staffs it into the card.
 *  The only one of the three that is a rate rather than a level. */
export function outputDelta(probe: GameState, card: CardDef, measure: (G: GameState) => number): number {
  return withGain(probe, realizedGain(probe, card.produces?.resources), measure);
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
