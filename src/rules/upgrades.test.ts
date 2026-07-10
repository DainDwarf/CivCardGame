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

// Every fixture sticker unlocked — the default the hint tests run under, so the pre-existing oracle
// assertions (which predate the unlock gate) still hold. The dedicated "locked" tests pass a partial
// set to *both* the predicate and the oracle, keeping them in lockstep.
const UNLOCKED_STICKERS: Record<string, true> = Object.fromEntries(Object.keys(FIXTURE_STICKERS).map((id) => [id, true]));
const UNLOCKED_BOARD_STICKERS: Record<string, true> = Object.fromEntries(
  Object.keys(FIXTURE_BOARD_STICKERS).map((id) => [id, true]),
);

/** Oracle: does *any* card upgrade actually go through — the next tier, or attaching some sticker to
 *  some owned copy? Brute-forces every (instance, sticker) pair through the real `buySticker`. */
function cardUpgradeOracle(
  collection: OwnedCards,
  influence: number,
  cardId: string,
  unlockedStickers: Record<string, true> = UNLOCKED_STICKERS,
): boolean {
  if (buyTier(collection, influence, cardId) !== null) return true;
  return instancesOf(collection, cardId).some((inst) =>
    Object.values(FIXTURE_STICKERS).some((s) => buySticker(collection, influence, inst.id, s.id, unlockedStickers) !== null),
  );
}

/** Oracle: does attaching any board sticker to `boardId` actually go through? */
function boardUpgradeOracle(
  boardStickers: BoardStickers,
  influence: number,
  boardId: BoardId,
  unlockedBoardStickers: Record<string, true> = UNLOCKED_BOARD_STICKERS,
): boolean {
  return Object.values(FIXTURE_BOARD_STICKERS).some(
    (s) => buyBoardSticker(boardStickers, influence, boardId, s.id, unlockedBoardStickers) !== null,
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
      expect(cardUpgradeAvailable(collection, c.influence, c.card, UNLOCKED_STICKERS)).toBe(
        cardUpgradeOracle(collection, c.influence, c.card),
      );
    });
  }

  it('all copies sticker-full but tier still buyable — on iff tier affordable', () => {
    // test_food x2 (tier x2->x4 costs 2), both copies at the sticker cap: only the tier upgrade remains.
    const full = fillStickers(collectionFromCounts({ test_food: 2 }), 'test_food');
    expect(cardUpgradeAvailable(full, 2, 'test_food', UNLOCKED_STICKERS)).toBe(true); // tier affordable
    expect(cardUpgradeAvailable(full, 2, 'test_food', UNLOCKED_STICKERS)).toBe(cardUpgradeOracle(full, 2, 'test_food'));
    expect(cardUpgradeAvailable(full, 1, 'test_food', UNLOCKED_STICKERS)).toBe(false); // tier unaffordable, no sticker room
    expect(cardUpgradeAvailable(full, 1, 'test_food', UNLOCKED_STICKERS)).toBe(cardUpgradeOracle(full, 1, 'test_food'));
  });

  it('crossing the price flips the hint (test_food x8 maxed, sticker cost 3)', () => {
    const maxed = collectionFromCounts({ test_food: 8 });
    expect(cardUpgradeAvailable(maxed, 2, 'test_food', UNLOCKED_STICKERS)).toBe(false);
    expect(cardUpgradeAvailable(maxed, 3, 'test_food', UNLOCKED_STICKERS)).toBe(true);
  });

  it('a locked sticker never lights the hint (maxed copies, sticker affordable, but not unlocked)', () => {
    // x8 maxed → no tier; a sticker is affordable + has room, but with no stickers unlocked the only
    // remaining upgrade avenue is gated off. Stays in lockstep with the oracle under the same empty set.
    const maxed = collectionFromCounts({ test_food: 8 });
    expect(cardUpgradeAvailable(maxed, 3, 'test_food', {})).toBe(false);
    expect(cardUpgradeAvailable(maxed, 3, 'test_food', {})).toBe(cardUpgradeOracle(maxed, 3, 'test_food', {}));
  });
});

describe('boardUpgradeAvailable — matches the real buy function', () => {
  const boards: BoardId[] = [TEST_BOARD_ID, TEST_BOARD_2_ID];

  it('empty board, unaffordable vs affordable (sticker cost 3)', () => {
    for (const b of boards) {
      expect(boardUpgradeAvailable({}, 2, b, UNLOCKED_BOARD_STICKERS)).toBe(boardUpgradeOracle({}, 2, b));
      expect(boardUpgradeAvailable({}, 2, b, UNLOCKED_BOARD_STICKERS)).toBe(false);
      expect(boardUpgradeAvailable({}, 3, b, UNLOCKED_BOARD_STICKERS)).toBe(boardUpgradeOracle({}, 3, b));
      expect(boardUpgradeAvailable({}, 3, b, UNLOCKED_BOARD_STICKERS)).toBe(true);
    }
  });

  it('a board at the cap is off even with plenty of Influence', () => {
    const b = boards[0];
    const full: BoardStickers = { [b]: ['test_bs_food', 'test_bs_military'] };
    expect(boardUpgradeAvailable(full, 100, b, UNLOCKED_BOARD_STICKERS)).toBe(false);
    expect(boardUpgradeAvailable(full, 100, b, UNLOCKED_BOARD_STICKERS)).toBe(boardUpgradeOracle(full, 100, b));
  });

  it('a locked board sticker never lights the hint (empty board, affordable, but not unlocked)', () => {
    const b = boards[0];
    expect(boardUpgradeAvailable({}, 100, b, {})).toBe(false);
    expect(boardUpgradeAvailable({}, 100, b, {})).toBe(boardUpgradeOracle({}, 100, b, {}));
  });
});

describe('nav roll-ups — on iff some tile is on', () => {
  const ownedDeckable = (collection: OwnedCards) =>
    Object.values(FIXTURE_CARDS).filter((c) => isDeckable(c) && instancesOf(collection, c.id).length > 0);

  it('anyCardUpgradeAvailable folds the per-card predicate', () => {
    const collection = collectionFromCounts({ test_food: 1, test_prod: 4 });
    for (const influence of [0, 1, 3, 5]) {
      const expected = ownedDeckable(collection).some((c) =>
        cardUpgradeAvailable(collection, influence, c.id, UNLOCKED_STICKERS),
      );
      expect(anyCardUpgradeAvailable(collection, influence, UNLOCKED_STICKERS)).toBe(expected);
    }
  });

  it('anyCardUpgradeAvailable is off with no owned cards', () => {
    expect(anyCardUpgradeAvailable(collectionFromCounts({}), 100, UNLOCKED_STICKERS)).toBe(false);
  });

  it('anyBoardUpgradeAvailable folds the per-board predicate', () => {
    const boards: BoardId[] = [TEST_BOARD_ID, TEST_BOARD_2_ID];
    const boardStickers: BoardStickers = { [boards[0]]: ['test_bs_food', 'test_bs_military'] }; // one board capped
    for (const influence of [0, 2, 3]) {
      const expected = boards.some((b) => boardUpgradeAvailable(boardStickers, influence, b, UNLOCKED_BOARD_STICKERS));
      expect(anyBoardUpgradeAvailable(boardStickers, influence, UNLOCKED_BOARD_STICKERS)).toBe(expected);
    }
  });
});
