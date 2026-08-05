import { CARDS, type ObjectiveGoal } from '../content/cards';
import {
  CORE_KEYS,
  addResources,
  applyUpkeep,
  cloneState,
  effectiveHandSize,
  freeTerritory,
  goalMet,
  isOperating,
  producingUnits,
  realizedGain,
  resolveEndTurn,
  scaleResources,
  type CoreResources,
  type GameState,
  type Resources,
} from '../rules';
import { effectiveGain } from '../rules/stickers';
import { isDurableProducer, isStructure } from '../content/cards';
import { cardPrice, grantDelta, outputDelta, presenceDelta, replacementCost, runCardIds } from './probes';
import { DEFAULT_MAX_ROUNDS } from './simulate';

/**
 * The **race model**: a run is a race between the win and death, so a state's value is its margin —
 * `T̂loss − T̂win`, both estimated in **rounds**.
 *
 * The currency is what makes this different from a band scorer. A target enters only as
 * `need / throughput`, with both sides in raw resource units, so nothing here can be denominated per
 * *fraction of a goal* — which is what makes a mission's steering signal independent of how large a
 * number its goal happens to name. Three behaviours then fall out of the arithmetic rather than out of
 * tuned terms: a producer is worth the rounds it shaves off `T̂win` (and worth nothing once it cannot
 * repay before `T̂loss`); survival and tempo trade against each other continuously, so a survivable dip
 * that buys a faster win is takeable; and staffing registers as value because it raises τ in `T̂win`'s
 * denominator.
 *
 * A **pure read** over `G` (it clones to project), so it is safe on a candidate's resulting state.
 */

/**
 * The tuned constants, with their units. Everything else in this module is derived from `G` and the
 * catalogue — a number that is not here is arithmetic, not a knob.
 */
const RACE = {
  /** Score points — a met objective ends the run, so it dwarfs any margin the horizon can express. */
  victory: 1_000_000,
  /** Rounds: the log-sum-exp temperature of the fold across a goal's goals. Tuned rather than derived
   *  because it prices a preference, not a quantity: how much the goal that *isn't* binding still pulls.
   *  A pure `max` has zero gradient on it, which lets a beam abandon a side goal for free. */
  goalSoftening: 1,
  /** Dimensionless multiplier on a losing margin, decaying with `T̂loss`. Tuned because it prices the
   *  *noise* in the two estimates rather than anything the state contains: both are projections, and a
   *  beam must not surf one round from famine on the strength of one. */
  nearDeathSteepness: 4,
  /** Rounds — the tie-break's ceiling, reached at `wealthCap` banked core resources (the two together
   *  are one constant: a weight with no cap is unbounded, and cannot then be held under a margin step).
   *  Sized so a full bank never outweighs a real difference in the race. */
  wealthRounds: 0.05,
  wealthCap: 50,
};

/** What bound `T̂loss`: the core pool that runs out first, a threat's own deadline, the drive loop's
 *  round cutoff, or a defeat already pending. Naming it is the difference between "this state is 3
 *  rounds from death" and an answer a balance question can act on. */
export type LossCause = keyof CoreResources | 'horizon' | 'deadline' | 'defeat';

/** Which route the goal's clock was read off: it is already satisfied (`met`), its satisfaction is a
 *  bespoke predicate with no threshold to divide (`flat`), the standing economy carries it
 *  (`throughput`), the deck lands copies of a card it reads (`landing`) or stands a producer it reads
 *  (`building`), or nothing the run holds reaches it at all (`none`). */
export type GoalRoute = 'met' | 'flat' | 'throughput' | 'landing' | 'building' | 'none';

/** One goal's clock. `need` and `tau` are in the goal's own measure units; `t` is in rounds. */
export interface GoalClock {
  icon: string;
  /** Units of `measure` still to gain, counting output already in flight (`0` once satisfied). */
  need: number;
  /** Per-round movement of `measure` from the permanent economy alone. */
  tau: number;
  /** Rounds to satisfy this goal, clamped to the horizon. */
  t: number;
  route: GoalRoute;
  /** The card the winning plan runs on; absent unless `route` names one. */
  cardId?: string;
}

/** One state's value, split into the terms that composed it. `total` is accumulated in the same
 *  sequence as the fields, never re-summed from them, so it is bit-identical to what a policy ranks by. */
