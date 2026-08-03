import { describe, it, expect } from 'vitest';
import { BOARDS, ORIGIN_BOARD_ID } from './boards';
import { CARDS, isStructure } from './cards';
import { availableBoardIds } from '../meta/boardDisplay';

describe('BOARDS', () => {
  it('each entry\'s id matches its registry key', () => {
    for (const [key, board] of Object.entries(BOARDS)) {
      expect(board.id).toBe(key);
    }
  });

  it('no board starts with a negative resource, population, territory, or culture', () => {
    for (const board of Object.values(BOARDS)) {
      // `resources` holds all eight pools (core + strategic), so one loop covers them all.
      for (const value of Object.values(board.resources)) {
        expect(value).toBeGreaterThanOrEqual(0);
      }
    }
  });

  // The origin board is the fresh-profile default and the lockout fallback (`availableBoardIds`), so
  // it must exist in the catalogue.
  it('the origin board is a real catalogue entry', () => {
    expect(BOARDS[ORIGIN_BOARD_ID]).toBeDefined();
  });

  it('every prebuilt id names a real structure that declares its workers', () => {
    for (const board of Object.values(BOARDS)) {
      for (const cardId of board.prebuilt ?? []) {
        const card = CARDS[cardId];
        expect(card, `board '${board.id}' stands unknown card '${cardId}'`).toBeDefined();
        expect(isStructure(card)).toBe(true);
        expect(card.workers).toBeDefined();
      }
    }
  });

  // A board standing more structures than it has land opens every run over its own territory cap,
  // which surfaces as a mid-sweep `assertRunInvariants` throw rather than as an authoring mistake.
  it('no board stands more prebuilt structures than it has territory', () => {
    for (const board of Object.values(BOARDS)) {
      expect((board.prebuilt ?? []).length).toBeLessThanOrEqual(board.resources.territory);
    }
  });
});

describe('availableBoardIds — the availability seam', () => {
  const all = Object.fromEntries((Object.keys(BOARDS) as string[]).map((id) => [id, true as const]));

  it('returns exactly the unlocked ids, in catalogue order', () => {
    expect(availableBoardIds(all)).toEqual(Object.keys(BOARDS).filter((id) => all[id]));
  });

  it('hides a board until its id is in the unlock set', () => {
    const others = (Object.keys(BOARDS) as string[]).filter((id) => id !== ORIGIN_BOARD_ID);
    const available = availableBoardIds({ [ORIGIN_BOARD_ID]: true });
    expect(available).toEqual([ORIGIN_BOARD_ID]);
    for (const id of others) expect(available).not.toContain(id);
  });

  // The structural never-locked-out guarantee: an empty (hand-edited/corrupt-but-valid) set still
  // yields a launchable board — the origin — so the pickers are never empty.
  it('falls back to the origin board when the unlock set is empty', () => {
    expect(availableBoardIds({})).toEqual([ORIGIN_BOARD_ID]);
  });
});
