import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mint, installCards, installFixtures, uninstallCards, uninstallFixtures } from '../rules/testFixtures';
import { createRun } from '../run/engine';
import { simConfig } from './simulate';
import {
  DEFAULT_ENABLER_TERMS,
  ENABLER_CONSTANTS,
  deriveEnablers,
  enablerPotential,
  explainEnablers,
  goalValuedCardCosts,
  weightSource,
} from './enablers';
import { OBJECTIVE_WEIGHT } from './value';
import { objectiveProgress } from './objective';
import { CARDS, type CardDef } from '../content/cards';
import { addBuilding, cultureForLevel, emptyResources, type DeckCard, type GameState, type Resources } from '../rules';

// The two conversion costs the Masonry deck rides on, read from content so a rebalance re-targets these
// expectations instead of silently breaking on a stale literal — the assertions pin the *relationship* (a
// resource's cap is its converter's cost), not the number.
const HUT_PRODUCTION_COST = CARDS.hut.cost.resources!.production!;
const CONQUEST_MILITARY_COST = CARDS.conquest.cost.resources!.military!;

// A real Masonry run root (Settlement board). Masonry wins on population: production is a production→
// population *consumable* enabler (a Hut's cost), and territory is a *capacity* enabler (the slot the Hut
// needs). Territory is not goal-valued here (the sim override that once blended it in is gone), so it rides
// the capacity probe — the exact case the generalization exists to cover.
function masonryRoot(): GameState {
  const config = simConfig({
    deckCardIds: ['hut', 'hut', 'conquest', 'conquest', 'toolmaking', 'toolmaking', 'dogs', 'dogs', 'farm', 'farm'],
    board: 'settlement',
    missionId: 'masonry',
    seed: 'enablers-test',
  });
  return createRun(config).G;
}

/** The score credit `scoreState`'s objective band grants for one unit of `resource`, off a zeroed baseline
 *  (so the objective's caps don't hide the step). */
function objectiveStep(resource: keyof GameState['resources']): number {
  const G = masonryRoot();
  G.resources = emptyResources();
  const before = objectiveProgress(G);
  G.resources[resource] += 1;
  return (objectiveProgress(G) - before) * OBJECTIVE_WEIGHT;
}

describe('consumable enabler (planner leaf accelerator)', () => {
  it('derives the deck\'s production→population conversion toward the Masonry objective', () => {
    const m = deriveEnablers(masonryRoot());
    // Masonry wins on population, grown by Huts — production (a Hut's cost) is a production→population enabler.
    expect(m.weight.production ?? 0).toBeGreaterThan(0);
    expect(m.cap.production).toBe(HUT_PRODUCTION_COST);
  });

  it('chains a core cost through an enabler-valued resource (military→Conquest→territory)', () => {
    // Territory isn't goal-valued on Masonry, so it's only *enabler*-valued (a capacity weight). Conquest
    // turns military into territory, and the consumable loop treats that capacity weight as a conversion
    // target — so banking the military that buys a Conquest is credited, capped at the Conquest's cost.
    const m = deriveEnablers(masonryRoot());
    expect(m.weight.military ?? 0).toBeGreaterThan(0);
    expect(m.cap.military).toBe(CONQUEST_MILITARY_COST);
  });

  it('credits only the enabler resources, not survival pools or the goal itself', () => {
    const m = deriveEnablers(masonryRoot());
    // food/science/money feed no valued conversion here; population is the goal, scored directly, not
    // shadowed as its own enabler.
    for (const k of ['food', 'science', 'money', 'population'] as const) {
      expect(m.weight[k] ?? 0, k).toBe(0);
    }
  });

  it('rises with a banked consumable up to its conversion cost, then saturates', () => {
    const m = deriveEnablers(masonryRoot());
    const pot = (resource: 'production' | 'military', amount: number) => {
      const G = masonryRoot();
      G.resources = emptyResources();
      G.resources[resource] = amount;
      return enablerPotential(G, m);
    };
    // production → population, saturating at the Hut cost
    expect(pot('production', 0)).toBe(0);
    expect(pot('production', HUT_PRODUCTION_COST - 1)).toBeGreaterThan(pot('production', 0));
    expect(pot('production', HUT_PRODUCTION_COST + 5)).toBe(pot('production', HUT_PRODUCTION_COST));
    // military → territory (the chained hop), saturating at the Conquest cost
    expect(pot('military', 0)).toBe(0);
    expect(pot('military', CONQUEST_MILITARY_COST - 1)).toBeGreaterThan(pot('military', 0));
    expect(pot('military', CONQUEST_MILITARY_COST + 3)).toBe(pot('military', CONQUEST_MILITARY_COST));
  });

  it('conversions: false removes the conversion weights but not the capacity credits', () => {
    const m = deriveEnablers(masonryRoot(), { conversions: false });
    expect(m.weight.production ?? 0).toBe(0);
    expect(m.weight.military ?? 0).toBe(0);
    expect(m.weight.territory ?? 0).toBeGreaterThan(0);
  });

  it('keeps a full consumable bank worth strictly less than the value it converts into (sound shaping)', () => {
    const m = deriveEnablers(masonryRoot());
    const bankOf = (resource: 'production' | 'military') => {
      const G = masonryRoot();
      G.resources = emptyResources();
      G.resources[resource] = m.cap[resource]!;
      return enablerPotential(G, m);
    };
    // A Hut's worth of production must score below the +1 population it converts into (a goal step)...
    expect(bankOf('production')).toBeLessThan(objectiveStep('population'));
    // ...and a Conquest's worth of military below the territory it converts into (that territory's enabler
    // value), so the search plays the Conquest rather than hoarding military toward it.
    const territoryValue = (() => {
      const G = masonryRoot();
      G.resources = emptyResources();
      G.resources.territory = CARDS.conquest.produces!.resources!.territory!;
      return enablerPotential(G, m);
    })();
    expect(bankOf('military')).toBeLessThan(territoryValue);
  });
});

