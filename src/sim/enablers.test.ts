import { describe, it, expect } from 'vitest';
import { createRun } from '../run/engine';
import { simConfig } from './simulate';
import { deriveEnablers, enablerPotential } from './enablers';
import { OBJECTIVE_WEIGHT } from './value';
import { objectiveProgress } from './objective';
import { CARDS } from '../content/cards';
import { emptyResources, type GameState } from '../rules';

// The two conversions the Masonry deck rides on, read from content so a Hut/Conquest cost rebalance
// re-targets these expectations instead of silently breaking on a stale literal — the assertions pin the
// *relationship* (a resource's cap is its converter's cost), not the number.
const HUT_PRODUCTION_COST = CARDS.hut.cost.production!;
const CONQUEST_MILITARY_COST = CARDS.conquest.cost.military!;

// A real Masonry run root (Settlement board), so the enabler model derives through the same path
// production uses — from the mission's seeded objective and the deck's own conversions (Hut, Conquest).
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

describe('enabler potential (planner leaf accelerator)', () => {
  it('derives the deck\'s conversion chain toward the Masonry objective', () => {
    const m = deriveEnablers(masonryRoot());
    // Masonry wins on population, grown by Huts — production (a Hut's cost) is a production→population enabler.
    expect(m.weight.production ?? 0).toBeGreaterThan(0);
    expect(m.cap.production).toBe(HUT_PRODUCTION_COST);
    // Population also rides on territory (a Hut needs a free slot), grown by Conquest (its military cost) —
    // the override makes territory goal-valued, so military is a military→territory enabler.
    expect(m.weight.military ?? 0).toBeGreaterThan(0);
    expect(m.cap.military).toBe(CONQUEST_MILITARY_COST);
  });

  it('credits only the banking resources, not survival pools or the goal resources themselves', () => {
    const m = deriveEnablers(masonryRoot());
    // food only feeds military (Dogs) — a second hop, not credited by the one-hop model; science/money
    // feed nothing here; population/territory are credited directly by the objective, not as enablers.
    for (const k of ['food', 'science', 'money', 'population', 'territory'] as const) {
      expect(m.weight[k] ?? 0, k).toBe(0);
    }
  });

  it('rises with a banked enabler up to its conversion cost, then saturates', () => {
    const m = deriveEnablers(masonryRoot());
    const pot = (military: number, production: number) => {
      const G = masonryRoot();
      G.resources.military = military;
      G.resources.production = production;
      return enablerPotential(G, m);
    };
    expect(pot(0, 0)).toBe(0);
    expect(pot(CONQUEST_MILITARY_COST - 2, 0)).toBeGreaterThan(pot(0, 0));
    expect(pot(CONQUEST_MILITARY_COST, 0)).toBeGreaterThan(pot(CONQUEST_MILITARY_COST - 2, 0));
    expect(pot(CONQUEST_MILITARY_COST + 3, 0)).toBe(pot(CONQUEST_MILITARY_COST, 0)); // saturates at the Conquest cost
    expect(pot(0, HUT_PRODUCTION_COST - 2)).toBeGreaterThan(pot(0, 0));
    expect(pot(0, HUT_PRODUCTION_COST)).toBeGreaterThan(pot(0, HUT_PRODUCTION_COST - 2));
    expect(pot(0, HUT_PRODUCTION_COST + 5)).toBe(pot(0, HUT_PRODUCTION_COST)); // saturates at the Hut cost
  });

  it('keeps a full bank worth strictly less than the objective step converting it yields (sound shaping)', () => {
    const m = deriveEnablers(masonryRoot());
    const fullBank = (resource: 'military' | 'production') => {
      const G = masonryRoot();
      G.resources = emptyResources();
      G.resources[resource] = m.cap[resource]!;
      return enablerPotential(G, m);
    };
    // Banking 5⚔️ must score below the +1 territory a Conquest turns it into, so playing beats hoarding.
    expect(fullBank('military')).toBeLessThan(objectiveStep('territory'));
    expect(fullBank('production')).toBeLessThan(objectiveStep('population'));
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
    // Masonry's win *is* population (a sim override makes it goal-valued), so it's scored directly, not as an
    // enabler — the same skip the spend-a-resource enablers apply to a goal-valued cost resource.
    const m = deriveEnablers(masonryRoot());
    expect(m.weight.population ?? 0).toBe(0);
  });
});
