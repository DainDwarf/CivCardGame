import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { installCards, installFixtures, mint, uninstallCards, uninstallFixtures } from '../rules/testFixtures';
import { addBuilding, addWork, blankState, bumpCounter, getCounter, openTradeRoute, scaleResources, seedObjective, setCounter, subtractResources, type GameState } from '../rules';
import { effectiveGain } from '../rules/stickers';
import { CARDS, CREW_PATIENCE, type CardDef } from '../content/cards';
import {
  RACE,
  absorbed,
  deriveRace,
  explainRaceModel,
  explainRaceValue,
  landingClock,
  raceBreakdown,
  raceScore,
  routeCause,
  type GoalRoute,
} from './race';

/** The factor the scale-invariance pair differs by. Every quantity on `race_goal_scaled` is this many
 *  times `race_goal`'s, and the measure stays *linear* in the pool — a `floor` anywhere inside it would
 *  make the invariance approximate and turn the assertion into a tolerance question. */
const SCALE = 3;

/** Idle rounds `race_clock` tolerates — read by its own `defeat` and by every assertion against it, so
 *  the suite pins the countdown rather than a copy of it. */
const RACE_CLOCK_PATIENCE = 6;

const FIXTURES: Record<string, CardDef> = {
  race_goal: {
    id: 'race_goal', name: 'Race Goal', kind: 'objective', cost: {},
    goals: [{ icon: '🔬', measure: (G) => G.resources.science, target: 10 }],
  },
  race_goal_scaled: {
    id: 'race_goal_scaled', name: 'Race Goal Scaled', kind: 'objective', cost: {},
    goals: [{ icon: '🔬', measure: (G) => G.resources.science * SCALE, target: 10 * SCALE }],
  },
  // Two further targets over the same economy, so a test can dial `T̂win` to a chosen number of rounds.
  race_goal_12: {
    id: 'race_goal_12', name: 'Race Goal 12', kind: 'objective', cost: {},
    goals: [{ icon: '🔬', measure: (G) => G.resources.science, target: 12 }],
  },
  race_goal_48: {
    id: 'race_goal_48', name: 'Race Goal 48', kind: 'objective', cost: {},
    goals: [{ icon: '🔬', measure: (G) => G.resources.science, target: 48 }],
  },
  // Same measure, ten times the target — the pair that pins a goal's *size* out of the per-unit slope.
  race_goal_100: {
    id: 'race_goal_100', name: 'Race Goal 100', kind: 'objective', cost: {},
    goals: [{ icon: '🔬', measure: (G) => G.resources.science, target: 100 }],
  },
  // Two goals over two pools, so a test can drive one clock past the other.
  race_goal_pair: {
    id: 'race_goal_pair', name: 'Race Goal Pair', kind: 'objective', cost: {},
    goals: [
      { icon: '🔬', measure: (G) => G.resources.science, target: 10 },
      { icon: '🪙', measure: (G) => G.resources.money, target: 10 },
    ],
  },
  // Wins by surviving, the way Harsh Winter does — the one measure that moves without an economy.
  race_goal_round: {
    id: 'race_goal_round', name: 'Race Goal Round', kind: 'objective', cost: {},
    goals: [{ icon: '❄️', measure: (G) => G.round, target: 8 }],
  },
  // A work box on the goal's own pool: output in flight this turn, which the permanent projection drops.
  race_work_sci: {
    id: 'race_work_sci', name: 'Race Work Science', kind: 'work',
    cost: {}, workers: 1, produces: { resources: { science: 3 } },
  },
  // The lumpy shape: a goal counting played copies, which no economy moves per round however good it is.
  race_goal_count: {
    id: 'race_goal_count', name: 'Race Goal Count', kind: 'objective', cost: {},
    goals: [{ icon: '⛏️', measure: (G) => G.removed.filter((c) => c.cardId === 'race_relic').length, target: 3 }],
  },
  race_relic: {
    id: 'race_relic', name: 'Race Relic', kind: 'action', cost: { resources: { production: 4 } },
  },
  // A second route to one count, dearer per unit — the runner-up a scan keeping only its winner forgets.
  race_trinket: {
    id: 'race_trinket', name: 'Race Trinket', kind: 'action', cost: { resources: { production: 6 } },
  },
  race_goal_either: {
    id: 'race_goal_either', name: 'Race Goal Either', kind: 'objective', cost: {},
    goals: [{
      icon: '⛏️',
      measure: (G) => G.removed.filter((c) => c.cardId === 'race_relic' || c.cardId === 'race_trinket').length,
      target: 3,
    }],
  },
  // A price that doubles with the copy's own play count — the shape a plan reading a printed cost keeps
  // calling cheap however many times the run has already paid it.
  race_toll: {
    id: 'race_toll', name: 'Race Toll', kind: 'action',
    cost: {
      resources: { production: 4 },
      resolve: ({ self }, base) => ({
        ...base,
        resources: scaleResources(base.resources ?? {}, 2 ** getCounter(self, 'plays')),
      }),
    },
  },
  race_goal_toll: {
    id: 'race_goal_toll', name: 'Race Goal Toll', kind: 'objective', cost: {},
    goals: [{
      icon: '⛏️',
      measure: (G) => G.removed.filter((c) => c.cardId === 'race_toll' || c.cardId === 'race_trinket').length,
      target: 2,
    }],
  },
  // A measure that counts the *distinct* cards standing, so a second copy of one of them buys nothing and
  // the only completion is a set — the shape a plan asking for `need / delta` copies of one card cannot
  // express at all.
  race_goal_distinct: {
    id: 'race_goal_distinct', name: 'Race Goal Distinct', kind: 'objective', cost: {},
    goals: [{
      icon: '🏛️',
      measure: (G) => ['race_shrine', 'race_kiln'].filter((id) => G.tableau.some((b) => b.cardId === id)).length,
      target: 2,
    }],
  },
  race_shrine: {
    id: 'race_shrine', name: 'Race Shrine', kind: 'building', workers: 0, cost: { resources: { production: 2 } },
  },
  race_kiln: {
    id: 'race_kiln', name: 'Race Kiln', kind: 'building', workers: 0, cost: { resources: { production: 4 } },
  },
  // A measure that counts a zone's plain *length*, so every copy that lands advances it by one and nothing
  // saturates — the shape whose only ceiling is how many copies the run holds.
  race_goal_fleet: {
    id: 'race_goal_fleet', name: 'Race Goal Fleet', kind: 'objective', cost: {},
    goals: [{ icon: '🚢', measure: (G) => G.tradeRoutes.length, target: 4 }],
  },
  race_ferry: {
    id: 'race_ferry', name: 'Race Ferry', kind: 'trade', cost: { resources: { production: 2 } },
  },
  race_barge: {
    id: 'race_barge', name: 'Race Barge', kind: 'trade', cost: { resources: { production: 3 } },
  },
  // The pair that differ only in where a played copy files: one back into circulation, one out of the run.
  race_spark: {
    id: 'race_spark', name: 'Race Spark', kind: 'action', cost: {}, effect: { resources: { science: 1 } },
  },
  race_flare: {
    id: 'race_flare', name: 'Race Flare', kind: 'action', cost: {},
    effect: { resources: { science: 1 }, resolve: (ctx) => { ctx.G.removed.push(ctx.self); } },
  },
  // A card the gate refuses outright: no price and no delivery clock moves while the named route is absent,
  // so the only thing that makes the goal reachable is landing a card the goal does not measure.
  race_gate_route: {
    id: 'race_gate_route', name: 'Race Gate Route', kind: 'trade', cost: { resources: { production: 1 } },
  },
  race_gated_relic: {
    id: 'race_gated_relic', name: 'Race Gated Relic', kind: 'action',
    cost: {
      resources: { production: 4 },
      check: ({ G }) => (G.tradeRoutes.some((r) => r.cardId === 'race_gate_route')
        ? null
        : { kind: 'missingRoute', cardId: 'race_gate_route' }),
    },
  },
  race_goal_gated: {
    id: 'race_goal_gated', name: 'Race Goal Gated', kind: 'objective', cost: {},
    goals: [{
      icon: '⛏️',
      measure: (G) => G.removed.filter((c) => c.cardId === 'race_gated_relic').length,
      target: 2,
    }],
  },
  // A pool nothing `produces` per round — it exists only as what a play grants.
  race_goal_pop: {
    id: 'race_goal_pop', name: 'Race Goal Pop', kind: 'objective', cost: {},
    goals: [{ icon: '🧍', measure: (G) => G.resources.population, target: 3 }],
  },
  race_hut: {
    id: 'race_hut', name: 'Race Hut', kind: 'building', workers: 0,
    cost: { resources: { production: 4 } }, effect: { resources: { population: 2 } },
  },
  // A goal nothing standing can move: no card produces 🗺️ per round and no play grants it, so a work
  // box's once-per-play output is the only route to it at all.
  race_goal_land: {
    id: 'race_goal_land', name: 'Race Goal Land', kind: 'objective', cost: {},
    goals: [{ icon: '🗺️', measure: (G) => G.resources.territory, target: 3 }],
  },
  // The one thing that gives 🗺️ a worker-round price, so a plan short of land can quote what it owes —
  // and, charging no pool at all, the plan whose whole price is the citizen who runs it.
  race_claim: {
    id: 'race_claim', name: 'Race Claim', kind: 'work', cost: {}, workers: 1,
    produces: { resources: { territory: 1 } },
  },
  // An event whose drain is computed rather than printed, and deepens every time the copy comes round.
  // Nothing declarative can be read off it, so only settling the boundary reaches the amount at all.
  race_blight: {
    id: 'race_blight', name: 'Race Blight', kind: 'event', cost: {},
    upkeep: {
      resolve: ({ G, self }) => {
        subtractResources(G.resources, { science: 1 + getCounter(self, 'level') });
        bumpCounter(self, 'level');
      },
    },
  },
  // The same shape starting from nothing: the first boundary takes zero, so a model reading one boundary
  // sees a run in perfect health and a pool that can never empty.
  race_creep: {
    id: 'race_creep', name: 'Race Creep', kind: 'event', cost: {},
    upkeep: {
      resolve: ({ G, self }) => {
        subtractResources(G.resources, { science: getCounter(self, 'level') });
        bumpCounter(self, 'level');
      },
    },
  },
  // A drain going the other way: 3, then 2, then 1. Projecting the slope forward would run the clock to
  // infinity through a pool that is emptying right now.
  race_relief: {
    id: 'race_relief', name: 'Race Relief', kind: 'event', cost: {},
    upkeep: {
      resolve: ({ G, self }) => {
        subtractResources(G.resources, { science: 3 - getCounter(self, 'level') });
        bumpCounter(self, 'level');
      },
    },
  },
  // A *pace* clock: its own tick maintains the idle streak its `defeat` reads, and progress on the thing
  // it watches (culture here) resets the streak. Neither a round count nor a drain can express it, which
  // is why the probe is a frozen-world replay of the threat's own hooks rather than a read of either.
  race_clock: {
    id: 'race_clock', name: 'Race Clock', kind: 'threat', cost: {},
    upkeep: {
      resolve: ({ G, self }) => {
        if (G.resources.culture > getCounter(self, 'seen')) {
          setCounter(self, 'seen', G.resources.culture);
          setCounter(self, 'idle', 0);
        } else bumpCounter(self, 'idle');
      },
    },
    defeat: (_G, self) => getCounter(self, 'idle') >= RACE_CLOCK_PATIENCE && 'the clock ran out',
  },
};

beforeAll(() => {
  installFixtures();
  installCards(FIXTURES);
});
afterAll(() => {
  uninstallCards(FIXTURES);
  uninstallFixtures();
});

