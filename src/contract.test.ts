import { describe, it, expect } from 'vitest';
import { buildRunConfig, reshuffleRunConfig, type RunSelection } from './contract';
import type { DeckSeed } from './content/decks';
import { buildSeedDecks } from './rules/deckBuilder';
import { collectionFromCounts } from './rules/collection';
import type { BoardStickers } from './rules/boardStickers';

// `buildRunConfig`/`reshuffleRunConfig` are pure plumbing (resolve instance ids → cardIds, shuffle):
// they never touch `CARDS`/`BOARDS`/`MISSIONS`, so this suite runs on a *synthetic* collection + deck
// seed rather than the (now empty, Phase 4 Step 2.5) content catalogues. The cardIds are arbitrary —
// `buildSeedDecks`/`collectionFromCounts` don't validate against `CARDS` — and deliberately varied so
// a shuffle produces a *different order* across seeds (a single-cardId deck would collide).
const SEED_COUNTS: Record<string, number> = { a: 3, b: 3, c: 3, d: 3, e: 3, f: 3 };
const SEED_DECKS: DeckSeed[] = [
  {
    id: 'starter',
    name: 'Test Deck',
    cards: ['a', 'a', 'b', 'b', 'c', 'c', 'd', 'd', 'e', 'e', 'f', 'f', 'a', 'b', 'c', 'd', 'e', 'f'],
  },
];

const selection: RunSelection = {
  missionId: 'test-mission',
  boardId: 'tribe',
  deckId: 'starter',
};

// No board stickers for the deck/shuffle-focused cases; the snapshot is covered on its own below.
const boardStickers: BoardStickers = {};

// The collection/decks pairing `buildRunConfig` consumes: a deck's instance ids only resolve against
// a collection actually granted them (the same shape `meta/store.ts`'s `emptyStore` builds).
function fixture() {
  const collection = collectionFromCounts(SEED_COUNTS);
  const decks = buildSeedDecks(SEED_DECKS, collection);
  return { collection, decks };
}

describe('buildRunConfig', () => {
  it('carries missionId, board, and seed through unchanged', () => {
    const { decks, collection } = fixture();
    const config = buildRunConfig(selection, 'seed-1', decks, collection, boardStickers);
    expect(config.missionId).toBe('test-mission');
    expect(config.board).toBe('tribe');
    expect(config.deckId).toBe('starter');
    expect(config.seed).toBe('seed-1');
  });

  it('shuffles the selected deck deterministically from the seed', () => {
    const { decks, collection } = fixture();
    const a = buildRunConfig(selection, 'seed-1', decks, collection, boardStickers);
    const b = buildRunConfig(selection, 'seed-1', decks, collection, boardStickers);
    expect(a.deck).toEqual(b.deck);
    const startingCardIds = SEED_DECKS.find((d) => d.id === 'starter')!.cards;
    expect(a.deck.map((c) => c.cardId).sort()).toEqual([...startingCardIds].sort());
  });

  it('produces a different order for a different seed', () => {
    const { decks, collection } = fixture();
    const a = buildRunConfig(selection, 'seed-1', decks, collection, boardStickers);
    const b = buildRunConfig(selection, 'seed-2', decks, collection, boardStickers);
    expect(a.deck).not.toEqual(b.deck);
  });

  it('never mutates the passed-in decks', () => {
    const { decks, collection } = fixture();
    const before = [...decks.find((d) => d.id === 'starter')!.cards];
    buildRunConfig(selection, 'seed-1', decks, collection, boardStickers);
    expect(decks.find((d) => d.id === 'starter')!.cards).toEqual(before);
  });

  it('produces an empty deck when deckId is not found', () => {
    const { decks, collection } = fixture();
    const config = buildRunConfig({ ...selection, deckId: 'nope' }, 'seed-1', decks, collection, boardStickers);
    expect(config.deck).toEqual([]);
  });

  it("snapshots the chosen board's stickers into the config", () => {
    const { decks, collection } = fixture();
    // selection.boardId is 'tribe' — only its stickers should be snapshotted, not monarchy's.
    const config = buildRunConfig(selection, 'seed-1', decks, collection, { tribe: ['frontier'], monarchy: ['garrison'] });
    expect(config.boardStickers).toEqual(['frontier']);
  });

  it('snapshots an empty array when the chosen board has no stickers', () => {
    const { decks, collection } = fixture();
    const config = buildRunConfig(selection, 'seed-1', decks, collection, { monarchy: ['garrison'] });
    expect(config.boardStickers).toEqual([]);
  });
});

describe('reshuffleRunConfig', () => {
  it('preserves the card multiset', () => {
    const { decks, collection } = fixture();
    const config = buildRunConfig(selection, 'seed-1', decks, collection, boardStickers);
    const reshuffled = reshuffleRunConfig(config, 'seed-2');
    expect(reshuffled.deck.map((c) => c.cardId).sort()).toEqual(config.deck.map((c) => c.cardId).sort());
  });

  it('preserves board, missionId, and deckId', () => {
    const { decks, collection } = fixture();
    const config = buildRunConfig(selection, 'seed-1', decks, collection, boardStickers);
    const reshuffled = reshuffleRunConfig(config, 'seed-2');
    expect(reshuffled.board).toBe(config.board);
    expect(reshuffled.missionId).toBe(config.missionId);
    expect(reshuffled.deckId).toBe(config.deckId);
  });

  it('produces a different order across seeds', () => {
    const { decks, collection } = fixture();
    const config = buildRunConfig(selection, 'seed-1', decks, collection, boardStickers);
    const reshuffled = reshuffleRunConfig(config, 'seed-2');
    expect(reshuffled.deck).not.toEqual(config.deck);
  });

  it('does not mutate the input config', () => {
    const { decks, collection } = fixture();
    const config = buildRunConfig(selection, 'seed-1', decks, collection, boardStickers);
    const before = [...config.deck];
    reshuffleRunConfig(config, 'seed-2');
    expect(config.deck).toEqual(before);
  });
});
