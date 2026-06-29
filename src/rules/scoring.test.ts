import { describe, it, expect } from 'vitest';
import { score } from './scoring';
import type { BuildingInstance } from './state';

const b = (cardId: string, workers = 0): BuildingInstance => ({ cardId, workers });

describe('score', () => {
  it('is zero for an empty tableau', () => {
    expect(score([])).toBe(0);
  });

  it('sums victory points regardless of staffing', () => {
    // farm (0) + workshop (1) + library (1)
    expect(score([b('farm'), b('workshop'), b('library')])).toBe(2);
  });

  it('counts wonders', () => {
    expect(score([b('pyramids'), b('great_library')])).toBe(6);
  });
});
