import { describe, it, expect } from 'vitest';
import { MISSIONS } from './missions';
import { blankState, type BuildingInstance } from '../rules';

const b = (buildingId: string, workers = 0): BuildingInstance => ({ buildingId, workers });

describe('mission: enlightenment', () => {
  const m = MISSIONS.enlightenment;

  it('objective is met at 30 science', () => {
    const G = blankState('enlightenment');
    G.resources.science = 30;
    expect(m.objective(G)).toBe(true);
    expect(m.failure(G)).toBe(false);
  });

  it('fails once round passes 12 short of the goal', () => {
    const G = blankState('enlightenment');
    G.round = 13;
    G.resources.science = 20;
    expect(m.failure(G)).toBe(true);
  });
});

describe('mission: long_winter', () => {
  const m = MISSIONS.long_winter;

  it('drains 2 food each upkeep (famine itself is enforced globally, not by the mission)', () => {
    const G = blankState('long_winter');
    G.resources.food = 5;
    m.onUpkeep!(G);
    expect(G.resources.food).toBe(3);
    expect(m.failure(G)).toBe(false);
  });

  it('objective is met after surviving 15 rounds', () => {
    const G = blankState('long_winter');
    G.round = 16;
    expect(m.objective(G)).toBe(true);
  });
});

describe('mission: barbarian_tide', () => {
  const m = MISSIONS.barbarian_tide;

  it('objective is met with three wonders (staffed or not)', () => {
    const G = blankState('barbarian_tide');
    G.tableau = [b('pyramids'), b('great_library'), b('colossus')];
    expect(m.objective(G)).toBe(true);
  });

  it('threat overwhelms an undefended city', () => {
    const G = blankState('barbarian_tide');
    m.setup!(G);
    for (let i = 0; i < 4; i++) m.onUpkeep!(G); // threat = 8
    expect(m.failure(G)).toBe(true); // 8 > 0 + BASE_DEFENSE(4)
  });

  it('a staffed barracks behind walls holds the line', () => {
    const G = blankState('barbarian_tide');
    m.setup!(G);
    G.tableau = [b('walls', 0), b('barracks', 1)]; // defense 5
    for (let i = 0; i < 4; i++) m.onUpkeep!(G); // threat = 8
    expect(m.failure(G)).toBe(false); // 8 > 5 + 4 is false
  });
});