/**
 * A state whose whole economy is `producers` copies of `test_sci` and `earners` copies of `test_money`
 * (each 2 of its pool per staffed worker). Food is deep enough that the population's own upkeep never
 * becomes the binding loss clock, so a case that doesn't set out to test survival reads `T̂loss` as the
 * horizon — and deep enough to saturate the wealth tie-break, so a case comparing two banks is reading
 * the race and not the tie-break.
 */
function state(
  objectiveCardId: string,
  { science = 0, money = 0, food = 10_000, military = 0, population = 0, producers = 0, earners = 0 } = {},
): GameState {
  const G = blankState('race_test');
  G.round = 1;
  G.resources.science = science;
  G.resources.money = money;
  G.resources.food = food;
  G.resources.military = military;
  G.resources.population = Math.max(population, producers + earners);
  seedObjective(G, objectiveCardId);
  for (let i = 0; i < producers; i++) addBuilding(G, mint(G, 'test_sci'));
  for (let i = 0; i < earners; i++) addBuilding(G, mint(G, 'test_money'));
  return G;
}

/**
 * A state whose run cards are exactly one staffed `test_prod` plus what `deck` and `removed` name —
 * `runCardIds` reads every zone, so the deck is what the plans are allowed to use, and a suite that
 * wants to pin *which* plan won has to say so. The producer is there to give 🔨 a worker-round price;
 * at 2🔨 a worker it is half a worker-round to the unit.
 */
function planned(
  objectiveCardId: string,
  deck: string[],
  {
    production = 0,
    population = 1,
    food = 20,
    territory = 6,
    removed = [] as string[],
    standing = [] as string[],
  } = {},
): GameState {
  const G = blankState('race_test');
  G.round = 1;
  G.resources.production = production;
  G.resources.food = food;
  G.resources.population = population;
  G.resources.territory = territory;
  seedObjective(G, objectiveCardId);
  addBuilding(G, mint(G, 'test_prod'));
  for (const id of standing) addBuilding(G, mint(G, id));
  for (const id of deck) G.deck.push(mint(G, id));
  for (const id of removed) G.removed.push(mint(G, id));
  return G;
}

/** Valued with the run's own plans — how every consumer will read it. */
function valued(G: GameState) {
  return raceBreakdown(G, { model: deriveRace(G) });
}

function clockOf(G: GameState) {
  return valued(G).goals[0];
}

describe('scale invariance', () => {
  it('ranks corresponding states identically when a goal and its measure are scaled together', () => {
    // The fault the whole model exists to make unexpressible: the same race, described in units three
    // times as large, must be worth exactly the same.
    for (const { science, producers } of [
      { science: 0, producers: 1 },
      { science: 4, producers: 1 },
      { science: 7, producers: 2 },
      { science: 9, producers: 3 },
      { science: 10, producers: 1 },
    ]) {
      const plain = raceScore(state('race_goal', { science, producers }));
      const scaled = raceScore(state('race_goal_scaled', { science, producers }));
      expect(scaled).toBeCloseTo(plain, 10);
    }
  });

  it('pays the same for a banked unit however large the goal is', () => {
    // The fault proper: the old per-unit credit was `1 / target`, so the steering signal shrank as the
    // goal grew. Two 🔬 is one round off a 2🔬-a-round economy at any target.
    const saved = (objectiveCardId: string) =>
      raceBreakdown(state(objectiveCardId, { producers: 1 })).tWin -
      raceBreakdown(state(objectiveCardId, { science: 2, producers: 1 })).tWin;
    expect(saved('race_goal')).toBeCloseTo(1);
    expect(saved('race_goal_100')).toBeCloseTo(1);
  });
});

describe('T̂win', () => {
  it('prices a banked unit at the fraction of a round it saves', () => {
    // One producer is 2🔬 a round against a 10🔬 goal: 5 rounds. Two banked 🔬 is one of those rounds.
    const empty = raceBreakdown(state('race_goal', { producers: 1 }));
    const banked = raceBreakdown(state('race_goal', { science: 2, producers: 1 }));
    expect(empty.tWin).toBeCloseTo(5);
    expect(banked.tWin).toBeCloseTo(4);
    expect(banked.total).toBeGreaterThan(empty.total);
  });

  it('banks a staffed work box\'s output this turn without counting it as throughput', () => {
    const G = state('race_goal', { population: 2, producers: 1 });
    addWork(G, mint(G, 'race_work_sci'));
    const b = raceBreakdown(G);
    // The box's 3🔬 lands at upkeep, so it shortens the goal — but it produces once, so the per-round
    // rate stays the tableau's alone.
    expect(b.goals[0].tau).toBe(2);
    expect(b.goals[0].need).toBe(7);
    expect(b.tWin).toBeCloseTo(3.5);
  });

  it('folds several goals at the bottleneck, without letting the others go free', () => {
    // 🔬 is 5 rounds out and 🪙 is 2 — so the race is the science clock, but the money clock is still
    // a clock. Both banks are far past the wealth cap, so every difference below is the fold's.
    const pair = (science: number, money: number) =>
      raceBreakdown(state('race_goal_pair', { science, money, producers: 1, earners: 1 }));
    const base = pair(0, 6);
    expect(base.bottleneck).toBe(0);
    expect(base.goals.map((c) => c.t)).toEqual([5, 2]);

    // A round off the bottleneck is worth more than a round off the goal that isn't binding…
    expect(pair(2, 6).total).toBeGreaterThan(pair(0, 8).total);
    // …but the one that isn't binding is still worth something, which is what constant 1 buys: under a
    // pure `max` this is exactly zero and a beam may abandon the side goal for free.
    expect(pair(0, 8).total).toBeGreaterThan(base.total);
  });

  it('counts down a goal measured in rounds', () => {
    // No economy touches this measure — the projection being a whole round on, counter included, is
    // the only thing that gives it a rate at all.
    const G = state('race_goal_round');
    G.round = 5;
    const b = raceBreakdown(G);
    expect(b.goals[0].tau).toBe(1);
    expect(b.tWin).toBeCloseTo(3);
  });

  it('reads a bespoke-`met` goal as flat', () => {
    // The sandbox shape: satisfaction isn't a threshold, so there is no `need` to divide and nothing to
    // steer by — the whole objective sits at the horizon however good the economy is.
    expect(raceBreakdown(state('test_never')).tWin).toBe(200);
    expect(raceBreakdown(state('test_never', { producers: 3 })).tWin).toBe(200);
  });

  it('reads a goal with no throughput as unwinnable rather than as a NaN', () => {
    const b = raceBreakdown(state('race_goal'), { maxRounds: 40 });
    expect(b.tWin).toBe(40);
    expect(b.tLoss).toBe(40);
    expect(Number.isFinite(b.total)).toBe(true);
  });
});

describe('plans', () => {
  it('prices a card-count goal as the copies still to buy', () => {
    // Three relics at 4🔨 each, on an economy where a 🔨 is half a worker-round and one person works:
    // 12🔨 is 6 worker-rounds is 6 rounds of paying. Three copies out of a three-card pile is 0.75 of a
    // round of drawing. Nothing about that measure moves per round, so without the plan it would read as
    // the horizon on every line.
    const c = clockOf(planned('race_goal_count', ['race_relic', 'race_relic', 'race_relic']));
    expect(c.route).toBe('landing');
    expect(c.cardId).toBe('race_relic');
    expect(c.tau).toBe(0);
    expect(c.t).toBeCloseTo(landingClock(6, 0.75));

    // …and lands as they do.
    const landed = clockOf(planned('race_goal_count', ['race_relic', 'race_relic'], { removed: ['race_relic'] }));
    expect(landed.t).toBeCloseTo(landingClock(4, 0.5));
  });

  it('brings a played copy nearer the win than the bank that would buy it', () => {
    // Their payment clocks are equal by construction — netting is exact, so a bank is worth precisely the
    // rounds of production it stands in for — and the tie-break sees the same wealth either way. Every
    // bit of the difference is delivery: the played copy is one the deck no longer owes. The softened
    // fold is what carries that through a payment clock four times its size.
    const banked = valued(planned('race_goal_count', ['race_relic', 'race_relic', 'race_relic'], { production: 4 }));
    const played = valued(planned('race_goal_count', ['race_relic', 'race_relic'], { removed: ['race_relic'] }));
    expect(played.goals[0].t).toBeLessThan(banked.goals[0].t);
    expect(banked.wealth).toBeCloseTo(played.wealth);
    expect(played.total).toBeGreaterThan(banked.total);
  });

  it('still counts a bank past every price it could pay', () => {
    // The exclusion is of what a plan *spent*, not of the pool: 12🔨 buys all three relics, and the 4
    // beyond that is wealth like any other. With the price covered either way, what is left of the clock
    // is the same three copies to deal.
    const G = (production: number) => planned('race_goal_count', ['race_relic', 'race_relic', 'race_relic'], { production });
    const exact = valued(G(12));
    const spare = valued(G(16));
    expect(exact.goals[0].t).toBeCloseTo(spare.goals[0].t);
    expect(spare.wealth).toBeGreaterThan(exact.wealth);
  });

  it('prices a goal with no producer standing as building one, then running it', () => {
    // 3🔨 for the science building is 1.5 worker-rounds, of which the standing 🔨 producer really settles
    // 1 at the coming boundary and the two people earn the rest the round after; its one copy is a quarter
    // of a round's draw away — standing it is the two at once. Then 10🔬 at 2🔬 a round, which is not: the
    // producer has to be standing before it pays.
    const c = clockOf(planned('race_goal', ['test_sci'], { population: 2 }));
    expect(c.route).toBe('building');
    expect(c.cardId).toBe('test_sci');
    expect(c.t).toBeCloseTo(landingClock(1.25, 0.25) + 5);

    // Once it stands, the setup is paid and the permanent economy carries the goal on its own.
    const standing = clockOf(planned('race_goal', ['test_sci'], { population: 2, standing: ['test_sci'] }));
    expect(standing.route).toBe('throughput');
    expect(standing.t).toBeCloseTo(5);
  });

  it('reads a placement grant as a play to repeat, not a rate to collect', () => {
    // The hut's citizens arrive when it is *bought*; nothing about it pays per round. Routing that into
    // τ would have the goal finish itself while the run stands still.
    const G = planned('race_goal_pop', ['race_hut']);
    const plan = deriveRace(G).plans[0];
    expect(plan.buildings).toEqual([]);
    expect(plan.landings).toHaveLength(1);
    expect(plan.landings[0]).toMatchObject({ cardId: 'race_hut', delta: 2 });
    // 1🧍 of 3, so one hut closes it: 4🔨 is 2 worker-rounds over one person, against a quarter-round draw.
    expect(clockOf(G).t).toBeCloseTo(landingClock(2, 0.25));
  });
});

