import { describe, it, expect } from 'vitest';
import { tableauProduction } from './production';
import type { BuildingInstance } from './state';

let nextId = 1;
const b = (cardId: string, workers: number): BuildingInstance => ({ id: nextId++, cardId, workers });

describe('tableauProduction', () => {
  it('counts only staffed buildings', () => {
    expect(tableauProduction([b('farm', 1), b('farm', 0), b('workshop', 1)])).toEqual({
      food: 2, // only the one staffed farm
      production: 2, // staffed workshop
      science: 0,
      military: 0,
      money: 0,
    });
  });

  it('self-sufficient walls produce military without workers', () => {
    expect(tableauProduction([b('walls', 0)])).toEqual({ food: 0, production: 0, science: 0, military: 3, money: 0 });
  });
});