export interface RaceBreakdown {
  /** One clock per goal, in the objective card's own order. */
  goals: GoalClock[];
  /** Index into `goals` of the binding one, or `-1` with no goals. */
  bottleneck: number;
  tWin: number;
  tLoss: number;
  lossCause: LossCause;
  /** The threat whose deadline bound `T̂loss`; absent unless `lossCause` is `'deadline'`. */
  lossCardId?: string;
  /** `T̂loss − T̂win` — the race margin, the value proper. */
  margin: number;
  /** The near-death steepening, ≤ 0. */
  nearDeath: number;
  /** The banked-wealth tie-break, ≥ 0. */
  wealth: number;
  /** `RACE.victory` or 0. */
  victory: number;
  total: number;
}

/** How this scorer learns the clock it is racing against. */
export interface RaceOptions {
  /** The drive loop's round cutoff (`SimOptions.maxRounds`), which is also the deepest a search may
   *  look. Every estimate here clamps to what remains of it: an unbounded horizon would make
   *  `T̂loss − T̂win` an `∞ − ∞` NaN on any state with no drain and no throughput, and a NaN comparator
   *  leaves a beam's sort order undefined. */
  maxRounds?: number;
  /** The run's plans (`deriveRace`, at the run root). Without it a goal the standing economy doesn't
   *  already carry reads as unreachable — correct, and flat, which is the whole reason the plans exist. */
  model?: RaceModel;
}

/**
 * How this run's deck can reach each goal that its standing economy will not. Derived **once at the run
 * root**, because every figure in it is a probe over the catalogue rather than a read of the moment —
 * and because an evaluation must stay at one clone (`permanentProjection`) for the search to afford any
 * depth at all.
 *
 * The plans are what make a lumpy goal legible. A mission counting mined veins, or one asking for
 * citizens no card *produces* per round, has a τ of exactly zero however well the run is going: nothing
 * in the permanent economy moves its measure, so the clock would sit at the horizon and the value would
 * be flat over every line that approaches the win. A plan restates the same goal as two clocks the run
 * really runs: a price in worker-rounds the workforce pays off at a rate, and a number of copies the deck
 * deals at its own.
 */
export interface RaceModel {
  /** Worker-rounds per unit of each pool (`replacementCost`): the rate a plan's price converts through. */
  unitCost: Partial<Record<keyof Resources, number>>;
  /** One per goal, in the objective card's own order. */
  plans: GoalPlan[];
}

/** The two shapes a deck can move a goal in. Both may be absent: a goal no card in the run touches has
 *  no plan, which is the model reporting that rather than guessing at one. */
export interface GoalPlan {
  landing?: LandingPlan;
  building?: BuildingPlan;
}

/** Landing copies of a card the goal reads — by standing in a zone it counts, by what the play grants, or
 *  by what a work box's once-per-play `produces` delivers. Repeatable: `need / delta` copies, each at
 *  `price`. */
export interface LandingPlan {
  cardId: string;
  delta: number;
  /** What one play charges, per pool — a structure's slot included. Every component but `territory`
   *  carries a `unitCost`, or there is no plan; land is netted against the free tableau instead. */
  price: Partial<Record<keyof Resources, number>>;
  /** What one play charges beyond its pools, in **worker-rounds**: the citizen a work box stands a turn
   *  to run. It is not in `price` because `unitCost` converts a pool *into* this unit and has nothing to
   *  say about one already in it — Conquest's real cost is 2⚔️ and a citizen's round. */
  workerRounds?: number;
  /** Whether a landed copy returns to the pile it was dealt from. A copy landing by presence is spent by
   *  landing, so a plan needing more than the run holds is unreachable; a work box files back to the
   *  discard, so two copies can deliver six units and the cadence they cycle at is the whole clock. */
  recycles?: boolean;
}

/** Standing a durable producer whose per-round output the goal reads: pay `price` once, then collect
 *  `tau` a round. A work box is deliberately not one: its `produces` fires once per play, which makes
 *  that output a landing's delta rather than a rate. */
export interface BuildingPlan {
  cardId: string;
  tau: number;
  price: Partial<Record<keyof Resources, number>>;
}