describe('cover', () => {
  /** The one cover the goal's plan composes, at the state handed in. */
  function cover(G: GameState) {
    return explainRaceValue(G, { model: deriveRace(G) }).goals[0].covers[0];
  }

  it('composes the routes a goal no single card finishes needs together', () => {
    const G = planned('race_goal_distinct', ['race_shrine', 'race_kiln'], { production: 6 });
    // Each card caps at the one distinct id it is, so neither route completes the goal and both are
    // deliverable — a scan asking each for two copies of itself drops both and reports no route at all.
    const plan = deriveRace(G).plans[0];
    expect(plan.landings).toHaveLength(2);
    expect(plan.landings.map((l) => l.cap)).toEqual([1, 1]);

    const c = clockOf(G);
    expect(c.route).toBe('cover');
    expect(c.cardId).toBe('race_shrine+race_kiln');
    expect(Number.isFinite(c.t)).toBe(true);
  });

  it('nets the bank against the members\' summed bill rather than against each of them', () => {
    // The half a `min` over routes cannot express: the 🔨 spent on the shrine is not there for the kiln,
    // so a bank covering either alone still leaves the pair to earn.
    const both = cover(planned('race_goal_distinct', ['race_shrine', 'race_kiln'], { production: 6 }));
    const half = cover(planned('race_goal_distinct', ['race_shrine', 'race_kiln'], { production: 4 }));
    // Both prices, plus the slot each structure stands in.
    expect(half.bill).toEqual({ production: 6, territory: 2 });
    expect(half.payment).toBeGreaterThan(both.payment);
  });

  it('reports no route where the run\'s caps cannot reach the target between them', () => {
    // Two copies of one card are still one distinct id. The goal really is unreachable here, and saying so
    // is the correct answer — what it may not do is say it because it costed the wrong plan.
    const G = planned('race_goal_distinct', ['race_shrine', 'race_shrine'], { production: 6 });
    expect(clockOf(G).route).toBe('none');
  });

  /** Two ferries and two barges against a goal wanting four routes: no card of which caps, and no card the
   *  run holds four of — so the copies in circulation are the whole of each route's ceiling. */
  function fleet(deck = ['race_ferry', 'race_ferry', 'race_barge', 'race_barge']) {
    return planned('race_goal_fleet', deck, { production: 20 });
  }

  it('makes the copies a route is spent by its ceiling, where the measure caps nothing', () => {
    // A goal counting a zone's length reads a second copy of a card as a second unit, so nothing about the
    // *measure* bounds either route — and asking each for all four is what leaves a run holding four copies
    // of the two cards with no route to a goal of four.
    const G = fleet();
    const plan = deriveRace(G).plans[0];
    expect(plan.landings.map((l) => l.cardId)).toEqual(['race_ferry', 'race_barge']);
    expect(plan.landings.map((l) => l.cap)).toEqual([undefined, undefined]);

    const goal = explainRaceValue(G, { model: deriveRace(G) }).goals[0];
    expect(goal.reach).toBe(4);
    expect(goal.landings.map((p) => p.copies)).toEqual([2, 2]);
    expect(goal.clock.route).toBe('cover');
    expect(goal.clock.cardId).toBe('race_ferry+race_barge');
    expect(Number.isFinite(goal.clock.t)).toBe(true);
  });

  it('brings an opened route nearer the win than the copy still in the deck', () => {
    // The gradient the whole ceiling exists for: with each route asked for the full four the goal is flat at
    // the horizon, and a beam has no reason to open the first one.
    const held = fleet();
    const opened = fleet();
    openTradeRoute(opened, opened.deck.pop()!);
    expect(valued(opened).goals[0].need).toBe(valued(held).goals[0].need - 1);
    expect(valued(opened).goals[0].t).toBeLessThan(valued(held).goals[0].t);
    expect(valued(opened).total).toBeGreaterThan(valued(held).total);
  });

  it('reports a goal the run holds too few copies for as short, not as one it has no route to', () => {
    // Two routes, four wanted: both cards are live at what they can deal and the goal is unreachable all
    // the same — a fact about the set, which is why no route carries it.
    const G = fleet(['race_ferry', 'race_barge']);
    const goal = explainRaceValue(G, { model: deriveRace(G) }).goals[0];
    expect(goal.reach).toBe(2);
    expect(goal.landings.every((p) => Number.isFinite(p.t))).toBe(true);
    expect(goal.clock.route).toBe('none');
    expect(routeCause(goal)).toBe('copies short');
  });
});

describe('a prerequisite the cost refuses without', () => {
  /** Two relics behind the gate, and — unless `withoutKey` — the one copy of the route that opens it. */
  function gated({ open = false, withoutKey = false } = {}) {
    const deck = ['race_gated_relic', 'race_gated_relic', ...(withoutKey ? [] : ['race_gate_route'])];
    const G = planned('race_goal_gated', deck, { production: 12 });
    if (open) openTradeRoute(G, G.deck.pop()!);
    return G;
  }

  it('plans the card the refusal names, and charges nothing for it once that card stands', () => {
    const closed = gated();
    const model = deriveRace(closed);
    // Kept, not dropped: the gate is a clock the leaf runs, so the route survives the scan carrying it.
    expect(model.plans[0].landings[0]).toMatchObject({
      cardId: 'race_gated_relic', requires: 'race_gate_route',
    });

    const shut = explainRaceValue(closed, { model }).goals[0].landings[0];
    expect(shut.prereq).toMatchObject({ cardId: 'race_gate_route', satisfied: false });
    expect(shut.prereq!.t).toBeGreaterThan(0);
    // Serial, not folded: the play is refused until the route stands, so the two clocks add.
    expect(shut.t).toBeCloseTo(shut.prereq!.t + shut.lands, 10);

    // Valued at the *same* model, which is how every consumer reads it — the plans are derived at the run
    // root, where nothing stands yet, and the leaf is what learns the gate has since been opened.
    const opened = explainRaceValue(gated({ open: true }), { model }).goals[0].landings[0];
    expect(opened.prereq).toMatchObject({ satisfied: true, t: 0 });
    expect(opened.t).toBe(opened.lands);
  });

  it('brings the state that opened the gate nearer the win than the one still holding the key', () => {
    // The gradient the whole term exists for: the route moves no goal measure and its rent only shortens
    // `T̂loss`, so without this a beam is paid never to open it.
    const model = deriveRace(gated());
    const shut = raceBreakdown(gated(), { model });
    const open = raceBreakdown(gated({ open: true }), { model });
    expect(open.goals[0].t).toBeLessThan(shut.goals[0].t);
    expect(open.total).toBeGreaterThan(shut.total);
  });

  it('reports a goal whose gate the run cannot open as unreachable, naming the gate', () => {
    // Both halves of the gated route are perfectly finite here — it is live in everything except being
    // playable, which is exactly the reading `routeCause` would otherwise have no word for.
    const G = gated({ withoutKey: true });
    const goal = explainRaceValue(G, { model: deriveRace(G) }).goals[0];
    expect(Number.isFinite(goal.landings[0].payment)).toBe(true);
    expect(Number.isFinite(goal.landings[0].delivery)).toBe(true);
    expect(goal.clock.route).toBe('none');
    expect(routeCause(goal)).toBe('gate race_gate_route unreachable');
  });
});

describe('delivery', () => {
  it('deals a played copy again where it files back to circulation, and never where it exiles itself', () => {
    // Both grant the goal's pool one unit a play and the run holds one of each, so the whole difference is
    // where `run/moves.ts` files the copy afterwards — which no `CardKind` states and only the play tells.
    const recycled = planned('race_goal', ['race_spark'], { production: 0 });
    const spent = planned('race_goal', ['race_flare'], { production: 0 });
    expect(deriveRace(recycled).plans[0].landings[0]).toMatchObject({ cardId: 'race_spark', recycles: true });
    expect(Number.isFinite(clockOf(recycled).t)).toBe(true);

    // The copy that exiles itself is one unit of the ten and can never be a second, so the route is a real
    // one and the goal is short of nine — where the recycling copy is dealt as often as the clock needs it.
    expect(deriveRace(spent).plans[0].landings[0]).toMatchObject({ cardId: 'race_flare', delta: 1 });
    expect(deriveRace(spent).plans[0].landings[0].recycles).toBeUndefined();
    const spentEx = explainRaceValue(spent, { model: deriveRace(spent) }).goals[0];
    expect(spentEx.reach).toBe(1);
    expect(spentEx.clock.route).toBe('none');
    expect(routeCause(spentEx)).toBe('copies short');
  });

  it('shortens a landing clock as the copies land, not merely as the bank covers them', () => {
    // The gradient the payment term structurally cannot supply: `copies·price − bank` is unchanged by
    // paying for one of those copies, so on a bank that covers the plan outright every finishing play
    // reads as free — a model with no notion that a copy still has to reach a hand.
    const banked = valued(planned('race_goal_count', ['race_relic', 'race_relic', 'race_relic'], { production: 12 }));
    const landed = valued(planned('race_goal_count', ['race_relic', 'race_relic'], { production: 8, removed: ['race_relic'] }));
    expect(banked.goals[0].t).toBeGreaterThan(0);
    expect(landed.goals[0].t).toBeLessThan(banked.goals[0].t);
    expect(landed.total).toBeGreaterThan(banked.total);
  });

  it('deals a copy from anywhere in circulation, and none at all from nowhere', () => {
    // A copy the run still circulates is dealt whichever pile it is resting in; a copy the run has lost
    // is dealt from nowhere, and on a plan that spends its copies by landing them the whole plan goes
    // with it.
    const held = planned('race_goal_count', ['race_relic', 'race_relic', 'race_relic'], { production: 12 });
    const shuffled = planned('race_goal_count', ['race_relic', 'race_relic', 'race_relic'], { production: 12 });
    shuffled.discard.push(shuffled.deck.pop()!);
    shuffled.hand.push(shuffled.deck.pop()!);
    expect(valued(shuffled).goals[0].t).toBeCloseTo(valued(held).goals[0].t);

    const short = valued(planned('race_goal_count', ['race_relic', 'race_relic'], { production: 12 }));
    expect(short.goals[0].route).toBe('none');
    expect(short.total).toBeLessThan(valued(held).total);
  });

  it('shortens a clock when a card genuinely leaves circulation', () => {
    // The thinning that is real: a copy exiled from the run is one the deck will never deal again, so
    // every remaining draw is likelier to be a plan copy. The bank covers all three relics either way,
    // which leaves the pile the only thing between the two states.
    const pile = (deck: string[], removed: string[]) =>
      valued(planned('race_goal_count', deck, { production: 12, removed }));
    const circulating = pile(['race_relic', 'race_relic', 'race_relic', 'test_prod', 'test_prod', 'test_prod'], []);
    const thinned = pile(['race_relic', 'race_relic', 'race_relic', 'test_prod', 'test_prod'], ['test_prod']);
    expect(thinned.goals[0].t).toBeLessThan(circulating.goals[0].t);
    expect(thinned.total).toBeGreaterThan(circulating.total);
  });

  it('charges a structure plan for the land it must stand on', () => {
    // A full board is a price like any other, and the only thing that pays it is land the run does not
    // have yet. Without the slot in the price the clock is flat over the very play that unblocks the
    // board — a box minting territory only ever *costs* on every axis the plan does price.
    const board = (territory: number) =>
      valued(planned('race_goal_pop', ['race_hut', 'race_claim'], { production: 4, territory }));
    const full = board(1); // the one standing producer fills the board
    const room = board(2);
    expect(full.goals[0].t).toBeGreaterThan(room.goals[0].t);
    expect(room.total).toBeGreaterThan(full.total);
  });
});