describe('territory capacity enabler', () => {
  it('credits territory when it is not goal-valued, scanning a structure\'s effect (not only produces)', () => {
    // The slot a Hut needs unlocks the Hut's one-shot `effect` grant of the goal population — so the probe
    // must read `effect`, which a produces-only scan would miss.
    const m = deriveEnablers(masonryRoot());
    expect(m.weight.territory ?? 0).toBeGreaterThan(0);
  });

  it('is a durable multi-round credit, worth more than one round of the building\'s throughput', () => {
    const m = deriveEnablers(masonryRoot());
    // One Hut grants +1 population; the credit is worth several rounds of it (a slot keeps hosting a
    // producer), not a single one-shot hop.
    const oneRound = CARDS.hut.effect!.resources!.population! * objectiveStep('population');
    expect(m.weight.territory!).toBeGreaterThan(oneRound);
  });

  it('capacity: false falls back to the intrinsic floor; with floor also off the credit vanishes', () => {
    const full = deriveEnablers(masonryRoot()).weight.territory!;
    const floorOnly = deriveEnablers(masonryRoot(), { capacity: false });
    expect(floorOnly.weight.territory ?? 0).toBeGreaterThan(0);
    expect(floorOnly.weight.territory!).toBeLessThan(full);
    const neither = deriveEnablers(masonryRoot(), { capacity: false, floor: false });
    expect(neither.weight.territory ?? 0).toBe(0);
  });

  it('rises with banked territory then saturates at the cap', () => {
    const m = deriveEnablers(masonryRoot());
    const pot = (territory: number) => {
      const G = masonryRoot();
      G.resources = emptyResources();
      G.resources.territory = territory;
      return enablerPotential(G, m);
    };
    expect(pot(0)).toBe(0);
    expect(pot(5)).toBeGreaterThan(pot(0));
    expect(pot(100)).toBe(pot(50)); // saturates at the capacity cap — hoarding territory past it earns nothing
  });
});

// Pyramid wins on *resource thresholds* (money/prod/culture), so population isn't goal-valued here — it's a
// pure enabler: staffing a per-worker producer (Toolmaking → production, a goal resource) converts a unit of
// population into goal output every round. A real Pyramid run root, so the model derives through the same
// path production uses.
function pyramidRoot(deckCardIds: readonly (string | DeckCard)[]): GameState {
  const config = simConfig({ deckCardIds, board: 'city', missionId: 'pyramid', seed: 'enablers-pop-test' });
  return createRun(config).G;
}

/** The enabler potential of a Pyramid root holding `population` and nothing else — the deck's model
 *  derived once, then read at each pool size. */
function potOf(deckCardIds: readonly (string | DeckCard)[]): (population: number) => number {
  const m = deriveEnablers(pyramidRoot(deckCardIds));
  return (population) => {
    const G = pyramidRoot(deckCardIds);
    G.resources = emptyResources();
    G.resources.population = population;
    return enablerPotential(G, m);
  };
}

// Two staffable culture producers whose only meaningful property is that one out-rates the other — local
// to this file, since only the best-producer case needs them.
const CULTURE_PRODUCERS: Record<string, CardDef> = {
  test_weak_culture: {
    id: 'test_weak_culture', name: 'Test Weak Culture', kind: 'work',
    cost: {}, workers: 1, produces: { resources: { culture: 2 } },
  },
  test_strong_culture: {
    id: 'test_strong_culture', name: 'Test Strong Culture', kind: 'work',
    cost: {}, workers: 1, produces: { resources: { culture: 6 } },
  },
};

// Two staffable food producers differing only in rate — neither outputs a goal resource, so they move the
// population *netting* (how much of a person's credit their own upkeep eats) and nothing else.
const FOOD_PRODUCERS: Record<string, CardDef> = {
  test_thin_food: {
    id: 'test_thin_food', name: 'Test Thin Food', kind: 'work',
    cost: {}, workers: 1, produces: { resources: { food: 1 } },
  },
  test_rich_food: {
    id: 'test_rich_food', name: 'Test Rich Food', kind: 'work',
    cost: {}, workers: 1, produces: { resources: { food: 8 } },
  },
};

// A one-goal-term producer and a two-goal-term one of the *same* per-key rate — the pair that separates
// summing a card's goal contributions from taking its largest, which are indistinguishable on any
// single-output card.
const MULTI_OUTPUT_PRODUCERS: Record<string, CardDef> = {
  test_one_term: {
    id: 'test_one_term', name: 'Test One Term', kind: 'work',
    cost: {}, workers: 1, produces: { resources: { production: 1 } },
  },
  test_two_terms: {
    id: 'test_two_terms', name: 'Test Two Terms', kind: 'work',
    cost: {}, workers: 1, produces: { resources: { production: 1, culture: 1 } },
  },
};