/**
 * The run's **permanent** economy one round on: tableau production, trade rent, threat drains, building
 * maintenance, population food, and the disaster of every `event` left unplayed in hand. This is the one
 * clone per evaluation; τ and the pool drains are both read off it.
 *
 * The hand keeps its events and drops everything else. Holding this copy is contingent, but *being held*
 * is not: an unplayed event fires at the boundary and files to the discard, from which the deck deals it
 * back, so a mission whose pressure is a recurring event drains for as long as the run owes the copies.
 * Reading that as a rate is the same pessimism `threatClock` takes — the run pictured doing nothing about
 * it — and it is the only term a death clock has, this being the one projection an evaluation can afford.
 * `applyUpkeep` settles them at the slot the engine does (its own `resolveHandEvents`), which is what
 * reaches an amount a card computes in a `resolve` closure: an escalating drain reading a counter it
 * bumps has no declarative bag to read off. Every other hand card drains nothing and files itself away at
 * the same boundary, so carrying it would buy the walk nothing.
 *
 * The counter advances **after** the boundary, which is what makes "one round on" true of the whole
 * state rather than of the pools alone: a drain keyed to the round is charged at the round it is
 * charged for, while a goal measured in rounds derives its τ of 1 from the same subtraction every other
 * goal uses.
 */
function permanentProjection(G: GameState): GameState {
  const clone = cloneState(G);
  clone.workZone = [];
  clone.hand = clone.hand.filter((c) => CARDS[c.cardId]?.kind === 'event');
  applyUpkeep(clone);
  clone.round = G.round + 1;
  return clone;
}

/**
 * What this turn's boundary will settle that the permanent projection deliberately drops: a staffed work
 * box's one-shot production — a level this turn reaches once, not a rate, which is why the projection
 * empties the work zone and this reads it instead.
 *
 * Read straight off the cards rather than through a second projection, so an evaluation stays one clone.
 * The fold mirrors the resolver exactly (per staffed worker, then the copy's stickers, then the board's
 * standing modifiers), because an amount arrived at differently would price the very play it is meant to
 * judge at a number the board won't pay. A box whose output is all closure reads as nothing in flight —
 * the price of not projecting.
 */
function inFlight(G: GameState): Partial<Resources> {
  const out: Partial<Resources> = {};
  for (const w of G.workZone) {
    const produces = CARDS[w.cardId]?.produces?.resources;
    if (!produces || !isOperating(w)) continue;
    const bag = realizedGain(G, effectiveGain(scaleResources(produces, producingUnits(w)), w));
    for (const [k, v] of Object.entries(bag ?? {}) as [keyof Resources, number][]) out[k] = (out[k] ?? 0) + v;
  }
  return out;
}

/** `G` with this turn's boundary settled — what every *level* read (a goal's `need`, a pool's depth)
 *  measures against, so staffing a box registers the turn it happens rather than the turn after. A
 *  shallow copy: the zones are only read from here. Returns `G` itself when nothing is in flight. */
function bankedState(G: GameState): GameState {
  const pending = inFlight(G);
  if (Object.keys(pending).length === 0) return G;
  return { ...G, resources: addResources({ ...G.resources }, pending) };
}

/**
 * Rounds until this threat's own `defeat` fires with the rest of the run **frozen** — the death clock a
 * pool drain cannot express. A deadline is not a rate: neither `G.round` passing a number nor a streak
 * counter climbing shows up anywhere in `pool / drain`, so without this probe a driven mission reads as
 * having until the drive cutoff whatever its threat actually says.
 *
 * The frozen world is the correct pessimism, and it is also what makes a *resetting* clock legible with
 * nothing authored for it: acting on a clock is the search's job and seeing where the clock stands is
 * this one's, so a leaf that has just done the thing the clock watches probes its own reset window while
 * one that banked instead probes the shrunken one.
 *
 * The tick is `resolveEndTurn` — the whole per-round broadcast a threat receives — rather than the
 * `upkeep` slot alone: a threat maintaining its counter in `on.endTurn` would otherwise probe as a clock
 * that never advances, which is a deadline invisible to precisely the value this feeds.
 */
