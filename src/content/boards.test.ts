import { describe, it, expect } from 'vitest';
import { BOARDS } from './boards';
import { availableBoardIds } from '../meta/boardDisplay';

describe('BOARDS', () => {
  it('each entry\'s id matches its registry key', () => {
    for (const [key, board] of Object.entries(BOARDS)) {
      expect(board.id).toBe(key);
    }
  });

  it('no board starts with a negative resource, population, territory, or culture', () => {
    for (const board of Object.values(BOARDS)) {
      // `resources` now holds all eight pools (core + strategic), so one loop covers them all.
      for (const value of Object.values(board.resources)) {
        expect(value).toBeGreaterThanOrEqual(0);
      }
    }
  });

  // Every non-starting board is hidden until a mission reward unlocks it, so a fresh profile (empty
  // unlock set) must still have at least one launchable board — otherwise the player can never play.
  it('at least one board is a starting board', () => {
    expect(Object.values(BOARDS).some((b) => b.starting)).toBe(true);
  });
});

describe('availableBoardIds — the unlock filter seam', () => {
  const starting = (Object.keys(BOARDS) as string[]).filter((id) => BOARDS[id].starting);
  const locked = (Object.keys(BOARDS) as string[]).filter((id) => !BOARDS[id].starting);

  it('always includes every starting board, even with an empty unlock set', () => {
    const available = availableBoardIds({});
    for (const id of starting) expect(available).toContain(id);
  });

  it('hides a non-starting board until it is unlocked', () => {
    const emptyAvailable = availableBoardIds({});
    for (const id of locked) expect(emptyAvailable).not.toContain(id);
  });

  it('reveals a board once its id is in the unlock set', () => {
    if (locked.length === 0) return; // vacuous while only starting boards exist
    const available = availableBoardIds({ [locked[0]]: true });
    expect(available).toContain(locked[0]);
  });

  it('returns ids in catalogue order', () => {
    const all = Object.fromEntries(locked.map((id) => [id, true as const]));
    expect(availableBoardIds(all)).toEqual((Object.keys(BOARDS) as string[]).filter((id) => BOARDS[id].starting || all[id]));
  });
});
