import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  boardStickerAppliesTo,
  buyBoardSticker,
  effectiveBoard,
  isBoardStickerFull,
  type BoardStickers,
} from './boardStickers';
import {
  FIXTURE_BOARD_STICKERS,
  TEST_BOARD,
  TEST_BOARD_ID,
  TEST_BOARD_2_ID,
  installFixtures,
  uninstallFixtures,
} from './testFixtures';

// `test_bs_food` (+2🌾) and `test_bs_military` (+1⚔️) are core-resource stickers, `test_bs_territory`
// (+1 territory) a strategic-gauge one; all unrestricted. `TEST_BOARD`/`TEST_BOARD_2` are two boards.
beforeAll(installFixtures);
afterAll(uninstallFixtures);

// Every fixture board sticker is unlocked by default; one dedicated test covers a *locked* rejection.
const UNLOCKED: Record<string, true> = Object.fromEntries(Object.keys(FIXTURE_BOARD_STICKERS).map((id) => [id, true]));

describe('effectiveBoard', () => {
  it('returns the same object (no stickers) unchanged', () => {
    expect(effectiveBoard(TEST_BOARD, [])).toBe(TEST_BOARD);
    expect(effectiveBoard(TEST_BOARD, undefined)).toBe(TEST_BOARD);
  });

  it('applies a single core-resource sticker (+2 Food)', () => {
    const eff = effectiveBoard(TEST_BOARD, ['test_bs_food']);
    expect(eff.resources.food).toBe(TEST_BOARD.resources.food + 2);
    // leaves everything else untouched
    expect(eff.resources.military).toBe(TEST_BOARD.resources.military);
    expect(eff.territory).toBe(TEST_BOARD.territory);
  });

  it('applies a strategic-gauge sticker (+1 Territory)', () => {
    const eff = effectiveBoard(TEST_BOARD, ['test_bs_territory']);
    expect(eff.territory).toBe(TEST_BOARD.territory + 1);
    expect(eff.resources).toEqual(TEST_BOARD.resources);
  });

  it('stacks two of the same sticker', () => {
    const eff = effectiveBoard(TEST_BOARD, ['test_bs_food', 'test_bs_food']);
    expect(eff.resources.food).toBe(TEST_BOARD.resources.food + 4);
  });

  it('composes two different stickers', () => {
    const eff = effectiveBoard(TEST_BOARD, ['test_bs_food', 'test_bs_territory']);
    expect(eff.resources.food).toBe(TEST_BOARD.resources.food + 2);
    expect(eff.territory).toBe(TEST_BOARD.territory + 1);
  });

  it('does not mutate the input board', () => {
    const before = TEST_BOARD.resources.food;
    effectiveBoard(TEST_BOARD, ['test_bs_food']);
    expect(TEST_BOARD.resources.food).toBe(before);
  });

  it('skips an unknown sticker id', () => {
    expect(effectiveBoard(TEST_BOARD, ['not-a-sticker'])).toEqual(TEST_BOARD);
  });
});

describe('boardStickerAppliesTo', () => {
  it('an unrestricted sticker applies to any board', () => {
    expect(boardStickerAppliesTo(FIXTURE_BOARD_STICKERS.test_bs_food, TEST_BOARD)).toBe(true);
  });
});

describe('isBoardStickerFull', () => {
  it('is full at the cap of 2', () => {
    expect(isBoardStickerFull([])).toBe(false);
    expect(isBoardStickerFull(['a'])).toBe(false);
    expect(isBoardStickerFull(['a', 'b'])).toBe(true);
  });
});

describe('buyBoardSticker', () => {
  it('attaches the sticker and deducts its cost', () => {
    const result = buyBoardSticker({}, 5, TEST_BOARD_ID, 'test_bs_food', UNLOCKED);
    expect(result).not.toBeNull();
    expect(result!.influence).toBe(2);
    expect(result!.boardStickers[TEST_BOARD_ID]).toEqual(['test_bs_food']);
  });

  it('does not mutate the input map', () => {
    const map: BoardStickers = {};
    buyBoardSticker(map, 5, TEST_BOARD_ID, 'test_bs_food', UNLOCKED);
    expect(map[TEST_BOARD_ID]).toBeUndefined();
  });

  it('rejects a board sticker that is not unlocked, even when everything else is valid', () => {
    // Affordable, applicable, under cap — but locked → rejected.
    expect(buyBoardSticker({}, 100, TEST_BOARD_ID, 'test_bs_food', {})).toBeNull();
  });

  it('appends a second sticker to a board that already has one', () => {
    const first = buyBoardSticker({}, FIXTURE_BOARD_STICKERS.test_bs_food.cost + FIXTURE_BOARD_STICKERS.test_bs_territory.cost, TEST_BOARD_ID, 'test_bs_food', UNLOCKED)!;
    const second = buyBoardSticker(first.boardStickers, first.influence, TEST_BOARD_ID, 'test_bs_territory', UNLOCKED);
    expect(second).not.toBeNull();
    expect(second!.boardStickers[TEST_BOARD_ID]).toEqual(['test_bs_food', 'test_bs_territory']);
  });

  it('allows attaching the same sticker twice — it stacks', () => {
    const first = buyBoardSticker({}, 10, TEST_BOARD_ID, 'test_bs_food', UNLOCKED)!;
    const second = buyBoardSticker(first.boardStickers, first.influence, TEST_BOARD_ID, 'test_bs_food', UNLOCKED);
    expect(second!.boardStickers[TEST_BOARD_ID]).toEqual(['test_bs_food', 'test_bs_food']);
  });

  it('rejects a third sticker once the board is full', () => {
    const first = buyBoardSticker({}, 20, TEST_BOARD_ID, 'test_bs_food', UNLOCKED)!;
    const second = buyBoardSticker(first.boardStickers, first.influence, TEST_BOARD_ID, 'test_bs_territory', UNLOCKED)!;
    expect(buyBoardSticker(second.boardStickers, second.influence, TEST_BOARD_ID, 'test_bs_military', UNLOCKED)).toBeNull();
  });

  it('rejects an unknown sticker id', () => {
    expect(buyBoardSticker({}, 5, TEST_BOARD_ID, 'not-a-sticker', UNLOCKED)).toBeNull();
  });

  it('rejects an unaffordable purchase', () => {
    expect(buyBoardSticker({}, 1, TEST_BOARD_ID, 'test_bs_food', UNLOCKED)).toBeNull();
  });

  it('keeps other boards untouched', () => {
    const first = buyBoardSticker({}, 10, TEST_BOARD_ID, 'test_bs_food', UNLOCKED)!;
    const second = buyBoardSticker(first.boardStickers, first.influence, TEST_BOARD_2_ID, 'test_bs_military', UNLOCKED)!;
    expect(second.boardStickers[TEST_BOARD_ID]).toEqual(['test_bs_food']);
    expect(second.boardStickers[TEST_BOARD_2_ID]).toEqual(['test_bs_military']);
  });
});
