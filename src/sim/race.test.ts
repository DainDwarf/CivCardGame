import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { installCards, installFixtures, mint, uninstallCards, uninstallFixtures } from '../rules/testFixtures';
import { addBuilding, addWork, blankState, bumpCounter, getCounter, seedObjective, setCounter, subtractResources, type GameState } from '../rules';
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
    // 3🔨 for the science building is 1.5 worker-rounds over two people, and its one copy is a quarter of
    // a round's draw away — standing it is the two at once. Then 10🔬 at 2🔬 a round, which is not: the
    // producer has to be standing before it pays.
    const c = clockOf(planned('race_goal', ['test_sci'], { population: 2 }));
    expect(c.route).toBe('building');
    expect(c.cardId).toBe('test_sci');
    expect(c.t).toBeCloseTo(landingClock(0.75, 0.25) + 5);

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

describe('delivery', () => {
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
    expect(plan.price).toEqual({});
    expect(plan.workerRounds).toBeGreaterThan(0);
    const crowd = planned('race_goal_land', ['race_claim'], { territory: 0, population: 3 });
    expect(clockOf(crowd).t).toBeLessThan(clockOf(G).t);
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

    const blighted = state('race_goal', { science: 12 });
    blighted.hand.push(mint(blighted, 'race_blight'));
    const fresh = raceBreakdown(blighted);
    expect(fresh.lossCause).toBe('science');
    expect(fresh.tLoss).toBeCloseTo(12);

    // A copy that has already come round three times takes four times as much, and the clock says so.
    const worn = state('race_goal', { science: 12 });
    const copy = mint(worn, 'race_blight');
    setCounter(copy, 'level', 3);
    worn.hand.push(copy);
    expect(raceBreakdown(worn).tLoss).toBeCloseTo(3);
    // …and the projection that read it left the counter where it found it.
    expect(getCounter(copy, 'level')).toBe(3);
  });

  it('reads a pending defeat as no rounds left at all', () => {
    const G = state('race_goal', { producers: 1 });
    G.pendingDefeat = { reason: 'test' };
    const b = raceBreakdown(G);
    expect(b.tLoss).toBe(0);
    expect(b.lossCause).toBe('defeat');
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
    return [
      state('race_goal', { producers: 1 }),
      state('race_goal', { science: 10, producers: 1 }),
      state('race_goal_pair', { producers: 1, earners: 1, money: 9 }),
      state('test_never', { producers: 1 }),
      state('race_goal_round', { producers: 1 }),
      planned('race_goal_count', ['race_relic', 'race_relic', 'race_relic'], { production: 4 }),
      planned('race_goal_pop', ['race_hut', 'race_hut'], { production: 8 }),
      planned('race_goal_land', ['race_claim', 'race_claim']),
      planned('race_goal', ['test_sci'], { population: 2 }),
      ticking,
      deadline,
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
    // The reading a `RaceModel` cannot give: which cards were weighed, and what became of each.
    const G = planned('race_goal_either', ['race_relic', 'race_trinket', 'race_trinket', 'race_trinket']);
    const goal = explainRaceModel(G).goals[0];
    const byId = Object.fromEntries(goal.candidates.map((c) => [c.cardId, c]));
    expect(byId.race_relic.perUnit).toBeLessThan(byId.race_trinket.perUnit);
    expect(byId.race_relic.landing).toMatchObject({ kept: false, reject: 'copies short' });
    expect(byId.race_trinket.landing).toMatchObject({ kept: true, reject: '' });
    expect(goal.inert).toBeGreaterThan(0);
  });
});

describe('ranking', () => {
  it('never lets a cheaper card the deck cannot deal shadow one it can', () => {
    // The relic is cheaper per unit and the run holds one copy of it against a goal wanting three, so its
    // clock is infinite; the trinket costs half as much again and circulates. A scan ranking on price alone
    // plans through the relic and the goal then reads as unreachable with three trinkets sitting in the deck.
    const G = planned('race_goal_either', ['race_relic', 'race_trinket', 'race_trinket', 'race_trinket']);
    const model = deriveRace(G);
    expect(model.plans[0].landings.map((p) => p.cardId)).toEqual(['race_trinket']);
    expect(model.plans[0].dropped).toEqual(['copies short']);

    const goal = explainRaceValue(G, { model }).goals[0];
    expect(goal.clock.route).toBe('landing');
    expect(goal.clock.cardId).toBe('race_trinket');
    expect(goal.clock.t).toBeCloseTo(goal.landings[0].t);
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
