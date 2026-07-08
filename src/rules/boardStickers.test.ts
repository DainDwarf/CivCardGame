import { describe, it, expect } from 'vitest';
import {
  boardStickerAppliesTo,
  buyBoardSticker,
  effectiveBoard,
  isBoardStickerFull,
  type BoardStickers,
} from './boardStickers';
import { BOARDS } from '../content/boards';
import { BOARD_STICKERS } from '../content/boardStickers';

describe('effectiveBoard', () => {
  it('returns the same object (no stickers) unchanged', () => {
    expect(effectiveBoard(BOARDS.tribe, [])).toBe(BOARDS.tribe);
    expect(effectiveBoard(BOARDS.tribe, undefined)).toBe(BOARDS.tribe);
  });

  it('applies a single core-resource sticker (Fertile Land, +2 Food)', () => {
    const eff = effectiveBoard(BOARDS.tribe, ['fertileLand']);
    expect(eff.resources.food).toBe(BOARDS.tribe.resources.food + 2);
    // leaves everything else untouched
    expect(eff.resources.military).toBe(BOARDS.tribe.resources.military);
    expect(eff.territory).toBe(BOARDS.tribe.territory);
  });

  it('applies a strategic-gauge sticker (Frontier, +1 Territory)', () => {
    const eff = effectiveBoard(BOARDS.tribe, ['frontier']);
    expect(eff.territory).toBe(BOARDS.tribe.territory + 1);
    expect(eff.resources).toEqual(BOARDS.tribe.resources);
  });

  it('stacks two of the same sticker', () => {
    const eff = effectiveBoard(BOARDS.tribe, ['fertileLand', 'fertileLand']);
    expect(eff.resources.food).toBe(BOARDS.tribe.resources.food + 4);
  });

  it('composes two different stickers', () => {
    const eff = effectiveBoard(BOARDS.tribe, ['fertileLand', 'frontier']);
    expect(eff.resources.food).toBe(BOARDS.tribe.resources.food + 2);
    expect(eff.territory).toBe(BOARDS.tribe.territory + 1);
  });

  it('does not mutate the input board', () => {
    const before = BOARDS.tribe.resources.food;
    effectiveBoard(BOARDS.tribe, ['fertileLand']);
    expect(BOARDS.tribe.resources.food).toBe(before);
  });

  it('skips an unknown sticker id', () => {
    expect(effectiveBoard(BOARDS.tribe, ['not-a-sticker'])).toEqual(BOARDS.tribe);
  });
});

describe('boardStickerAppliesTo', () => {
  it('an unrestricted sticker applies to any board', () => {
    expect(boardStickerAppliesTo(BOARD_STICKERS.fertileLand, BOARDS.tribe)).toBe(true);
    expect(boardStickerAppliesTo(BOARD_STICKERS.fertileLand, BOARDS.monarchy)).toBe(true);
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
    const result = buyBoardSticker({}, 5, 'tribe', 'fertileLand');
    expect(result).not.toBeNull();
    expect(result!.influence).toBe(2);
    expect(result!.boardStickers.tribe).toEqual(['fertileLand']);
  });

  it('does not mutate the input map', () => {
    const map: BoardStickers = {};
    buyBoardSticker(map, 5, 'tribe', 'fertileLand');
    expect(map.tribe).toBeUndefined();
  });

  it('appends a second sticker to a board that already has one', () => {
    const first = buyBoardSticker({}, 10, 'tribe', 'fertileLand')!;
    const second = buyBoardSticker(first.boardStickers, first.influence, 'tribe', 'frontier');
    expect(second).not.toBeNull();
    expect(second!.boardStickers.tribe).toEqual(['fertileLand', 'frontier']);
  });

  it('allows attaching the same sticker twice — it stacks', () => {
    const first = buyBoardSticker({}, 10, 'tribe', 'fertileLand')!;
    const second = buyBoardSticker(first.boardStickers, first.influence, 'tribe', 'fertileLand');
    expect(second!.boardStickers.tribe).toEqual(['fertileLand', 'fertileLand']);
  });

  it('rejects a third sticker once the board is full', () => {
    const first = buyBoardSticker({}, 20, 'tribe', 'fertileLand')!;
    const second = buyBoardSticker(first.boardStickers, first.influence, 'tribe', 'frontier')!;
    expect(buyBoardSticker(second.boardStickers, second.influence, 'tribe', 'garrison')).toBeNull();
  });

  it('rejects an unknown sticker id', () => {
    expect(buyBoardSticker({}, 5, 'tribe', 'not-a-sticker')).toBeNull();
  });

  it('rejects an unaffordable purchase', () => {
    expect(buyBoardSticker({}, 1, 'tribe', 'fertileLand')).toBeNull();
  });

  it('keeps other boards untouched', () => {
    const first = buyBoardSticker({}, 10, 'tribe', 'fertileLand')!;
    const second = buyBoardSticker(first.boardStickers, first.influence, 'monarchy', 'garrison')!;
    expect(second.boardStickers.tribe).toEqual(['fertileLand']);
    expect(second.boardStickers.monarchy).toEqual(['garrison']);
  });
});