describe('population capacity enabler', () => {
  beforeAll(() => installCards({ ...CULTURE_PRODUCERS, ...FOOD_PRODUCERS }));
  afterAll(() => uninstallCards({ ...CULTURE_PRODUCERS, ...FOOD_PRODUCERS }));

  it('credits population as a durable, multi-round enabler when it is not itself goal-valued', () => {
    const deck = ['toolmaking', 'toolmaking', 'foraging', 'foraging', 'farm', 'farm', 'bead_workshop', 'bead_workshop'];
    const m = deriveEnablers(pyramidRoot(deck));

    // One round of the deck's best goal producer (Toolmaking: 2🔨/worker) credited through the objective —
    // read from content, so a Toolmaking/objective rebalance re-targets the relationship, not a stale number.
    const stepPerProduction = (() => {
      const G = pyramidRoot(deck);
      G.resources = emptyResources();
      const before = objectiveProgress(G);
      G.resources.production += 1;
      return (objectiveProgress(G) - before) * OBJECTIVE_WEIGHT;
    })();
    const oneRoundThroughput = CARDS.toolmaking.produces!.resources!.production! * stepPerProduction;

    expect(m.weight.population ?? 0).toBeGreaterThan(0);
    // Durable-capacity semantics: worth *more* than a single round's throughput (a consumable one-hop credit
    // would be worth at most one round), since a staffed worker produces every round it's staffed.
    expect(m.weight.population!).toBeGreaterThan(oneRoundThroughput);
  });

  it('scales the credit with the deck\'s best goal producer', () => {
    // The credit tracks the *best* staffable producer of a goal resource, so adding a stronger one raises
    // it. Synthetic producers, ordered by construction: a real pair can be flattened by a rebalance until
    // the two are equal, which pins nothing.
    const withStrong = deriveEnablers(pyramidRoot(['test_weak_culture', 'test_strong_culture', 'foraging']));
    const weakOnly = deriveEnablers(pyramidRoot(['test_weak_culture', 'foraging']));
    expect(withStrong.weight.population!).toBeGreaterThan(weakOnly.weight.population!);
  });

  it('credits the board\'s own population gross but nets what growth eats', () => {
    const deck = ['toolmaking', 'toolmaking', 'foraging', 'foraging'];
    const m = deriveEnablers(pyramidRoot(deck));
    const start = pyramidRoot(deck).startResources.population;
    const pot = potOf(deck);

    expect(pot(0)).toBe(0);
    // The mouths the board opens on are sunk — no line can undo them, so they cost the credit nothing.
    expect(pot(start)).toBe(m.weight.population! * start);
    // Every person past that pays their own upkeep out of their credit, so growth is worth strictly less
    // than the gross rate — and eventually nothing at all, the derived saturation.
    expect(pot(start + 2)).toBeLessThan(m.weight.population! * (start + 2));
    expect(pot(100)).toBe(pot(50));
  });

  it('keeps more of the credit the better the run can feed a worker', () => {
    // The netting is in worker-rounds: a person eats `foodPerNextPop` and it takes
    // `foodPerNextPop / foodPerWorker` of a worker to source, so a richer food producer leaves more of the
    // person's own credit intact. Neither producer outputs a goal resource, so `weight.population` is
    // identical across the two and only the netting can move the potential.
    const grown = pyramidRoot(['toolmaking']).startResources.population + 3;
    const thin = potOf(['toolmaking', 'test_thin_food'])(grown);
    const rich = potOf(['toolmaking', 'test_rich_food'])(grown);
    expect(rich).toBeGreaterThan(thin);
    expect(deriveEnablers(pyramidRoot(['toolmaking', 'test_rich_food'])).weight.population).toBe(
      deriveEnablers(pyramidRoot(['toolmaking', 'test_thin_food'])).weight.population,
    );
  });

  it('reads the food rate off the run\'s instances, so a stickered copy feeds what it really yields', () => {
    // `foodPerWorker` walks instances rather than `CARDS`: an Irrigated Farm really does feed more, and
    // pricing it at its base rate would charge a person several times what feeding them costs.
    const grown = pyramidRoot(['toolmaking']).startResources.population + 3;
    const bare = potOf(['toolmaking', 'farm'])(grown);
    const irrigated = potOf(['toolmaking', { cardId: 'farm', stickers: ['irrigation', 'irrigation'] }])(grown);
    expect(irrigated).toBeGreaterThan(bare);
  });

  it('feeds nobody from a deck with no per-worker food, so growth earns nothing', () => {
    const deck = ['toolmaking', 'toolmaking'];
    const start = pyramidRoot(deck).startResources.population;
    const pot = potOf(deck);
    expect(pot(start + 4)).toBe(pot(start));
  });

  it('charges no upkeep where the derived credit is absent, so a goal-valued pool is never penalised', () => {
    // The netting rides on the *derived* throughput, not the composed weight: on Masonry growing population
    // is the win, and a charge landing there would fight the objective band it serves.
    const m = deriveEnablers(masonryRoot());
    expect(m.foodPerWorker).toBeUndefined();
    const pot = (population: number) => {
      const G = masonryRoot();
      G.resources = emptyResources();
      G.resources.population = population;
      return enablerPotential(G, m);
    };
    expect(pot(6)).toBeGreaterThanOrEqual(pot(2));
  });

  it('does not double-credit population when it is itself the objective (Masonry)', () => {
    // Masonry's win *is* population, so it's scored directly, not as an enabler — the same skip the
    // spend-a-resource enablers apply to a goal-valued cost resource.
    const m = deriveEnablers(masonryRoot());
    expect(m.weight.population ?? 0).toBe(0);
  });
});