describe('payment', () => {
  /**
   * A run whose plan is three 4🔨 relics and whose only 🔨 income is the `standing` copies of `test_prod`
   * in its tableau. A copy of the producer rides in the deck either way, so the pool has a worker-round
   * price and the circulation is the same multiset whether one stands or not — which leaves the income
   * as the only difference between two of these.
   */
  function earning({ standing = 0, staffed = true, population = 2 } = {}) {
    const G = blankState('race_test');
    G.round = 1;
    G.resources.food = 10_000;
    G.resources.population = population;
    G.resources.territory = 6;
    seedObjective(G, 'race_goal_count');
    G.deck.push(mint(G, 'test_prod'));
    for (let i = 0; i < 3; i++) G.deck.push(mint(G, 'race_relic'));
    for (let i = 0; i < standing; i++) {
      const placed = addBuilding(G, mint(G, 'test_prod'));
      if (!staffed) placed.workers = 0;
    }
    return G;
  }

  /** The one route this plan has, with the two clocks inside it. */
  function route(G: GameState) {
    return explainRaceValue(G, { model: deriveRace(G) }).goals[0].landings[0];
  }

  it('pays a price out of the income the board really has', () => {
    // 12🔨 at half a worker-round each is 6 wr owed. A staffed producer settles 1 of them at the coming
    // boundary and the two citizens earn the rest from the boundary after; with nothing standing, every
    // one of the 6 waits on that redeployment. The pool is one no goal measures, so this clock is the
    // only place the producer can register at all.
    const idle = route(earning());
    const producing = route(earning({ standing: 1 }));
    expect(idle.realized).toBe(0);
    expect(idle.payment).toBeCloseTo(1 + 6 / 2);
    expect(producing.realized).toBeCloseTo(1);
    expect(producing.payment).toBeCloseTo(1 + 5 / 2);
  });

  it('improves the race by staffing a producer that is already standing', () => {
    // The anchor, synthetically: the box stands, a citizen is free, and the goal reads nothing the box
    // makes. Under a clock divided by the raw workforce the two states are worth exactly the same, so a
    // policy taking strict improvements never puts the citizen to work.
    const unstaffed = earning({ standing: 1, staffed: false });
    const staffed = earning({ standing: 1 });
    expect(route(staffed).payment).toBeLessThan(route(unstaffed).payment);
    expect(valued(staffed).goals[0].t).toBeLessThan(valued(unstaffed).goals[0].t);
    expect(valued(staffed).total).toBeGreaterThan(valued(unstaffed).total);
  });

  it('keeps a plan the run has no income for, at a clock it can still read', () => {
    // The other half of the same decision: a run whose board feeds none of a plan's pools is a run that
    // has yet to deploy its people, not one with no plan. Charging it the workforce a boundary later is
    // what keeps the clock finite there — an infinite one would read every such goal as unreachable and
    // leave the value flat over the whole line that fixes it.
    const G = earning();
    expect(deriveRace(G).plans[0].landings.map((p) => p.cardId)).toEqual(['race_relic']);
    expect(clockOf(G).route).toBe('landing');
    expect(Number.isFinite(route(G).payment)).toBe(true);
  });

  it('reads the income of the state it is valuing, not of the root it was derived at', () => {
    // The plans are root-derived and the income is not: a producer staffed twenty rounds in has to shorten
    // the clock of the leaf that staffed it, or the search is ranking states by a rate none of them has.
    const root = earning();
    const model = deriveRace(root);
    const later = earning({ standing: 1 });
    expect(raceBreakdown(later, { model }).goals[0].t).toBeLessThan(raceBreakdown(root, { model }).goals[0].t);
  });
});

describe('price', () => {
  /** The one route the goal's plan has, at the state handed in. */
  function route(G: GameState) {
    return explainRaceValue(G, { model: deriveRace(G) }).goals[0].landings[0];
  }

  /** One toll copy per entry, each already played that many times. */
  function tolled(plays: number[], { production = 0 } = {}) {
    const G = planned('race_goal_toll', plays.map(() => 'race_toll'), { production });
    G.deck.forEach((c, i) => setCounter(c, 'plays', plays[i]));
    return G;
  }

  it('quotes a route at what a play costs now, not at the price it was printed with', () => {
    // A card whose cost climbs with its own use is a different price every time the run pays it, and a plan
    // reading the catalogue keeps calling the route cheap long after the run has made it expensive.
    const fresh = tolled([0, 0, 0]);
    const used = tolled([1, 1, 1]);
    expect(route(fresh).price).toEqual({ production: 4 });
    expect(route(used).price).toEqual({ production: 8 });
    expect(route(used).payment).toBeGreaterThan(route(fresh).payment);
    expect(valued(used).total).toBeLessThan(valued(fresh).total);
  });

  it('prices the copy a play would really be made with', () => {
    // The run spends its least-played copy next, so a copy it has already run three times charges nobody —
    // and the quote climbs only once every copy has been used, which is also what keeps it monotone over the
    // plan's own progress.
    expect(route(tolled([0, 3, 3])).price).toEqual({ production: 4 });
    expect(route(tolled([2, 3, 3])).price).toEqual({ production: 16 });
  });

  it('leaves a card whose price does not scale exactly where it was', () => {
    // The other half of the same reading: a cost with nothing to resolve is its declarative self, so a
    // counter no price consults must not move a single clock.
    const deck = ['race_relic', 'race_relic', 'race_relic'];
    const plain = planned('race_goal_count', deck, { production: 4 });
    const bumped = planned('race_goal_count', deck, { production: 4 });
    setCounter(bumped.deck[1], 'plays', 5);
    expect(route(bumped).price).toEqual({ production: 4 });
    expect(valued(bumped)).toEqual(valued(plain));
  });

  it('folds the copy\'s own stickers into what its route charges', () => {
    // `currentCost`'s other half, and the reason the price is read through it rather than off the card: a
    // sticker moves the price of the copy carrying it, so a plan quoting the catalogue charges a discount
    // the run bought or misses a surcharge it is paying.
    const G = planned('race_goal_count', ['race_relic', 'race_relic', 'race_relic'], { production: 4 });
    G.deck[0].stickers = ['test_costcut'];
    expect(route(G).price).toEqual({ production: 3 });
  });

  it('ranks the root\'s routes at the prices the root really pays', () => {
    // The toll is the cheaper card as printed (4🔨 against the trinket's 6) and the dearer one once every
    // copy has been played once. A root ranking off the catalogue plans the goal through the route the run
    // has already priced itself out of.
    const deck = [...Array<string>(3).fill('race_toll'), ...Array<string>(3).fill('race_trinket')];
    const fresh = planned('race_goal_toll', deck);
    expect(deriveRace(fresh).plans[0].landings.map((p) => p.cardId)).toEqual(['race_toll', 'race_trinket']);

    const used = planned('race_goal_toll', deck);
    for (const c of used.deck) if (c.cardId === 'race_toll') setCounter(c, 'plays', 1);
    expect(deriveRace(used).plans[0].landings.map((p) => p.cardId)).toEqual(['race_trinket', 'race_toll']);
    const toll = explainRaceModel(used).goals[0].candidates.find((c) => c.cardId === 'race_toll');
    expect(toll?.price).toEqual({ production: 8 });
  });

  it('is unmoved by which pile the copy it prices against is resting in', () => {
    // The price is the cheapest copy the run *circulates*, and circulation is one pile — so a model reading
    // the hand instead would quote two prices for the same run as the deck turns over, exactly the flicker a
    // delivery clock counted over three zones would have.
    const parked = (zone: 'deck' | 'hand' | 'discard') => {
      const G = tolled([3, 0, 3], { production: 20 });
      G[zone].push(G.deck.splice(G.deck.findIndex((c) => getCounter(c, 'plays') === 0), 1)[0]);
      return valued(G);
    };
    const base = parked('deck');
    for (const zone of ['hand', 'discard'] as const) expect(parked(zone), zone).toEqual(base);
    // …and the copy really is what the plan is priced at: with it played out too, the route costs eight
    // times as much.
    expect(base.goals[0].t).toBeLessThan(valued(tolled([3, 3, 3], { production: 20 })).goals[0].t);
  });
});

describe('circulation', () => {
  /**
   * The same run with one copy parked in a different zone. The population is spent on the standing
   * producer, so a box played here staffs nobody and puts nothing in flight — which leaves *where the
   * copy sits* as the only difference between the four states. The deck holds one card the plan doesn't
   * read, so a copy leaving the pile would move the plan's share of it if anything did.
   */
  function parked(cardId: string, zone: 'deck' | 'hand' | 'discard' | 'work') {
    const G = planned('race_goal_land', ['race_claim', 'race_claim', 'test_work'], { territory: 0 });
    const [copy] = G.deck.splice(G.deck.findIndex((c) => c.cardId === cardId), 1);
    if (zone === 'work') addWork(G, copy);
    else G[zone].push(copy);
    return valued(G);
  }

  it('is unmoved by a copy changing zones within a turn', () => {
    // Hand, discard, deck and work zone are one pile as far as future draws go: the boundary files the
    // work box and recycles the hand, so nothing about the deck's delivery rate has changed. A model
    // that counted three of the four would score every play by how many cards it shifted.
    for (const cardId of ['race_claim', 'test_work']) {
      const base = parked(cardId, 'deck');
      for (const zone of ['hand', 'discard', 'work'] as const) {
        const b = parked(cardId, zone);
        expect(b.goals, `${cardId} in ${zone}`).toEqual(base.goals);
        expect(b.total, `${cardId} in ${zone}`).toBe(base.total);
      }
    }
  });

  it('prefers landing the plan\'s own copy to landing another card that recycles', () => {
    // The inversion a three-zone count produces: playing the one card the plan runs on takes it out of
    // the counted pile, so the plan's share of a draw *falls* by the play — and the model prices the
    // right move below both the wrong one and doing nothing at all. Six cards the plan doesn't read are
    // what give that share room to move.
    const played = (cardId?: string) => {
      const deck = [...Array<string>(6).fill('test_work'), 'race_claim', 'race_claim'];
      const G = planned('race_goal_land', deck, { territory: 0, population: 3 });
      if (cardId) addWork(G, G.deck.splice(G.deck.findIndex((c) => c.cardId === cardId), 1)[0]);
      return valued(G);
    };
    const onPlan = played('race_claim');
    expect(onPlan.total).toBeGreaterThan(played('test_work').total);
    expect(onPlan.total).toBeGreaterThan(played().total);
  });
});

