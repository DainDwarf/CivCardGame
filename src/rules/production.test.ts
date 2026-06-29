import { describe, it, expect } from 'vitest';
import { tableauProduction } from './production';
import type { BuildingInstance } from './state';

const b = (buildingId: string, workers: number): BuildingInstance => ({ buildingId, workers });

describe('tableauProduction', () => {
  it('counts only staffed buildings', () => {
    expect(tableauProduction([b('farm', 1), b('farm', 0), b('workshop', 1)])).toEqual({
      food: 2, // only the one staffed farm
      production: 2, // staffed workshop
      science: 0,
    });
  });

  it('ignores buildings that produce nothing (e.g. City Walls)', () => {
    expect(tableauProduction([b('walls', 0)])).toEqual({ food: 0, production: 0, science: 0 });
  });
});