describe('intrinsic strategic floor', () => {
  // Sandbox never wins (`met: () => false`, measure pinned at 0), so neither probe registers and every
  // objective-derived credit is zero — the case the floor exists for. (A card-count goal no longer
  // qualifies: the card probe derives real credits there.)
  function floorOnlyRoot(): GameState {
    const config = simConfig({
      deckCardIds: ['hut', 'hut', 'farm', 'farm', 'foraging', 'foraging', 'toolmaking', 'toolmaking'],
      board: 'settlement',
      missionId: 'sandbox',
      seed: 'enablers-intrinsic',
    });
    return createRun(config).G;
  }

  it('credits all three strategic pools on an objective that values nothing', () => {
    const m = deriveEnablers(floorOnlyRoot());
    for (const k of ['territory', 'population', 'culture'] as const) {
      expect(m.weight[k] ?? 0, k).toBeGreaterThan(0);
      expect(m.cap[k], k).toBeDefined();
    }
  });

  it('rises with a held strategic pool where the derived model alone would be flat', () => {
    const m = deriveEnablers(floorOnlyRoot());
    const pot = (population: number) => {
      const G = floorOnlyRoot();
      G.resources = emptyResources();
      G.resources.population = population;
      return enablerPotential(G, m);
    };
    expect(pot(3)).toBeGreaterThan(pot(0));
  });

  it('does not downgrade a pool the objective genuinely runs through', () => {
    // Masonry's territory carries a real derived throughput credit (the slot a Hut needs); composing the
    // floor as a `max` must leave that strictly above the bare floor.
    const derived = deriveEnablers(masonryRoot()).weight.territory!;
    expect(derived).toBeGreaterThan(deriveEnablers(floorOnlyRoot()).weight.territory!);
  });

  it('stays below a goal step, so engine never outbids the objective it serves', () => {
    // The floor is a growth nudge, not a competing goal: a fully saturated strategic pool must score under a
    // single unit of objective progress.
    const m = deriveEnablers(floorOnlyRoot());
    const saturated = m.weight.population! * m.cap.population!;
    expect(saturated).toBeLessThan(OBJECTIVE_WEIGHT);
  });

  it('floor: false leaves a no-resource objective with no strategic credit at all', () => {
    // With nothing goal-valued the derived throughput is zero everywhere, so ablating the floor empties the
    // whole strategic layer — the isolation that lets a sweep measure the floor alone.
    const m = deriveEnablers(floorOnlyRoot(), { floor: false });
    for (const k of ['territory', 'population', 'culture'] as const) {
      expect(m.weight[k] ?? 0, k).toBe(0);
    }
  });

  it('floor: false keeps a genuinely derived credit intact', () => {
    expect(deriveEnablers(masonryRoot(), { floor: false }).weight.territory ?? 0).toBeGreaterThan(0);
  });
});

