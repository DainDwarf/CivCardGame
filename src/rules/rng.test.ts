import { describe, it, expect } from 'vitest';
import { shuffle } from './rng';

describe('shuffle', () => {
  const deck = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

  it('is deterministic for a given seed', () => {
    expect(shuffle(deck, 'run-1')).toEqual(shuffle(deck, 'run-1'));
  });

  it('differs across seeds', () => {
    expect(shuffle(deck, 'run-1')).not.toEqual(shuffle(deck, 'run-2'));
  });

  it('preserves the multiset of cards', () => {
    expect([...shuffle(deck, 'run-1')].sort()).toEqual([...deck].sort());
  });

  it('does not mutate the input', () => {
    const original = [...deck];
    shuffle(deck, 'run-1');
    expect(deck).toEqual(original);
  });

  it('actually reorders (not a no-op) for a plain seed', () => {
    expect(shuffle(deck, 'run-1')).not.toEqual(deck);
  });
});