function threatClock(G: GameState, index: number, cap: number): number {
  const threat = G.threats[index];
  const card = CARDS[threat.cardId];
  if (!card?.defeat) return Infinity;
  // Nothing left to bind: whatever already closed the window is at least as soon as this, and the caller
  // rejects a tie either way — so this is the answer rather than a clone spent on a loop that can't run.
  if (cap <= 0) return Infinity;
  // A threat with no tick slot varies in nothing but the round, and `defeat` is a pure read by contract,
  // so it needs no `cloneState` — which is the cheap path *and* the common one, an absolute deadline
  // having nothing else to do each round.
  const inert = card.upkeep === undefined && card.produces === undefined && card.on?.endTurn === undefined;
  const world = inert ? { ...G, resources: { ...G.resources } } : cloneState(G);
  const self = world.threats[index];
  if (card.defeat(world, self)) return 0;
  // The round advances *after* the boundary, as it does in the engine: the tick ending round `r` runs,
  // then `beginTurn` makes it `r + 1`, and the flush after that is where a defeat is first seen. A clock
  // at or past `cap` is whatever already bound `T̂loss`, so there is nothing to learn past it.
  for (let t = 1; t < cap; t++) {
    if (!inert) resolveEndTurn({ G: world, self });
    world.round = G.round + t;
    if (card.defeat(world, self)) return t;
  }
  return Infinity;
}

/** A smooth maximum — `max` plus a term that decays exponentially as a value falls behind it, shifted so
 *  the exponentials cannot overflow at horizon-scale inputs. Exact `max` for a single value, and bounded
 *  by `max + temperature·ln n`, so folding several goals cannot inflate a rounds figure without limit. */
function softMax(values: number[], temperature: number): number {
  const max = Math.max(...values);
  let sum = 0;
  for (const v of values) sum += Math.exp((v - max) / temperature);
  return max + temperature * Math.log(sum);
}

/** The goals the seeded objective declares — `deriveRace` and `raceBreakdown` index their arrays off the
 *  same list, so a plan and the clock it feeds always name the same goal. */
function objectiveGoals(G: GameState): readonly ObjectiveGoal[] {
  return (G.objective ? CARDS[G.objective.cardId]?.goals : undefined) ?? [];
}

/**
 * What paying `price` `copies` times still costs in **worker-rounds** once the bank has been spent on it,
 * and how much of the bank that took. Netting is exact rather than discounted: a bank is worth the rounds
 * of production it stands in for, no more and no less.
 *
 * Exactness has a consequence every caller carries: the remainder `copies·price − bank` is *unchanged* by
 * paying for one of those copies, so this term is flat over the very plays it prices. A clock built on it
 * alone would have a gradient for earning and none for spending, which is why a landing route also carries
 * a term that isn't (`deliveryClock`).
 *
 * Land is the one component not drawn from `resources`: a slot is spent by standing in it, so the bank a
 * structure's price draws on is the **free** tableau rather than the territory pool.
 *
 * `perCopyWorkerRounds` joins the sum instead of being converted or netted: it is already in the target
 * currency, and no bank holds labour.
 */
function outstanding(
  price: Partial<Record<keyof Resources, number>>,
  copies: number,
  banked: GameState,
  unitCost: RaceModel['unitCost'],
  perCopyWorkerRounds = 0,
): { workerRounds: number; netted: Partial<Record<keyof Resources, number>> } {
  let workerRounds = perCopyWorkerRounds * copies;
  const netted: Partial<Record<keyof Resources, number>> = {};
  for (const [k, amt] of Object.entries(price) as [keyof Resources, number][]) {
    const total = amt * copies;
    const bank = k === 'territory' ? freeTerritory(banked) : banked.resources[k];
    const paid = Math.min(Math.max(0, bank), total);
    if (paid > 0) netted[k] = paid;
    // A pool with no rate makes the plan unreachable, never free. `deriveRace` emits no such plan except
    // in land, which it leaves to be netted here — a full board with nothing minting territory really is
    // a structure plan the run cannot carry out.
    if (total > paid) workerRounds += (total - paid) * (unitCost[k] ?? Infinity);
  }
  return { workerRounds, netted };
}

/**
 * When a plan lands, from the two clocks that must both run out: earning its price and drawing its copies
 * overlap, so it is the later of the two rather than their sum.
 *
 * Softened for the same reason the goal fold is, and against the same temperature: a hard `max` has zero
 * gradient on whichever clock isn't binding, and here the masked one is routinely the *payment* — the
 * half that carries every earning and spending decision the run makes. A beam that can see only the
 * binding clock stops building the economy the other one is waiting on. The softening costs at most
 * `temperature·ln 2` rounds where the two meet and decays to exact `max` as they part.
 *
 * An infinite clock is taken hard: `exp(∞ − ∞)` is a NaN, and a NaN leaves a beam's sort order undefined.
 */