describe('work boxes', () => {
  it('routes a goal only a box feeds through its once-per-play output', () => {
    // The hole a goal fed by nothing else falls into: no standing card moves 🗺️, so τ is zero and there
    // is no producer to build — without the box's own output the clock sits at the horizon and the value
    // is flat over every play that approaches the win. One copy against three units is finite because a
    // box files back to the discard: it is dealt again, unlike a copy spent by landing.
    const G = planned('race_goal_land', ['race_claim'], { territory: 0 });
    const plan = deriveRace(G).plans[0];
    expect(plan.buildings).toEqual([]);
    expect(plan.landings).toHaveLength(1);
    expect(plan.landings[0]).toMatchObject({ cardId: 'race_claim', delta: 1, recycles: true });
    const c = clockOf(G);
    expect(c.route).toBe('landing');
    expect(Number.isFinite(c.t)).toBe(true);
  });

  it('charges the citizen who runs the box, not only the pools it costs', () => {
    // The box is free of every pool, so the staffing is the whole of what it charges: without it this
    // plan is priced at nothing and its payment clock is flat over the workforce that pays it.
    const G = planned('race_goal_land', ['race_claim'], { territory: 0 });
    const plan = deriveRace(G).plans[0].landings[0];
    expect(explainRaceValue(G, { model: deriveRace(G) }).goals[0].landings[0].price).toEqual({});
    expect(plan.workerRounds).toBeGreaterThan(0);
    const crowd = planned('race_goal_land', ['race_claim'], { territory: 0, population: 3 });
    expect(clockOf(crowd).t).toBeLessThan(clockOf(G).t);
  });

  /** A run whose only route to 🗺️ is a work box, beside one producer in the tableau — so `population`
   *  decides whether anybody is left over to run the box. Food is deep enough that nothing here is a
   *  survival reading. */
  function boxRoute(population: number) {
    return planned('race_goal_land', ['race_claim', 'race_claim', 'race_claim'], {
      territory: 0, population, food: 10_000,
    });
  }

  /** The one route the goal's plan has, at the state handed in. */
  function route(G: GameState) {
    return explainRaceValue(G, { model: deriveRace(G) }).goals[0].landings[0];
  }

  it('lands at the deck\'s own rate while a citizen is free', () => {
    // The state with slack is the one the wait must not touch: the fold is the draw clock and the price,
    // the same expression as on a route that stands nobody at all.
    const free = route(boxRoute(2));
    expect(free.staffing).toBe(0);
    expect(free.lands).toBe(landingClock(free.payment, free.delivery));

    // And a landing that stands nobody waits for nobody, however committed the run's people are: the hut's
    // citizens arrive with the purchase, so there is no box for anyone to run.
    const grant = route(planned('race_goal_pop', ['race_hut', 'race_hut'], { production: 8, food: 10_000 }));
    expect(grant.staffing).toBe(0);
    expect(grant.lands).toBe(landingClock(grant.payment, grant.delivery));
  });

  it('waits a redeployment boundary when every citizen is committed', () => {
    // A box produces nothing unstaffed, so a run whose whole workforce is standing in the tableau does not
    // land at the rate the deck deals it. The wait is a boundary and not a verdict: the citizen is one move
    // and a turn from the box, and an infinite clock would derive the goal out of existence.
    const busy = route(boxRoute(1));
    expect(busy.staffing).toBe(1);
    expect(busy.lands).toBe(landingClock(busy.payment, busy.delivery + 1));
    expect(busy.lands).toBeGreaterThan(landingClock(busy.payment, busy.delivery));
    expect(Number.isFinite(busy.lands)).toBe(true);

    // With nobody to redeploy there is no route at all — which the workforce gate already answers, the
    // wait never surfacing as a clock a leaf reads.
    const empty = explainRaceValue(boxRoute(0), { model: deriveRace(boxRoute(0)) }).goals[0];
    expect(empty.clock.route).toBe('none');
    expect(routeCause(empty)).toBe('no workforce');
  });

  it('is worth freeing a citizen for', () => {
    // The mirror, and the anchor action: the same person, in the tableau or idle. The box charges no pool,
    // so the producer's output pays nothing toward the plan and the payment halves are identical — every
    // bit of the difference is the wait, which is what makes a citizen an asset to the goal rather than
    // only the food it eats.
    const committed = boxRoute(1);
    const idle = boxRoute(1);
    idle.tableau[0].workers = 0;
    expect(route(committed).staffing).toBe(1);
    expect(route(idle).staffing).toBe(0);
    expect(route(idle).payment).toBe(route(committed).payment);
    expect(valued(idle).goals[0].t).toBeLessThan(valued(committed).goals[0].t);
    expect(valued(idle).total).toBeGreaterThan(valued(committed).total);
  });

  it('brings a staffed box nearer the win than the copy still in the deck', () => {
    const idle = planned('race_goal_land', ['race_claim', 'race_claim'], { territory: 0, population: 2 });
    const played = planned('race_goal_land', ['race_claim', 'race_claim'], { territory: 0, population: 2 });
    addWork(played, played.deck.pop()!);
    expect(valued(played).goals[0].need).toBe(valued(idle).goals[0].need - 1);
    expect(valued(played).total).toBeGreaterThan(valued(idle).total);
  });
});

describe('deadline honesty', () => {
  it('credits a producer nothing when it cannot repay before the run is cut off', () => {
    const idle = state('race_goal');
    const staffed = state('race_goal', { producers: 1 });
    // 10🔬 at 2🔬 a round is 5 rounds; with 3 left, the producer buys nothing the run will ever collect.
    expect(raceScore(staffed, { maxRounds: 3 })).toBeCloseTo(raceScore(idle, { maxRounds: 3 }), 10);
    // The same producer against a horizon it fits inside is worth the rounds it saves.
    expect(raceScore(staffed, { maxRounds: 50 })).toBeGreaterThan(raceScore(idle, { maxRounds: 50 }));
  });
});

describe('T̂loss', () => {
  it('names the pool that runs out first', () => {
    const G = state('race_goal', { food: 7, population: 4 }); // 4🧍 eat 4🌾 a round
    const b = raceBreakdown(G);
    expect(b.lossCause).toBe('food');
    expect(b.tLoss).toBeCloseTo(7 / 4);
  });

  it('steepens the same losing margin as death draws nearer', () => {
    // Both races are 4 rounds short: 6 vs 2, and 24 vs 20. A drain of 2🌾 sets each loss clock.
    const near = state('race_goal_12', { food: 4, producers: 1 });
    const far = state('race_goal_48', { food: 40, producers: 1 });
    for (const G of [near, far]) G.threats.push(mint(G, 'test_threat'));
    const a = raceBreakdown(near);
    const b = raceBreakdown(far);
    expect(a.tLoss).toBeCloseTo(2);
    expect(b.tLoss).toBeCloseTo(20);
    expect(a.margin).toBeCloseTo(b.margin);
    expect(a.nearDeath).toBeLessThan(b.nearDeath);
    expect(a.total).toBeLessThan(b.total);
  });

  it('reads an unplayed event\'s disaster as the drain it keeps taking', () => {
    // `test_event` takes 2⚔️ at every boundary it is left in hand for, and files to the discard the deck
    // deals it back from — so it is a rate, and the permanent economy having no military drain of its
    // own makes it the whole of the clock.
    const doomed = state('race_goal', { military: 5 });
    doomed.hand.push(mint(doomed, 'test_event'));
    const b = raceBreakdown(doomed);
    expect(b.lossCause).toBe('military');
    expect(b.tLoss).toBeCloseTo(2.5);

    // A hand card that is no event drains nothing and files itself away, so the projection drops it.
    const idle = state('race_goal', { military: 5 });
    idle.hand.push(mint(idle, 'race_relic'));
    expect(raceBreakdown(idle).lossCause).toBe('horizon');
  });

  it('settles a held event whose drain is a closure, and deepens with it', () => {
    // The pressure whole missions are built on, and the one no declarative read can reach: the amount is
    // computed from a counter the card bumps itself, so a projection that drops the hand — or reads only
    // the printed bag — sees a run in perfect health right up to the round it collapses.
    const clear = state('race_goal', { science: 12 });
    expect(raceBreakdown(clear).lossCause).toBe('horizon');

    // 12🔬 against a drain of 1 deepening by 1 a resolution, at a share of 1: the clock is not 12 rounds
    // but the root of `12 = t + t²/2`, which is 4 — the runway a flat reading of today's level promises
    // and the run will not get.
    const blighted = state('race_goal', { science: 12 });
    blighted.hand.push(mint(blighted, 'race_blight'));
    const fresh = raceBreakdown(blighted);
    expect(fresh.lossCause).toBe('science');
    expect(fresh.tLoss).toBeCloseTo(4);

    // A copy that has already come round three times starts at 4 and deepens from there.
    const worn = state('race_goal', { science: 12 });
    const copy = mint(worn, 'race_blight');
    setCounter(copy, 'level', 3);
    worn.hand.push(copy);
    expect(raceBreakdown(worn).tLoss).toBeCloseTo(Math.sqrt(40) - 4);
    // …and the projection that read it left the counter where it found it.
    expect(getCounter(copy, 'level')).toBe(3);
  });

  it('tells a shallow collapse from a deep one at an empty pool', () => {
    // `level / drain` is zero at an empty pool whatever the drain, so the clock alone reads a boundary
    // about to take four exactly as it reads one about to take one — and the play that quadruples the
    // burn costs nothing. What separates them is the depth of the boundary, which is not a time.
    const shallow = state('race_goal_12', { food: 0, population: 2, producers: 1 }); // 2🧍 eat 1🌾
    const deep = state('race_goal_12', { food: 0, population: 4, producers: 1 }); // 4🧍 eat 4🌾
    expect(raceBreakdown(shallow).tLoss).toBe(0);
    expect(raceBreakdown(deep).tLoss).toBe(0);
    expect(raceBreakdown(deep).nearDeath).toBeLessThan(raceBreakdown(shallow).nearDeath);
  });

  it('says nothing about a pool that survives the coming boundary', () => {
    // The term is confined to the states it exists for: a pool with a round of runway is short of
    // nothing, so every reading a round or more from collapse is exactly what it always was.
    const G = state('race_goal_12', { food: 4, population: 2, producers: 1 });
    const ex = explainRaceValue(G, { model: deriveRace(G) });
    expect(ex.pools.every((p) => p.shortfall === undefined)).toBe(true);
    expect(ex.breakdown.nearDeath).toBeCloseTo(
      (-RACE.nearDeathSteepness * Math.max(0, ex.breakdown.tWin - ex.breakdown.tLoss)) / (1 + ex.breakdown.tLoss),
      12,
    );
  });

  it('reads a pending defeat as no rounds left at all', () => {
    const G = state('race_goal', { producers: 1 });
    G.pendingDefeat = { reason: 'test' };
    const b = raceBreakdown(G);
    expect(b.tLoss).toBe(0);
    expect(b.lossCause).toBe('defeat');
  });
});

describe('the slack cap', () => {
  /** A race with a chosen death clock: `test_threat` takes 2🌾 a round and a population of one eats
   *  nothing, so the food bank stands for the rounds. The money saturates the wealth tie-break at every
   *  one of them, so two states below differ in the race and in nothing else. */
  const dying = (rounds: number, objectiveCardId = 'race_goal') => {
    const G = state(objectiveCardId, { producers: 1, food: 2 * rounds, money: 2 * RACE.wealthCap });
    G.threats.push(mint(G, 'test_threat'));
    return raceBreakdown(G);
  };

  it('leaves a death clock nearer than the cap exactly where it was', () => {
    // Below the cap the term is inert, which is what keeps every fire-fighting reading the model already
    // had: the margin is the subtraction it always was, to the bit.
    const b = dying(RACE.slackCap - 5);
    expect(b.tLoss).toBeCloseTo(RACE.slackCap - 5);
    expect(b.slack).toBe(b.tLoss);
    expect(b.margin).toBe(b.tLoss - b.tWin);
  });

  it('stops paying for runway the run cannot spend', () => {
    const on = dying(RACE.slackCap);
    expect(dying(RACE.slackCap + 1).total).toBe(on.total);
    expect(dying(RACE.slackCap * 3).total).toBe(on.total);
  });

  it('meets the cap without a step', () => {
    // One kink and no jump: the last round of runway under the cap is worth exactly the round it is.
    expect(dying(RACE.slackCap).total - dying(RACE.slackCap - 1).total).toBeCloseTo(1, 10);
  });

  it('keeps a whole round of pull on the win clock past the cap', () => {
    // Which is the whole point of capping at a number of rounds rather than at a multiple of the win: in
    // the flat region the only thing left to tell two states apart is the race they are running, and a
    // round off it is worth a round.
    const empty = raceBreakdown(state('race_goal', { producers: 1 }));
    const banked = raceBreakdown(state('race_goal', { science: 2, producers: 1 }));
    expect(empty.tLoss).toBeGreaterThan(RACE.slackCap);
    expect(banked.slack).toBe(empty.slack);
    expect(banked.total - empty.total).toBeCloseTo(empty.tWin - banked.tWin, 10);
  });

  it('reads the bare death clock for the near-death cliff', () => {
    // A cap on what runway is *worth* is not a claim about where death is: the cliff steepens off the
    // clock the run really has, past the cap as under it.
    const b = dying(RACE.slackCap + 5, 'race_goal_100');
    expect(b.tWin).toBeGreaterThan(b.tLoss);
    expect(b.tLoss).toBeGreaterThan(b.slack);
    expect(b.nearDeath).toBeCloseTo((-RACE.nearDeathSteepness * (b.tWin - b.tLoss)) / (1 + b.tLoss), 10);
  });
});

