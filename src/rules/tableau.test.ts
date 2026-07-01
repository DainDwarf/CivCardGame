import { describe, it, expect } from 'vitest';
import { countTag, freeTerritory, usedTerritory } from './tableau';
import { blankState, type BuildingInstance } from './state';

let nextId = 1;
const b = (buildingId: string, workers = 0): BuildingInstance => ({ id: nextId++, buildingId, workers });

describe('countTag', () => {
  it('counts built cards with a tag, staffed or not', () => {
    expect(countTag([b('pyramids'), b('great_library'), b('farm', 1)], 'wonder')).toBe(2);
    expect(countTag([b('farm', 1), b('workshop', 1)], 'wonder')).toBe(0);
  });
});

describe('territory', () => {
  it('one slot is filled per building, regardless of staffing', () => {
    expect(usedTerritory([])).toBe(0);
    expect(usedTerritory([b('farm', 1), b('walls')])).toBe(2);
  });

  it('free territory is the cap minus what is built', () => {
    const G = blankState('enlightenment');
    G.territory = 3;
    G.tableau = [b('farm', 1), b('workshop', 1)];
    expect(freeTerritory(G)).toBe(1);
    G.tableau.push(b('library'));
    expect(freeTerritory(G)).toBe(0);
  });
});
