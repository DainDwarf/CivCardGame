import { describe, it, expect } from 'vitest';
import { buildRunConfig, reshuffleRunConfig, type RunSelection } from './contract';
import { DEFAULT_DECKS } from './content/decks';
import { buildSeedDecks } from './rules/deckBuilder';
import { collectionFromCounts } from './rules/collection';
import { STARTING_COLLECTION } from './content/collection';

const selection: RunSelection = {
  missionId: 'enlightenment',
  boardId: 'tribe',
  deckId: 'starter',
};

// Same collection/decks pairing `meta/store.ts`'s `emptyStore` builds for a fresh player —
// the starting deck's instance ids only resolve against a collection actually granted them.
function fixture() {
  const collection = collectionFromCounts(STARTING_COLLECTION);
  const decks = buildSeedDecks(DEFAULT_DECKS, collection);
  return { collection, decks };
}

describe('buildRunConfig', () => {
  it('carries missionId, board, and seed through unchanged', () => {
    const { decks, collection } = fixture();
    const config = buildRunConfig(selection, 'seed-1', decks, collection);
    expect(config.missionId).toBe('enlightenment');
    expect(config.board).toBe('tribe');
    expect(config.deckId).toBe('starter');
    expect(config.seed).toBe('seed-1');
  });

  it('shuffles the selected deck deterministically from the seed', () => {
    const { decks, collection } = fixture();
    const a = buildRunConfig(selection, 'seed-1', decks, collection);
    const b = buildRunConfig(selection, 'seed-1', decks, collection);
    expect(a.deck).toEqual(b.deck);
    const startingCardIds = DEFAULT_DECKS.find((d) => d.id === 'starter')!.cards;
    expect(a.deck.map((c) => c.cardId).sort()).toEqual([...startingCardIds].sort());
  });

  it('produces a different order for a different seed', () => {
    const { decks, collection } = fixture();
    const a = buildRunConfig(selection, 'seed-1', decks, collection);
    const b = buildRunConfig(selection, 'seed-2', decks, collection);
    expect(a.deck).not.toEqual(b.deck);
  });

  it('never mutates the passed-in decks', () => {
    const { decks, collection } = fixture();
    const before = [...decks.find((d) => d.id === 'starter')!.cards];
    buildRunConfig(selection, 'seed-1', decks, collection);
    expect(decks.find((d) => d.id === 'starter')!.cards).toEqual(before);
  });

  it('produces an empty deck when deckId is not found', () => {
    const { decks, collection } = fixture();
    const config = buildRunConfig({ ...selection, deckId: 'nope' }, 'seed-1', decks, collection);
    expect(config.deck).toEqual([]);
  });
});

describe('reshuffleRunConfig', () => {
  it('preserves the card multiset', () => {
    const { decks, collection } = fixture();
    const config = buildRunConfig(selection, 'seed-1', decks, collection);
    const reshuffled = reshuffleRunConfig(config, 'seed-2');
    expect(reshuffled.deck.map((c) => c.cardId).sort()).toEqual(config.deck.map((c) => c.cardId).sort());
  });

  it('preserves board, missionId, and deckId', () => {
    const { decks, collection } = fixture();
    const config = buildRunConfig(selection, 'seed-1', decks, collection);
    const reshuffled = reshuffleRunConfig(config, 'seed-2');
    expect(reshuffled.board).toBe(config.board);
    expect(reshuffled.missionId).toBe(config.missionId);
    expect(reshuffled.deckId).toBe(config.deckId);
  });

  it('produces a different order across seeds', () => {
    const { decks, collection } = fixture();
    const config = buildRunConfig(selection, 'seed-1', decks, collection);
    const reshuffled = reshuffleRunConfig(config, 'seed-2');
    expect(reshuffled.deck).not.toEqual(config.deck);
  });

  it('does not mutate the input config', () => {
    const { decks, collection } = fixture();
    const config = buildRunConfig(selection, 'seed-1', decks, collection);
    const before = [...config.deck];
    reshuffleRunConfig(config, 'seed-2');
    expect(config.deck).toEqual(before);
  });
});