describe('card-cost goal valuation', () => {
  // Writing wins on a *card count* (clay tablets in `removed`), so no resource moves `objectiveProgress`
  // directly — the card probe is what makes the tablet's cost bankable. The mission itself seeds the
  // tablets into the deck, so the probe finds them through the real injection path.
  function writingRoot(): GameState {
    const config = simConfig({
      deckCardIds: ['forge', 'forge', 'toolmaking', 'toolmaking', 'farm', 'bow', 'storytelling', 'storytelling'],
      board: 'city',
      missionId: 'writing',
      seed: 'enablers-card-cost',
    });
    return createRun(config).G;
  }

  /** The score credit one recorded tablet yields — the goal step the banked cost converts into. */
  function tabletStep(): number {
    const G = writingRoot();
    const before = objectiveProgress(G);
    G.removed.push({ id: -1, cardId: 'clay_tablet' });
    return (objectiveProgress(G) - before) * OBJECTIVE_WEIGHT;
  }

  /** The cost keys the tablet actually charges — read off the card so a rebalance that moves the
   *  tablet onto different resources re-targets these assertions instead of breaking them. */
  const tabletCost = Object.entries(CARDS.clay_tablet.cost.resources!) as [keyof Resources, number][];

  it('banks each of the goal card\'s cost resources, capped at one card\'s worth', () => {
    const m = deriveEnablers(writingRoot());
    expect(tabletCost.length).toBeGreaterThan(0);
    for (const [key, amount] of tabletCost) {
      expect(m.weight[key] ?? 0).toBeGreaterThan(0);
      expect(m.cap[key]).toBe(amount);
    }
  });

  it('attributes the goal step by what each cost key costs to obtain, not by how many units it is', () => {
    // A unit of one pool is not a unit of another: the tablet's 🔬 and 🔨 are equal shares of its price only
    // if a point of each takes equal work to make. Each key's per-unit credit is therefore in the same ratio
    // as its worker-round price — the count split is the special case where those prices are equal.
    const e = explainEnablers(writingRoot());
    const priced = tabletCost.map(([key]) => e.cardCosts[key]!);
    for (const p of priced) expect(p.unitCost).toBeDefined();
    for (const p of priced) {
      expect(p.marginal / priced[0].marginal).toBeCloseTo(p.unitCost! / priced[0].unitCost!);
    }
  });

  it('keeps a full cost bank worth strictly less than the goal step it converts into (sound shaping)', () => {
    const m = deriveEnablers(writingRoot());
    const fullBank = tabletCost.reduce((sum, [key]) => sum + m.weight[key]! * m.cap[key]!, 0);
    expect(fullBank).toBeGreaterThan(0);
    expect(fullBank).toBeLessThan(tabletStep());
  });

  it('rises with the banked cost then saturates at the card\'s cost', () => {
    const m = deriveEnablers(writingRoot());
    const pot = (production: number) => {
      const G = writingRoot();
      G.resources = emptyResources();
      G.resources.production = production;
      return enablerPotential(G, m);
    };
    const cost = CARDS.clay_tablet.cost.resources!.production!;
    expect(pot(cost - 2)).toBeGreaterThan(pot(0));
    expect(pot(cost + 5)).toBe(pot(cost));
  });

  it('prices the cost\'s producers durably but leaves the capacity passes at the floor (confinement)', () => {
    const m = deriveEnablers(writingRoot());
    // Forge produces production — a banked-toward resource — so the durable credit prices owning one...
    expect(m.producerCredit.forge ?? 0).toBeGreaterThan(0);
    // ...but the strategic pools stay at the same floor a gradient-free objective leaves: the capacity
    // passes price engine at a per-round accrual this stepped gradient never pays, so feeding them the
    // card marginal makes engine sinks out-compete the banking itself.
    const sandboxSame = deriveEnablers(
      createRun(
        simConfig({
          deckCardIds: ['forge', 'forge', 'toolmaking', 'toolmaking', 'farm', 'bow', 'storytelling', 'storytelling'],
          board: 'city',
          missionId: 'sandbox',
          seed: 'enablers-card-cost',
        }),
      ).G,
    );
    expect(m.weight.population).toBe(sandboxSame.weight.population);
    expect(m.weight.territory).toBe(sandboxSame.weight.territory);
  });

  it('cardCosts: false derives a card-count goal like one naming no resource', () => {
    // Nothing else values production/food on Writing, so ablating the probe empties the banking slope
    // *and* the producer credit it implied (Forge's output is only worth what the bank pays), leaving
    // just the intrinsic strategic floors.
    const m = deriveEnablers(writingRoot(), { cardCosts: false });
    expect(m.weight.production ?? 0).toBe(0);
    expect(m.weight.food ?? 0).toBe(0);
    expect(m.producerCredit.forge).toBeUndefined();
    expect(m.weight.territory ?? 0).toBeGreaterThan(0);
  });

  it('probes the tableau for a building-presence goal, keeping the best marginal per resource', () => {
    // Growing Numbers counts hut+farm *present in the tableau* — the tableau injection, not `removed`.
    // Both cost only production and move the goal equally, so the cheaper card carries the higher
    // per-unit marginal and its cost sets the cap.
    const config = simConfig({
      deckCardIds: ['hut', 'hut', 'farm', 'farm', 'foraging', 'foraging', 'toolmaking', 'toolmaking'],
      board: 'settlement',
      missionId: 'growing_numbers',
      seed: 'enablers-card-cost',
    });
    const m = deriveEnablers(createRun(config).G);
    expect(m.weight.production ?? 0).toBeGreaterThan(0);
    expect(m.cap.production).toBe(CARDS.farm.cost.resources!.production!);
  });

  it('probes a standing zone only with the kinds that reach it', () => {
    // First Trades counts open routes, and `run/moves.ts`'s `playCard` opens one only for a `trade` card.
    // Conquest is `work`, so an ungated route probe would credit banking its military toward a goal step
    // with no path to happen — competing with the money that buys the route that actually moves it.
    const config = simConfig({
      deckCardIds: ['bartering', 'conquest', 'foraging', 'foraging', 'toolmaking', 'toolmaking'],
      board: 'settlement',
      missionId: 'first_trades',
      seed: 'enablers-card-cost',
    });
    const m = goalValuedCardCosts(createRun(config).G);
    expect(m.military).toBeUndefined();
    expect(m.money!.costAmt).toBe(CARDS.bartering.cost.resources!.money!);
  });

  it('prices a pool the goal card charges through its play effect, at the same marginal as its cost', () => {
    // The Voyage's crew leaves through `effect` because `CardCost.resources` is core-only, but it is as
    // much the price of a launch as the 🪙 beside it — so the two must share one per-unit marginal, and the
    // citizen's cap must be what one launch charges.
    const config = simConfig({
      deckCardIds: ['forge', 'forge', 'farm', 'farm', 'house', 'toolmaking', 'toolmaking'],
      board: 'city',
      missionId: 'setting_sail',
      seed: 'enablers-card-cost',
    });
    const m = goalValuedCardCosts(createRun(config).G);
    expect(m.population!.cardId).toBe('voyage');
    expect(m.population!.marginal).toBe(m.money!.marginal);
    expect(m.population!.costAmt).toBe(-CARDS.voyage.effect!.resources!.population!);
  });

  it('banks every copy\'s charge of a pool nothing in the run produces per round', () => {
    // Money and production are refilled by the Trader and the Forge between launches, so one launch's
    // charge is the useful bank. Nothing *produces* population — a House mints citizens by being bought —
    // so the citizens every seeded Voyage will take must be banked at once.
    const config = simConfig({
      deckCardIds: ['forge', 'forge', 'trader', 'trader', 'farm', 'house', 'toolmaking'],
      board: 'city',
      missionId: 'setting_sail',
      seed: 'enablers-card-cost',
    });
    const G = createRun(config).G;
    const m = goalValuedCardCosts(G);
    // Across the zones, not the draw pile: the run root has already dealt the opening hand.
    const voyages = [...G.deck, ...G.hand, ...G.discard].filter((c) => c.cardId === 'voyage').length;
    expect(voyages).toBeGreaterThan(1);
    expect(m.money!.cap).toBe(CARDS.voyage.cost.resources!.money!);
    expect(m.population!.cap).toBe(-CARDS.voyage.effect!.resources!.population! * voyages);
  });

  it('keeps whichever of the price and the capacity credit is worth more at saturation', () => {
    // The one pool both passes can claim: a strategic price (cap: the single citizen a launch charges) and
    // the capacity credit (cap: `CAPACITY_CAP`). Their per-unit rates aren't comparable, so the model keeps
    // the larger *saturated* credit — and the loser must leave nothing behind.
    const G = createRun(
      simConfig({
        deckCardIds: ['forge', 'forge', 'farm', 'farm', 'house', 'toolmaking', 'toolmaking'],
        board: 'city',
        missionId: 'setting_sail',
        seed: 'enablers-card-cost',
      }),
    ).G;
    for (const terms of [DEFAULT_ENABLER_TERMS, {}]) {
      const e = explainEnablers(G, terms);
      const price = e.cardCosts.population!;
      const floored = e.capacity.population.weight * ENABLER_CONSTANTS.CAPACITY_CAP;
      const priced = ENABLER_CONSTANTS.HOP_DISCOUNT * price.marginal * OBJECTIVE_WEIGHT * price.cap;
      const kept = e.model.weight.population! * e.model.cap.population!;
      expect(kept).toBe(Math.max(floored, priced));
    }
  });

  it('registers nothing on a resource-threshold objective, so those missions\' models are untouched', () => {
    // The guarantee the acceptance sweep leans on: on every mission whose goals read only `G.resources`,
    // the probe is provably a no-op, so `deriveEnablers` output — and hence every planner/oracle
    // trajectory — is unchanged by this layer. A broad deck widens the candidate pool the probe injects.
    const resourceMissions = [
      'first_settlement', 'reading_seasons',
      'first_temple', 'masonry', 'accounting', 'pyramid',
    ];
    const deckCardIds = [
      'hut', 'farm', 'forge', 'toolmaking', 'conquest', 'beer',
      'storytelling', 'bow', 'dogs', 'foraging', 'bead_workshop', 'sun_stone',
    ];
    for (const missionId of resourceMissions) {
      const G = createRun(simConfig({ deckCardIds, board: 'settlement', missionId, seed: 'enablers-card-cost' })).G;
      expect(goalValuedCardCosts(G), missionId).toEqual({});
    }
  });

  it('values a mission-seeded event\'s cost through the `removed` count it feeds', () => {
    const config = simConfig({
      deckCardIds: ['bow', 'bow', 'dogs', 'dogs', 'foraging', 'foraging'],
      board: 'settlement',
      missionId: 'raiders_at_border',
      seed: 'enablers-card-cost',
    });
    const m = deriveEnablers(createRun(config).G);
    expect(m.weight.military ?? 0).toBeGreaterThan(0);
    expect(m.cap.military).toBe(CARDS.raider.cost.resources!.military!);
  });
});