describe('the rescue-pending charge', () => {
  /** A run whose food is the pool under pressure: two citizens eat one a round, so the clock is the bank,
   *  and only what the deck holds can end it. One staffed `test_prod` gives 🔨 a worker-round price and
   *  leaves a citizen idle, so nothing here waits on staffing. The goal is over 🔬, which nothing in the
   *  state moves — every reading below is about the loss side alone. */
  const starving = (
    deck: string[],
    { food = 10, production = 0, territory = 6, standing = [] as string[] } = {},
  ): GameState => {
    const G = blankState('race_test');
    G.round = 1;
    G.resources.food = food;
    G.resources.production = production;
    G.resources.population = 2;
    G.resources.territory = territory;
    seedObjective(G, 'race_goal');
    addBuilding(G, mint(G, 'test_prod'));
    for (const id of standing) addBuilding(G, mint(G, id));
    for (const id of deck) G.deck.push(mint(G, id));
    return G;
  };

  const foodPool = (G: GameState) => explainRaceValue(G, { model: deriveRace(G) }).pools.find((p) => p.key === 'food')!;

  it('charges a threatened pool for a rescue the run has not made', () => {
    // The blind spot proper: a run one purchase from ending its famine ranked every action it had at the
    // same number, because a runway is a rate and a rate says nothing about the purchase that changes it.
    expect(valued(starving(['test_food'])).rescue).toBeLessThan(0);
    expect(valued(starving(['race_relic'])).rescue).toBe(0);
  });

  it('takes nothing off the clock it charges for', () => {
    // The whole difference from crediting a reachable rescue: the pool's runway is what it always was, so
    // the pressure that performs the rescue is still there to perform it.
    expect(foodPool(starving(['test_food'])).t).toBe(foodPool(starving(['race_relic'])).t);
  });

  it('vanishes once the rescue is standing and fed', () => {
    // Executing it flips the projection through the ordinary drain reading, which takes the pool out of
    // the charge's reach entirely — and holding the same card is strictly worse than having played it.
    const held = starving(['test_food']);
    const stood = starving([], { standing: ['test_food'] });
    expect(foodPool(stood).t).toBe(Infinity);
    expect(valued(stood).rescue).toBe(0);
    expect(valued(held).rescue).toBeLessThan(valued(stood).rescue);
  });

  it('falls as the run banks toward the price', () => {
    // The gradient that was missing below the unit that made the purchase legal: a bank part-way to the
    // route shortens its payment clock, so saving for a rescue is worth something before it is affordable.
    const poor = valued(starving(['test_food'])).rescue;
    const rich = valued(starving(['test_food'], { production: 2 })).rescue;
    expect(rich).toBeGreaterThan(poor);
    expect(rich).toBeLessThan(0);
  });

  it('counts the slot a structural rescue needs as part of its price', () => {
    // Slot economics with no term of their own: a full board leaves the route owing land, which
    // `outstanding` converts through territory's own rate — so the play that opens a slot registers here.
    const deck = ['test_food', 'race_claim'];
    const full = valued(starving(deck, { territory: 1, production: 2 })).rescue;
    const room = valued(starving(deck, { territory: 2, production: 2 })).rescue;
    expect(room).toBeGreaterThan(full);
  });

  it('says nothing about a pool with more runway than the margin can express', () => {
    // Urgency reaches zero at the same cap the margin stops paying for runway, which is also what keeps
    // the routes off the beam's leaf on every state that is not in trouble.
    expect(valued(starving(['test_food'], { food: RACE.slackCap })).rescue).toBe(0);
    expect(valued(starving(['test_food'], { food: RACE.slackCap - 1 })).rescue).toBeLessThan(0);
  });

  it('stops charging for a rescue too far off to be one', () => {
    // A ceiling rather than an unbounded distance: a route the deck deals once a dozen rounds is no more
    // actionable than one it never deals, and an uncapped charge would swamp the race it rides on.
    const diluted = starving(['test_food', ...Array<string>(80).fill('race_relic')], { production: 2 });
    const rescue = foodPool(diluted).rescue!;
    expect(rescue.lands).toBeGreaterThan(RACE.rescueRounds);
    expect(rescue.penalty).toBeCloseTo(rescue.urgency * RACE.rescueRounds, 12);
  });

  it('reaches a pool through the event that drains it', () => {
    // The defusal half: nothing *produces* ⚔️ here, so the only way off the drain is exiling the copy that
    // deals it — a route the producer scan alone would report as no route at all.
    const G = state('race_goal', { military: 4, producers: 1 });
    G.hand.push(mint(G, 'test_event'));
    for (let i = 0; i < 4; i++) G.deck.push(mint(G, 'race_relic'));
    const model = deriveRace(G);
    expect(model.rescues.military?.map((r) => [r.kind, r.cardId])).toEqual([['defusal', 'test_event']]);
    expect(raceBreakdown(G, { model }).rescue).toBeLessThan(0);
  });
});

describe('a rescue route weighed on one copy', () => {
  /** The food scan's `test_food` reading at a run circulating exactly the copies named — one entry per
   *  copy, holding the stickers it carries. A staffed `test_prod` gives 🔨 its worker-round rate, which is
   *  what lets the scan price anything at all. */
  const weighed = (...copies: (string[] | undefined)[]) => {
    const G = blankState('race_test');
    G.round = 1;
    G.resources.food = 10;
    G.resources.population = 2;
    G.resources.territory = 6;
    seedObjective(G, 'race_goal');
    addBuilding(G, mint(G, 'test_prod'));
    for (const stickers of copies) G.deck.push(mint(G, 'test_food', stickers));
    return explainRaceModel(G)
      .rescues.find((r) => r.key === 'food')!
      .candidates.find((c) => c.cardId === 'test_food')!;
  };

  // Read through a call rather than a const: the shared fixtures are spliced into `CARDS` by the suite's
  // `beforeAll`, which runs after a describe body.
  const printed = () => CARDS.test_food.produces!.resources!;
  const printedPrice = () => CARDS.test_food.cost.resources!.production!;

  it('rates a stickered copy at what that copy really yields', () => {
    const c = weighed(['test_restricted']);
    expect(c.delta).toBe(effectiveGain(printed(), { stickers: ['test_restricted'] })!.food);
    expect(c.delta).toBeGreaterThan(printed().food!);
  });

  it('takes the rate and the price off the same copy', () => {
    // The incoherence this pins: the scan picks the copy a play would really be made with, and a deck
    // holding a cheaper bare copy beside a dearer stickered one must not quote the first's price against
    // the second's output. Whichever copy wins the pricing, both readings are that copy's.
    const c = weighed(['test_restricted'], ['test_costcut']);
    expect(c.price.production).toBe(printedPrice() - 1);
    expect(c.delta).toBe(printed().food);
  });

  it('falls back to the printed bag where the run circulates no copy', () => {
    // A copy standing on the board is not a copy the run can deal, so there is no instance to fold
    // against and the catalogue rate is the only one there is.
    const G = blankState('race_test');
    G.round = 1;
    G.resources.food = 10;
    G.resources.population = 2;
    G.resources.territory = 6;
    seedObjective(G, 'race_goal');
    addBuilding(G, mint(G, 'test_prod'));
    addBuilding(G, mint(G, 'test_food', ['test_restricted']));
    const c = explainRaceModel(G)
      .rescues.find((r) => r.key === 'food')!
      .candidates.find((x) => x.cardId === 'test_food')!;
    expect(c.delta).toBe(printed().food);
  });
});

describe('a goal route weighed on one copy', () => {
  /** The `race_goal` scan's candidate for `cardId`, at a run circulating exactly the copies named. A
   *  staffed `test_prod` gives 🔨 its worker-round rate, which is what lets the scan price anything. */
  const weighed = (cardId: string, ...copies: (string[] | undefined)[]) => {
    const G = blankState('race_test');
    G.round = 1;
    G.resources.food = 10;
    G.resources.population = 2;
    G.resources.territory = 6;
    seedObjective(G, 'race_goal');
    addBuilding(G, mint(G, 'test_prod'));
    for (const stickers of copies) G.deck.push(mint(G, cardId, stickers));
    return explainRaceModel(G).goals[0].candidates.find((c) => c.cardId === cardId)!;
  };

  /** What the goal's own pool reads at, off the same fold a play would take. */
  const science = (cardId: string, field: 'produces' | 'effect', stickers?: string[]) => {
    const base = CARDS[cardId][field]!.resources!;
    return (stickers ? effectiveGain(base, { stickers })! : base).science;
  };

  it('reads a producer route off the stickered copy', () => {
    expect(weighed('test_sci', ['test_addgain']).tau).toBe(science('test_sci', 'produces', ['test_addgain']));
    expect(weighed('test_sci', undefined).tau).toBe(science('test_sci', 'produces'));
  });

  it('reads a landing route off the stickered copy, whichever field carries it', () => {
    expect(weighed('race_work_sci', ['test_addgain']).delta).toBe(
      science('race_work_sci', 'produces', ['test_addgain']),
    );
    expect(weighed('test_action', ['test_addgain']).delta).toBe(science('test_action', 'effect', ['test_addgain']));
  });
});

describe('recurring events', () => {
  /** A run whose circulation is `filler` cards no goal reads plus `events` copies of `test_event` resting
   *  in `zone`, and `defused` more the run has played away. Nothing else drains ⚔️, so the event's rate
   *  is the whole death clock. */
  function circulating({
    zone = 'deck' as 'deck' | 'hand' | 'discard',
    events = 1,
    filler = 0,
    defused = 0,
  } = {}) {
    const G = state('race_goal', { military: 5 });
    for (let i = 0; i < filler; i++) G.deck.push(mint(G, 'race_relic'));
    for (let i = 0; i < events; i++) G[zone].push(mint(G, 'test_event'));
    for (let i = 0; i < defused; i++) G.removed.push(mint(G, 'test_event'));
    return G;
  }

  /** One pool's death-clock rate, beside the census the events reaching it were charged over. */
  function drains(G: GameState) {
    const ex = explainRaceValue(G, { model: deriveRace(G) });
    return { drain: ex.pools.find((p) => p.key === 'military')!.drain, census: ex.events! };
  }

  it('charges a copy the deck still circulates, wherever it is resting', () => {
    // The reading a presence test cannot give: the copy is in the discard, so it takes nothing at *this*
    // boundary and the pool it empties would read as unreachable — right up to the turn it is redealt.
    const G = circulating({ zone: 'discard', filler: 9 });
    const { drain, census } = drains(G);
    expect(census).toMatchObject({ copies: 1, pool: 10 });
    expect(drain).toBeCloseTo(census.share * 2);
    const b = raceBreakdown(G);
    expect(b.lossCause).toBe('military');
    expect(Number.isFinite(b.tLoss)).toBe(true);
  });

  it('reads the same clock wherever in circulation the copy sits', () => {
    // Hand, discard and deck are one pile as far as future boundaries go, exactly as they are for a
    // delivery clock. A rate that moved with the shuffle would flicker between the drain and none at all.
    const base = raceBreakdown(circulating({ zone: 'deck', filler: 9 }));
    for (const zone of ['hand', 'discard'] as const) {
      expect(raceBreakdown(circulating({ zone, filler: 9 })).tLoss, zone).toBeCloseTo(base.tLoss, 12);
    }
  });

  it('charges nothing for a copy the run has played away', () => {
    const held = raceBreakdown(circulating({ filler: 9 }));
    const defused = raceBreakdown(circulating({ events: 0, filler: 9, defused: 1 }));
    expect(held.lossCause).toBe('military');
    expect(defused.lossCause).toBe('horizon');
  });

  it('drains twice as fast for a second copy in the same pile', () => {
    // The filler makes up the difference, so both runs circulate the same number of cards and a copy is
    // dealt at the same share either way — leaving how many of them there are as the only difference.
    const one = drains(circulating({ filler: 10 }));
    const two = drains(circulating({ events: 2, filler: 9 }));
    expect(two.census.share).toBe(one.census.share);
    expect(two.drain).toBeCloseTo(2 * one.drain);
  });

  it('never charges past what the boundary really takes', () => {
    // A pile no deeper than the hand deals every copy every turn, so the rate is the whole drain and no
    // more. The equality is also what says the two projections differ by the events and by nothing else.
    const G = circulating({ events: 2 });
    const { drain, census } = drains(G);
    expect(census.share).toBe(1);
    expect(drain).toBeCloseTo(2 * 2);
    expect(raceBreakdown(G).tLoss).toBeCloseTo(5 / 4);
  });
});

