import { xoroshiro128plus, xoroshiro128plusFromState } from 'pure-rand/generator/xoroshiro128plus';
import { uniformInt } from 'pure-rand/distribution/uniformInt';
import type { RandomGenerator } from 'pure-rand/types/RandomGenerator';

/**
 * Runs are seeded so draws are reproducible (replays, headless simulation — see
 * docs/DESIGN.md). Game logic must never call `Math.random`; this is the one seam
 * that produces randomness, and it always flows from a `RunConfig.seed` string.
 *
 * `seededRng` returns the raw mutable generator (not just `shuffle`) so callers that
 * need to persist and resume the stream (e.g. `GameState.rngState`, advanced by the
 * discard-pile reshuffle in `deck.ts`) can do so via `getState()`/`shuffleFromState`.
 */
export function seededRng(seed: string): RandomGenerator {
  return xoroshiro128plus(hashSeedToInt(seed));
}

/** Fisher–Yates shuffle, deterministic for a given seed. Does not mutate `arr`. */
export function shuffle<T>(arr: readonly T[], seed: string): T[] {
  return shuffleWithRng(arr, seededRng(seed)).result;
}

/** A uniform integer in `[min, max]` (both inclusive), advancing `rng` in place. The one place
 *  outside `shuffleWithRng` that draws from a live generator — kept here so `pure-rand` stays
 *  confined to this single randomness seam (the headless simulator's `sim/randomPolicy.ts` picks
 *  moves through this, never a fresh import). */
export function randInt(rng: RandomGenerator, min: number, max: number): number {
  return uniformInt(rng, min, max);
}

/**
 * Fisher–Yates shuffle resuming from a persisted RNG state (see `GameState.rngState`).
 * Returns both the shuffled copy and the advanced state, so the caller can store the
 * latter for the next reshuffle. Does not mutate `arr`.
 */
export function shuffleFromState<T>(
  arr: readonly T[],
  rngState: readonly number[],
): { result: T[]; rngState: readonly number[] } {
  return shuffleWithRng(arr, xoroshiro128plusFromState(rngState));
}

function shuffleWithRng<T>(arr: readonly T[], rng: RandomGenerator): { result: T[]; rngState: readonly number[] } {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = uniformInt(rng, 0, i);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return { result, rngState: rng.getState() };
}

/** xmur3 string hash — turns an arbitrary seed string into the 32-bit int the generator wants. */
function hashSeedToInt(seed: string): number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^= h >>> 16) >>> 0;
}