describe('durable producer credit', () => {
  // First Settlement wins on production, so the Forge produces the goal resource directly — the case whose
  // per-unit worth lives in the goal-valued map and never in `weight` (the consumables loop skips a
  // goal-valued cost), and so the one a `weight`-only credit would silently price at zero.
  function producerRoot(): GameState {
    const config = simConfig({
      deckCardIds: ['forge', 'forge', 'archives', 'archives', 'hut', 'hut', 'bow', 'bow'],
      board: 'tribe',
      missionId: 'first_settlement',
      seed: 'enablers-durable',
    });
    return createRun(config).G;
  }

  /** The model's potential with `cardId` owned once, at the given staffing. */
  function withBuilding(cardId: string, workers: number): number {
    const G = producerRoot();
    const m = deriveEnablers(G);
    addBuilding(G, mint(G, cardId));
    G.tableau[G.tableau.length - 1]!.workers = workers;
    return enablerPotential(G, m);
  }

  it('credits a producer of the goal resource', () => {
    expect(deriveEnablers(producerRoot()).producerCredit.forge ?? 0).toBeGreaterThan(0);
  });

  it('rates a goal-resource producer above one whose output nothing values', () => {
    const m = deriveEnablers(producerRoot());
    expect(m.producerCredit.forge!).toBeGreaterThan(m.producerCredit.archives ?? 0);
  });

  it('credits ownership, not staffing — an unstaffed structure is still a re-staffable option', () => {
    const bare = enablerPotential(producerRoot(), deriveEnablers(producerRoot()));
    expect(withBuilding('forge', 0)).toBeGreaterThan(bare);
    expect(withBuilding('forge', 0)).toBe(withBuilding('forge', 1));
  });

  it('credits nothing for a one-shot placement grant', () => {
    // Hut grants population on `effect`, not `produces` — not durable income, and the strategic weights
    // already credit the population it lands.
    expect(deriveEnablers(producerRoot()).producerCredit.hut).toBeUndefined();
  });

  it('producers: false credits no structure', () => {
    expect(deriveEnablers(producerRoot()).producerCredit.forge ?? 0).toBeGreaterThan(0); // otherwise credited
    expect(Object.keys(deriveEnablers(producerRoot(), { producers: false }).producerCredit)).toHaveLength(0);
  });

  it('saturates, so a tableau of engine never outbids the objective it serves', () => {
    // Read the *durable* term in isolation — the marginal forge past the cap — so a board rebalance moving
    // the starting pools can't break this for reasons unrelated to the credit.
    const G = producerRoot();
    const m = deriveEnablers(G);
    for (let i = 0; i < 40; i++) addBuilding(G, mint(G, 'forge'));
    const saturated = enablerPotential(G, m);
    addBuilding(G, mint(G, 'forge'));
    expect(enablerPotential(G, m)).toBe(saturated);
    expect(m.producerCredit.forge! * 41).toBeGreaterThan(OBJECTIVE_WEIGHT); // the cap is what bound it
  });
});