describe('escalating events', () => {
  /** A run whose circulation is one copy of `cardId` plus `filler` cards nothing reads, against a bank of
   *  12🔬. At a hand of 4 a pile of eight deals the copy half the boundaries, which is what makes the two
   *  places the share enters — once on the level, twice on the deepening — tell each other apart. */
  function escalating(cardId: string, { filler = 7, science = 12 } = {}) {
    const G = state('race_goal', { science });
    for (let i = 0; i < filler; i++) G.deck.push(mint(G, 'race_relic'));
    G.deck.push(mint(G, cardId));
    return explainRaceValue(G, { model: deriveRace(G) });
  }

  it('runs the clock down at the rate the drain will deepen to, not the one it stands at', () => {
    // Half a boundary a round of a drain that starts at 1 and rises by 1 a resolution: 12🔬 lasts the root
    // of `12 = 0.5·t + 0.125·t²`, which is 8 rounds — against the 24 a flat reading of today's level
    // promises. Overstating that runway is what lets a run bank through a collapse it was told was distant.
    const ex = escalating('race_blight');
    const pool = ex.pools.find((p) => p.key === 'science')!;
    expect(ex.events!.share).toBe(0.5);
    expect(ex.events!.escalation).toEqual({ science: 1 });
    expect(pool.drain).toBeCloseTo(0.5);
    expect(pool.accel).toBeCloseTo(0.125);
    expect(pool.t).toBeCloseTo(8);
    expect(pool.t).toBeLessThan(pool.level / pool.drain);
  });

  it('reads a drain that starts at nothing as a clock all the same', () => {
    // The shape a single boundary cannot see at all: the first resolution takes zero, so the pool has no
    // drain, no rate, and — before the second reading — no clock either.
    const ex = escalating('race_creep');
    const pool = ex.pools.find((p) => p.key === 'science')!;
    expect(pool.drain).toBe(0);
    expect(Number.isFinite(pool.t)).toBe(true);
    expect(pool.t).toBeGreaterThan(0);
    expect(ex.breakdown.lossCause).toBe('science');
  });

  it('reads an empty pool as the cliff edge, whatever the first resolution takes', () => {
    // Where the continuous form and the discrete truth part. Nothing is taken until a copy comes round a
    // second time, so the pool really sits still for `2 / share` rounds — but a cumulative take with no
    // first-order term has its root at the origin the moment the level is zero, and the model has always
    // read an empty pool under a live drain that way. Both shipped Clay Tablet cells start here, so the
    // one unit that lifts the clock off the floor is worth the whole of the runway below.
    const at = (science: number) => escalating('race_creep', { science }).pools.find((p) => p.key === 'science')!;
    expect(at(0).t).toBe(0);
    expect(at(1).t).toBeCloseTo(Math.sqrt(1 / 0.125));
  });

  it('holds a drain that eases at what it takes now', () => {
    // The guard on the other side: projecting the slope forward would have this pool refilling and the
    // clock running to infinity, through a bank that is emptying as the projection is read.
    const ex = escalating('race_relief');
    const pool = ex.pools.find((p) => p.key === 'science')!;
    expect(ex.events!.escalation).toBeUndefined();
    expect(pool.accel).toBeUndefined();
    expect(pool.t).toBe(pool.level / pool.drain);
  });

  it('leaves a flat drain exactly where a division would put it', () => {
    // The reduction that makes the escalation safe to add: `test_event` takes the same 2⚔️ every time it
    // comes round, so the second boundary reads what the first did and the clock is the plain quotient —
    // not close to it, the same expression.
    const G = state('race_goal', { military: 5 });
    for (let i = 0; i < 9; i++) G.deck.push(mint(G, 'race_relic'));
    G.deck.push(mint(G, 'test_event'));
    const ex = explainRaceValue(G, { model: deriveRace(G) });
    const pool = ex.pools.find((p) => p.key === 'military')!;
    expect(ex.events!.escalation).toBeUndefined();
    expect(pool.accel).toBeUndefined();
    expect(pool.t).toBe(pool.level / pool.drain);
  });
});

describe('the deadline probe', () => {
  /** A state whose only pressure is `threatCardId`, minted so a case can set its counters first. */
  function threatened(threatCardId: string, counters: Record<string, number> = {}) {
    const G = state('race_goal', { producers: 1 });
    const threat = mint(G, threatCardId);
    for (const [k, v] of Object.entries(counters)) setCounter(threat, k, v);
    G.threats.push(threat);
    return { G, threat };
  }

  it('reads an absolute deadline as the rounds left before it fires', () => {
    // `test_deadline` gives away the run once round 5 has fully elapsed, so from round 2 there are 4
    // boundaries left — the same shape the horizon takes, which is what says the two are commensurable.
    const { G } = threatened('test_deadline');
    G.round = 2;
    const b = raceBreakdown(G);
    expect(b.tLoss).toBe(4);
    expect(b.lossCause).toBe('deadline');
    expect(b.lossCardId).toBe('test_deadline');
  });

  it('counts a streak clock down from wherever its counter stands', () => {
    for (const idle of [0, 1, RACE_CLOCK_PATIENCE - 1]) {
      expect(raceBreakdown(threatened('race_clock', { idle }).G).tLoss).toBe(RACE_CLOCK_PATIENCE - idle);
    }
  });

  it('sees the reset a leaf has already earned', () => {
    // The pace clock's whole point, and the thing no authored field could tell the value function: two
    // leaves differing only in whether the progress the clock watches landed this turn. The one that
    // moved spends the probe's first round on the reset and then has the full patience again.
    const reset = threatened('race_clock', { seen: 0 });
    const banked = threatened('race_clock', { seen: 1 });
    for (const { G } of [reset, banked]) G.resources.culture = 1;
    expect(raceBreakdown(reset.G).tLoss).toBe(RACE_CLOCK_PATIENCE + 1);
    expect(raceBreakdown(banked.G).tLoss).toBe(RACE_CLOCK_PATIENCE);
  });

  it('leaves a threat with no deadline to the pool drains', () => {
    // `test_threat` drains 2🌾 a round on top of 4 citizens eating: a rate, which the permanent
    // projection already carries. Probing it too would name the threat for a clock the pools own.
    const { G } = threatened('test_threat');
    G.resources.food = 7;
    G.resources.population = 4;
    const b = raceBreakdown(G);
    expect(b.lossCause).toBe('food');
    expect(b.tLoss).toBeCloseTo(7 / 6);
    expect(b.lossCardId).toBeUndefined();
  });

  it('leaves a clock past the cutoff to the horizon', () => {
    const { G } = threatened('test_deadline_far'); // round 30, well past the cutoff below
    const b = raceBreakdown(G, { maxRounds: 10 });
    expect(b.tLoss).toBe(10);
    expect(b.lossCause).toBe('horizon');
  });

  it('disturbs nothing it probes', () => {
    const { G, threat } = threatened('race_clock', { idle: 2 });
    raceBreakdown(G);
    expect(getCounter(threat, 'idle')).toBe(2);
    expect(G.round).toBe(1);
    expect(G.resources.food).toBe(10_000);
  });

  it('reads Setting Sail\'s pace clock unauthored', () => {
    // Nothing on `impatient_crews` was written for this: the probe replays the threat's own tick, and the
    // frozen fleet is what makes the streak climb at all.
    for (const idle of [0, 3, CREW_PATIENCE - 1]) {
      const { G } = threatened('impatient_crews', { idle });
      expect(raceBreakdown(G).tLoss).toBe(CREW_PATIENCE - idle);
    }
    // …and a voyage launched this turn is a reset the tick has yet to apply — the clock the leaf really
    // faces, not the one its counter currently reads.
    const { G } = threatened('impatient_crews');
    G.removed.push(mint(G, 'voyage'));
    expect(raceBreakdown(G).tLoss).toBe(CREW_PATIENCE + 1);
  });
});

describe('the catalogue', () => {
  it('gives every authored goal a clock that is a number of rounds', () => {
    // A coherence check over live content, not a balance one: every objective anyone has authored has to
    // come out of the plan machinery as rounds — no NaN from a zero rate, nothing past the cutoff, no
    // measure the probes can't hold. The universe is every card a run can *hold* — which is wider than
    // `isDeckable`, since every shipped card-count goal counts a mission-injected `event` in `removed`,
    // and a universe without those would leave exactly the goal kind these plans exist for unprobed.
    // Several copies apiece, because a plan is dealt from the copies the run really owns: a universe
    // holding one of everything can complete no goal counting more than one of anything, which is a fact
    // about that universe rather than about the catalogue. Above every authored goal's threshold.
    const held = Object.values(CARDS)
      .filter((c) => c.kind !== 'threat' && c.kind !== 'objective')
      .flatMap((c) => Array.from({ length: 8 }, () => c.id));
    const routes = new Set<GoalRoute>();
    for (const card of Object.values(CARDS)) {
      if (card.kind !== 'objective') continue;
      const G = planned(card.id, held, { population: 3, production: 5 });
      for (const c of valued(G).goals) {
        expect(Number.isFinite(c.t), `${card.id} ${c.icon}`).toBe(true);
        expect(c.t).toBeGreaterThanOrEqual(0);
        expect(c.t).toBeLessThanOrEqual(200);
        // A finite-and-clamped clock passes just as happily on a goal that found no route at all and
        // fell back to the horizon, which is the shape this whole check is meant to catch.
        expect(c.route, `${card.id} ${c.icon}`).not.toBe('none');
        routes.add(c.route);
      }
    }
    // And the lumpy kind really is reached: the card-count goals are why the plans exist, and they are
    // measured in mission-injected events that only the widened universe above puts in the run.
    expect(routes.has('landing')).toBe(true);
  });

  it('gives every authored deadline a clock the frozen world can run down', () => {
    // The threat counterpart of the sweep above. A `defeat` hook only reaches `T̂loss` if replaying the
    // threat's own tick against a still board arrives at it; one that never does reads as the horizon,
    // which is indistinguishable from a mission carrying no deadline at all — the exact blindness this
    // probe exists to close, so it must not pass in silence.
    for (const card of Object.values(CARDS)) {
      if (card.kind !== 'threat' || !card.defeat) continue;
      const G = state('race_goal', { producers: 1 });
      G.threats.push(mint(G, card.id));
      const b = raceBreakdown(G);
      expect(b.lossCause, card.id).toBe('deadline');
      expect(b.tLoss, card.id).toBeGreaterThan(0);
    }
  });
});

