import { describe, it, expect } from 'vitest';
import { MISSIONS } from './missions';
import { applyUpkeep, blankState, coreCollapse, type BuildingInstance } from '../rules';

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

  it('threat depletes military from an undefended city (revolt is the universal floor, not the mission)', () => {
    const G = blankState('barbarian_tide');
    m.setup!(G); // military = 4, threat = 0
    // Round 1: military 4 + 0 - 2 = 2; Round 2: military 2 + 0 - 4 = -2
    applyUpkeep(G, m.onUpkeep);
    applyUpkeep(G, m.onUpkeep);
    expect(m.failure(G)).toBe(false); // the mission owns no failure
    expect(coreCollapse(G.resources)).toBe('revolt'); // defeat comes from the universal core floor
  });

  it('walls and a staffed barracks keep military positive through four rounds of rising threat', () => {
    const G = blankState('barbarian_tide');
    m.setup!(G); // military = 4
    G.tableau = [b('walls', 0), b('barracks', 1)]; // 3 + 2 = 5 military/round
    // Round 1: 4+5-2=7, Round 2: 7+5-4=8, Round 3: 8+5-6=7, Round 4: 7+5-8=4
    for (let i = 0; i < 4; i++) applyUpkeep(G, m.onUpkeep);
    expect(coreCollapse(G.resources)).toBeNull(); // military = 4 >= 0, no collapse
  });
});