describe('multi-output goal producers', () => {
  beforeAll(() => {
    installFixtures();
    installCards(MULTI_OUTPUT_PRODUCERS);
  });
  afterAll(() => {
    uninstallCards(MULTI_OUTPUT_PRODUCERS);
    uninstallFixtures();
  });

  function twoTermRoot(deckCardIds: string[]): GameState {
    const config = simConfig({
      deckCardIds, board: 'settlement', missionId: 'test_culture_and_production_win', seed: 'enablers-multi',
    });
    return createRun(config).G;
  }

  it('sums a card\'s goal contributions rather than taking its largest', () => {
    // Both producers pay 1🔨/worker; only one *also* pays 1🎭, and both are goal terms here. A card yields
    // every line of its `produces` each round, so the two-term one must rate strictly higher — under a
    // max-across-keys fold the two are identical, which is what this pins.
    const one = deriveEnablers(twoTermRoot(['test_one_term', 'foraging']));
    const two = deriveEnablers(twoTermRoot(['test_two_terms', 'foraging']));
    expect(one.weight.population ?? 0).toBeGreaterThan(0);
    expect(two.weight.population!).toBeGreaterThan(one.weight.population!);
  });
});

describe('culture enabler', () => {
  beforeAll(installFixtures);
  afterAll(uninstallFixtures);

  // First Settlement wins on production/military; culture is *not* goal-valued, so a producer gated behind a
  // culture level makes reaching that level an enabler. Göbekli Tepe is gated at culture level 1 and produces
  // production (a goal resource here).
  function firstSettlementRoot(deckCardIds: string[]): GameState {
    const config = simConfig({ deckCardIds, board: 'tribe', missionId: 'first_settlement', seed: 'enablers-culture' });
    return createRun(config).G;
  }

  // The synthetic culture mission wins *at* a culture level and names no other term, so culture is the whole
  // objective — used to pin the gate-unlock skip and, contrastingly, the hand-size credit that survives it.
  function cultureWinRoot(deckCardIds: string[]): GameState {
    const config = simConfig({ deckCardIds, board: 'settlement', missionId: 'test_culture_win', seed: 'enablers-culture-skip' });
    return createRun(config).G;
  }

  // The same culture level conjoined with a production threshold: culture is goal-valued *and* has a sibling
  // term, so the level a producer is gated behind is worth that producer's output on the sibling.
  function cultureAndProductionRoot(deckCardIds: string[]): GameState {
    const config = simConfig({
      deckCardIds, board: 'settlement', missionId: 'test_culture_and_production_win', seed: 'enablers-culture-conj',
    });
    return createRun(config).G;
  }

  it('credits the culture level that ungates a goal producer, when culture is not goal-valued', () => {
    const m = deriveEnablers(firstSettlementRoot(['gobekli_tepe', 'toolmaking', 'bow', 'bow']));
    expect(m.weight.culture ?? 0).toBeGreaterThan(0);
    expect(m.cap.culture ?? 0).toBeGreaterThan(0);
  });

  it('skips the gate-unlock when culture is the objective\'s only term', () => {
    // Reaching the level *is* the whole win there, scored directly, and the only thing the gated producer
    // could be credited for is culture itself — which would restate that same slope.
    const m = deriveEnablers(cultureWinRoot(['gobekli_tepe', 'sun_stone', 'sun_stone']));
    expect(m.weight.culture ?? 0).toBe(0);
  });

  it('still credits the gate-unlock when culture is goal-valued alongside another term', () => {
    // Göbekli is gated at culture level 1 and produces production — the sibling goal term — so banking
    // culture toward that level is worth the production it ungates, which the objective's culture slope
    // does not express. Without the gated producer there is nothing to credit and the weight goes away.
    const gated = deriveEnablers(cultureAndProductionRoot(['gobekli_tepe', 'sun_stone', 'toolmaking']));
    const ungated = deriveEnablers(cultureAndProductionRoot(['sun_stone', 'sun_stone', 'toolmaking']));
    expect(gated.weight.culture ?? 0).toBeGreaterThan(0);
    expect(ungated.weight.culture ?? 0).toBe(0);
  });

  it('credits hand-size throughput per culture level even when culture is goal-valued', () => {
    // A bigger hand helps every goal, not the one the level might be — so unlike the gate-unlock it rides no
    // skip. Level-based (not linear in raw culture): flat within a level, a step up at each new level.
    const m = deriveEnablers(cultureWinRoot(['sun_stone', 'sun_stone', 'foraging']));
    expect(m.handsizePerLevel ?? 0).toBeGreaterThan(0);
    const pot = (culture: number) => {
      const G = cultureWinRoot(['sun_stone', 'sun_stone', 'foraging']);
      G.resources = emptyResources();
      G.resources.culture = culture;
      return enablerPotential(G, m);
    };
    expect(pot(cultureForLevel(1))).toBeGreaterThan(pot(0));
    expect(pot(cultureForLevel(2))).toBeGreaterThan(pot(cultureForLevel(1)));
  });

  it('sets no hand-size credit when the deck cannot grow culture', () => {
    const m = deriveEnablers(pyramidRoot(['toolmaking', 'toolmaking', 'foraging', 'foraging']));
    expect(m.handsizePerLevel).toBeUndefined();
  });

  it('handSize: false sets no hand-size credit even when the deck grows culture', () => {
    const m = deriveEnablers(cultureWinRoot(['sun_stone', 'sun_stone', 'foraging']), { handSize: false });
    expect(m.handsizePerLevel).toBeUndefined();
  });
});