export function landingClock(payment: number, delivery: number): number {
  if (!Number.isFinite(payment) || !Number.isFinite(delivery)) return Math.max(payment, delivery);
  return softMax([payment, delivery], RACE.goalSoftening);
}

/**
 * Rounds until the deck has dealt `copies` more plays of `cardId` into a hand. A plan is not only *paid
 * for* at the workforce's rate, it is *delivered* at the deck's: a run banking the whole price of five
 * copies while four of them sit unshuffled is not one play from the win.
 *
 * The supply is every copy the run still holds — deck, discard and hand alike, since the hand recycles at
 * each boundary — over those same three zones' size, so `k·h/D` is what a round's draw surfaces. A copy in
 * hand is therefore credited when it *lands*, not while it is held: that is what makes playing one a step
 * toward the win rather than a shuffle of the same copies between zones, and it is the gradient the
 * payment term structurally cannot supply.
 *
 * A copy spent by landing is one the run no longer holds, so a plan asking for more than it holds cannot
 * be dealt at all. A copy that `recycles` is dealt again, and then the cadence is the whole of the clock:
 * six units off two work boxes is the rounds it takes those two to come round four more times.
 */
function deliveryClock(G: GameState, cardId: string, copies: number, recycles = false): number {
  if (copies <= 0) return 0;
  let held = 0;
  let pool = 0;
  for (const zone of [G.deck, G.discard, G.hand]) {
    pool += zone.length;
    for (const c of zone) if (c.cardId === cardId) held++;
  }
  if (!recycles && copies > held) return Infinity;
  const perRound = (held * effectiveHandSize(G)) / pool;
  return perRound > 0 ? copies / perRound : Infinity;
}

/**
 * One goal's rounds-to-completion, over every route the run has to it. `need` reads the **banked** state
 * and τ the **permanent** one, which is what counts each contribution exactly once: a tableau producer's
 * output is throughput (τ) and a staffed work box's is a level already reached (`need`).
 *
 * Read off raw `measure`/`target` rather than `goalProgress`, which caps at the target and returns 1
 * once met — either would erase the very quantity `need` is. A goal carrying a bespoke `met` is flat by
 * construction: its satisfaction isn't a threshold, so there is no `need` to divide.
 *
 * The routes are all costed and the **soonest** taken, with no test of whether the standing economy
 * "needs" a plan: `min` is the honest fold over alternatives, and a gate deciding which route to price
 * is a branch that can fire the wrong way. A plan's price is paid at the **workforce**'s rate — the
 * population, not the workers currently in boxes, because `unitCost` prices a pool at the output of a
 * worker standing in the best box for it, and a denominator counting only staffed workers would then
 * disagree with its own numerator about the same person.
 */
function goalClock(
  goal: ObjectiveGoal,
  G: GameState,
  banked: GameState,
  perm: GameState,
  horizon: number,
  plan: GoalPlan | undefined,
  unitCost: RaceModel['unitCost'],
): { clock: GoalClock; netted: Partial<Record<keyof Resources, number>> } {
  const need = Math.max(0, goal.target - goal.measure(banked));
  const tau = goal.measure(perm) - goal.measure(G);
  const bare = { icon: goal.icon, need, tau };
  if (goalMet(goal, banked)) return { clock: { ...bare, t: 0, route: 'met' }, netted: {} };
  if (goal.met) return { clock: { ...bare, t: horizon, route: 'flat' }, netted: {} };

  let t = tau > 0 ? need / tau : Infinity;
  let route: GoalRoute = 'throughput';
  let cardId: string | undefined;
  let netted: Partial<Record<keyof Resources, number>> = {};
  const workforce = Math.max(0, banked.resources.population);
  const take = (candidate: number, r: GoalRoute, id: string, n: Partial<Record<keyof Resources, number>>) => {
    if (!(candidate < t)) return;
    t = candidate;
    route = r;
    cardId = id;
    netted = n;
  };
  if (workforce > 0 && plan?.landing) {
    const { landing } = plan;
    const copies = need / landing.delta;
    const paid = outstanding(landing.price, copies, banked, unitCost, landing.workerRounds);
    const lands = landingClock(
      paid.workerRounds / workforce,
      deliveryClock(banked, landing.cardId, copies, landing.recycles),
    );
    take(lands, 'landing', landing.cardId, paid.netted);
  }
  if (workforce > 0 && plan?.building) {
    const { building } = plan;
    const paid = outstanding(building.price, 1, banked, unitCost);
    const stands = landingClock(paid.workerRounds / workforce, deliveryClock(banked, building.cardId, 1));
    // Collecting from the producer *is* sequential with standing it, unlike the two halves of standing it.
    take(stands + need / building.tau, 'building', building.cardId, paid.netted);
  }

  return {
    clock: {
      ...bare,
      t: Math.min(t, horizon),
      route: Number.isFinite(t) ? route : 'none',
      ...(cardId !== undefined ? { cardId } : {}),
    },
    netted,
  };
}

