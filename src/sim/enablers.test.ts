import { describe, it, expect } from 'vitest';
import { createRun } from '../run/engine';
import { simConfig } from './simulate';
import { deriveEnablers, enablerPotential } from './enablers';
import { OBJECTIVE_WEIGHT } from './value';
import { objectiveProgress } from './objective';
import { CARDS } from '../content/cards';
import { cultureForLevel, emptyResources, type GameState } from '../rules';

// The two conversion costs the Masonry deck rides on, read from content so a rebalance re-targets these
// expectations instead of silently breaking on a stale literal — the assertions pin the *relationship* (a
// resource's cap is its converter's cost), not the number.
const HUT_PRODUCTION_COST = CARDS.hut.cost.production!;
const CONQUEST_MILITARY_COST = CARDS.conquest.cost.military!;

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
    expect(pot('production', HUT_PRODUCTION_COST - 2)).toBeGreaterThan(pot('production', 0));
    expect(pot('production', HUT_PRODUCTION_COST + 5)).toBe(pot('production', HUT_PRODUCTION_COST));
    // military → territory (the chained hop), saturating at the Conquest cost
    expect(pot('military', 0)).toBe(0);
    expect(pot('military', CONQUEST_MILITARY_COST - 2)).toBeGreaterThan(pot('military', 0));
    expect(pot('military', CONQUEST_MILITARY_COST + 3)).toBe(pot('military', CONQUEST_MILITARY_COST));
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
function pyramidRoot(deckCardIds: string[]): GameState {
  const config = simConfig({ deckCardIds, board: 'city', missionId: 'pyramid', seed: 'enablers-pop-test' });
  return createRun(config).G;
}

describe('population capacity enabler', () => {
  it('credits population as a durable, multi-round enabler when it is not itself goal-valued', () => {
    const deck = ['toolmaking', 'toolmaking', 'foraging', 'foraging', 'farm', 'farm', 'jewelry', 'jewelry'];
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
    // Beer (5🎭/worker) is a stronger culture producer than Cave Art (2🎭/worker); the population credit
    // tracks the best staffable, so a deck holding Beer earns more per population than one without it.
    const withBeer = deriveEnablers(pyramidRoot(['cave_art', 'beer', 'foraging', 'foraging']));
    const caveArtOnly = deriveEnablers(pyramidRoot(['cave_art', 'foraging', 'foraging']));
    expect(withBeer.weight.population!).toBeGreaterThan(caveArtOnly.weight.population!);
  });

  it('rises with banked population then saturates at the cap', () => {
    const m = deriveEnablers(pyramidRoot(['toolmaking', 'toolmaking', 'foraging', 'foraging']));
    const pot = (population: number) => {
      const G = pyramidRoot(['toolmaking', 'toolmaking', 'foraging', 'foraging']);
      G.resources = emptyResources();
      G.resources.population = population;
      return enablerPotential(G, m);
    };
    expect(pot(0)).toBe(0);
    expect(pot(5)).toBeGreaterThan(pot(0));
    expect(pot(100)).toBe(pot(50)); // saturates at the cap — hoarding population past it earns nothing
  });

  it('does not double-credit population when it is itself the objective (Masonry)', () => {
    // Masonry's win *is* population, so it's scored directly, not as an enabler — the same skip the
    // spend-a-resource enablers apply to a goal-valued cost resource.
    const m = deriveEnablers(masonryRoot());
    expect(m.weight.population ?? 0).toBe(0);
  });
});

describe('intrinsic strategic floor', () => {
  // Growing Numbers wins on a *building count*, so no resource moves `objectiveProgress` and every
  // objective-derived credit is zero — the case the floor exists for.
  function cardCountRoot(): GameState {
    const config = simConfig({
      deckCardIds: ['hut', 'hut', 'farm', 'farm', 'foraging', 'foraging', 'toolmaking', 'toolmaking'],
      board: 'settlement',
      missionId: 'growing_numbers',
      seed: 'enablers-intrinsic',
    });
    return createRun(config).G;
  }

  it('credits all three strategic pools on an objective that names no resource', () => {
    const m = deriveEnablers(cardCountRoot());
    for (const k of ['territory', 'population', 'culture'] as const) {
      expect(m.weight[k] ?? 0, k).toBeGreaterThan(0);
      expect(m.cap[k], k).toBeDefined();
    }
  });

  it('rises with a held strategic pool where the derived model alone would be flat', () => {
    const m = deriveEnablers(cardCountRoot());
    const pot = (population: number) => {
      const G = cardCountRoot();
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
    expect(derived).toBeGreaterThan(deriveEnablers(cardCountRoot()).weight.territory!);
  });

  it('stays below a goal step, so engine never outbids the objective it serves', () => {
    // The floor is a growth nudge, not a competing goal: a fully saturated strategic pool must score under a
    // single unit of objective progress.
    const m = deriveEnablers(cardCountRoot());
    const saturated = m.weight.population! * m.cap.population!;
    expect(saturated).toBeLessThan(OBJECTIVE_WEIGHT);
  });
});

describe('culture enabler', () => {
  // First Settlement wins on production/military; culture is *not* goal-valued, so a producer gated behind a
  // culture level makes reaching that level an enabler. Göbekli Tepe is gated at culture level 1 and produces
  // production (a goal resource here).
  function firstSettlementRoot(deckCardIds: string[]): GameState {
    const config = simConfig({ deckCardIds, board: 'tribe', missionId: 'first_settlement', seed: 'enablers-culture' });
    return createRun(config).G;
  }

  // Rites & Rituals wins *at* a culture level, so culture is goal-valued there — used to pin the gate-unlock
  // skip and, contrastingly, the hand-size credit that survives it.
  function ritesRoot(deckCardIds: string[]): GameState {
    const config = simConfig({ deckCardIds, board: 'settlement', missionId: 'rites_rituals', seed: 'enablers-culture-skip' });
    return createRun(config).G;
  }

  it('credits the culture level that ungates a goal producer, when culture is not goal-valued', () => {
    const m = deriveEnablers(firstSettlementRoot(['gobekli_tepe', 'toolmaking', 'bow', 'bow']));
    expect(m.weight.culture ?? 0).toBeGreaterThan(0);
    expect(m.cap.culture ?? 0).toBeGreaterThan(0);
  });

  it('skips the gate-unlock when culture is itself the objective', () => {
    // Reaching the level *is* the win on Rites, scored directly — so the gated producer isn't a separate enabler.
    const m = deriveEnablers(ritesRoot(['gobekli_tepe', 'burial', 'burial']));
    expect(m.weight.culture ?? 0).toBe(0);
  });

  it('credits hand-size throughput per culture level even when culture is goal-valued', () => {
    // A bigger hand helps every goal, not the one the level might be — so unlike the gate-unlock it rides no
    // skip. Level-based (not linear in raw culture): flat within a level, a step up at each new level.
    const m = deriveEnablers(ritesRoot(['burial', 'burial', 'foraging']));
    expect(m.handsizePerLevel ?? 0).toBeGreaterThan(0);
    const pot = (culture: number) => {
      const G = ritesRoot(['burial', 'burial', 'foraging']);
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
});
