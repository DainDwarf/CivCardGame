import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { isDeckable } from '../content/cards';
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
import {
  installFixtures,
  uninstallFixtures,
  FIXTURE_CARDS,
  FIXTURE_STICKERS,
  FIXTURE_BOARD_STICKERS,
  TEST_BOARD_ID,
  TEST_BOARD_2_ID,
} from './testFixtures';
import type { BoardId } from '../content/boards';

/**
 * The upgrade-hint predicates must be **on ⟺ some real purchase would succeed right now**. Rather
 * than re-assert a re-composed boolean, these tests pin each predicate against a brute-force oracle
 * built from the *actual* `buy*` functions — so if a buy-reject ever changes, the hint test catches
 * the divergence (the [[feedback-test-fixtures-share-prod-code-path]] rule applied to assertions).
 *
 * This suite brute-forces the *whole live* sticker/board-sticker catalogue, so it decouples onto the
 * synthetic fixtures (installed for the suite's duration) — with the content catalogues emptied in
 * Step 2.3 the live maps *are* the fixtures, which is exactly what lets the fixture-built oracle agree
 * with the predicate's live-catalogue walk. `test_food` is a food building (the restricted sticker
 * applies); `test_prod` produces no food (it doesn't). `TEST_BOARD`/`TEST_BOARD_2` stand in for the
 * board list; all fixture board stickers are unrestricted.
 */

beforeAll(installFixtures);
afterAll(uninstallFixtures);

/** Oracle: does *any* card upgrade actually go through — the next tier, or attaching some sticker to
 *  some owned copy? Brute-forces every (instance, sticker) pair through the real `buySticker`. */
function cardUpgradeOracle(collection: OwnedCards, influence: number, cardId: string): boolean {
  if (buyTier(collection, influence, cardId) !== null) return true;
  return instancesOf(collection, cardId).some((inst) =>
    Object.values(FIXTURE_STICKERS).some((s) => buySticker(collection, influence, inst.id, s.id) !== null),
  );
}

/** Oracle: does attaching any board sticker to `boardId` actually go through? */
function boardUpgradeOracle(boardStickers: BoardStickers, influence: number, boardId: BoardId): boolean {
  return Object.values(FIXTURE_BOARD_STICKERS).some(
    (s) => buyBoardSticker(boardStickers, influence, boardId, s.id) !== null,
  );
}

/** Set every owned instance of `cardId` to carry `MAX_STICKERS` stickers (no room for more). */
function fillStickers(collection: OwnedCards, cardId: string): OwnedCards {
  return {
    ...collection,
    instances: collection.instances.map((i) =>
      i.cardId === cardId ? { ...i, stickers: ['test_addgain', 'test_costcut'] } : i,
    ),
  };
}

describe('cardUpgradeAvailable — matches the real buy functions', () => {
  // test_food is a food building (the restricted sticker applies); test_prod produces no food.
  const cases: { name: string; counts: Record<string, number>; influence: number; card: string }[] = [
    { name: 'x1, no influence — nothing affordable', counts: { test_food: 1 }, influence: 0, card: 'test_food' },
    { name: 'x1, 1 influence — next tier affordable', counts: { test_food: 1 }, influence: 1, card: 'test_food' },
    { name: 'x1, 3 influence — tier + sticker affordable', counts: { test_food: 1 }, influence: 3, card: 'test_food' },
    { name: 'x8 maxed, 2 influence — no tier, sticker unaffordable', counts: { test_food: 8 }, influence: 2, card: 'test_food' },
    { name: 'x8 maxed, 3 influence — no tier but sticker affordable+room', counts: { test_food: 8 }, influence: 3, card: 'test_food' },
    { name: 'test_prod x1, 3 influence — restricted N/A but universal stickers apply', counts: { test_prod: 1 }, influence: 3, card: 'test_prod' },
    { name: 'not owned', counts: {}, influence: 100, card: 'test_food' },
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
    // test_food x2 (tier x2->x4 costs 2), both copies at the sticker cap: only the tier upgrade remains.
    const full = fillStickers(collectionFromCounts({ test_food: 2 }), 'test_food');
    expect(cardUpgradeAvailable(full, 2, 'test_food')).toBe(true); // tier affordable
    expect(cardUpgradeAvailable(full, 2, 'test_food')).toBe(cardUpgradeOracle(full, 2, 'test_food'));
    expect(cardUpgradeAvailable(full, 1, 'test_food')).toBe(false); // tier unaffordable, no sticker room
    expect(cardUpgradeAvailable(full, 1, 'test_food')).toBe(cardUpgradeOracle(full, 1, 'test_food'));
  });

  it('crossing the price flips the hint (test_food x8 maxed, sticker cost 3)', () => {
    const maxed = collectionFromCounts({ test_food: 8 });
    expect(cardUpgradeAvailable(maxed, 2, 'test_food')).toBe(false);
    expect(cardUpgradeAvailable(maxed, 3, 'test_food')).toBe(true);
  });
});

describe('boardUpgradeAvailable — matches the real buy function', () => {
  const boards: BoardId[] = [TEST_BOARD_ID, TEST_BOARD_2_ID];

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
    const full: BoardStickers = { [b]: ['test_bs_food', 'test_bs_military'] };
    expect(boardUpgradeAvailable(full, 100, b)).toBe(false);
    expect(boardUpgradeAvailable(full, 100, b)).toBe(boardUpgradeOracle(full, 100, b));
  });
});

describe('nav roll-ups — on iff some tile is on', () => {
  const ownedDeckable = (collection: OwnedCards) =>
    Object.values(FIXTURE_CARDS).filter((c) => isDeckable(c) && instancesOf(collection, c.id).length > 0);

  it('anyCardUpgradeAvailable folds the per-card predicate', () => {
    const collection = collectionFromCounts({ test_food: 1, test_prod: 4 });
    for (const influence of [0, 1, 3, 5]) {
      const expected = ownedDeckable(collection).some((c) => cardUpgradeAvailable(collection, influence, c.id));
      expect(anyCardUpgradeAvailable(collection, influence)).toBe(expected);
    }
  });

  it('anyCardUpgradeAvailable is off with no owned cards', () => {
    expect(anyCardUpgradeAvailable(collectionFromCounts({}), 100)).toBe(false);
  });

  it('anyBoardUpgradeAvailable folds the per-board predicate', () => {
    const boards: BoardId[] = [TEST_BOARD_ID, TEST_BOARD_2_ID];
    const boardStickers: BoardStickers = { [boards[0]]: ['test_bs_food', 'test_bs_military'] }; // one board capped
    for (const influence of [0, 2, 3]) {
      const expected = boards.some((b) => boardUpgradeAvailable(boardStickers, influence, b));
      expect(anyBoardUpgradeAvailable(boardStickers, influence)).toBe(expected);
    }
  });
});