describe('the explained pass', () => {
  /** Every shape the suite above builds, so the equality below is asserted over met goals, flat ones,
   *  landing and building plans, absorbed folds, a deadline and a pending defeat alike. */
  function everyShape(): GameState[] {
    const lost = state('race_goal', { producers: 1 });
    lost.pendingDefeat = { reason: 'starved' };
    const ticking = state('race_goal', { producers: 1 });
    const clock = mint(ticking, 'race_clock');
    setCounter(clock, 'idle', 2);
    ticking.threats.push(clock);
    const deadline = state('race_goal', { producers: 1 });
    deadline.threats.push(mint(deadline, 'test_deadline'));
    const recurring = state('race_goal', { military: 5, producers: 1 });
    for (let i = 0; i < 3; i++) recurring.deck.push(mint(recurring, 'race_relic'));
    recurring.discard.push(mint(recurring, 'test_event'));
    const deepening = state('race_goal', { science: 12, producers: 1 });
    for (let i = 0; i < 3; i++) deepening.deck.push(mint(deepening, 'race_relic'));
    deepening.discard.push(mint(deepening, 'race_blight'));
    return [
      state('race_goal', { producers: 1 }),
      state('race_goal', { science: 10, producers: 1 }),
      state('race_goal_pair', { producers: 1, earners: 1, money: 9 }),
      state('test_never', { producers: 1 }),
      state('race_goal_round', { producers: 1 }),
      planned('race_goal_count', ['race_relic', 'race_relic', 'race_relic'], { production: 4 }),
      planned('race_goal_pop', ['race_hut', 'race_hut'], { production: 8 }),
      planned('race_goal_land', ['race_claim', 'race_claim']),
      planned('race_goal_distinct', ['race_shrine', 'race_kiln'], { production: 6 }),
      planned('race_goal_gated', ['race_gated_relic', 'race_gated_relic', 'race_gate_route'], { production: 12 }),
      planned('race_goal', ['test_sci'], { population: 2 }),
      planned('race_goal', ['test_food'], { population: 2, food: 10, production: 2 }),
      ticking,
      deadline,
      recurring,
      deepening,
      lost,
    ];
  }

  it('values a state to the last bit of what a policy ranks by', () => {
    // The explain is the same pass with a sink attached, and this is what says so: a report that valued
    // its own reading of the state would answer a balance question about a model nothing plays under.
    for (const G of everyShape()) {
      const opts = { model: deriveRace(G) };
      expect(explainRaceValue(G, opts).breakdown).toEqual(raceBreakdown(G, opts));
      expect(explainRaceValue(G, opts).breakdown.total).toBe(raceScore(G, opts));
    }
  });

  it('derives the same plans it explains', () => {
    // Tautological while `deriveRace` is the projection, and that is what it guards: the day someone gives
    // the scan a second implementation to keep the report off the hot path, this is what refuses it.
    for (const G of everyShape()) expect(explainRaceModel(G).model).toEqual(deriveRace(G));
  });

  it('records the fold weights the fold really used', () => {
    // Recomputing `exp((t − max)/τ)` outside the fold is the drift the sink exists to prevent, so the
    // check is that the recorded weights reconstruct `T̂win` rather than that they look plausible.
    const G = state('race_goal_pair', { producers: 1, earners: 1, money: 9 });
    const ex = explainRaceValue(G, { model: deriveRace(G) });
    const max = Math.max(...ex.goals.map((g) => g.clock.t));
    const sum = ex.foldWeights.reduce((n, w) => n + w, 0);
    expect(max + RACE.goalSoftening * max * Math.log(sum)).toBeCloseTo(ex.breakdown.tWin, 10);
  });

  it('keeps a weight on the clock furthest behind, however far behind it is', () => {
    // The floor a temperature measured against the leader puts under the fold: a gap cannot be wider than
    // the leading clock itself, so the weakest weight any state can produce is `exp(-1/goalSoftening)` —
    // and a goal 195 rounds behind a 200-round bottleneck is exactly that state. Under an absolute
    // temperature the same pair weighed `exp(-195)`, which is positive and yet far under the ULP of the
    // leader's 1: `T̂win` came out the leader's clock bit for bit, with no gradient on the other goal at all.
    const G = state('race_goal_pair', { producers: 1 });
    const ex = explainRaceValue(G, { model: deriveRace(G) });
    expect(ex.goals.map((g) => g.clock.route)).toEqual(['throughput', 'none']);
    expect(ex.foldWeights[0]).toBeGreaterThanOrEqual(Math.exp(-1 / RACE.goalSoftening));
    expect(ex.breakdown.tWin).toBeGreaterThan(Math.max(...ex.goals.map((g) => g.clock.t)));
    expect(ex.foldWeights.some(absorbed)).toBe(false);

    // A goal a few rounds behind pulls harder still, which is the whole reason the fold is soft.
    const close = state('race_goal_pair', { producers: 1, earners: 1 });
    const closeEx = explainRaceValue(close, { model: deriveRace(close) });
    expect(closeEx.foldWeights[1]).toBeGreaterThan(ex.foldWeights[0]);
  });

  it('weighs a gap by its size against the bottleneck, not by its size in rounds', () => {
    // The re-unitization proper, read off the one fold that takes its arguments directly. Two clocks three
    // times as long are the same race, so the fold scales with them and its weights do not move at all…
    const base: number[] = [];
    const scaled: number[] = [];
    expect(landingClock(6, 15, scaled) / 3).toBeCloseTo(landingClock(2, 5, base), 10);
    expect(scaled).toEqual(base);

    // …while the same gap in rounds against a shorter bottleneck is a wider gap, and weighs less.
    const near: number[] = [];
    const far: number[] = [];
    landingClock(2, 5, near);
    landingClock(37, 40, far);
    expect(near[0]).toBeLessThan(far[0]);
  });

  it('folds a pair of met clocks to nothing rather than to a NaN', () => {
    // Nothing left to divide: with the temperature taken off the leader, a leader of zero leaves `exp(-0/0)`
    // where the weights were — and a NaN clock leaves a beam's sort order undefined.
    const met: number[] = [];
    expect(landingClock(0, 0, met)).toBe(0);
    expect(met).toEqual([1, 1]);
  });

  it('names why a goal found no route, where the clock only says none', () => {
    // Three answers a `GoalClock` spells one way. A plan the deck is short of copies for…
    const short = planned('race_goal_count', ['race_relic'], { production: 4 });
    const shortEx = explainRaceValue(short, { model: deriveRace(short) }).goals[0];
    expect(shortEx.clock.route).toBe('none');
    expect(routeCause(shortEx)).toBe('copies short');
    // …a plan no citizen is left to pay for…
    const idle = planned('race_goal_count', ['race_relic', 'race_relic', 'race_relic'], { production: 4, population: 0 });
    const idleEx = explainRaceValue(idle, { model: deriveRace(idle) }).goals[0];
    expect(routeCause(idleEx)).toBe('no workforce');
    // …and a goal nothing in the run touches at all.
    const bare = planned('race_goal_count', [], { production: 4 });
    expect(routeCause(explainRaceValue(bare, { model: deriveRace(bare) }).goals[0])).toBe('no plan');
  });

  it('keeps every route the deck can deal, with the reason it dropped the rest', () => {
    // The reading a `RaceModel` cannot give: which cards were weighed, and what became of each. The relic is
    // the cheaper card per unit and the run has already spent its only copy, so the deck deals it never
    // again — the one thing that still drops a route the run genuinely holds a card for.
    const G = planned('race_goal_either', ['race_trinket', 'race_trinket', 'race_trinket'], { removed: ['race_relic'] });
    const goal = explainRaceModel(G).goals[0];
    const byId = Object.fromEntries(goal.candidates.map((c) => [c.cardId, c]));
    expect(byId.race_relic.perUnit).toBeLessThan(byId.race_trinket.perUnit);
    expect(byId.race_relic.landing).toMatchObject({ kept: false, reject: 'no copies circulate' });
    expect(byId.race_trinket.landing).toMatchObject({ kept: true, reject: '' });
    expect(goal.inert).toBeGreaterThan(0);
  });
});

describe('ranking', () => {
  it('spends a cheaper card the deck is short of on the share it can deal, without letting it shadow one it can', () => {
    // The relic is cheaper per unit and the run holds one copy against a goal wanting three, so it finishes
    // nothing alone; the trinket costs half as much again and circulates three. Dropping the short route
    // plans three trinkets and never sees that the relic is a cheaper third of the same goal — and taking it
    // as if it *could* finish leaves the goal reading unreachable with the trinkets sitting in the deck.
    const G = planned('race_goal_either', ['race_relic', 'race_trinket', 'race_trinket', 'race_trinket']);
    const model = deriveRace(G);
    expect(model.plans[0].landings.map((p) => p.cardId)).toEqual(['race_relic', 'race_trinket']);
    expect(model.plans[0].dropped).toBeUndefined();

    const goal = explainRaceValue(G, { model }).goals[0];
    expect(goal.landings.map((p) => p.copies)).toEqual([1, 3]);
    expect(goal.covers[0].members.map((m) => m.copies)).toEqual([1, 2]);
    // The relic alone reaches a third of the goal, so only the trinket and the cover are ever taken — and
    // the cover is what the `min` finds, being the same three units at the cheaper bill.
    expect(goal.clock.route).toBe('cover');
    expect(goal.clock.t).toBeLessThan(goal.landings[1].t);
  });

  it('takes the soonest route at each leaf, not the one that ranked best at the root', () => {
    // Two kept routes whose order inverts with the bank: unpaid, the relic's cheaper price wins; once the
    // bank covers both prices outright, only delivery is left and the six trinkets are dealt twice as often
    // as the three relics. A plan pre-committed at the root reads one of these two states wrong.
    const deck = [...Array<string>(3).fill('race_relic'), ...Array<string>(6).fill('race_trinket')];
    const at = (production: number) => {
      const G = planned('race_goal_either', deck, { production });
      const ex = explainRaceValue(G, { model: deriveRace(G) }).goals[0];
      expect(ex.landings.map((p) => p.cardId)).toEqual(['race_relic', 'race_trinket']);
      return ex;
    };
    const poor = at(0);
    const rich = at(30);
    expect(poor.clock.cardId).toBe('race_relic');
    expect(rich.clock.cardId).toBe('race_trinket');
    // Each state's clock is the `min` over the routes it costed, which is the whole of the claim.
    for (const ex of [poor, rich]) expect(ex.clock.t).toBeCloseTo(Math.min(...ex.landings.map((p) => p.t)));
    expect(poor.landings[0].t).toBeLessThan(poor.landings[1].t);
    expect(rich.landings[1].t).toBeLessThan(rich.landings[0].t);
  });

  it('spends the bank of the route it took, not of the last one it costed', () => {
    // The tie-break counts the bank *past* what the goal's plan spent, and with several routes costed the
    // netting that reaches it has to be the winner's. The loser here draws deeper on the same pool, so a
    // fold carrying the last reading instead would prefer the price to the thing the price buys — and no
    // clock would move to say so.
    const deck = [...Array<string>(3).fill('race_relic'), ...Array<string>(6).fill('race_trinket')];
    const G = planned('race_goal_either', deck, { production: 13.5, food: 0 });
    const model = deriveRace(G);
    const ex = explainRaceValue(G, { model }).goals[0];
    expect(ex.clock.cardId).toBe('race_relic');
    expect(ex.landings.map((p) => p.netted)).toEqual([{ production: 12 }, { production: 13.5 }]);
    expect(raceBreakdown(G, { model }).wealth).toBeCloseTo(((13.5 - 12) / RACE.wealthCap) * RACE.wealthRounds, 12);
  });
});

describe('victory', () => {
  it('dominates any margin the horizon can express', () => {
    const won = state('race_goal', { science: 10, producers: 1 });
    won.pendingVictory = true;
    expect(raceScore(won)).toBeGreaterThan(raceScore(state('race_goal', { producers: 3 })) + 1_000);
  });
});
