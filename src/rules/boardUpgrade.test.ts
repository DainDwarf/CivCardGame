import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { applyBoardUpgrade } from './boardUpgrade';
import { MAX_BOARD_STICKERS } from './boardStickers';
import { installFixtures, uninstallFixtures, TEST_BOARD_ID, TEST_BOARD_2_ID } from './testFixtures';

// `applyBoardUpgrade` reads the live `BOARDS`/`BOARD_STICKERS` catalogues, so the two fixture boards
// and the fixture board stickers (including `test_bs_restricted`, which only applies to TEST_BOARD)
// must be spliced in for its target lookup + eligibility filter to resolve.
beforeAll(installFixtures);
afterAll(uninstallFixtures);

describe('applyBoardUpgrade', () => {
  it('unlocks the target and drops the source from the unlocked set', () => {
    const { unlockedBoards } = applyBoardUpgrade(
      { [TEST_BOARD_ID]: true },
      {},
      { from: TEST_BOARD_ID, to: TEST_BOARD_2_ID },
    );
    expect(unlockedBoards[TEST_BOARD_2_ID]).toBe(true);
    expect(unlockedBoards[TEST_BOARD_ID]).toBeUndefined();
  });

  it('carries the source board\'s stickers across to the target', () => {
    const { boardStickers } = applyBoardUpgrade(
      { [TEST_BOARD_ID]: true },
      { [TEST_BOARD_ID]: ['test_bs_food'] },
      { from: TEST_BOARD_ID, to: TEST_BOARD_2_ID },
    );
    expect(boardStickers[TEST_BOARD_2_ID]).toEqual(['test_bs_food']);
    expect(boardStickers[TEST_BOARD_ID]).toBeUndefined();
  });

  it('drops a carried sticker that does not apply to the target board', () => {
    // `test_bs_restricted` applies only to TEST_BOARD, so upgrading to TEST_BOARD_2 must leave it behind
    // while the unrestricted `test_bs_food` still rides along.
    const { boardStickers } = applyBoardUpgrade(
      { [TEST_BOARD_ID]: true },
      { [TEST_BOARD_ID]: ['test_bs_food', 'test_bs_restricted'] },
      { from: TEST_BOARD_ID, to: TEST_BOARD_2_ID },
    );
    expect(boardStickers[TEST_BOARD_2_ID]).toEqual(['test_bs_food']);
  });

  it('drops an unresolvable sticker id', () => {
    const { boardStickers } = applyBoardUpgrade(
      { [TEST_BOARD_ID]: true },
      { [TEST_BOARD_ID]: ['not-a-sticker', 'test_bs_food'] },
      { from: TEST_BOARD_ID, to: TEST_BOARD_2_ID },
    );
    expect(boardStickers[TEST_BOARD_2_ID]).toEqual(['test_bs_food']);
  });

  it('truncates the carried stickers to the per-board cap', () => {
    // A source over the cap (only reachable by a corrupt store) must not push the target past it.
    const over = Array.from({ length: MAX_BOARD_STICKERS + 2 }, () => 'test_bs_food');
    const { boardStickers } = applyBoardUpgrade(
      { [TEST_BOARD_ID]: true },
      { [TEST_BOARD_ID]: over },
      { from: TEST_BOARD_ID, to: TEST_BOARD_2_ID },
    );
    expect(boardStickers[TEST_BOARD_2_ID]).toHaveLength(MAX_BOARD_STICKERS);
  });

  it('does not mutate its inputs', () => {
    const unlocked = { [TEST_BOARD_ID]: true as const };
    const stickers = { [TEST_BOARD_ID]: ['test_bs_food'] };
    applyBoardUpgrade(unlocked, stickers, { from: TEST_BOARD_ID, to: TEST_BOARD_2_ID });
    expect(unlocked).toEqual({ [TEST_BOARD_ID]: true });
    expect(stickers).toEqual({ [TEST_BOARD_ID]: ['test_bs_food'] });
  });
});
