import { describe, it, expect } from 'vitest';
import { blankState } from './state';
import { seedObjective, objectiveMet, goalsReadout } from './objective';
import { cultureForLevel, cultureLevel } from './culture';
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

  // The refactor models a culture-*level* win as `culture >= cultureForLevel(N)`. Pin that this is
  // exactly equivalent to the old `cultureLevel(culture) >= N` at the band boundary (a `>=` vs `>`
  // off-by-one here would silently change the win condition).
  it('the culture threshold exactly matches the old cultureLevel predicate', () => {
    const met = (cardId: string, culture: number) =>
      objectiveMet(withObjective(cardId, (G) => (G.resources.culture = culture)));
    for (let culture = 0; culture <= cultureForLevel(2) + 20; culture++) {
      expect(met('rites_rituals_goal', culture)).toBe(cultureLevel(culture) >= 1);
      expect(met('restless_people_goal', culture)).toBe(cultureLevel(culture) >= 2);
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