/**
 * Derive the run's plans — once, at the root. Every card the run holds is probed against every goal for
 * the three ways it can move a measure, and the best of each kind is kept.
 *
 * "Best" is not the same question for the two plans. A landing is repeatable, so the one that matters is
 * the **cheapest per unit of measure**; a producer is bought once and then collected forever, so the one
 * that matters is the **fastest**, exactly as the model it replaces chose. Ties resolve to first in
 * catalogue order, so the same run derives the same plan every time.
 *
 * A price with any *pool* component `replacementCost` could not reach yields **no plan** at all. Worker-
 * rounds are the currency here, and a pool nothing in the run can obtain has no figure in it — carrying
 * the raw unit count in beside real prices would produce a number in no currency at all. Land is the
 * exception, being netted against the tableau before it is ever converted.
 */
export function deriveRace(G: GameState): RaceModel {
  const ids = runCardIds(G);
  const unitCost = replacementCost(G, ids);
  const probe = cloneState(G);
  const cards = Object.values(CARDS).filter((c) => ids.has(c.id));
  const plans = objectiveGoals(G).map((goal) => {
    const plan: GoalPlan = {};
    let cheapest = Infinity;
    let fastest = 0;
    for (const card of cards) {
      const price = cardPrice(G, card);
      if (Object.keys(price).some((k) => unitCost[k as keyof Resources] === undefined)) continue;
      const workerRounds = Object.entries(price).reduce(
        (n, [k, amt]) => n + amt * unitCost[k as keyof Resources]!,
        0,
      );
      // Room is part of what a structure charges. It is folded in past the ranking above because land is
      // held rather than bought at a rate: a plan owes it only for the copies the tableau has no slot for.
      const planPrice = isStructure(card) ? { ...price, territory: (price.territory ?? 0) + 1 } : price;
      // A work box is a landing in this model's own vocabulary — pay a price, take a delta, repeat — and
      // for a goal no standing card moves it is the only route there is. Its `produces` fires once per
      // play, so it reads at one staffed worker as a level; the citizen who spends the turn running it is
      // the rest of what it charges, and it recycles into the discard rather than being spent by landing.
      const work = card.kind === 'work';
      const staffing = work ? 1 : 0;
      const delta = Math.max(
        presenceDelta(probe, card, goal.measure),
        grantDelta(probe, card, goal.measure),
        work ? outputDelta(probe, card, goal.measure) : 0,
      );
      if (delta > 0 && (workerRounds + staffing) / delta < cheapest) {
        cheapest = (workerRounds + staffing) / delta;
        plan.landing = {
          cardId: card.id,
          delta,
          price: planPrice,
          ...(work ? { workerRounds: staffing, recycles: true } : {}),
        };
      }
      // Only a durable producer's `produces` is a rate — a work box's is the landing delta above.
      if (!isDurableProducer(card)) continue;
      const tau = outputDelta(probe, card, goal.measure);
      if (tau > fastest) {
        fastest = tau;
        plan.building = { cardId: card.id, tau, price: planPrice };
      }
    }
    return plan;
  });
  return { unitCost, plans };
}

