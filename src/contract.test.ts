import { describe, it, expect } from 'vitest';
import { buildRunConfig, type RunSelection } from './contract';
import { DECKS } from './content/decks';

const selection: RunSelection = {
  missionId: 'enlightenment',
  boardId: 'tribe',
  deckId: 'balanced',
};

describe('buildRunConfig', () => {
  it('carries missionId, board, and seed through unchanged', () => {
    const config = buildRunConfig(selection, 'seed-1');
    expect(config.missionId).toBe('enlightenment');
    expect(config.board).toBe('tribe');
    expect(config.deckId).toBe('balanced');
    expect(config.seed).toBe('seed-1');
  });

  it('shuffles the selected deck deterministically from the seed', () => {
    const a = buildRunConfig(selection, 'seed-1');
    const b = buildRunConfig(selection, 'seed-1');
    expect(a.deck).toEqual(b.deck);
    expect([...a.deck].sort()).toEqual([...DECKS.balanced.cards].sort());
  });

  it('produces a different order for a different seed', () => {
    const a = buildRunConfig(selection, 'seed-1');
    const b = buildRunConfig(selection, 'seed-2');
    expect(a.deck).not.toEqual(b.deck);
  });

  it('never mutates the saved deck in DECKS', () => {
    const before = [...DECKS.balanced.cards];
    buildRunConfig(selection, 'seed-1');
    expect(DECKS.balanced.cards).toEqual(before);
  });
});
