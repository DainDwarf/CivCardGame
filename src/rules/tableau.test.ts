import { describe, it, expect } from 'vitest';
import { countTag } from './tableau';
import type { BuildingInstance } from './state';

const b = (buildingId: string, workers = 0): BuildingInstance => ({ buildingId, workers });

describe('countTag', () => {
  it('counts built cards with a tag, staffed or not', () => {
    expect(countTag([b('pyramids'), b('great_library'), b('farm', 1)], 'wonder')).toBe(2);
    expect(countTag([b('farm', 1), b('workshop', 1)], 'wonder')).toBe(0);
  });
});
