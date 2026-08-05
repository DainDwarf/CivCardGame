import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { installCards, installFixtures, mint, uninstallCards, uninstallFixtures } from '../rules/testFixtures';
import { addBuilding, addWork, blankState, bumpCounter, getCounter, seedObjective, setCounter, type GameState } from '../rules';
import { CARDS, CREW_PATIENCE, type CardDef } from '../content/cards';
import { deriveRace, raceBreakdown, raceScore, type GoalRoute } from './race';

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
  // A pool nothing `produces` per round — it exists only as what a play grants.
  race_goal_pop: {
    id: 'race_goal_pop', name: 'Race Goal Pop', kind: 'objective', cost: {},
    goals: [{ icon: '🧍', measure: (G) => G.resources.population, target: 3 }],
  },
  race_hut: {
    id: 'race_hut', name: 'Race Hut', kind: 'building', workers: 0,
    cost: { resources: { production: 4 } }, effect: { resources: { population: 2 } },
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
  { production = 0, population = 1, food = 20, removed = [] as string[], standing = [] as string[] } = {},
): GameState {
  const G = blankState('race_test');
  G.round = 1;
  G.resources.production = production;
  G.resources.food = food;
  G.resources.population = population;
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
    // 12🔨 is 6 worker-rounds is 6 rounds. Nothing about that measure moves per round, so without the
    // plan it would read as the horizon on every line.
    const c = clockOf(planned('race_goal_count', ['race_relic', 'race_relic', 'race_relic']));
    expect(c.route).toBe('landing');
    expect(c.cardId).toBe('race_relic');
    expect(c.tau).toBe(0);
    expect(c.t).toBeCloseTo(6);

    // …and lands as they do.
    const landed = clockOf(planned('race_goal_count', ['race_relic', 'race_relic'], { removed: ['race_relic'] }));
    expect(landed.t).toBeCloseTo(4);
  });

  it('leaves a played copy and its banked price at the same distance from the win', () => {
    // Not "strictly beats": exact netting is the honest arithmetic, and it makes the two *equal* — the
    // bank is worth precisely the rounds of production it stands in for. What the model owes here is
    // that they don't come apart, and in particular that the tie-break doesn't quietly prefer the bank
    // to the thing the bank buys.
    const banked = valued(planned('race_goal_count', ['race_relic', 'race_relic', 'race_relic'], { production: 4 }));
    const played = valued(planned('race_goal_count', ['race_relic', 'race_relic'], { removed: ['race_relic'] }));
    expect(banked.goals[0].t).toBeCloseTo(played.goals[0].t);
    expect(banked.wealth).toBeCloseTo(played.wealth);
    expect(banked.total).toBeCloseTo(played.total);
  });

  it('still counts a bank past every price it could pay', () => {
    // The exclusion is of what a plan *spent*, not of the pool: 12🔨 buys all three relics, and the 4
    // beyond that is wealth like any other.
    const G = (production: number) => planned('race_goal_count', ['race_relic', 'race_relic', 'race_relic'], { production });
    const exact = valued(G(12));
    const spare = valued(G(16));
    expect(exact.goals[0].t).toBeCloseTo(0);
    expect(spare.goals[0].t).toBeCloseTo(0);
    expect(spare.wealth).toBeGreaterThan(exact.wealth);
  });

  it('prices a goal with no producer standing as building one, then running it', () => {
    // 3🔨 for the science building is 1.5 worker-rounds over two people, then 10🔬 at 2🔬 a round.
    const c = clockOf(planned('race_goal', ['test_sci'], { population: 2 }));
    expect(c.route).toBe('building');
    expect(c.cardId).toBe('test_sci');
    expect(c.t).toBeCloseTo(0.75 + 5);

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
    expect(plan.building).toBeUndefined();
    expect(plan.landing).toMatchObject({ cardId: 'race_hut', delta: 2 });
    // 1🧍 of 3, so one hut closes it: 4🔨 is 2 worker-rounds, one person.
    expect(clockOf(G).t).toBeCloseTo(2);
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

  it('sees an unplayed event\'s disaster land, without reading it as a rate', () => {
    // `test_event` drains 2⚔️ at the boundary it is left in hand for. The permanent economy has no
    // military drain at all, so the *only* way this is visible is the level it carries the pool to.
    const doomed = state('race_goal', { military: 1 });
    doomed.hand.push(mint(doomed, 'test_event'));
    const b = raceBreakdown(doomed);
    expect(b.tLoss).toBe(0);
    expect(b.lossCause).toBe('military');

    const survivable = state('race_goal', { military: 5 });
    survivable.hand.push(mint(survivable, 'test_event'));
    // A one-shot drain the pool absorbs is not a countdown: nothing recurring is emptying it.
    expect(raceBreakdown(survivable).lossCause).toBe('horizon');
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
    const held = Object.values(CARDS)
      .filter((c) => c.kind !== 'threat' && c.kind !== 'objective')
      .map((c) => c.id);
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
});

describe('victory', () => {
  it('dominates any margin the horizon can express', () => {
    const won = state('race_goal', { science: 10, producers: 1 });
    won.pendingVictory = true;
    expect(raceScore(won)).toBeGreaterThan(raceScore(state('race_goal', { producers: 3 })) + 1_000);
  });
});
