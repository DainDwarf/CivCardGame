import { cloneState, shuffleFromState, type GameState } from '../rules';

/**
 * **Fair draw sampling** for the planner (`sim/plannerPolicy.ts`) — the seam that keeps it honest, unlike
 * the oracle. The oracle reads the real shuffle straight off `cloneState(G)`; a *fair* planner may
 * know only what the player knows: the current hand, and the deck as an **unordered multiset** (the
 * in-game deck view even labels it "Grouped — not in draw order"). So before searching a future, the
 * planner replays it against a **sampled** deck order drawn from its own seed stream, never the real one.
 *
 * v1 shuffles the **whole** deck (a conservative, always-fair information set): the engine's `revealCount`
 * is only a monotonic peek *bump*, not a reliable current known-prefix length, so there is no trustworthy
 * "revealed top-of-deck prefix" to hold fixed yet. Keeping a real peeked prefix fixed (so Calendar-style
 * reveals are valued precisely) is a future refinement gated on that signal — until then, treating the
 * whole deck as hidden can only *under*-use information, never leak the real order.
 *
 * The hand, tableau, discard, and every other zone are left as-is (all known to the player). `rngState` is
 * re-seeded from the sampling stream so an in-search reshuffle continues the *sample*, not the real run's
 * stream. Returns the advanced sampling `rngState` so the caller threads independent worlds.
 */
export function determinize(
  G: GameState,
  rngState: readonly number[],
): { G: GameState; rngState: readonly number[] } {
  const clone = cloneState(G);
  // Whole deck — no revealed-prefix fidelity yet (see above): `revealCount` can't tell us how many top
  // cards a peek still leaves known, so nothing is held fixed.
  const { result, rngState: next } = shuffleFromState(clone.deck, rngState);
  clone.deck = result;
  clone.rngState = next;
  return { G: clone, rngState: next };
}
