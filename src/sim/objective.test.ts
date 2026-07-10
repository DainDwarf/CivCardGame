import { describe, it, expect } from 'vitest';
import { objectiveProgress, PROGRESS } from './objective';
import { blankState, seedObjective, type GameState } from '../rules';
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

  it('falls back to the binary met/not for an objective with no authored gradient (the sandbox never wins)', () => {
    // `sandbox_goal.objective` is `() => false`, so with no registry entry the progress is a constant 0
    // regardless of how rich the state is — no steering, and the greedy scorer is unchanged on it.
    const rich = withObjective('sandbox_goal', (G) => {
      G.resources.production = 50;
      G.resources.military = 50;
      G.round = 20;
    });
    expect(objectiveProgress(rich)).toBe(0);
  });

  it('is 0 when no objective is seeded', () => {
    expect(objectiveProgress(blankState('sandbox'))).toBe(0);
  });

  // Coherence, never deferred (see the data-coherence-vs-balance convention): a mistyped/renamed key
  // would silently fall back to the flat gradient and drift that whole mission, surfacing only as a
  // `simulateRun` throw when it's swept. Pin every key to a real objective card at test time instead.
  it('every registry key names a real objective card', () => {
    for (const cardId of Object.keys(PROGRESS)) {
      const card = CARDS[cardId];
      expect(card, `PROGRESS key '${cardId}' has no card`).toBeDefined();
      expect(card.kind, `PROGRESS key '${cardId}' is not an objective card`).toBe('objective');
    }
  });
});
