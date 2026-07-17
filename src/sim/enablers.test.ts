import { describe, it, expect } from 'vitest';
import { createRun } from '../run/engine';
import { simConfig } from './simulate';
import { deriveEnablers, enablerPotential } from './enablers';
import { OBJECTIVE_WEIGHT } from './value';
import { objectiveProgress } from './objective';
import { emptyResources, type GameState } from '../rules';

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
    // Masonry wins on population, grown by Huts (cost 4🔨) — production is a production→population enabler.
    expect(m.weight.production ?? 0).toBeGreaterThan(0);
    expect(m.cap.production).toBe(4);
    // Population also rides on territory (a Hut needs a free slot), grown by Conquest (cost 5⚔️) — the
    // override makes territory goal-valued, so military is a military→territory enabler.
    expect(m.weight.military ?? 0).toBeGreaterThan(0);
    expect(m.cap.military).toBe(5);
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
    expect(pot(3, 0)).toBeGreaterThan(pot(0, 0));
    expect(pot(5, 0)).toBeGreaterThan(pot(3, 0));
    expect(pot(8, 0)).toBe(pot(5, 0)); // saturates at the Conquest cost (5)
    expect(pot(0, 2)).toBeGreaterThan(pot(0, 0));
    expect(pot(0, 4)).toBeGreaterThan(pot(0, 2));
    expect(pot(0, 9)).toBe(pot(0, 4)); // saturates at the Hut cost (4)
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
