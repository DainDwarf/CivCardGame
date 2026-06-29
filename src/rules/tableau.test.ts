import { describe, it, expect } from 'vitest';
import { countTag, totalDefense } from './tableau';
import type { BuildingInstance } from './state';

const b = (cardId: string, workers = 0): BuildingInstance => ({ cardId, workers });

describe('countTag', () => {
  it('counts built cards with a tag, staffed or not', () => {
    expect(countTag([b('pyramids'), b('great_library'), b('farm', 1)], 'wonder')).toBe(2);
    expect(countTag([b('farm', 1), b('workshop', 1)], 'wonder')).toBe(0);
  });
});

describe('totalDefense', () => {
  it('counts self-sufficient walls but not an unstaffed barracks', () => {
    expect(totalDefense([b('walls', 0), b('barracks', 0)])).toBe(3); // walls only
  });

  it('counts a staffed barracks behind walls', () => {
    expect(totalDefense([b('walls', 0), b('barracks', 1)])).toBe(5); // 3 + 2
  });
});
