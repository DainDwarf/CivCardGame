// Integration suite (`*.integration.test.ts`): both cases drive a full `simulateRun` end-to-end over a
// real deck/board/mission, so they're slower and balance-sensitive by nature — the win-rate case moves if
// Masonry's winnability shifts. Run in isolation with `npm run test:integration`.
import { describe, it, expect } from 'vitest';
import { simConfig, simulateRun } from './simulate';
import { createPlannerPolicy } from './plannerPolicy';
import type { DeckCard } from '../rules/deckBuilder';

// Kept byte-identical to `scripts/sim/baselines/masonry.json`, so this case and the standing fixture
// measure the same cell and a sweep of it reads on this test directly.
const MASONRY_DECK: (string | DeckCard)[] = [
  'bead_workshop',
  { cardId: 'farm', stickers: ['irrigation', 'irrigation'] },
  ...Array<string>(4).fill('hut'),
  ...Array<string>(4).fill('foraging'),
  ...Array<string>(2).fill('dogs'),
  ...Array<string>(4).fill('toolmaking'),
  ...Array<string>(2).fill('bow'),
  ...Array<string>(2).fill('conquest'),
  'bartering',
];

function runSeed(seed: number) {
  const config = simConfig({
    deckCardIds: MASONRY_DECK,
    board: 'settlement',
    missionId: 'masonry',
    seed: `masonry-cfg-${seed}`,
  });
  return simulateRun(config, createPlannerPolicy(`masonry-pol-${seed}`));
}

describe('planner clears Masonry', () => {
  // The core claim: competent play clears Masonry end-to-end. Pinned as a clean sweep because that is what
  // it measures — these six are a cold slice of a stream the fixture wins 30 of 30 of — so a single lost
  // seed is a real regression rather than the sample thinning, and widening the sample is then the honest
  // first move, not lowering the bar.
  it('wins on the standing deck across every seed', () => {
    const seeds = 6;
    let wins = 0;
    for (let s = 0; s < seeds; s++) {
      if (runSeed(s).result.outcome === 'victory') wins++;
    }
    expect(wins).toBe(seeds);
  }, 120_000);

  it('is deterministic — same seed pair yields the same outcome', () => {
    const a = runSeed(0);
    const b = runSeed(0);
    expect(a.result.outcome).toBe(b.result.outcome);
    expect(a.actionsApplied).toBe(b.actionsApplied);
  }, 120_000);
});

// A deck with a **peek** card (Calendar, a look-only `reveal`) parks a `pendingInteraction` mid-turn. The
// planner re-plans on that parked state; before the `expandTurn` root-exclusion fix it kept "do nothing"
// as the highest-value line (a parked `endTurn` no-ops, so it dodged food upkeep) and emitted a no-op
// `endTurn` forever until the action cap threw. This pins that the peek is always resolved and the run
// terminates normally — regardless of win/lose, which is a separate balance question.
describe('planner resolves a parked peek instead of deadlocking', () => {
  const CALENDAR_DECK: (string | DeckCard)[] = [
    ...Array<string>(4).fill('foraging'),
    ...Array<string>(4).fill('toolmaking'),
    ...Array<string>(2).fill('bartering'),
    ...Array<string>(2).fill('bead_workshop'),
    ...Array<string>(2).fill('storytelling'),
    'calendar',
  ];
  it('reaches a real gameover well under the action cap', () => {
    const config = simConfig({
      deckCardIds: CALENDAR_DECK,
      board: 'settlement',
      missionId: 'finding_copper',
      seed: 'finding_copper-cfg-0',
    });
    const out = simulateRun(config, createPlannerPolicy('finding_copper-pol-0'));
    expect(['victory', 'defeat']).toContain(out.gameover.outcome);
    expect(out.actionsApplied).toBeLessThan(2000);
  }, 120_000);
});