/** Value one state as the race margin, split into the terms that composed it. */
export function raceBreakdown(G: GameState, opts: RaceOptions = {}): RaceBreakdown {
  // The drive loop cuts a run at `round > maxRounds`, so this many end-of-round boundaries remain,
  // counting the one this state can still reach. `Infinity` is a legal cutoff there (it disables the
  // stall check) and is caught here rather than at the call sites, since it is this module's
  // `∞ − ∞` that would go NaN.
  const cutoff = opts.maxRounds;
  const bound = cutoff !== undefined && Number.isFinite(cutoff) ? cutoff : DEFAULT_MAX_ROUNDS;
  const horizon = Math.max(0, bound - G.round + 1);
  const banked = bankedState(G);
  const perm = permanentProjection(G);

  // T̂win — the bottleneck goal, softened so the others still pull. With no objective seeded there is
  // no clock to run down, which reads as the horizon: unwinnable, and flat.
  const unitCost = opts.model?.unitCost ?? {};
  const clocked = objectiveGoals(G).map((g, i) =>
    goalClock(g, G, banked, perm, horizon, opts.model?.plans[i], unitCost),
  );
  const goals = clocked.map((c) => c.clock);
  // The deepest a single goal's plan spent of each pool. `max` rather than a sum: each goal's plan is
  // priced as if it had the whole bank, since the run may spend it on whichever it likes.
  const spent: Partial<Record<keyof Resources, number>> = {};
  for (const { netted } of clocked) {
    for (const [k, v] of Object.entries(netted) as [keyof Resources, number][]) {
      spent[k] = Math.max(spent[k] ?? 0, v);
    }
  }
  let bottleneck = -1;
  for (let i = 0; i < goals.length; i++) if (bottleneck < 0 || goals[i].t > goals[bottleneck].t) bottleneck = i;
  const tWin = goals.length > 0 ? softMax(goals.map((c) => c.t), RACE.goalSoftening) : horizon;

  // T̂loss — the soonest clock that ends the run: a core pool emptying under the permanent drain, a
  // threat's own deadline running out, or the drive cutoff.
  let tLoss = horizon;
  let lossCause: LossCause = 'horizon';
  let lossCardId: string | undefined;
  if (G.pendingDefeat) {
    tLoss = 0;
    lossCause = 'defeat';
  } else {
    for (const k of CORE_KEYS) {
      const level = banked.resources[k];
      const drain = G.resources[k] - perm.resources[k];
      // A pool this turn's boundary already carries below zero has collapsed whatever its rate — which
      // is the only thing that makes a *one-shot* drain (an unplayed event's disaster) visible here.
      const t = level < 0 ? 0 : drain > 0 ? level / drain : Infinity;
      if (t < tLoss) {
        tLoss = t;
        lossCause = k;
      }
    }
    // Each probe is capped at what already binds, which narrows as they land: a clock longer than the
    // shortest one found so far changes nothing, and the search is charged per round it looks at.
    for (let i = 0; i < G.threats.length; i++) {
      const t = threatClock(G, i, tLoss);
      if (t < tLoss) {
        tLoss = t;
        lossCause = 'deadline';
        lossCardId = G.threats[i].cardId;
      }
    }
  }

  const margin = tLoss - tWin;
  let total = margin;

  // Both estimates are projections, and the closer death is the less a losing margin can be trusted to
  // be recoverable — so steepen the same deficit as `T̂loss` shrinks. The `1 +` is the unit round, not a
  // second knob: it is what keeps a zero-round `T̂loss` finite.
  const nearDeath = -RACE.nearDeathSteepness * Math.max(0, tWin - tLoss) / (1 + tLoss);
  total += nearDeath;

  // Among states the race cannot tell apart, prefer the deeper bank — the wealth that buys the next
  // play. Linear to its cap so it keeps discriminating over the range a bank actually spans.
  //
  // Only the bank *past* what a goal's plan already spent counts: what a plan has earmarked is already
  // priced into `T̂win`, so counting it a second time here would break a tie toward the bank — the model
  // preferring the price to the thing the price buys.
  const core = CORE_KEYS.reduce((n, k) => n + Math.max(0, banked.resources[k] - (spent[k] ?? 0)), 0);
  const wealth = (Math.min(core, RACE.wealthCap) / RACE.wealthCap) * RACE.wealthRounds;
  total += wealth;

  const victory = G.pendingVictory ? RACE.victory : 0;
  total += victory;

  return {
    goals,
    bottleneck,
    tWin,
    tLoss,
    lossCause,
    ...(lossCardId !== undefined ? { lossCardId } : {}),
    margin,
    nearDeath,
    wealth,
    victory,
    total,
  };
}

/** The scalar a policy ranks by. */
export function raceScore(G: GameState, opts?: RaceOptions): number {
  return raceBreakdown(G, opts).total;
}
