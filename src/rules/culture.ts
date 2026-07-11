import type { GameState } from './state';

/**
 * Culture is an accumulating gauge that ratchets through discrete *levels*. It is never
 * spent — only the level it has reached matters (it raises hand size and gates cards).
 *
 * The cost to climb from level L to L+1 is `2^L * CULTURE_STEP` culture, so the levels sit
 * at cumulative totals 10, 30, 70, 150, … — each band twice as wide as the last.
 *
 * The level is always DERIVED from `G.culture`; it is deliberately not stored on GameState,
 * so there is no second source of truth to keep in sync across save/undo.
 */
export const CULTURE_STEP = 10;

/** Culture needed to advance *from* level `level` to the next — the width of that band. */
export function cultureStep(level: number): number {
  return 2 ** level * CULTURE_STEP;
}

/** Cumulative culture required to *reach* `level` from 0 — the sum of every band below it
 *  (`10, 30, 70, 150, …`). The single source for "how much raw culture is level N worth", used by
 *  `cultureProgress` for the band floor and by the sim's culture-goal steering. */
export function cultureForLevel(level: number): number {
  return CULTURE_STEP * (2 ** level - 1);
}

/** The highest level `culture` has reached. Computed iteratively to avoid float boundary error. */
export function cultureLevel(culture: number): number {
  let level = 0;
  let remaining = culture;
  while (remaining >= cultureStep(level)) {
    remaining -= cultureStep(level);
    level += 1;
  }
  return level;
}

/** Progress of culture within its current level — everything the progress bar needs. */
export interface CultureProgress {
  /** Level reached so far. */
  level: number;
  /** Culture accumulated into the current band (resets to 0 on each level-up). */
  current: number;
  /** Width of the current band — culture needed to reach the next level. */
  needed: number;
  /** `current / needed`, clamped to [0, 1] — the fill fraction. */
  ratio: number;
}

export function cultureProgress(culture: number): CultureProgress {
  const level = cultureLevel(culture);
  const spent = cultureForLevel(level); // cumulative culture to have reached `level`
  const current = culture - spent;
  const needed = cultureStep(level);
  return { level, current, needed, ratio: needed > 0 ? Math.min(1, current / needed) : 0 };
}

/** Hand size after the culture bonus: one extra card drawn per culture level reached. */
export function effectiveHandSize(G: GameState): number {
  return G.handSize + cultureLevel(G.culture);
}
