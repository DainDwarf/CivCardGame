import { describe, it, expect } from 'vitest';
import { buildRunConfig, reshuffleRunConfig, type RunSelection } from './contract';
import { DEFAULT_DECKS } from './content/decks';
import { cloneDecks } from './rules/deckBuilder';

const selection: RunSelection = {
  missionId: 'enlightenment',
  boardId: 'tribe',
  deckId: 'balanced',
};

describe('buildRunConfig', () => {
  it('carries missionId, board, and seed through unchanged', () => {
    const decks = cloneDecks(DEFAULT_DECKS);
    const config = buildRunConfig(selection, 'seed-1', decks);
    expect(config.missionId).toBe('enlightenment');
    expect(config.board).toBe('tribe');
    expect(config.deckId).toBe('balanced');
    expect(config.seed).toBe('seed-1');
  });

  it('shuffles the selected deck deterministically from the seed', () => {
    const decks = cloneDecks(DEFAULT_DECKS);
    const a = buildRunConfig(selection, 'seed-1', decks);
    const b = buildRunConfig(selection, 'seed-1', decks);
    expect(a.deck).toEqual(b.deck);
    expect([...a.deck].sort()).toEqual(
      [...decks.find((d) => d.id === 'balanced')!.cards].sort(),
    );
  });

  it('produces a different order for a different seed', () => {
    const decks = cloneDecks(DEFAULT_DECKS);
    const a = buildRunConfig(selection, 'seed-1', decks);
    const b = buildRunConfig(selection, 'seed-2', decks);
    expect(a.deck).not.toEqual(b.deck);
  });

  it('never mutates the passed-in decks', () => {
    const decks = cloneDecks(DEFAULT_DECKS);
    const before = [...decks.find((d) => d.id === 'balanced')!.cards];
    buildRunConfig(selection, 'seed-1', decks);
    expect(decks.find((d) => d.id === 'balanced')!.cards).toEqual(before);
  });

  it('produces an empty deck when deckId is not found', () => {
    const decks = cloneDecks(DEFAULT_DECKS);
    const config = buildRunConfig({ ...selection, deckId: 'nope' }, 'seed-1', decks);
    expect(config.deck).toEqual([]);
  });
});

describe('reshuffleRunConfig', () => {
  it('preserves the card multiset', () => {
    const decks = cloneDecks(DEFAULT_DECKS);
    const config = buildRunConfig(selection, 'seed-1', decks);
    const reshuffled = reshuffleRunConfig(config, 'seed-2');
    expect([...reshuffled.deck].sort()).toEqual([...config.deck].sort());
  });

  it('preserves board, missionId, and deckId', () => {
    const decks = cloneDecks(DEFAULT_DECKS);
    const config = buildRunConfig(selection, 'seed-1', decks);
    const reshuffled = reshuffleRunConfig(config, 'seed-2');
    expect(reshuffled.board).toBe(config.board);
    expect(reshuffled.missionId).toBe(config.missionId);
    expect(reshuffled.deckId).toBe(config.deckId);
  });

  it('produces a different order across seeds', () => {
    const decks = cloneDecks(DEFAULT_DECKS);
    const config = buildRunConfig(selection, 'seed-1', decks);
    const reshuffled = reshuffleRunConfig(config, 'seed-2');
    expect(reshuffled.deck).not.toEqual(config.deck);
  });

  it('does not mutate the input config', () => {
    const decks = cloneDecks(DEFAULT_DECKS);
    const config = buildRunConfig(selection, 'seed-1', decks);
    const before = [...config.deck];
    reshuffleRunConfig(config, 'seed-2');
    expect(config.deck).toEqual(before);
  });
});
