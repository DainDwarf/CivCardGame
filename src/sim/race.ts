import { CARDS, type ObjectiveGoal } from '../content/cards';
import {
  CORE_KEYS,
  STRATEGIC_KEYS,
  addResources,
  applyUpkeep,
  assignedWorkers,
  cloneState,
  currentCost,
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
import { isDurableProducer, isStructure, type CardDef } from '../content/cards';
import {
  cardPrice, grantDelta, outputDelta, presenceDelta, replacementCost, runCardIds, selfExiles,
} from './probes';
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
  /** Rounds of runway worth having: `T̂loss` enters the margin capped at this, so slack a run can never
   *  spend stops outranking a state racing for the win. Tuned because it prices how far ahead a run
   *  bothers to look, which is nowhere in `G`.
   *
   *  Absolute where `goalSoftening` is deliberately relative, and the two answer different questions: a
   *  temperature scales the *gap between two clocks*, which means nothing except against the race that
   *  folds it, while this names how much runway is worth having at all — a fact about the horizon rather
   *  than about either clock. A scale relative to `T̂win` is not merely unneeded here but inverted: the
   *  capped region's value would be `(c−1)·T̂win`, which *rises* with the win clock, paying the model to
   *  lengthen its own race. Below the cap nothing here is expressible at all, which is what leaves every
   *  near-death reading exactly where it was. */
  slackCap: 25,
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
 *  (`throughput`), the deck lands copies of a card it reads (`landing`) or several cards no one of which
 *  reaches the target alone (`cover`) or stands a producer it reads (`building`), or nothing the run holds
 *  reaches it at all (`none`). */
export type GoalRoute = 'met' | 'flat' | 'throughput' | 'landing' | 'cover' | 'building' | 'none';

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
  /** `T̂loss` as the margin counts it — `min(tLoss, RACE.slackCap)`. Equal to `tLoss` below the cap, which
   *  is where every near-death reading lives. */
  slack: number;
  /** `slack − T̂win` — the race margin, the value proper. */
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
 * and because an evaluation must stay at the one projection (`permanentProjection`) for the search to
 * afford any depth at all.
 *
 * The plans are what make a lumpy goal legible. A mission counting mined veins, or one asking for
 * citizens no card *produces* per round, has a τ of exactly zero however well the run is going: nothing
 * in the permanent economy moves its measure, so the clock would sit at the horizon and the value would
 * be flat over every line that approaches the win. A plan restates the same goal as two clocks the run
 * really runs: a price in worker-rounds the run's income and workforce pay off at a rate, and a number of
 * copies the deck deals at its own.
 */
export interface RaceModel {
  /** Worker-rounds per unit of each pool (`replacementCost`): the rate a plan's price converts through. */
  unitCost: Partial<Record<keyof Resources, number>>;
  /** One per goal, in the objective card's own order. */
  plans: GoalPlan[];
}

/** The two rates a plan's price converts through. `unitCost` is root-derived and rides on the `RaceModel`;
 *  `income` is read off the leaf's own projection, so a producer staffed mid-run shortens the payment clock
 *  the turn it is staffed rather than at whatever the root happened to be standing. */
interface PriceRates {
  unitCost: RaceModel['unitCost'];
  /** Per-round gain of each pool from the permanent economy — the positive half of the same reading the
   *  pool drains take, so nothing is both an income and a drain. */
  income: Partial<Record<keyof Resources, number>>;
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
 *  whatever a play charges *there* (`routePrice`), which is why no price rides here. */
export interface LandingPlan {
  cardId: string;
  delta: number;
  /** What one play charges beyond its pools, in **worker-rounds**: the citizen a work box stands a turn
   *  to run. It is a plan field rather than a price because `unitCost` converts a pool *into* this unit and
   *  has nothing to say about one already in it — Conquest's real cost is 2⚔️ and a citizen's round. */
  workerRounds?: number;
  /** Whether a landed copy returns to the pile it was dealt from. A copy landing by presence is spent by
   *  landing, so a plan needing more than the run holds is unreachable; a played copy that files back to
   *  the discard is dealt again, so two copies can deliver six units and the cadence they cycle at is the
   *  whole clock. */
  recycles?: boolean;
  /** The most units of the measure this card can ever supply, however many copies land — absent where the
   *  route is a rate and `need / delta` copies of it really do finish the goal. A measure counting the
   *  *distinct* cards present caps every route at one card's worth, which is what makes a goal asking for
   *  two of them reachable only by two different cards: hence `cover`. */
  cap?: number;
  /** A card whose standing this route's own `cost.check` refuses the play without — the prerequisite
   *  `gateOf` lands in front of the route. */
  requires?: string;
}

/** Standing a durable producer whose per-round output the goal reads: pay for it once, then collect `tau`
 *  a round. A work box is deliberately not one: its `produces` fires once per play, which makes that
 *  output a landing's delta rather than a rate. */
export interface BuildingPlan {
  cardId: string;
  tau: number;
  /** As `LandingPlan.requires`. */
  requires?: string;
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
  /** What one play charged at the **root**, per pool — a structure's slot included. A card whose price
   *  climbs with its own use reads a different number at every leaf (`PlanClockExplain.price`). */
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
  /** The card the scan found this one's cost refusing the play without. Neither route is dropped for it —
   *  a gate is a clock the leaf runs, not a reason to have no plan. */
  requires?: string;
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
  /** The population the redeployment half of every `CandidateRoute.t` below was charged to. At zero they
   *  read `Infinity` past whatever the root's standing income covers, while the routes are kept anyway — so
   *  the figure has to travel with them or the scan reads as keeping the unreachable. */
  workforce: number;
  /** Pools with no `unitCost` — a price naming one yields no plan. */
  unpriceable: (keyof Resources)[];
  goals: GoalPlanExplain[];
  /** `runCardIds`, sorted. */
  runCards: string[];
}

/** The gate one route waits behind: the card its cost names, whether that card already stands, and — where
 *  it does not — the route that lands it. Recorded on every gated route, satisfied or not, because a gate
 *  that has been opened and one that was never there are the same silence otherwise, and the first is what
 *  the run just paid for. */
export interface PrereqClockExplain {
  cardId: string;
  satisfied: boolean;
  /** Rounds this gate adds in front of the route it gates — the route's `t`, or `0` once satisfied. */
  t: number;
  /** The clock of landing one copy; absent once the card stands, there being nothing left to land. */
  route?: PlanClockExplain;
}

/** One plan route's two clocks, and the fold across them. Shared by both routes: a building plan runs the
 *  same payment/delivery pair and then adds the rounds it spends collecting. */
export interface PlanClockExplain {
  cardId: string;
  /** Copies the plan owes — `need / delta` for a landing, `1` for a building. */
  copies: number;
  /** What one play charges *here*, per pool — a structure's slot included. Read at this state rather than
   *  taken off the plan, so a card whose price escalates is quoted at what the next play of it really costs. */
  price: Partial<Record<keyof Resources, number>>;
  /** What the copies still cost after the bank was spent on them. */
  workerRounds: number;
  /** How much of each pool that netting took. */
  netted: Partial<Record<keyof Resources, number>>;
  /** Worker-rounds of that debt the coming boundary already settles, off the board's standing income in
   *  the priced pools — the half of `payment` that is measured rather than assumed. */
  realized: number;
  /** `paymentClock` — the earning clock. */
  payment: number;
  /** `deliveryClock` — the drawing clock, and the circulation census behind it: `held × hand / pool`. */
  delivery: number;
  held: number;
  pool: number;
  hand: number;
  perRound: number;
  /** `staffingWait` — rounds the delivery half additionally spends on a citizen to run the box, `0` on a
   *  route that stands nobody and wherever one is free. The clock that folds is `delivery + staffing`. */
  staffing: number;
  recycles: boolean;
  /** The softMax weights of `[payment, delivery]`, in that order (see `absorbed`). Empty where an infinite
   *  clock made the fold a hard `max`. */
  weights: number[];
  /** `landingClock(payment, delivery)`. */
  lands: number;
  /** Rounds collecting `need` at the producer's rate once it stands; `0` for a landing. */
  collect: number;
  /** The gate in front of all of it; absent where the route's cost names none. */
  prereq?: PrereqClockExplain;
  /** `prereq + lands + collect` — the clock this route offered the `min`. */
  t: number;
}

/** One cover's clock: the members it composed, and the two things no member carries — the summed bill the
 *  bank was netted against once, and the fold across the members' own clocks. */
export interface CoverClockExplain {
  cardIds: string[];
  /** Each member's share, and the delivery half it contributed to the `max`. Its payment is deliberately
   *  absent: a member has no payment of its own, the cover having one bill. */
  members: {
    cardId: string;
    copies: number;
    price: Partial<Record<keyof Resources, number>>;
    delivery: number;
    staffing: number;
    held: number;
    pool: number;
    hand: number;
    perRound: number;
    /** What this member would have read alone — the number the cover exists because none of them finished. */
    t: number;
  }[];
  /** `Σ member price × copies`, the bag `outstanding` netted the bank against. */
  bill: Partial<Record<keyof Resources, number>>;
  netted: Partial<Record<keyof Resources, number>>;
  payment: number;
  /** The latest member's `delivery + staffing`. */
  delivery: number;
  weights: number[];
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
  /** Units of the measure the goal's landing routes can together still supply (`landingReach` summed),
   *  `Infinity` where one of them recycles. Under `need` the goal cannot be finished by landing however live
   *  each route reads on its own — the one figure that says so, and the reason the cover came up short. */
  reach: number;
  /** `need / tau` off the standing economy — the route taken unless a plan beat it. */
  throughput: number;
  /** The plans this goal was offered, which is not the same as the ones it costed: a workforce of zero
   *  gates both branches off, and a good plan then reads exactly like none at all. */
  plan?: GoalPlan;
  /** Every route costed here, in the plan's own order — the `min` this clock is. */
  landings: PlanClockExplain[];
  buildings: PlanClockExplain[];
  /** At most one, and empty wherever the capped routes never needed composing. */
  covers: CoverClockExplain[];
}

/** One core pool's death clock: the positive root of `level = drain·t + accel·t²`. */
export interface PoolClockExplain {
  key: keyof CoreResources;
  level: number;
  drain: number;
  /** Half the per-round² deepening of `drain`, absent where nothing escalates — which is also where `t`
   *  is the plain `level / drain` it has always been. */
  accel?: number;
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
  /** How much deeper the *second* such boundary goes, per pool — the escalation the death clock is solved
   *  against. Absent where nothing deepens, which is every flat drain and every eased one. */
  escalation?: Partial<Record<keyof Resources, number>>;
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
 *  figures: the root of the price itself, the leaf of the clock that price runs down at, whose rates it has
 *  already reported separately. `''` where the route is a live one.
 *
 *  Being short of copies is deliberately not among them: a route is asked for what it can deal
 *  (`landingReach`) and never for more, so falling short is a fact about the *goal* — `routeCause` reads it
 *  off the reach the routes together muster. */
function unreachableCause(payable: boolean, delivery: number): string {
  if (!payable) return 'unpriceable pool';
  if (!Number.isFinite(delivery)) return 'no copies circulate';
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
  // The shortfall no route reports, because no route has it: each one is live at what it can deliver, and
  // what the goal is short of is the sum of them.
  if (plan.landings.length > 0 && g.reach < g.clock.need) causes.add('copies short');
  for (const p of [...g.landings, ...g.buildings]) {
    if (Number.isFinite(p.t)) continue;
    // A gate nothing can open ends the route before its own two halves are read: both are finite here, and
    // reporting them would name a route that is live in everything except being playable.
    if (p.prereq && !Number.isFinite(p.prereq.t)) {
      causes.add(`gate ${p.prereq.cardId} unreachable`);
      continue;
    }
    const cause = unreachableCause(Number.isFinite(p.payment), p.delivery);
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
function eventCensus(G: GameState): Omit<EventDrainExplain, 'full' | 'escalation'> {
  let copies = 0;
  let pool = 0;
  for (const zone of circulationZones(G)) {
    pool += zone.length;
    for (const c of zone) if (CARDS[c.cardId]?.kind === 'event') copies++;
  }
  const hand = effectiveHandSize(G);
  return { copies, pool, hand, share: pool > 0 ? Math.min(1, hand / pool) : 0 };
}

/** Every `event` copy the run's circulation holds — the hand a boundary probe stands a world's worth of
 *  recurring pressure up as. */
function eventCopies(G: GameState): CardInstance[] {
  return circulationZones(G).flatMap((zone) => zone.filter((c) => CARDS[c.cardId]?.kind === 'event'));
}

/** One end-of-turn boundary settled in place, the world's hand replaced by `events`: nothing, or the copies
 *  handed in. The work zone is dropped either way — its output is a level this turn reaches rather than a
 *  rate, which `inFlight` reads instead. */
function settle(world: GameState, events: CardInstance[]): void {
  world.workZone = [];
  world.hand = events;
  applyUpkeep(world);
}

/**
 * The run's **permanent** economy one round on: tableau production, trade rent, threat drains, building
 * maintenance, population food, and the recurring disaster of every `event` the run still circulates. τ
 * and the pool drains are both read off it, with `accel` carrying the one thing a projected state cannot
 * hold — a drain that is not the same next round as it is this one.
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
 * The amount is measured, never read: each boundary settles every circulating copy through the same
 * `applyUpkeep` at the slot the engine does (its own `resolveHandEvents`), so a drain computing itself off
 * a counter it bumps is charged what it really takes.
 *
 * **Two** boundaries, because what such a drain really takes is not one number. A copy that deepens every
 * time it comes round is charged today's level flat by a single reading, and `level / drain` then promises
 * rounds that will not exist. So each boundary is run in both worlds and the events' own marginal is the
 * difference — a diff of the two diffs, which cancels whatever the rest of the board did between them
 * (a threat escalating on its own clock included). The rise from the first to the second is what one
 * resolution deepens by; the clock above turns it into a rate that climbs. Three clones and four
 * boundaries, and only for a run that circulates an event at all.
 *
 * The counter advances **after** the boundary, which is what makes "one round on" true of the whole
 * state rather than of the pools alone: a drain keyed to the round is charged at the round it is
 * charged for, while a goal measured in rounds derives its τ of 1 from the same subtraction every other
 * goal uses. Both worlds advance together for the second boundary, so a round-keyed drain cancels there
 * as the rest does.
 */
function permanentProjection(
  G: GameState,
  ex?: RaceSink,
): { perm: GameState; accel: Partial<Record<keyof Resources, number>> } {
  const perm = cloneState(G);
  settle(perm, []);
  const census = eventCensus(G);
  const accel: Partial<Record<keyof Resources, number>> = {};
  if (census.copies > 0) {
    const charged = cloneState(G);
    const copies = eventCopies(charged);
    settle(charged, copies);
    const first = { ...charged.resources };
    const next = cloneState(perm);
    next.round = G.round + 1;
    charged.round = G.round + 1;
    settle(next, []);
    settle(charged, copies);

    const full: Partial<Record<keyof Resources, number>> = {};
    const escalation: Partial<Record<keyof Resources, number>> = {};
    for (const k of ALL_POOLS) {
      const d1 = perm.resources[k] - first[k];
      const d2 = next.resources[k] - perm.resources[k] - (charged.resources[k] - first[k]);
      if (d1 !== 0) full[k] = d1;
      perm.resources[k] -= census.share * d1;
      // A drain that *eases* is left flat at what it takes now rather than projected toward zero and a
      // clock toward `∞`: the model may read a pressure short, never read one away.
      const step = d2 - d1;
      if (step > 0) {
        escalation[k] = step;
        // A copy resolves `share` times a round, so after `t` rounds the drain has deepened by
        // `share·t` steps and the cumulative take is `share·d1·t + share²·step·t²/2`.
        accel[k] = (census.share * census.share * step) / 2;
      }
    }
    if (ex) ex.events = { ...census, full, ...(Object.keys(escalation).length > 0 ? { escalation } : {}) };
  }
  perm.round = G.round + 1;
  return { perm, accel };
}

/** What the permanent economy *adds* to each pool a round — the same subtraction the pool drains read, kept
 *  the other way up. A pool the board feeds net-negatively yields nothing here rather than a negative rate:
 *  it is not paying for anything. */
function incomeRates(G: GameState, perm: GameState): Partial<Record<keyof Resources, number>> {
  const income: Partial<Record<keyof Resources, number>> = {};
  for (const k of ALL_POOLS) {
    const gain = perm.resources[k] - G.resources[k];
    if (gain > 0) income[k] = gain;
  }
  return income;
}

/**
 * Rounds until a pool of `level` empties under a drain of `drain` a round that deepens by `2·accel` a round
 * squared — the positive root of `level = drain·t + accel·t²`.
 *
 * At an `accel` of zero it is the same division a flat drain has always been, evaluated by the same
 * expression, so a run whose pressure does not escalate reads a clock bit-identical to one that never knew
 * escalation existed. A drain of zero that escalates still empties the pool, which is what a disaster
 * starting from nothing is; a negative drain that escalates empties it later, once the deepening has
 * outrun the refill.
 */
function drainClock(level: number, drain: number, accel: number): number {
  if (accel > 0) return (Math.sqrt(drain * drain + 4 * accel * level) - drain) / (2 * accel);
  return drain > 0 ? level / drain : Infinity;
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

/** A price converted into **worker-rounds**, `Infinity` where a component has no rate — the one scale the
 *  root's ranking and the leaf's copy-picking can both compare a bag of pools on. */
function priceWorkerRounds(
  price: Partial<Record<keyof Resources, number>>,
  unitCost: RaceModel['unitCost'],
): number {
  let wr = 0;
  for (const [k, amt] of Object.entries(price) as [keyof Resources, number][]) wr += amt * (unitCost[k] ?? Infinity);
  return wr;
}

/**
 * The copy the next play of this card would really be made with: the cheapest one the run still
 * **circulates**.
 *
 * Cheapest because that is the play the run has. A card whose price climbs with its own use leaves its
 * least-played copy for the next play, so any other copy quotes a price nobody would pay; it also keeps the
 * quote monotone over the plan's own progress, since landing the cheapest copy raises the minimum or leaves
 * it where it was and can never lower it.
 *
 * Over the circulation for the same reason `deliveryClock` counts it there: which of the four piles a copy
 * rests in this turn is not a distance travelled, and a price read off the hand alone would flicker with the
 * deal. Ties break on the instance id, which no zone move touches either. `undefined` where the run
 * circulates no copy at all — a route with no copy to deal is dead on delivery, and the declarative base is
 * the only price left to report it at.
 */
function pricingCopy(G: GameState, card: CardDef, unitCost: RaceModel['unitCost']): CardInstance | undefined {
  let best: CardInstance | undefined;
  let bestWr = Infinity;
  for (const zone of circulationZones(G)) {
    for (const c of zone) {
      if (c.cardId !== card.id) continue;
      const wr = priceWorkerRounds(cardPrice(G, card, c), unitCost);
      if (best === undefined || wr < bestWr || (wr === bestWr && c.id < best.id)) {
        best = c;
        bestWr = wr;
      }
    }
  }
  return best;
}

/** Room is part of what a structure charges: one tableau slot per copy. Folded in past the pool price
 *  because land is held rather than bought at a rate — `outstanding` nets it against the free tableau
 *  instead of converting it, and it is the one component exempt from needing a `unitCost` up front. */
function withRoom(
  card: CardDef,
  price: Partial<Record<keyof Resources, number>>,
): Partial<Record<keyof Resources, number>> {
  return isStructure(card) ? { ...price, territory: (price.territory ?? 0) + 1 } : price;
}

/** What one play of this card charges at this state, per pool — the figure every clock on the route is run
 *  down from, and a read of the moment rather than of the catalogue: the copy a play would use, priced
 *  through `currentCost`, so a plan cannot go on believing a route is cheap after the run has made it
 *  expensive. */
function routePrice(
  G: GameState,
  card: CardDef,
  unitCost: RaceModel['unitCost'],
): Partial<Record<keyof Resources, number>> {
  return withRoom(card, cardPrice(G, card, pricingCopy(G, card, unitCost)));
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
 * Worker-rounds of a plan's outstanding price that **this** boundary settles on its own: the board's
 * standing income in the pools the price names, converted through the same `unitCost` the debt was.
 *
 * Restricted to the priced pools, which is the whole discrimination: a Farm's food pays nothing toward a
 * price quoted in coins, however many citizens the Farm is running. Within those pools the sum is fungible,
 * as `outstanding`'s own sum across a bag of pools already is.
 *
 * The work zone is deliberately not in it: a box's output is a level this turn reaches, which `bankedState`
 * has already taken off the debt, and counting it again as a rate would pay for the plan twice.
 */
function realizedIncome(
  price: Partial<Record<keyof Resources, number>>,
  income: Partial<Record<keyof Resources, number>>,
  unitCost: RaceModel['unitCost'],
): number {
  let wr = 0;
  for (const k of Object.keys(price) as (keyof Resources)[]) wr += (income[k] ?? 0) * (unitCost[k] ?? 0);
  return wr;
}

/**
 * Rounds to earn what a plan still owes, from the income the board **really** has and the workforce it
 * could redeploy behind it.
 *
 * The coming boundary yields what the projection measured — `realized`, and nothing else, because a
 * citizen standing idle or standing in the wrong box produces nothing at it. From the boundary after, the
 * whole workforce can be on the job at the replacement rate `unitCost` already prices a pool at. So a plan
 * whose pools the board is already feeding is paid at that feed, and one whose pools nothing feeds is paid
 * a round later at the rate this model has always charged.
 *
 * That asymmetry is the point. Dividing the whole debt by the workforce instead values a run by what its
 * people *could* be doing, which is flat over every act that puts them to doing it — and a plan's priced
 * pools are by construction the ones no goal measures, so a producer feeding one reaches `T̂win` through no
 * other term and staffing it would be worth nothing anywhere. Here it shortens the clock by exactly what it
 * produces.
 *
 * The `1 +` is the boundary `permanentProjection` measures, not a knob: it is what makes the two branches
 * meet — without it they part by a whole round at `realized = workerRounds`, and a discontinuity there is
 * a state the beam can score two ways.
 */
function paymentClock(workerRounds: number, realized: number, workforce: number): number {
  if (workerRounds <= 0) return 0;
  if (realized >= workerRounds) return workerRounds / realized;
  return workforce > 0 ? 1 + (workerRounds - realized) / workforce : Infinity;
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

/**
 * Rounds a work box's landing waits on a citizen to run it. A box produces nothing unstaffed, so a plan
 * whose people are all committed elsewhere does not land at the rate the deck deals it — it lands when
 * somebody is free. Without this the draw rate is the whole of the delivery half, and a goal reachable
 * only through a box reads a short finite clock on a state where nothing can reach it at all.
 *
 * Availability is read off the **tableau** alone, the way `permanentProjection` reads the economy: the
 * boundary files a work box back to the discard and strips its staffing, so a citizen running a box this
 * turn is one the next play has. Counting them as committed would charge this wait to the play that staffs
 * a box, which is the play it exists to make worth making.
 *
 * One boundary rather than one per copy, for the same reason — the citizen freed for the first play is the
 * one every play after it runs on. The `1` is the boundary the projection already measures, exactly as
 * `paymentClock`'s is: a redeployment is the same event in both, and a citizen standing in the wrong box is
 * one move and a turn from the right one, never unreachable. Nobody at all is the one reading here that is
 * not a delay.
 */
function staffingWait(banked: GameState, plan: { workerRounds?: number }, copies: number): number {
  // A plan charging worker-rounds a play is one standing a citizen to run a box: nothing else in this model
  // is priced in labour a play spends rather than in pools it costs.
  if (!(plan.workerRounds && plan.workerRounds > 0) || copies <= 0) return 0;
  if (banked.resources.population - assignedWorkers(banked.tableau) >= 1) return 0;
  return banked.resources.population > 0 ? 1 : Infinity;
}

/** What the census and the fold weights are collected into when someone is recording; `undefined` on the
 *  beam's own path, where nothing is. */
type RouteSink = { census: { held: number; pool: number; hand: number; perRound: number }; weights: number[] };

function routeSink(): RouteSink {
  return { census: { held: 0, pool: 0, hand: 0, perRound: 0 }, weights: [] };
}

/** The same for a cover, whose members each need one of the above and whose own fold has weights and a
 *  summed bill no member carries. */
type CoverSink = {
  members: RouteSink[];
  clocks: { price: Partial<Record<keyof Resources, number>>; delivery: number; staffing: number; t: number }[];
  bill: Partial<Record<keyof Resources, number>>;
  weights: number[];
};

function coverSink(size: number): CoverSink {
  return { members: Array.from({ length: size }, routeSink), clocks: [], bill: {}, weights: [] };
}

/**
 * One route's clock: the softened fold of earning `copies` of its price and drawing that many copies. Shared
 * by the root scan, which keeps a route on whether both halves are finite, and by the leaf, which takes the
 * soonest of the kept ones — so a route is never kept on one reading and taken on another.
 *
 * The price is read here rather than carried on the plan, which is what makes the two readings the same
 * function at two states: a plan that quoted the root's price would keep charging it long after the run had
 * paid the cheap copies off.
 *
 * A building route is the same pair for a single copy; the rounds it then spends collecting are the caller's,
 * being the one part that really is sequential with standing it.
 */
function routeClock(
  plan: { cardId: string; workerRounds?: number; recycles?: boolean },
  copies: number,
  banked: GameState,
  workforce: number,
  rates: PriceRates,
  sink?: RouteSink,
): {
  price: Partial<Record<keyof Resources, number>>;
  workerRounds: number;
  netted: Partial<Record<keyof Resources, number>>;
  realized: number;
  payment: number;
  delivery: number;
  staffing: number;
  t: number;
} {
  const price = routePrice(banked, CARDS[plan.cardId], rates.unitCost);
  const paid = outstanding(price, copies, banked, rates.unitCost, plan.workerRounds);
  const realized = realizedIncome(price, rates.income, rates.unitCost);
  const payment = paymentClock(paid.workerRounds, realized, workforce);
  // The two halves of one clock: the deck deals the copy and somebody has to be free to run it, so what the
  // fold takes is their sum. `delivery` is kept the draw rate it measures — the census reconstructs it, and
  // the root's keep is decided on it, which is what holds the wait to the leaf that knows the staffing.
  const delivery = deliveryClock(banked, plan.cardId, copies, plan.recycles, sink?.census);
  const staffing = staffingWait(banked, plan, copies);
  return {
    price, ...paid, realized, payment, delivery, staffing,
    t: landingClock(payment, delivery + staffing, sink?.weights),
  };
}

/**
 * The gate a route waits behind, in the same rounds everything else here is measured in: nothing once the
 * named card stands, else the clock of landing one copy of it.
 *
 * Serial with the route it gates, rather than folded beside it, because the gate is not a second clock on
 * the same play — the play is *refused* until the named card stands, so no amount of banking or drawing
 * moves the goal until it does. Which is also what makes the term a gradient: it vanishes the round the
 * card lands, and the difference is the whole reason to land it, a prerequisite carrying no measure of its
 * own and so registering nowhere else in this model.
 *
 * Satisfaction is read off the zone the refusal names rather than by re-running the cost closure: the
 * `missingRoute` payload *is* that predicate, and re-running it at a leaf would need a copy to price
 * against that this has no reason to go looking for.
 *
 * One level deep. A prerequisite that is itself gated is planned as though it were not, which is the bound
 * that keeps this from recursing through a chain no catalogue has.
 */
function gateOf(
  plan: { requires?: string },
  banked: GameState,
  workforce: number,
  rates: PriceRates,
  recording: boolean,
): { t: number; netted: Partial<Record<keyof Resources, number>>; explain?: PrereqClockExplain } | undefined {
  const cardId = plan.requires;
  if (cardId === undefined) return undefined;
  if (banked.tradeRoutes.some((r) => r.cardId === cardId)) {
    return { t: 0, netted: {}, ...(recording ? { explain: { cardId, satisfied: true, t: 0 } } : {}) };
  }
  const sink = recording ? routeSink() : undefined;
  const r = routeClock({ cardId }, 1, banked, workforce, rates, sink);
  return {
    t: r.t,
    netted: r.netted,
    ...(recording
      ? {
        explain: {
          cardId,
          satisfied: false,
          t: r.t,
          route: {
            cardId, copies: 1, price: r.price, workerRounds: r.workerRounds, netted: r.netted,
            realized: r.realized, payment: r.payment, delivery: r.delivery, ...sink!.census,
            staffing: r.staffing, recycles: false, weights: sink!.weights, lands: r.t, collect: 0, t: r.t,
          },
        },
      }
      : {}),
  };
}

/** Two earmarks against one bank, folded per pool the way `computeRace` folds two goals' — `max`, each
 *  having been priced as though the whole bank were its own. */
function mergeNetted(
  a: Partial<Record<keyof Resources, number>>,
  b: Partial<Record<keyof Resources, number>>,
): Partial<Record<keyof Resources, number>> {
  const out = { ...a };
  for (const [k, v] of Object.entries(b) as [keyof Resources, number][]) out[k] = Math.max(out[k] ?? 0, v);
  return out;
}

/** Copies of a card the run still circulates — the one count `landingReach` is a ceiling by. */
function heldCopies(G: GameState, cardId: string): number {
  let held = 0;
  for (const zone of circulationZones(G)) {
    for (const c of zone) if (c.cardId === cardId) held++;
  }
  return held;
}

/**
 * The most units of the measure this route can still supply **from here**.
 *
 * Where `LandingPlan.cap` is what the *measure* saturates at — a fact about the goal, derived once — this is
 * what the *run* can still deal, and it is a read of the moment for the same reason `deliveryClock`'s census
 * is: a copy that does not recycle is spent by landing, so the copies in circulation are the ceiling on
 * everything that route will ever deliver. Two of a card a goal counts one apiece supply two of a need of
 * four, and the rest of that goal is another card's — which is what `coverMembers` composes.
 *
 * Asking a route for more than that is what makes it read as no route at all: an unreachable delivery clock
 * on the one card the run really has, rather than a partial contribution the cover can build on.
 */
function landingReach(banked: GameState, landing: LandingPlan): number {
  if (landing.cap !== undefined) return landing.cap;
  if (landing.recycles) return Infinity;
  return heldCopies(banked, landing.cardId) * landing.delta;
}

/**
 * The set of routes a cover runs, or nothing where the run's routes cannot together reach the goal.
 *
 * Cheapest-per-unit first, which is the order `deriveRace` already left the list in. Greedy over that rank
 * is exactly optimal while the ceilings are equal — every measure counting the distinct cards standing caps
 * each route at one — and an approximation past that, since the rank is a rate and the spend is a
 * ceiling-sized chunk. A search over subsets would be the exact answer to a question no shipped goal asks.
 * Each member is asked for the share left after the ones before it, so a route with room to spare finishes
 * the goal rather than overbuying its own ceiling.
 *
 * A route with nothing left to deal is passed over rather than ending the composition: a ceiling reaches
 * zero as a plan's copies land, and the members after it are exactly what the goal is then finished by.
 */
function coverMembers(
  landings: LandingPlan[],
  reaches: number[],
  need: number,
): { plan: LandingPlan; copies: number }[] {
  const members: { plan: LandingPlan; copies: number }[] = [];
  let remaining = need;
  for (let i = 0; i < landings.length; i++) {
    if (remaining <= 0) break;
    const share = Math.min(reaches[i], remaining);
    if (share <= 0) continue;
    members.push({ plan: landings[i], copies: share / landings[i].delta });
    remaining -= share;
  }
  // Divided shares accumulate rounding, and a goal is short by a rounding error in no meaningful sense.
  return remaining > 1e-9 ? [] : members;
}

/**
 * When several routes finish a goal that no one of them can, the clock of pursuing them together. A goal
 * counting the *distinct* cards standing caps each route at one card's worth (`LandingPlan.cap`), so its
 * only completion is a set — and a `min` over the members reports the soonest of several routes that each
 * fall short, which is a clock for reaching part of a goal.
 *
 * The two halves compose differently because the run does them differently. The bill is **one bill**: the
 * members' prices are summed and the bank netted against the total once, since a coin spent on the first
 * card is not there for the second — netting each member against the whole bank separately would let the
 * same food buy both. Delivery is the **latest** member's: the deck deals them in parallel, and the set is
 * complete when the last one arrives.
 *
 * Which makes the one-member case exactly `routeClock` — `outstanding` multiplies price by copies, so a
 * bill already scaled and paid once is the same arithmetic — and that is the point: a cover is not a second
 * model of a landing, it is the same landing over a set the goal forced.
 */
function coverClock(
  members: { plan: LandingPlan; copies: number }[],
  banked: GameState,
  workforce: number,
  rates: PriceRates,
  sink?: CoverSink,
): { netted: Partial<Record<keyof Resources, number>>; payment: number; delivery: number; t: number } {
  const bill: Partial<Record<keyof Resources, number>> = {};
  let labour = 0;
  let delivery = 0;
  members.forEach((m, i) => {
    const r = routeClock(m.plan, m.copies, banked, workforce, rates, sink?.members[i]);
    for (const [k, amt] of Object.entries(r.price) as [keyof Resources, number][]) {
      bill[k] = (bill[k] ?? 0) + amt * m.copies;
    }
    labour += (m.plan.workerRounds ?? 0) * m.copies;
    delivery = Math.max(delivery, r.delivery + r.staffing);
    sink?.clocks.push(r);
  });
  const paid = outstanding(bill, 1, banked, rates.unitCost, labour);
  const payment = paymentClock(paid.workerRounds, realizedIncome(bill, rates.income, rates.unitCost), workforce);
  if (sink) sink.bill = bill;
  return { netted: paid.netted, payment, delivery, t: landingClock(payment, delivery, sink?.weights) };
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
 * is a branch that can fire the wrong way. The workforce `paymentClock` redeploys is the **population**,
 * not the workers currently in boxes: `unitCost` prices a pool at the output of a worker standing in the
 * best box for it, so a denominator counting only staffed workers would disagree with its own numerator
 * about the same person.
 */
function goalClock(
  goal: ObjectiveGoal,
  G: GameState,
  banked: GameState,
  perm: GameState,
  horizon: number,
  plan: GoalPlan | undefined,
  rates: PriceRates,
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
  const covers = ex ? ([] as CoverClockExplain[]) : undefined;
  let reach = 0;
  const seal = (clock: GoalClock, raw: number): GoalClock => {
    ex?.push({
      clock,
      raw,
      clamped: raw > horizon,
      workforce,
      reach,
      throughput,
      ...(plan ? { plan } : {}),
      landings: landings ?? [],
      buildings: buildings ?? [],
      covers: covers ?? [],
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
    // Read once: the share each route is costed for below and the composition the cover runs over are the
    // same ceilings spent two ways.
    const reaches = plan.landings.map((l) => landingReach(banked, l));
    if (ex) reach = reaches.reduce((n, r) => n + r, 0);
    plan.landings.forEach((landing, i) => {
      // Nothing left to deal is not a clock of no rounds: a route asked for zero copies is delivered
      // instantly, which would hand the goal a route that supplies none of it.
      if (reaches[i] <= 0) return;
      const sink = landings ? routeSink() : undefined;
      // A route buys its own ceiling and no more, so that is what it is costed for. Whether the goal is
      // then finished is the `take` below: only a route whose share *is* the need completes alone.
      const share = Math.min(reaches[i], need);
      const copies = share / landing.delta;
      const r = routeClock(landing, copies, banked, workforce, rates, sink);
      const gate = gateOf(landing, banked, workforce, rates, landings !== undefined);
      const t = gate === undefined ? r.t : gate.t + r.t;
      landings?.push({
        cardId: landing.cardId, copies, price: r.price, workerRounds: r.workerRounds, netted: r.netted,
        realized: r.realized, payment: r.payment, delivery: r.delivery, ...sink!.census,
        staffing: r.staffing, recycles: landing.recycles ?? false, weights: sink!.weights,
        ...(gate?.explain ? { prereq: gate.explain } : {}),
        lands: r.t, collect: 0, t,
      });
      if (share >= need) {
        take(t, 'landing', landing.cardId, gate ? mergeNetted(r.netted, gate.netted) : r.netted);
      }
    });
    const cover = coverMembers(plan.landings, reaches, need);
    if (cover.length > 1) {
      const sink = landings ? coverSink(cover.length) : undefined;
      const r = coverClock(cover, banked, workforce, rates, sink);
      covers?.push({
        cardIds: cover.map((m) => m.plan.cardId),
        members: cover.map((m, i) => ({
          cardId: m.plan.cardId, copies: m.copies, price: sink!.clocks[i].price,
          delivery: sink!.clocks[i].delivery, staffing: sink!.clocks[i].staffing,
          ...sink!.members[i].census, t: sink!.clocks[i].t,
        })),
        bill: sink!.bill, netted: r.netted, payment: r.payment, delivery: r.delivery,
        weights: sink!.weights, t: r.t,
      });
      take(r.t, 'cover', cover.map((m) => m.plan.cardId).join('+'), r.netted);
    }
    for (const building of plan.buildings) {
      const sink = buildings ? routeSink() : undefined;
      const r = routeClock(building, 1, banked, workforce, rates, sink);
      const gate = gateOf(building, banked, workforce, rates, buildings !== undefined);
      // Collecting from the producer *is* sequential with standing it, unlike the two halves of standing it.
      const collect = need / building.tau;
      const t = gate === undefined ? r.t + collect : gate.t + r.t + collect;
      buildings?.push({
        cardId: building.cardId, copies: 1, price: r.price, workerRounds: r.workerRounds, netted: r.netted,
        realized: r.realized, payment: r.payment, delivery: r.delivery, ...sink!.census,
        staffing: r.staffing, recycles: false, weights: sink!.weights,
        ...(gate?.explain ? { prereq: gate.explain } : {}),
        lands: r.t, collect, t,
      });
      take(t, 'building', building.cardId, gate ? mergeNetted(r.netted, gate.netted) : r.netted);
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

/**
 * The card this copy's cost refuses the play without, read through the one seam a price may be read
 * through, so a check a sticker materialized lands here too.
 *
 * Only `missingRoute` names one. It is the single refusal whose payload identifies a card the run can go and
 * land — the rest say the moment is wrong (an empty pile, a committed citizen), which the clocks around it
 * already measure and no plan can shorten by adding a card. Unknown to the catalogue is no prerequisite
 * either: the leaf would price a card that does not exist.
 */
function gatedOn(G: GameState, card: CardDef, self: CardInstance | undefined): string | undefined {
  if (!self) return undefined;
  const reason = currentCost(card, { G, self }).check?.({ G, self });
  if (reason?.kind !== 'missingRoute') return undefined;
  return CARDS[reason.cardId] ? reason.cardId : undefined;
}

/** One route's verdict at the run root. `t` is read at the income and workforce the root happens to have, so
 *  it is `Infinity` on a citizenless root with nothing standing; `kept` deliberately reads neither, being
 *  about the route rather than the moment. */
function probeRoute(
  plan: { cardId: string; workerRounds?: number; recycles?: boolean },
  copies: number,
  banked: GameState,
  workforce: number,
  rates: PriceRates,
): CandidateRoute {
  const r = routeClock(plan, copies, banked, workforce, rates);
  const reject = unreachableCause(Number.isFinite(r.workerRounds), r.delivery);
  return { kept: reject === '', t: r.t, payment: r.payment, delivery: r.delivery, reject };
}

/**
 * Derive the run's plans from the state the policy plans at. Every card the run holds is probed against
 * every goal for the three ways it can move a measure, and every route that is **deliverable here** is kept.
 *
 * Kept, not ranked: what a route costs per unit of measure and whether the deck can deal its copies are
 * independent questions, so an argmin over the first alone will hand a goal a cheap card the run cannot
 * circulate and drop the dearer one it can. The order is still cheapest-per-unit (fastest for a producer),
 * because `goalClock` takes a strict improvement and that is where ties resolve — first in catalogue order
 * within equal rank, so the same run derives the same plans every time.
 *
 * Deliverable is measured on the route's own two halves — a price with a rate to convert through and copies
 * the deck can deal — and not on the clock they fold to, whose rates are the run's income and workforce.
 * Both are facts about the moment and are gated at the leaf; folding them in here would leave a root with
 * no citizens carrying no plans for the rest of the run.
 *
 * A price with any *pool* component `replacementCost` could not reach yields **no route** at all. Worker-
 * rounds are the currency here, and a pool nothing in the run can obtain has no figure in it — carrying
 * the raw unit count in beside real prices would produce a number in no currency at all. Land is the
 * exception, being netted against the tableau before it is ever converted.
 */
export function deriveRace(G: GameState): RaceModel {
  return explainRaceModel(G).model;
}

/** `deriveRace` with every card it weighed, every route it dropped and why. Recorded unconditionally — a
 *  derivation runs per plan root, never per leaf, so the explain allocation stays off the hot path. */
export function explainRaceModel(G: GameState): RaceModelExplain {
  const ids = runCardIds(G);
  const unitCost = replacementCost(G, ids);
  const probe = cloneState(G);
  const banked = bankedState(G);
  const workforce = Math.max(0, banked.resources.population);
  // The root's own income, so a reported root clock is the reading a leaf at that state would take. It
  // decides nothing — a route is kept on its price and its copies, neither of which this touches.
  const rates: PriceRates = { unitCost, income: incomeRates(G, permanentProjection(G).perm) };
  const cards = Object.values(CARDS).filter((c) => ids.has(c.id));
  // A fact about the card, not about any goal, so it is read once rather than per goal below — and only
  // where it can be false at all: a kind with no discard filing recycles nothing whatever its effect does.
  const exiles = new Set(cards.filter((c) => c.kind === 'action' && selfExiles(G, c)).map((c) => c.id));
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
      // The root's own copies at the root's own state, through the same pricing every leaf uses — so the
      // ranking below is decided on what a play really costs here rather than on a printed floor.
      const copy = pricingCopy(G, card, unitCost);
      const price = cardPrice(G, card, copy);
      const unpriceable = (Object.keys(price) as (keyof Resources)[]).filter((k) => unitCost[k] === undefined);
      const work = card.kind === 'work';
      // The two ways a copy can move a measure, kept apart because they differ in what a *second* copy
      // buys. What a play adds is a resource and resources sum, so that half is a rate by construction;
      // standing somewhere counted may or may not be, which is what the two-copy probe below reads.
      const standing = presenceDelta(probe, card, goal.measure);
      const played = Math.max(
        grantDelta(probe, card, goal.measure),
        work ? outputDelta(probe, card, goal.measure) : 0,
      );
      const delta = Math.max(standing, played);
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
      const workerRounds = priceWorkerRounds(price, unitCost);
      // A work box is a landing in this model's own vocabulary — pay a price, take a delta, repeat — and
      // for a goal no standing card moves it is the only route there is. Its `produces` fires once per
      // play, so it reads at one staffed worker as a level; the citizen who spends the turn running it is
      // the rest of what it charges.
      const staffing = work ? 1 : 0;
      const perUnit = delta > 0 ? (workerRounds + staffing) / delta : Infinity;
      const requires = gatedOn(G, card, copy);
      const gated = requires !== undefined ? { requires } : {};
      const candidate: PlanCandidate = {
        cardId: card.id, delta, tau, price: withRoom(card, price), workerRounds, perUnit, unpriceable,
        ...gated,
      };
      if (delta > 0) {
        // Where the delta is what the play *added*, the copy files where its kind sends it and the two that
        // file to the discard are dealt again — bar an action whose own effect exiled it first. Where the
        // delta is the copy *standing* somewhere counted, it is spent standing there whatever its kind.
        const recycles = played >= standing && (work || (card.kind === 'action' && !exiles.has(card.id)));
        // A second copy that buys nothing is a ceiling rather than a rate, and a goal past it is reachable
        // only alongside another card. Probed only on the standing half, the played one summing by construction.
        const cap = played >= standing || presenceDelta(probe, card, goal.measure, 2) >= 2 * standing
          ? undefined
          : standing;
        const plan: LandingPlan = {
          cardId: card.id,
          delta,
          ...(work ? { workerRounds: staffing } : {}),
          ...(recycles ? { recycles } : {}),
          ...(cap !== undefined ? { cap } : {}),
          ...gated,
        };
        // A route with nothing left to deal is dead rather than instant — `deliveryClock` reads no copies
        // asked for as no rounds waited. Tested on the reach and never on the share, which a goal already
        // satisfied at the root drives to zero for every route alike: what the run can deliver is what makes
        // a plan worth carrying, and a met goal is one a later leaf may want a plan for again.
        const reach = landingReach(banked, plan);
        candidate.landing = reach > 0
          ? probeRoute(plan, Math.min(reach, need) / delta, banked, workforce, rates)
          : { kept: false, t: Infinity, reject: 'no copies circulate' };
        if (candidate.landing.kept) landings.push({ plan, rank: perUnit });
        else dropped.add(candidate.landing.reject);
      }
      if (tau > 0) {
        const plan: BuildingPlan = { cardId: card.id, tau, ...gated };
        candidate.building = probeRoute(plan, 1, banked, workforce, rates);
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
  const { perm, accel } = permanentProjection(G, ex);

  // T̂win — the bottleneck goal, softened so the others still pull. With no objective seeded there is
  // no clock to run down, which reads as the horizon: unwinnable, and flat.
  const rates: PriceRates = { unitCost: opts.model?.unitCost ?? {}, income: incomeRates(G, perm) };
  const clocked = objectiveGoals(G).map((g, i) =>
    goalClock(g, G, banked, perm, horizon, opts.model?.plans[i], rates, ex?.goals),
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
      const rise = accel[k] ?? 0;
      // A pool this turn's boundary already carries below zero has collapsed whatever its rate.
      const t = level < 0 ? 0 : drainClock(level, drain, rise);
      ex?.pools.push({ key: k, level, drain, ...(rise > 0 ? { accel: rise } : {}), t });
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

  // Runway past the cap is slack the run has no way to spend, and a margin linear in it outranks the win
  // it is racing for: a state 163 rounds from famine and 3.5 from the win refuses to free the citizen that
  // wins, because freeing one dents the runway by more than the whole race is worth. Capping leaves the
  // win clock's gradient at exactly −1 everywhere, so two states that both have more runway than they can
  // spend are told apart by their win alone. It sits here, after every clock that reads `tLoss` — the
  // deadline probes take it as their search budget, and a probe capped at the slack would report a
  // threat's real clock as no clock at all.
  const slack = Math.min(tLoss, RACE.slackCap);
  const margin = slack - tWin;
  let total = margin;

  // Both estimates are projections, and the closer death is the less a losing margin can be trusted to
  // be recoverable — so steepen the same deficit as `T̂loss` shrinks. Off the **bare** clock rather than
  // the capped slack: a run three rounds from famine is three rounds from famine whatever the margin
  // makes of runway it will never reach. The `1 +` is the unit round, not a second knob: it is what keeps
  // a zero-round `T̂loss` finite.
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
    slack,
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
