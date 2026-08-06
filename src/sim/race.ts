import { CARDS, type ObjectiveGoal } from '../content/cards';
import {
  CORE_KEYS,
  STRATEGIC_KEYS,
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
  type CardInstance,
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
 *
 * Exported so a retune moves the report with the model: a rounds figure is unreadable without the
 * temperature that folded it.
 */
export const RACE = {
  /** Score points — a met objective ends the run, so it dwarfs any margin the horizon can express. */
  victory: 1_000_000,
  /** Dimensionless: the log-sum-exp temperature of every softened fold, as a **fraction of the clock
   *  leading it**. Tuned rather than derived because it prices a preference, not a quantity: how much the
   *  clock that *isn't* binding still pulls. A pure `max` has zero gradient on it, which lets a beam abandon
   *  a side goal — or a plan's whole earning half — for free. A fraction rather than a number of rounds
   *  because what a gap means is relative: three rounds behind a four-round bottleneck is a different state
   *  from three behind forty, and an absolute tolerance reads them the same. */
  goalSoftening: 0.4,
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

const ALL_POOLS: (keyof Resources)[] = [...CORE_KEYS, ...STRATEGIC_KEYS];

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

/** The two shapes a deck can move a goal in, each holding **every** route the run really has of that kind
 *  rather than the one that ranked best on price. A route's price and its delivery are different questions,
 *  and only the second knows whether the deck can deal the copies at all — so the choice belongs at the leaf
 *  that has both, where `goalClock` takes the soonest. The root keeps what is deliverable there, which in
 *  practice is a handful; both lists may be empty, which is the model reporting no route rather than
 *  guessing at one. */
export interface GoalPlan {
  /** Cheapest per unit first — the order ties resolve in, since `goalClock` takes a strict improvement. */
  landings: LandingPlan[];
  /** Fastest first, for the same reason. */
  buildings: BuildingPlan[];
  /** The causes the root scan dropped routes for, deduplicated. Read only when both lists are empty: a goal
   *  no card touches and one whose every route is undeliverable are otherwise the same silence. */
  dropped?: string[];
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
 * Everything the two derivations compute on their way to a plan and a value — the survivors plus every
 * intermediate that doesn't reach one. Most of what either says is *absence*: a goal with no plan and a
 * goal whose only candidate was priced in a pool nothing mints look identical in a `RaceModel`, and a
 * clock reports the route it took but not the three it ranked out. So "why is this goal unreachable" is
 * unanswerable from the finished objects and answerable from these.
 *
 * Produced by the *same* passes that build them, never a second derivation. The two differ in how, and
 * for one reason: `deriveRace` runs once at the run root and can afford to record unconditionally, while
 * `raceBreakdown` is the beam's per-leaf leaf — so its intermediates are written into an optional sink the
 * scoring path never allocates, rather than returned.
 */

/** What became of one card's route of one kind at the root scan. */
export interface CandidateRoute {
  /** Whether the goal's plan carries this route. */
  kept: boolean;
  /** Rounds the route reads at the run root — the deliverability the keep was decided on. */
  t: number;
  /** The two halves of `t`, absent where the scan refused the route before costing it. */
  payment?: number;
  delivery?: number;
  /** Why the scan dropped it; `''` where it was kept. */
  reject: string;
}

/** One card weighed for one goal's plans, and what became of it. Only a card that moves the measure some
 *  way is recorded: the rest of the scan is a count. */
export interface PlanCandidate {
  cardId: string;
  /** Units of the goal's measure one play lands — the landing route's denominator. */
  delta: number;
  /** Units of the measure one round of it standing yields — `0` unless durable. */
  tau: number;
  price: Partial<Record<keyof Resources, number>>;
  /** `price` converted through `unitCost`, plus the citizen a work box stands. `Infinity` where a
   *  component has no rate. */
  workerRounds: number;
  /** `(workerRounds + staffing) / delta` — what orders the landing list, `Infinity` at zero delta. */
  perUnit: number;
  /** Price components `replacementCost` reached no figure for. Non-empty means the card was refused before
   *  it could be costed at all — the plan it would have made is the one the model is silent about. */
  unpriceable: (keyof Resources)[];
  /** The route of each kind this card offers; absent where it moves the measure no such way. */
  landing?: CandidateRoute;
  building?: CandidateRoute;
}

/** One goal's derivation: the scan that produced its plans. */
export interface GoalPlanExplain {
  icon: string;
  /** Cards in the run — the scan universe. */
  scanned: number;
  /** Those that moved the measure in no way at all, so ranked for nothing. */
  inert: number;
  /** The rest, in the order scanned (catalogue order, which is also the tie-break). */
  candidates: PlanCandidate[];
  plan: GoalPlan;
}

export interface RaceModelExplain {
  model: RaceModel;
  /** The population every `CandidateRoute.t` below was divided by. At zero they all read `Infinity` while
   *  the routes are kept anyway, so the figure has to travel with them or the scan reads as keeping the
   *  unreachable. */
  workforce: number;
  /** Pools with no `unitCost` — a price naming one yields no plan. */
  unpriceable: (keyof Resources)[];
  goals: GoalPlanExplain[];
  /** `runCardIds`, sorted. */
  runCards: string[];
}

/** One plan route's two clocks, and the fold across them. Shared by both routes: a building plan runs the
 *  same payment/delivery pair and then adds the rounds it spends collecting. */
export interface PlanClockExplain {
  cardId: string;
  /** Copies the plan owes — `need / delta` for a landing, `1` for a building. */
  copies: number;
  /** What the copies still cost after the bank was spent on them. */
  workerRounds: number;
  /** How much of each pool that netting took. */
  netted: Partial<Record<keyof Resources, number>>;
  /** `workerRounds / workforce` — the earning clock. */
  payment: number;
  /** `deliveryClock` — the drawing clock, and the circulation census behind it: `held × hand / pool`. */
  delivery: number;
  held: number;
  pool: number;
  hand: number;
  perRound: number;
  recycles: boolean;
  /** The softMax weights of `[payment, delivery]`, in that order (see `absorbed`). Empty where an infinite
   *  clock made the fold a hard `max`. */
  weights: number[];
  /** `landingClock(payment, delivery)`. */
  lands: number;
  /** Rounds collecting `need` at the producer's rate once it stands; `0` for a landing. */
  collect: number;
  /** `lands + collect` — the clock this route offered the `min`. */
  t: number;
}

/** One goal's clock with the routes it ranked and the clamp it met. */
export interface GoalClockExplain {
  clock: GoalClock;
  /** `t` before the horizon clamp — the only place a goal past the horizon is distinguishable from one
   *  sitting exactly on it. */
  raw: number;
  clamped: boolean;
  /** The population a plan's price is paid at. Both routes are gated on it being positive, so a root with
   *  no citizens reads `'none'` with a perfectly good plan unused. */
  workforce: number;
  /** `need / tau` off the standing economy — the route taken unless a plan beat it. */
  throughput: number;
  /** The plans this goal was offered, which is not the same as the ones it costed: a workforce of zero
   *  gates both branches off, and a good plan then reads exactly like none at all. */
  plan?: GoalPlan;
  /** Every route costed here, in the plan's own order — the `min` this clock is. */
  landings: PlanClockExplain[];
  buildings: PlanClockExplain[];
}

/** One core pool's death clock. */
export interface PoolClockExplain {
  key: keyof CoreResources;
  level: number;
  drain: number;
  t: number;
}

/** The recurring `event` pressure folded into those drains, with the circulation it was folded over: a
 *  drain of two thirds of a coin is a number to take on faith without the census that scaled it. */
export interface EventDrainExplain {
  /** `event` copies in circulation. */
  copies: number;
  /** Cards in circulation, over all four zones. */
  pool: number;
  /** The hand the run refills to. */
  hand: number;
  /** `min(1, hand / pool)` — the share of boundaries a circulating copy is in hand for. */
  share: number;
  /** What one boundary with every copy in hand takes, per pool — the amount `share` scales. */
  full: Partial<Record<keyof Resources, number>>;
}

/** One threat's frozen-world deadline probe, and the bound it ran under — a probe capped at `0` learned
 *  nothing, which is not the same as a threat with no deadline. */
export interface ThreatClockExplain {
  cardId: string;
  cap: number;
  t: number;
}

/** One state's value with every intermediate the `RaceBreakdown` drops. */
export interface RaceValueExplain {
  breakdown: RaceBreakdown;
  /** Rounds of drive cutoff left, which every estimate clamps to. */
  horizon: number;
  goals: GoalClockExplain[];
  /** The goal fold's softMax weights, parallel to `goals` (see `absorbed`). */
  foldWeights: number[];
  pools: PoolClockExplain[];
  /** Absent where the run circulates no `event` at all. */
  events?: EventDrainExplain;
  threats: ThreatClockExplain[];
}

/** Where the sink collects — the explain less the one field the pass returns rather than records. */
type RaceSink = Omit<RaceValueExplain, 'breakdown'>;

/**
 * Whether a softMax weight was **absorbed**: the fold came out bit-identical to a hard `max`, so the state
 * has no gradient on that clock whatever it does to it.
 *
 * The threshold is float64's own, not a tolerance. The winning clock weighs exactly `1`, so a weight below
 * the ULP of `1` leaves the sum unchanged and `temperature·ln(sum)` is exactly `0` — which takes a gap of
 * about `36.7 · goalSoftening` times the leading clock. The temperature being a fraction of that leader, a
 * gap cannot exceed it: above a softening of ~0.027 the predicate is unreachable, and reading a weight is
 * reading how much of a gradient the fold carries rather than whether it carries one.
 */
export function absorbed(w: number): boolean {
  return 1 + w === 1;
}

/** Which half of a route's clock ran to infinity, in one vocabulary for the root scan's rejections and the
 *  leaf's dead routes alike. `payable` is passed rather than read because the two ask it of different
 *  figures: the root of the price itself, the leaf of the price divided by a workforce it has already
 *  reported separately. `''` where the route is a live one. */
function unreachableCause(payable: boolean, delivery: number, copies: number, held: number, recycles: boolean): string {
  if (!payable) return 'unpriceable pool';
  if (!Number.isFinite(delivery)) return !recycles && copies > held ? 'copies short' : 'no copies circulate';
  return '';
}

/** Why a goal's route is `'none'`, off the recorded facts alone. Derivation knowledge rather than
 *  presentation: "no plan" and "a plan nothing can pay for" are the same word in a `GoalClock` and
 *  different answers to a balance question. `''` where the route is a real one. */
export function routeCause(g: GoalClockExplain): string {
  if (g.clock.route !== 'none') return '';
  const plan = g.plan;
  if (!plan || (plan.landings.length === 0 && plan.buildings.length === 0)) {
    return plan?.dropped?.length ? plan.dropped.join(' + ') : 'no plan';
  }
  if (g.workforce <= 0) return 'no workforce';
  const causes = new Set<string>();
  for (const p of [...g.landings, ...g.buildings]) {
    if (Number.isFinite(p.t)) continue;
    const cause = unreachableCause(Number.isFinite(p.payment), p.delivery, p.copies, p.held, p.recycles);
    if (cause) causes.add(cause);
  }
  return [...causes].join(' + ') || 'unreachable';
}

/** The four piles future draws keep dealing from — the run's circulation. A delivery clock and a recurring
 *  event's rate are both shares of it, and have to be shares of the same one. */
function circulationZones(G: GameState): CardInstance[][] {
  return [G.deck, G.discard, G.hand, G.workZone];
}

/** How much of the run's circulation is `event`, and how much of a boundary a copy of it spends in hand. */
function eventCensus(G: GameState): Omit<EventDrainExplain, 'full'> {
  let copies = 0;
  let pool = 0;
  for (const zone of circulationZones(G)) {
    pool += zone.length;
    for (const c of zone) if (CARDS[c.cardId]?.kind === 'event') copies++;
  }
  const hand = effectiveHandSize(G);
  return { copies, pool, hand, share: pool > 0 ? Math.min(1, hand / pool) : 0 };
}

/** One end-of-turn boundary settled on a clone, its hand replaced by `withEvents`' worth of one: nothing,
 *  or every `event` copy the run circulates. The work zone is dropped either way — its output is a level
 *  this turn reaches rather than a rate, which `inFlight` reads instead. */
function boundary(G: GameState, withEvents: boolean): GameState {
  const clone = cloneState(G);
  const events = withEvents
    ? circulationZones(clone).flatMap((zone) => zone.filter((c) => CARDS[c.cardId]?.kind === 'event'))
    : [];
  clone.workZone = [];
  clone.hand = events;
  applyUpkeep(clone);
  return clone;
}

/**
 * The run's **permanent** economy one round on: tableau production, trade rent, threat drains, building
 * maintenance, population food, and the recurring disaster of every `event` the run still circulates. τ
 * and the pool drains are both read off it.
 *
 * The hand is dropped whole, events included, and the events are charged back at their **circulation
 * rate**. An unplayed event fires at the boundary and files to the discard, from which the deck deals it
 * back, so what a mission's recurring pressure costs is that disaster once a shuffle cycle — `hand / pool`
 * of a boundary per copy, the same census `deliveryClock` measures a plan's delivery over. Charging it
 * instead by whether a copy happens to sit in hand right now makes a death clock flicker between the whole
 * drain and none at all as the deck turns over, so on the majority of turns the pool it empties reads as
 * unreachable. Which pile a copy rests in is no more a distance travelled here than it is there; a copy in
 * `removed` is out of circulation and charges nothing, which is what playing an event to defuse it buys.
 *
 * The amount is measured, never read: the second boundary settles every circulating copy through the same
 * `applyUpkeep` at the slot the engine does (its own `resolveHandEvents`), so an escalating drain computing
 * itself off a counter it bumps is charged what it really takes. That is a second clone, paid only by a run
 * that circulates an event at all.
 *
 * The counter advances **after** the boundary, which is what makes "one round on" true of the whole
 * state rather than of the pools alone: a drain keyed to the round is charged at the round it is
 * charged for, while a goal measured in rounds derives its τ of 1 from the same subtraction every other
 * goal uses.
 */
function permanentProjection(G: GameState, ex?: RaceSink): GameState {
  const perm = boundary(G, false);
  const census = eventCensus(G);
  if (census.copies > 0) {
    const charged = boundary(G, true);
    const full: Partial<Record<keyof Resources, number>> = {};
    for (const k of ALL_POOLS) {
      const taken = perm.resources[k] - charged.resources[k];
      if (taken !== 0) full[k] = taken;
      perm.resources[k] -= census.share * taken;
    }
    if (ex) ex.events = { ...census, full };
  }
  perm.round = G.round + 1;
  return perm;
}

/**
 * What this turn's boundary will settle that the permanent projection deliberately drops: a staffed work
 * box's one-shot production — a level this turn reaches once, not a rate, which is why the projection
 * empties the work zone and this reads it instead.
 *
 * Read straight off the cards rather than through a projection of its own, which costs an evaluation nothing.
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

/**
 * A smooth maximum — `max` plus a term that decays exponentially as a value falls behind it, shifted so
 * the exponentials cannot overflow at horizon-scale inputs. Exact `max` for a single value, and bounded by
 * `max · (1 + softening·ln n)`, so folding several clocks cannot inflate a rounds figure without limit.
 *
 * The temperature is `softening · max` rather than a fixed number of rounds, which makes a weight a function
 * of the **relative** gap: scaling every clock in a fold leaves all of them unchanged, and the tolerance
 * narrows with the bottleneck as the win comes into reach. A gap can never exceed the leader, so the weakest
 * weight a fold of non-negative clocks can reach is `exp(-1 / softening)` — a floor rather than a vanishing.
 */
function softMax(values: number[], softening: number, weightsOut?: number[]): number {
  const max = Math.max(...values);
  // Every clock met: no gaps, and no temperature to divide them by — `exp(-0/0)` would be a NaN, and a NaN
  // leaves a beam's sort order undefined.
  if (max <= 0) {
    for (let i = 0; i < values.length; i++) weightsOut?.push(1);
    return max;
  }
  const temperature = softening * max;
  let sum = 0;
  for (const v of values) {
    const w = Math.exp((v - max) / temperature);
    weightsOut?.push(w);
    sum += w;
  }
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
 * `goalSoftening·ln 2` of the later clock where the two meet, and decays toward exact `max` as they part.
 *
 * An infinite clock is taken hard: `exp(∞ − ∞)` is a NaN, and a NaN leaves a beam's sort order undefined.
 */
export function landingClock(payment: number, delivery: number, weightsOut?: number[]): number {
  if (!Number.isFinite(payment) || !Number.isFinite(delivery)) return Math.max(payment, delivery);
  return softMax([payment, delivery], RACE.goalSoftening, weightsOut);
}

/**
 * Rounds until the deck has dealt `copies` more plays of `cardId` into a hand. A plan is not only *paid
 * for* at the workforce's rate, it is *delivered* at the deck's: a run banking the whole price of five
 * copies while four of them sit unshuffled is not one play from the win.
 *
 * The rate belongs to the run's **circulation** — the multiset of cards future draws will keep dealing —
 * so both counts are taken over deck, discard, hand *and* work zone alike: the boundary recycles the hand
 * and files the work zone back to the discard, so a copy in any of the four is a copy the deck still owns,
 * and `k·h/D` is what a round's draw surfaces. Which of the four a copy sits in this turn is therefore not
 * a distance travelled, and cannot be one: a rate that moved when a card crossed between them would price
 * every play by how many cards it shifted.
 *
 * Circulation changes when a card really enters or leaves it — exiled to `removed`, spent by a landing, or
 * standing on the board for the rest of the run — and the clock moves with it, since the draws that remain
 * really are that much richer in what the plan needs. What shortens a **recycling** plan's clock instead is
 * `copies`: the box's output moved `need`, and the copies still owed fall with it.
 *
 * A copy spent by landing is one the run no longer holds, so a plan asking for more than it holds cannot
 * be dealt at all. A copy that `recycles` is dealt again, and then the cadence is the whole of the clock:
 * six units off two work boxes is the rounds it takes those two to come round four more times.
 */
function deliveryClock(
  G: GameState,
  cardId: string,
  copies: number,
  recycles = false,
  censusOut?: { held: number; pool: number; hand: number; perRound: number },
): number {
  if (copies <= 0) return 0;
  let held = 0;
  let pool = 0;
  for (const zone of circulationZones(G)) {
    pool += zone.length;
    for (const c of zone) if (c.cardId === cardId) held++;
  }
  const hand = effectiveHandSize(G);
  const perRound = (held * hand) / pool;
  if (censusOut) Object.assign(censusOut, { held, pool, hand, perRound });
  if (!recycles && copies > held) return Infinity;
  return perRound > 0 ? copies / perRound : Infinity;
}

/** What the census and the fold weights are collected into when someone is recording; `undefined` on the
 *  beam's own path, where nothing is. */
type RouteSink = { census: { held: number; pool: number; hand: number; perRound: number }; weights: number[] };

function routeSink(): RouteSink {
  return { census: { held: 0, pool: 0, hand: 0, perRound: 0 }, weights: [] };
}

/**
 * One route's clock: the softened fold of earning `copies` of its price and drawing that many copies. Shared
 * by the root scan, which keeps a route on whether both halves are finite, and by the leaf, which takes the
 * soonest of the kept ones — so a route is never kept on one reading and taken on another.
 *
 * A building route is the same pair for a single copy; the rounds it then spends collecting are the caller's,
 * being the one part that really is sequential with standing it.
 */
function routeClock(
  plan: { cardId: string; price: Partial<Record<keyof Resources, number>>; workerRounds?: number; recycles?: boolean },
  copies: number,
  banked: GameState,
  workforce: number,
  unitCost: RaceModel['unitCost'],
  sink?: RouteSink,
): { workerRounds: number; netted: Partial<Record<keyof Resources, number>>; payment: number; delivery: number; t: number } {
  const paid = outstanding(plan.price, copies, banked, unitCost, plan.workerRounds);
  const payment = workforce > 0 ? paid.workerRounds / workforce : Infinity;
  const delivery = deliveryClock(banked, plan.cardId, copies, plan.recycles, sink?.census);
  return { ...paid, payment, delivery, t: landingClock(payment, delivery, sink?.weights) };
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
  ex?: GoalClockExplain[],
): { clock: GoalClock; netted: Partial<Record<keyof Resources, number>> } {
  const need = Math.max(0, goal.target - goal.measure(banked));
  const tau = goal.measure(perm) - goal.measure(G);
  const bare = { icon: goal.icon, need, tau };
  const throughput = tau > 0 ? need / tau : Infinity;
  const workforce = Math.max(0, banked.resources.population);
  // Written by the very calls whose arguments they explain, so a recorded figure is the one the clock ran on
  // rather than a second reading of it — and left unallocated off the explain path, so the beam's leaf
  // spends nothing to be told what it already knows.
  const landings = ex ? ([] as PlanClockExplain[]) : undefined;
  const buildings = ex ? ([] as PlanClockExplain[]) : undefined;
  const seal = (clock: GoalClock, raw: number): GoalClock => {
    ex?.push({
      clock,
      raw,
      clamped: raw > horizon,
      workforce,
      throughput,
      ...(plan ? { plan } : {}),
      landings: landings ?? [],
      buildings: buildings ?? [],
    });
    return clock;
  };
  if (goalMet(goal, banked)) return { clock: seal({ ...bare, t: 0, route: 'met' }, 0), netted: {} };
  if (goal.met) return { clock: seal({ ...bare, t: horizon, route: 'flat' }, horizon), netted: {} };

  let t = throughput;
  let route: GoalRoute = 'throughput';
  let cardId: string | undefined;
  let netted: Partial<Record<keyof Resources, number>> = {};
  const take = (candidate: number, r: GoalRoute, id: string, n: Partial<Record<keyof Resources, number>>) => {
    if (!(candidate < t)) return;
    t = candidate;
    route = r;
    cardId = id;
    netted = n;
  };
  if (workforce > 0 && plan) {
    for (const landing of plan.landings) {
      const sink = landings ? routeSink() : undefined;
      const copies = need / landing.delta;
      const r = routeClock(landing, copies, banked, workforce, unitCost, sink);
      landings?.push({
        cardId: landing.cardId, copies, workerRounds: r.workerRounds, netted: r.netted,
        payment: r.payment, delivery: r.delivery, ...sink!.census, recycles: landing.recycles ?? false,
        weights: sink!.weights, lands: r.t, collect: 0, t: r.t,
      });
      take(r.t, 'landing', landing.cardId, r.netted);
    }
    for (const building of plan.buildings) {
      const sink = buildings ? routeSink() : undefined;
      const r = routeClock(building, 1, banked, workforce, unitCost, sink);
      // Collecting from the producer *is* sequential with standing it, unlike the two halves of standing it.
      const collect = need / building.tau;
      buildings?.push({
        cardId: building.cardId, copies: 1, workerRounds: r.workerRounds, netted: r.netted,
        payment: r.payment, delivery: r.delivery, ...sink!.census, recycles: false,
        weights: sink!.weights, lands: r.t, collect, t: r.t + collect,
      });
      take(r.t + collect, 'building', building.cardId, r.netted);
    }
  }

  return {
    clock: seal(
      {
        ...bare,
        t: Math.min(t, horizon),
        route: Number.isFinite(t) ? route : 'none',
        ...(cardId !== undefined ? { cardId } : {}),
      },
      t,
    ),
    netted,
  };
}

/** One route's verdict at the run root. `t` divides by the workforce the root happens to have, so it is
 *  `Infinity` on a citizenless root; `kept` deliberately does not, being about the route rather than the
 *  moment. */
function probeRoute(
  plan: { cardId: string; price: Partial<Record<keyof Resources, number>>; workerRounds?: number; recycles?: boolean },
  copies: number,
  banked: GameState,
  workforce: number,
  unitCost: RaceModel['unitCost'],
): CandidateRoute {
  const sink = routeSink();
  const r = routeClock(plan, copies, banked, workforce, unitCost, sink);
  const reject = unreachableCause(
    Number.isFinite(r.workerRounds),
    r.delivery,
    copies,
    sink.census.held,
    plan.recycles ?? false,
  );
  return { kept: reject === '', t: r.t, payment: r.payment, delivery: r.delivery, reject };
}

/**
 * Derive the run's plans — once, at the root. Every card the run holds is probed against every goal for
 * the three ways it can move a measure, and every route that is **deliverable here** is kept.
 *
 * Kept, not ranked: what a route costs per unit of measure and whether the deck can deal its copies are
 * independent questions, so an argmin over the first alone will hand a goal a cheap card the run cannot
 * circulate and drop the dearer one it can. The order is still cheapest-per-unit (fastest for a producer),
 * because `goalClock` takes a strict improvement and that is where ties resolve — first in catalogue order
 * within equal rank, so the same run derives the same plans every time.
 *
 * Deliverable is measured on the route's own two halves — a price with a rate to convert through and copies
 * the deck can deal — and not on the clock they fold to, whose divisor is the workforce. A workforce is a
 * fact about the moment and is gated at the leaf; folding it in here would leave a root with no citizens
 * carrying no plans for the rest of the run.
 *
 * A price with any *pool* component `replacementCost` could not reach yields **no route** at all. Worker-
 * rounds are the currency here, and a pool nothing in the run can obtain has no figure in it — carrying
 * the raw unit count in beside real prices would produce a number in no currency at all. Land is the
 * exception, being netted against the tableau before it is ever converted.
 */
export function deriveRace(G: GameState): RaceModel {
  return explainRaceModel(G).model;
}

/** `deriveRace` with every card it weighed, every route it dropped and why. Recorded unconditionally, this
 *  being a once-per-run derivation. */
export function explainRaceModel(G: GameState): RaceModelExplain {
  const ids = runCardIds(G);
  const unitCost = replacementCost(G, ids);
  const probe = cloneState(G);
  const banked = bankedState(G);
  const workforce = Math.max(0, banked.resources.population);
  const cards = Object.values(CARDS).filter((c) => ids.has(c.id));
  const explained: GoalPlanExplain[] = [];
  const plans = objectiveGoals(G).map((goal) => {
    const need = Math.max(0, goal.target - goal.measure(banked));
    const candidates: PlanCandidate[] = [];
    const dropped = new Set<string>();
    // Ranked as they are found and sorted once the scan is over: `Array.sort` is stable, so an equal rank
    // keeps catalogue order and the same run derives the same list in the same order every time.
    const landings: { plan: LandingPlan; rank: number }[] = [];
    const buildings: { plan: BuildingPlan; rank: number }[] = [];
    let inert = 0;
    for (const card of cards) {
      const price = cardPrice(G, card);
      const unpriceable = (Object.keys(price) as (keyof Resources)[]).filter((k) => unitCost[k] === undefined);
      const work = card.kind === 'work';
      const delta = Math.max(
        presenceDelta(probe, card, goal.measure),
        grantDelta(probe, card, goal.measure),
        work ? outputDelta(probe, card, goal.measure) : 0,
      );
      // Only a durable producer's `produces` is a rate — a work box's is the landing delta above.
      const tau = isDurableProducer(card) ? outputDelta(probe, card, goal.measure) : 0;
      if (delta <= 0 && tau <= 0) {
        inert++;
        continue;
      }
      if (unpriceable.length > 0) {
        // The refusal stands; what the report adds is what was refused. The probes are pure over `probe` and
        // this pass runs once, so recording the card the model would not price costs the report alone.
        const dead = (): CandidateRoute => ({ kept: false, t: Infinity, reject: 'unpriceable pool' });
        dropped.add('unpriceable pool');
        candidates.push({
          cardId: card.id, delta, tau, price, workerRounds: Infinity, perUnit: Infinity, unpriceable,
          ...(delta > 0 ? { landing: dead() } : {}),
          ...(tau > 0 ? { building: dead() } : {}),
        });
        continue;
      }
      const workerRounds = Object.entries(price).reduce(
        (n, [k, amt]) => n + amt * unitCost[k as keyof Resources]!,
        0,
      );
      // Room is part of what a structure charges. It is folded in past the conversion above because land is
      // held rather than bought at a rate: a plan owes it only for the copies the tableau has no slot for.
      const planPrice = isStructure(card) ? { ...price, territory: (price.territory ?? 0) + 1 } : price;
      // A work box is a landing in this model's own vocabulary — pay a price, take a delta, repeat — and
      // for a goal no standing card moves it is the only route there is. Its `produces` fires once per
      // play, so it reads at one staffed worker as a level; the citizen who spends the turn running it is
      // the rest of what it charges, and it recycles into the discard rather than being spent by landing.
      const staffing = work ? 1 : 0;
      const perUnit = delta > 0 ? (workerRounds + staffing) / delta : Infinity;
      const candidate: PlanCandidate = {
        cardId: card.id, delta, tau, price: planPrice, workerRounds, perUnit, unpriceable,
      };
      if (delta > 0) {
        const plan: LandingPlan = {
          cardId: card.id,
          delta,
          price: planPrice,
          ...(work ? { workerRounds: staffing, recycles: true } : {}),
        };
        candidate.landing = probeRoute(plan, need / delta, banked, workforce, unitCost);
        if (candidate.landing.kept) landings.push({ plan, rank: perUnit });
        else dropped.add(candidate.landing.reject);
      }
      if (tau > 0) {
        const plan: BuildingPlan = { cardId: card.id, tau, price: planPrice };
        candidate.building = probeRoute(plan, 1, banked, workforce, unitCost);
        if (candidate.building.kept) buildings.push({ plan, rank: -tau });
        else dropped.add(candidate.building.reject);
      }
      candidates.push(candidate);
    }
    landings.sort((a, b) => a.rank - b.rank);
    buildings.sort((a, b) => a.rank - b.rank);
    const plan: GoalPlan = {
      landings: landings.map((x) => x.plan),
      buildings: buildings.map((x) => x.plan),
      ...(dropped.size > 0 ? { dropped: [...dropped].sort() } : {}),
    };
    explained.push({ icon: goal.icon, scanned: cards.length, inert, candidates, plan });
    return plan;
  });
  return {
    model: { unitCost, plans },
    workforce,
    unpriceable: ALL_POOLS.filter((k) => unitCost[k] === undefined),
    goals: explained,
    runCards: [...ids].sort(),
  };
}

/** Value one state as the race margin, split into the terms that composed it. */
export function raceBreakdown(G: GameState, opts: RaceOptions = {}): RaceBreakdown {
  return computeRace(G, opts);
}

/**
 * `raceBreakdown` with the intermediates it drops — every route a goal ranked, the two clocks inside each,
 * the fold weights, and the pool and deadline clocks `T̂loss` took the `min` of.
 *
 * The same pass, and the sink is why: this is the beam's per-leaf value, so the recording is a parameter
 * the scoring path never passes rather than a wider return type it would allocate on every node. Hand it
 * the same `opts` the policy scores under — the plans above all — or the routes read `'none'` and the
 * report is an artifact of its own call.
 */
export function explainRaceValue(G: GameState, opts: RaceOptions = {}): RaceValueExplain {
  const sink: RaceSink = { horizon: 0, goals: [], foldWeights: [], pools: [], threats: [] };
  const breakdown = computeRace(G, opts, sink);
  return { breakdown, ...sink };
}

function computeRace(G: GameState, opts: RaceOptions, ex?: RaceSink): RaceBreakdown {
  // The drive loop cuts a run at `round > maxRounds`, so this many end-of-round boundaries remain,
  // counting the one this state can still reach. `Infinity` is a legal cutoff there (it disables the
  // stall check) and is caught here rather than at the call sites, since it is this module's
  // `∞ − ∞` that would go NaN.
  const cutoff = opts.maxRounds;
  const bound = cutoff !== undefined && Number.isFinite(cutoff) ? cutoff : DEFAULT_MAX_ROUNDS;
  const horizon = Math.max(0, bound - G.round + 1);
  if (ex) ex.horizon = horizon;
  const banked = bankedState(G);
  const perm = permanentProjection(G, ex);

  // T̂win — the bottleneck goal, softened so the others still pull. With no objective seeded there is
  // no clock to run down, which reads as the horizon: unwinnable, and flat.
  const unitCost = opts.model?.unitCost ?? {};
  const clocked = objectiveGoals(G).map((g, i) =>
    goalClock(g, G, banked, perm, horizon, opts.model?.plans[i], unitCost, ex?.goals),
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
  const tWin = goals.length > 0 ? softMax(goals.map((c) => c.t), RACE.goalSoftening, ex?.foldWeights) : horizon;

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
      // A pool this turn's boundary already carries below zero has collapsed whatever its rate.
      const t = level < 0 ? 0 : drain > 0 ? level / drain : Infinity;
      ex?.pools.push({ key: k, level, drain, t });
      if (t < tLoss) {
        tLoss = t;
        lossCause = k;
      }
    }
    // Each probe is capped at what already binds, which narrows as they land: a clock longer than the
    // shortest one found so far changes nothing, and the search is charged per round it looks at.
    for (let i = 0; i < G.threats.length; i++) {
      const t = threatClock(G, i, tLoss);
      ex?.threats.push({ cardId: G.threats[i].cardId, cap: tLoss, t });
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
