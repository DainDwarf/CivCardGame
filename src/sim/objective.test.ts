import { describe, it, expect } from 'vitest';
import { objectiveProgress, hasObjectiveGradient, OVERRIDES } from './objective';
import { blankState, seedObjective, cultureForLevel, type GameState } from '../rules';
import { CARDS } from '../content/cards';

/** A zeroed state carrying the given objective card, tweaked per case. */
function withObjective(cardId: string, mut: (G: GameState) => void = () => {}): GameState {
  const G = blankState('sandbox');
  seedObjective(G, cardId);
  mut(G);
  return G;
}

describe('objectiveProgress (sim-local goal gradient)', () => {
  it('is 0 at the start of "The First Settlement" and 1 exactly when both thresholds are met', () => {
    expect(objectiveProgress(withObjective('first_settlement_goal'))).toBe(0);
    const won = withObjective('first_settlement_goal', (G) => {
      G.resources.production = 10;
      G.resources.military = 10;
    });
    expect(objectiveProgress(won)).toBe(1);
  });

  it('rises monotonically as either threshold resource accumulates', () => {
    const p = (prod: number, mil: number) =>
      objectiveProgress(
        withObjective('first_settlement_goal', (G) => {
          G.resources.production = prod;
          G.resources.military = mil;
        }),
      );
    expect(p(5, 0)).toBeGreaterThan(p(0, 0));
    expect(p(5, 5)).toBeGreaterThan(p(5, 0));
    expect(p(10, 5)).toBeGreaterThan(p(5, 5));
  });

  it('caps each term at its threshold — hoarding past a threshold earns no more progress', () => {
    // Two states, both short 6 military; one has 10 production, the other a hoarded 100. The gradient
    // must be identical — the excess production is worthless, which is what pushes a policy to convert it.
    const atThreshold = withObjective('first_settlement_goal', (G) => {
      G.resources.production = 10;
      G.resources.military = 4;
    });
    const hoarding = withObjective('first_settlement_goal', (G) => {
      G.resources.production = 100;
      G.resources.military = 4;
    });
    expect(objectiveProgress(hoarding)).toBe(objectiveProgress(atThreshold));
    expect(objectiveProgress(atThreshold)).toBeLessThan(1);
  });

  it('rises with accumulated culture on "Rites & Rituals" and is 1 exactly at level 1', () => {
    const p = (culture: number) =>
      objectiveProgress(withObjective('rites_rituals_goal', (G) => (G.resources.culture = culture)));
    expect(p(0)).toBe(0);
    // Sub-level culture registers (a discrete cultureLevel would read 0 all the way to 10).
    expect(p(5)).toBeGreaterThan(p(0));
    expect(p(9)).toBeGreaterThan(p(5)); // still short of the level
    expect(p(9)).toBeLessThan(1); // one short of the level still isn't done
    expect(p(10)).toBe(1); // level 1 = the win
    // Never spent, so hoarding past the goal earns no more.
    expect(p(70)).toBe(1);
  });

  it('the sandbox never wins and offers no gradient to climb (a purely-bespoke goal)', () => {
    // `sandbox_goal`'s single goal is `met: () => false` with a constant-0 measure, so the progress is
    // 0 regardless of how rich the state is — no steering, and the greedy scorer is unchanged on it.
    const rich = withObjective('sandbox_goal', (G) => {
      G.resources.production = 50;
      G.resources.military = 50;
      G.round = 20;
    });
    expect(objectiveProgress(rich)).toBe(0);
    expect(hasObjectiveGradient(rich)).toBe(false);
  });

  it('is 0 when no objective is seeded', () => {
    expect(objectiveProgress(blankState('sandbox'))).toBe(0);
    expect(hasObjectiveGradient(blankState('sandbox'))).toBe(false);
  });

  it('reports a climbable gradient for the declarative objectives', () => {
    for (const cardId of ['first_settlement_goal', 'rites_rituals_goal', 'raiders_at_border_goal']) {
      expect(hasObjectiveGradient(withObjective(cardId)), cardId).toBe(true);
    }
  });

  // Balance-neutrality: the goals-derived gradient must reproduce the pre-refactor per-objective
  // formulas bit-for-bit, so migrating to declarative goals can't silently shift any policy's steering.
  it('reproduces the pre-refactor gradient for the purely-declarative objectives', () => {
    const fs = (prod: number, mil: number) =>
      objectiveProgress(
        withObjective('first_settlement_goal', (G) => {
          G.resources.production = prod;
          G.resources.military = mil;
        }),
      );
    // old: (min(prod,10) + min(mil,10)) / 20
    expect(fs(3, 7)).toBe((Math.min(3, 10) + Math.min(7, 10)) / 20);
    expect(fs(12, 4)).toBe((Math.min(12, 10) + Math.min(4, 10)) / 20);

    const rs = (sci: number) =>
      objectiveProgress(withObjective('reading_seasons_goal', (G) => (G.resources.science = sci)));
    expect(rs(6)).toBe(Math.min(6, 10) / 10); // old: min(science,10)/10
    expect(rs(14)).toBe(1);

    const raid = (n: number) =>
      objectiveProgress(
        withObjective('raiders_at_border_goal', (G) => {
          G.removed = Array.from({ length: n }, (_, i) => ({ id: i + 1, cardId: 'raider' }));
        }),
      );
    expect(raid(1)).toBe(Math.min(1, 3) / 3); // old: min(count,RAIDER_WAVES)/RAIDER_WAVES
    expect(raid(5)).toBe(1);

    const cult = (c: number) =>
      objectiveProgress(withObjective('rites_rituals_goal', (G) => (G.resources.culture = c)));
    expect(cult(5)).toBe(Math.min(5, cultureForLevel(1)) / cultureForLevel(1)); // old: min(culture,target)/target
  });

  // Territory is no longer blended into growing_numbers/masonry as a steering override — both ride the
  // generic goals average now (building count / population), with territory valued only as a capacity
  // enabler in `sim/enablers.ts`. So the gradient must respond to the real goal, not territory.
  it('growing_numbers/masonry ride the generic goals gradient, not a territory override', () => {
    const gn = (huts: boolean, farm: boolean) =>
      objectiveProgress(
        withObjective('growing_numbers_goal', (G) => {
          G.resources.territory = 5; // ignored now — only built buildings move the gradient
          G.tableau = [
            ...(huts ? [{ id: 1, cardId: 'hut', workers: 0 }] : []),
            ...(farm ? [{ id: 2, cardId: 'farm', workers: 0 }] : []),
          ];
        }),
      );
    expect(gn(false, false)).toBe(0); // territory alone no longer contributes
    expect(gn(true, false)).toBe(0.5);
    expect(gn(true, true)).toBe(1);

    const mas = (population: number, territory: number) =>
      objectiveProgress(withObjective('masonry_goal', (G) => {
        G.resources.population = population;
        G.resources.territory = territory;
      }));
    expect(mas(3, 5)).toBe(mas(3, 0)); // territory doesn't move the masonry gradient
    expect(mas(6, 0)).toBe(1);
  });

  // Coherence, never deferred (see the data-coherence-vs-balance convention): a mistyped/renamed
  // override key would silently drop its steering term, surfacing only as a drifted sweep.
  it('every OVERRIDES key names a real objective card', () => {
    for (const cardId of Object.keys(OVERRIDES)) {
      const card = CARDS[cardId];
      expect(card, `OVERRIDES key '${cardId}' has no card`).toBeDefined();
      expect(card.kind, `OVERRIDES key '${cardId}' is not an objective card`).toBe('objective');
    }
  });
});
