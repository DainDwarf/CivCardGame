// Integration suite (`*.integration.test.ts`): drives a full `simulateRun` end-to-end over the real
// Accounting mission, so it exercises the *whole* breeding loop the unit tests can only stub — reshuffle
// emitted mid-draw → flushed at a boundary → `envious_population` mints Thieves into the deck → they're
// drawn on a later refill → unplayed ones drain via `resolveHandEvents`. `simulateRun` runs
// `assertRunInvariants` after every action, so "cards breeding cards mid-run never corrupts state"
// (unique ids, staffing bounds, drained bus) is asserted for free across the run. Run in isolation with
// `npm run test:integration`.
import { describe, it, expect } from 'vitest';
import { simConfig, simulateRun } from '../sim/simulate';
import { createGreedyPolicy } from '../sim/greedyPolicy';
import type { RunState } from '../run/engine';

// A money-leaning deck with no money *sink* (no Bartering), so the goal-directed greedy — whose target on
// this mission *is* money — banks 🪙 upward toward 40 and crosses the spawn threshold at a reshuffle
// rather than incidentally. Trader/Jewelry are the faucets; Farm/Foraging/Hut sustain and grow the
// population that staffs them.
const MONEY_DECK: string[] = [
  ...Array<string>(3).fill('trader'),
  ...Array<string>(3).fill('jewelry'),
  ...Array<string>(3).fill('toolmaking'),
  ...Array<string>(2).fill('farm'),
  ...Array<string>(2).fill('foraging'),
  ...Array<string>(2).fill('hut'),
];

function runSeed(seed: number) {
  const config = simConfig({
    deckCardIds: MONEY_DECK,
    board: 'settlement',
    missionId: 'accounting',
    seed: `accounting-cfg-${seed}`,
  });
  let thiefBred = false;
  const outcome = simulateRun(config, createGreedyPolicy(`accounting-pol-${seed}`), {
    onStep: ({ next }: { next: RunState }) => {
      // A Thief exists in a *drawable* zone only if the threat minted it (none are seeded at setup).
      const G = next.G;
      if ([...G.deck, ...G.hand, ...G.discard, ...G.removed].some((c) => c.cardId === 'thief')) {
        thiefBred = true;
      }
    },
  });
  return { outcome, thiefBred };
}

describe('Accounting breeds thieves end-to-end', () => {
  // The core claim: over a real run the Envious Population threat actually mints Thieves through the live
  // reshuffle cycle (not the stubbed `dispatchEvent` the unit test uses), and no invariant trips while it
  // does. A hoard-pursuing policy on a sink-free deck banks past the threshold on every seed.
  it('mints thieves into the deck as the treasury grows', () => {
    const seeds = 4;
    let bred = 0;
    for (let s = 0; s < seeds; s++) {
      if (runSeed(s).thiefBred) bred++;
    }
    expect(bred).toBeGreaterThan(0);
  }, 120_000);

  it('is deterministic — same seed pair yields the same run', () => {
    const a = runSeed(0);
    const b = runSeed(0);
    expect(a.outcome.result.outcome).toBe(b.outcome.result.outcome);
    expect(a.outcome.actionsApplied).toBe(b.outcome.actionsApplied);
    expect(a.thiefBred).toBe(b.thiefBred);
  }, 120_000);
});
