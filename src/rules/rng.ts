import { xoroshiro128plus } from 'pure-rand/generator/xoroshiro128plus';
import { uniformInt } from 'pure-rand/distribution/uniformInt';
import type { RandomGenerator } from 'pure-rand/types/RandomGenerator';

/**
 * Runs are seeded so draws are reproducible (replays, headless simulation — see
 * docs/DESIGN.md). Game logic must never call `Math.random`; this is the one seam
 * that produces randomness, and it always flows from a `RunConfig.seed` string.
 *
 * `seededRng` returns the raw mutable generator (not just `shuffle`) so later steps —
 * e.g. seeding the discard-pile reshuffle — can keep drawing from the same stream
 * instead of building a parallel RNG path.
 */
export function seededRng(seed: string): RandomGenerator {
  return xoroshiro128plus(hashSeedToInt(seed));
}

/** Fisher–Yates shuffle, deterministic for a given seed. Does not mutate `arr`. */
export function shuffle<T>(arr: readonly T[], seed: string): T[] {
  const rng = seededRng(seed);
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = uniformInt(rng, 0, i);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
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