describe('enabler term toggles', () => {
  it('the shipped default is the measured lean set: capacity + producers + cardCosts', () => {
    // Pins the planner's default terms against silent drift — changing this is a re-measured decision
    // (see `DEFAULT_ENABLER_TERMS`), not a refactor.
    expect(DEFAULT_ENABLER_TERMS).toEqual({ conversions: false, floor: false, handSize: false });
  });


  it('every term on is exactly the default model', () => {
    const explicit = deriveEnablers(masonryRoot(), {
      cardCosts: true,
      conversions: true,
      capacity: true,
      floor: true,
      handSize: true,
      producers: true,
    });
    expect(explicit).toEqual(deriveEnablers(masonryRoot()));
  });

  it('every term off is the empty model — the `enablers: false` endpoint', () => {
    const m = deriveEnablers(masonryRoot(), {
      cardCosts: false,
      conversions: false,
      capacity: false,
      floor: false,
      handSize: false,
      producers: false,
    });
    expect(m).toEqual({ weight: {}, cap: {}, producerCredit: {} });
    const G = masonryRoot();
    addBuilding(G, mint(G, 'farm'));
    expect(enablerPotential(G, m)).toBe(0);
  });
});

describe('explainEnablers (the derivation record sim:valuation prints)', () => {
  // A **card-count** goal: Writing wins on tablets in `removed`, so no resource moves the gradient and the
  // capacity pass derives nothing for any strategic pool — the case where the finished model's *absences*
  // carry all the information. The farms are what make a food rate exist while nothing charges it.
  function cardCountRoot(seed = 'explain-card-count'): GameState {
    return createRun(
      simConfig({
        deckCardIds: ['farm', 'farm', 'toolmaking', 'storytelling', 'hut'],
        board: 'city',
        missionId: 'writing',
        seed,
      }),
    ).G;
  }

  const ONLY_CARD_COSTS = { conversions: false, capacity: false, floor: false, handSize: false, producers: false };
  const TERM_SETS = [{}, DEFAULT_ENABLER_TERMS, ONLY_CARD_COSTS];

  it('returns exactly the model deriveEnablers returns', () => {
    // The whole safety argument for splitting the derivation: the moment the two stop sharing a pass, a
    // printed valuation starts describing something no policy ranks by.
    for (const G of [masonryRoot(), cardCountRoot()]) {
      for (const terms of TERM_SETS) {
        expect(explainEnablers(G, terms).model).toEqual(deriveEnablers(G, terms));
      }
    }
  });

  it('derives the same model whatever the shuffle', () => {
    // What `sim:valuation`'s absent `--seed` flag rests on: the probes read the deck as an unordered set,
    // so shuffle order cannot reach the model.
    expect(deriveEnablers(cardCountRoot('explain-seed-a'))).toEqual(deriveEnablers(cardCountRoot('explain-seed-b')));
  });

  it('names the card that set a capacity throughput, at the rate that card really pays', () => {
    const e = explainEnablers(masonryRoot());
    const c = e.capacity.territory;
    expect(c.cardId).toBeDefined();
    // Recompute off the catalogue rather than pinning a literal, so a rebalance re-targets this.
    const card = CARDS[c.cardId!];
    let expected = 0;
    for (const [k, marginal] of Object.entries(e.goalValued) as [keyof Resources, number][]) {
      if (k === 'territory') continue;
      const output = (card.effect?.resources?.[k] ?? 0) + (card.produces?.resources?.[k] ?? 0);
      if (output > 0) expected += output * marginal * OBJECTIVE_WEIGHT;
    }
    expect(c.throughput).toBeCloseTo(expected, 10);
    expect(c.derived).toBeCloseTo(c.throughput * ENABLER_CONSTANTS.CAPACITY_HORIZON, 10);
  });

  it('attributes every weight in the model to a recorded pass', () => {
    // A future pass that adds a weight source without recording it would leave a credit the report renders
    // as blank — a number with no stated origin, which is the one thing this tool exists not to print.
    for (const G of [masonryRoot(), cardCountRoot()]) {
      for (const terms of TERM_SETS) {
        const e = explainEnablers(G, terms);
        for (const k of Object.keys(e.model.weight) as (keyof Resources)[]) {
          expect(weightSource(e, k)).not.toBe('');
        }
      }
    }
  });

  it('distinguishes a floored strategic weight from a derived one', () => {
    // The fact the Setting Sail balance question turned on: on a card-count goal the capacity pass derives
    // nothing, so population's only weight under the full model is the blind intrinsic floor — and under
    // the planner's shipped terms it has no weight at all.
    const G = cardCountRoot();
    const full = explainEnablers(G, {});
    expect(full.capacity.population.throughput).toBe(0);
    expect(full.capacity.population.floorApplied).toBe(true);
    expect(full.model.weight.population).toBe(ENABLER_CONSTANTS.INTRINSIC_CAPACITY_CREDIT);

    const planner = explainEnablers(G, DEFAULT_ENABLER_TERMS);
    expect(planner.capacity.population.floorApplied).toBe(false);
    expect(planner.model.weight.population).toBeUndefined();
  });

  it('records the food rate even where the model never charges it', () => {
    const e = explainEnablers(cardCountRoot(), {});
    expect(e.capacity.population.throughput).toBe(0); // nothing derived ⇒ nothing to net against
    expect(e.model.foodPerWorker).toBeUndefined();
    expect(e.foodPerWorker.value).toBeGreaterThan(0);
    expect(e.foodPerWorker.cardId).toBe('farm');
  });
});
