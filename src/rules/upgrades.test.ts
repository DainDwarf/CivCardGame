import { describe, it, expect } from 'vitest';
import { STICKERS } from '../content/stickers';
import { BOARD_STICKERS } from '../content/boardStickers';
import { BOARDS, type BoardId } from '../content/boards';
import { CARDS, isDeckable } from '../content/cards';
import {
  collectionFromCounts,
  instancesOf,
  type OwnedCards,
} from './collection';
import { buyTier } from './shop';
import { buySticker } from './stickers';
import { buyBoardSticker, type BoardStickers } from './boardStickers';
import {
  cardUpgradeAvailable,
  boardUpgradeAvailable,
  anyCardUpgradeAvailable,
  anyBoardUpgradeAvailable,
} from './upgrades';

/**
 * The upgrade-hint predicates must be **on ⟺ some real purchase would succeed right now**. Rather
 * than re-assert a re-composed boolean, these tests pin each predicate against a brute-force oracle
 * built from the *actual* `buy*` functions — so if a buy-reject ever changes, the hint test catches
 * the divergence (the [[feedback-test-fixtures-share-prod-code-path]] rule applied to assertions).
 */

/** Oracle: does *any* card upgrade actually go through — the next tier, or attaching some sticker to
 *  some owned copy? Brute-forces every (instance, sticker) pair through the real `buySticker`. */
function cardUpgradeOracle(collection: OwnedCards, influence: number, cardId: string): boolean {
  if (buyTier(collection, influence, cardId) !== null) return true;
  return instancesOf(collection, cardId).some((inst) =>
    Object.values(STICKERS).some((s) => buySticker(collection, influence, inst.id, s.id) !== null),
  );
}

/** Oracle: does attaching any board sticker to `boardId` actually go through? */
function boardUpgradeOracle(boardStickers: BoardStickers, influence: number, boardId: BoardId): boolean {
  return Object.values(BOARD_STICKERS).some(
    (s) => buyBoardSticker(boardStickers, influence, boardId, s.id) !== null,
  );
}

/** Set every owned instance of `cardId` to carry `MAX_STICKERS` stickers (no room for more). */
function fillStickers(collection: OwnedCards, cardId: string): OwnedCards {
  return {
    ...collection,
    instances: collection.instances.map((i) =>
      i.cardId === cardId ? { ...i, stickers: ['reinforced', 'efficient'] } : i,
    ),
  };
}

describe('cardUpgradeAvailable — matches the real buy functions', () => {
  // farm is a food building (irrigation applies); workshop produces no food (irrigation doesn't).
  const cases: { name: string; counts: Record<string, number>; influence: number; card: string }[] = [
    { name: 'x1, no influence — nothing affordable', counts: { farm: 1 }, influence: 0, card: 'farm' },
    { name: 'x1, 1 influence — next tier affordable', counts: { farm: 1 }, influence: 1, card: 'farm' },
    { name: 'x1, 3 influence — tier + sticker affordable', counts: { farm: 1 }, influence: 3, card: 'farm' },
    { name: 'x8 maxed, 2 influence — no tier, sticker unaffordable', counts: { farm: 8 }, influence: 2, card: 'farm' },
    { name: 'x8 maxed, 3 influence — no tier but sticker affordable+room', counts: { farm: 8 }, influence: 3, card: 'farm' },
    { name: 'workshop x1, 3 influence — irrigation N/A but universal stickers apply', counts: { workshop: 1 }, influence: 3, card: 'workshop' },
    { name: 'not owned', counts: {}, influence: 100, card: 'farm' },
  ];

  for (const c of cases) {
    it(c.name, () => {
      const collection = collectionFromCounts(c.counts);
      expect(cardUpgradeAvailable(collection, c.influence, c.card)).toBe(
        cardUpgradeOracle(collection, c.influence, c.card),
      );
    });
  }

  it('all copies sticker-full but tier still buyable — on iff tier affordable', () => {
    // farm x2 (tier x2->x4 costs 2), both copies at the sticker cap: only the tier upgrade remains.
    const full = fillStickers(collectionFromCounts({ farm: 2 }), 'farm');
    expect(cardUpgradeAvailable(full, 2, 'farm')).toBe(true); // tier affordable
    expect(cardUpgradeAvailable(full, 2, 'farm')).toBe(cardUpgradeOracle(full, 2, 'farm'));
    expect(cardUpgradeAvailable(full, 1, 'farm')).toBe(false); // tier unaffordable, no sticker room
    expect(cardUpgradeAvailable(full, 1, 'farm')).toBe(cardUpgradeOracle(full, 1, 'farm'));
  });

  it('crossing the price flips the hint (farm x8 maxed, sticker cost 3)', () => {
    const maxed = collectionFromCounts({ farm: 8 });
    expect(cardUpgradeAvailable(maxed, 2, 'farm')).toBe(false);
    expect(cardUpgradeAvailable(maxed, 3, 'farm')).toBe(true);
  });
});

describe('boardUpgradeAvailable — matches the real buy function', () => {
  const boards = Object.keys(BOARDS) as BoardId[];

  it('empty board, unaffordable vs affordable (sticker cost 3)', () => {
    for (const b of boards) {
      expect(boardUpgradeAvailable({}, 2, b)).toBe(boardUpgradeOracle({}, 2, b));
      expect(boardUpgradeAvailable({}, 2, b)).toBe(false);
      expect(boardUpgradeAvailable({}, 3, b)).toBe(boardUpgradeOracle({}, 3, b));
      expect(boardUpgradeAvailable({}, 3, b)).toBe(true);
    }
  });

  it('a board at the cap is off even with plenty of Influence', () => {
    const b = boards[0];
    const full: BoardStickers = { [b]: ['fertileLand', 'garrison'] };
    expect(boardUpgradeAvailable(full, 100, b)).toBe(false);
    expect(boardUpgradeAvailable(full, 100, b)).toBe(boardUpgradeOracle(full, 100, b));
  });
});

describe('nav roll-ups — on iff some tile is on', () => {
  const ownedDeckable = (collection: OwnedCards) =>
    Object.values(CARDS).filter((c) => isDeckable(c) && instancesOf(collection, c.id).length > 0);

  it('anyCardUpgradeAvailable folds the per-card predicate', () => {
    const collection = collectionFromCounts({ farm: 1, workshop: 4 });
    for (const influence of [0, 1, 3, 5]) {
      const expected = ownedDeckable(collection).some((c) => cardUpgradeAvailable(collection, influence, c.id));
      expect(anyCardUpgradeAvailable(collection, influence)).toBe(expected);
    }
  });

  it('anyCardUpgradeAvailable is off with no owned cards', () => {
    expect(anyCardUpgradeAvailable(collectionFromCounts({}), 100)).toBe(false);
  });

  it('anyBoardUpgradeAvailable folds the per-board predicate', () => {
    const boards = Object.keys(BOARDS) as BoardId[];
    const boardStickers: BoardStickers = { [boards[0]]: ['fertileLand', 'garrison'] }; // one board capped
    for (const influence of [0, 2, 3]) {
      const expected = boards.some((b) => boardUpgradeAvailable(boardStickers, influence, b));
      expect(anyBoardUpgradeAvailable(boardStickers, influence)).toBe(expected);
    }
  });
});
