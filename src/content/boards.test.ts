import { describe, it, expect } from 'vitest';
import { BOARDS } from './boards';

describe('BOARDS', () => {
  it('each entry\'s id matches its registry key', () => {
    for (const [key, board] of Object.entries(BOARDS)) {
      expect(board.id).toBe(key);
    }
  });

  it('no board starts with a negative resource, population, territory, or culture', () => {
    for (const board of Object.values(BOARDS)) {
      for (const value of Object.values(board.resources)) {
        expect(value).toBeGreaterThanOrEqual(0);
      }
      expect(board.population).toBeGreaterThanOrEqual(0);
      expect(board.territory).toBeGreaterThanOrEqual(0);
      expect(board.culture).toBeGreaterThanOrEqual(0);
    }
  });
});
