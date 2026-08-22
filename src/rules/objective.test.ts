import { describe, it, expect } from 'vitest';
import { blankState } from './state';
import { seedObjective, objectiveMet, goalsReadout, runScore } from './objective';
import { cultureForLevel, cultureLevel } from './culture';
import { installCards, installFixtures, uninstallCards, uninstallFixtures } from './testFixtures';
import { CARDS } from '../content/cards';
import type { GameState } from './state';

/** A zeroed state carrying the given objective card, tweaked per case. */
function withObjective(cardId: string, mut: (G: GameState) => void = () => {}): GameState {
  const G = blankState('sandbox');
  seedObjective(G, cardId);
  mut(G);
  return G;
}

describe('goalsReadout (derived objective readout)', () => {
  // The user-visible string that replaced the removed `dynamicText` on the plain-threshold objectives:
  // `icon capped/target` per goal, joined with ` · `. Pins the exact format so a wrong edit can't drift it.
  it('formats each goal as `icon capped/target`, joined with a middot', () => {
    const goals = CARDS.first_settlement_goal.goals!;
    const G = blankState('sandbox');
    expect(goalsReadout(goals, G)).toBe('🔨 0/10 · ⚔️ 0/10');
    G.resources.production = 4;
    G.resources.military = 8;
    expect(goalsReadout(goals, G)).toBe('🔨 4/10 · ⚔️ 8/10');
  });

  it('caps the numerator at the target — a hoarded pool never reads past its goal', () => {
    const goals = CARDS.reading_seasons_goal.goals!;
    const G = blankState('sandbox');
    G.resources.science = 6;
    expect(goalsReadout(goals, G)).toBe('🔬 6/10');
    G.resources.science = 25; // past the threshold
    expect(goalsReadout(goals, G)).toBe('🔬 10/10');
  });
});

describe('objectiveMet (goals-derived win boolean)', () => {
  it('wins "The First Settlement" only when BOTH thresholds are met', () => {
    expect(objectiveMet(withObjective('first_settlement_goal', (G) => (G.resources.production = 10)))).toBe(false);
    expect(objectiveMet(withObjective('first_settlement_goal', (G) => (G.resources.military = 10)))).toBe(false);
    expect(
      objectiveMet(
        withObjective('first_settlement_goal', (G) => {
          G.resources.production = 10;
          G.resources.military = 10;
        }),
      ),
    ).toBe(true);
  });

  // A culture-*level* win is modelled as the threshold `culture >= cultureForLevel(N)`. Pin that this
  // is exactly equivalent to `cultureLevel(culture) >= N` at the band boundary (a `>=` vs `>`
  // off-by-one here would silently change the win condition). Measured against the synthetic
  // `test_culture_objective`: no shipped mission wins on culture any more, so the shape has to be
  // pinned off the catalogue or it can't be pinned at all.
  it('the culture threshold exactly matches the cultureLevel predicate', () => {
    installFixtures();
    try {
      const met = (culture: number) =>
        objectiveMet(withObjective('test_culture_objective', (G) => (G.resources.culture = culture)));
      for (let culture = 0; culture <= cultureForLevel(1) + 20; culture++) {
        expect(met(culture)).toBe(cultureLevel(culture) >= 1);
      }
    } finally {
      uninstallFixtures();
    }
  });

  it('a purely-bespoke never-met goal (the sandbox) never wins, however rich the state', () => {
    expect(
      objectiveMet(
        withObjective('sandbox_goal', (G) => {
          G.resources.production = 999;
          G.round = 999;
        }),
      ),
    ).toBe(false);
  });
});

describe('runScore (infinite-mission score)', () => {
  const scoredObjective = {
    test_scored_goal: {
      id: 'test_scored_goal', name: 'Test Scored Goal', kind: 'objective' as const, cost: {},
      goals: [{ icon: 'x', measure: () => 0, target: 1, met: () => false }],
      score: (G: GameState) => G.resources.military * 2,
    },
  };

  it('is undefined with no objective seeded, or one declaring no score measure', () => {
    const bare = blankState('sandbox');
    bare.round = 9;
    expect(runScore(bare)).toBeUndefined();
    expect(runScore(withObjective('sandbox_goal', (G) => (G.round = 23)))).toBeUndefined();
  });

  it("reads the objective card's own score measure when it carries one", () => {
    installCards(scoredObjective);
    try {
      const G = withObjective('test_scored_goal', (g) => {
        g.round = 50;
        g.resources.military = 4;
      });
      expect(runScore(G)).toBe(8); // the measure, not the round
    } finally {
      uninstallCards(scoredObjective);
    }
  });
});
