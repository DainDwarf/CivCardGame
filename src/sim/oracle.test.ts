import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { CardDef } from '../content/cards';
import {
  installFixtures,
  uninstallFixtures,
  installCards,
  uninstallCards,
  TEST_BOARD_ID,
} from '../rules/testFixtures';
import {
  createOraclePolicy,
  createProverPolicy,
  proveWinnable,
  searchBoundsFor,
  NO_WIN_REASON,
  noWinReason,
  type OracleOptions,
} from './oracle';
import { simConfig, simulateRun } from './simulate';

// A staffable science producer (cost {}, so it goes down and staffs on turn 1). Paired with the shared
// +3🌾 work box, the winnable line is a genuine *multi-round build*: staff one of each (the Test Board's
// 2 population), and food nets +1/round (no famine) while science climbs +2/round from 3 toward the
// 10-threshold — a win reached over several `endTurn`s, not a turn-1 burst. That multi-round shape is the
// point: it drives the oracle's round beam, cross-round transposition, and `endTurn`-edge line
// reconstruction (a turn-1 win would return from the within-turn sub-search and exercise none of them).
const SCI_WORK = {
  test_sci_work: {
    id: 'test_sci_work', name: 'Test Science Work', kind: 'work',
    cost: {}, workers: 1, produces: { resources: { science: 2 } },
  },
} satisfies Record<string, CardDef>;

// Four of each, so both types surface across the draw order the oracle searches over.
const BUILD_DECK = [
  ...Array.from({ length: 4 }, () => 'test_sci_work'),
  ...Array.from({ length: 4 }, () => 'test_work_food'),
];

// Small-but-capable search bounds keep the tests fast while reliably finding the multi-round win.
const TEST_OPTS: OracleOptions = { beamWidth: 40, turnConfigLimit: 24, maxRounds: 30 };

describe('seeded oracle — winnability search + replay seam', () => {
  beforeAll(() => {
    installFixtures();
    installCards(SCI_WORK);
  });
  afterAll(() => {
    uninstallCards(SCI_WORK);
    uninstallFixtures();
  });

  it(
    'search-proves a multi-round win and dispenses it through the real engine to victory',
    () => {
      let anyFound = false;
      for (let i = 0; i < 5; i++) {
        const seed = `oracle-win-${i}`;
        const config = simConfig({ deckCardIds: BUILD_DECK, board: TEST_BOARD_ID, missionId: 'test_win', seed });

        const { winnable, line } = proveWinnable(config, TEST_OPTS);
        if (!winnable) continue;
        anyFound = true;
        expect(line).not.toBeNull();
        // The win spans real turns — the coverage a turn-1 burst would lose: the line carries `endTurn`
        // edges, so reconstructing and dispensing it exercises the cross-round machinery.
        expect(line!.some((a) => a.kind === 'endTurn')).toBe(true);

        // The dispensing seam: determinism lands each dispensed action on the same state the search saw,
        // so replaying the found (multi-round) line through the *real* drive loop reaches an actual victory.
        const policy = createOraclePolicy(seed, TEST_OPTS);
        const out = simulateRun(config, policy);
        expect(policy.foundLine).toBe(true);
        expect(out.result.outcome).toBe('victory');
      }
      expect(anyFound).toBe(true); // non-vacuous: the search really proved at least one seed winnable
    },
    60_000,
  );

  it(
    'reports a genuinely-unwinnable mission as not winnable, and still terminates',
    () => {
      // `test_unwinnable`'s `test_never` objective can never be met, so no line exists at any depth; its
      // round-5 `test_deadline` keeps both the search and the fallback run short.
      const opts: OracleOptions = { beamWidth: 16, turnConfigLimit: 12, maxRounds: 12 };
      const config = simConfig({ deckCardIds: BUILD_DECK, board: TEST_BOARD_ID, missionId: 'test_unwinnable', seed: 'oracle-unwinnable' });

      const proof = proveWinnable(config, opts);
      expect(proof.winnable).toBe(false);
      expect(proof.line).toBeNull();
      // Every branch dies on the round-5 deadline, so the search runs out of *successors* rather than of
      // budget or depth — the mode that indicts the beam rather than the caps.
      expect(proof.exhausted).toBe('deadEnd');

      // With no line, the oracle falls back and the run still reaches a gameover (the round-5 deadline),
      // so `foundLine` stays false and the run terminates in defeat.
      const policy = createOraclePolicy('oracle-unwinnable', opts);
      const out = simulateRun(config, policy);
      expect(policy.foundLine).toBe(false);
      expect(out.gameover.outcome).toBe('defeat');
    },
    30_000,
  );

  it(
    'prover ends an unprovable seed as noWinFound, naming the bound that stopped the search',
    () => {
      const opts: OracleOptions = { beamWidth: 16, turnConfigLimit: 12, maxRounds: 12 };
      const config = simConfig({ deckCardIds: BUILD_DECK, board: TEST_BOARD_ID, missionId: 'test_unwinnable', seed: 'prover-unwinnable' });

      const policy = createProverPolicy('prover-unwinnable', opts);
      const out = simulateRun(config, policy);

      expect(policy.foundLine).toBe(false);
      expect(out.gameover.reason).toBe(noWinReason('deadEnd'));
      // Still greppable as one family, so a report can split by bound or fold them back together.
      expect(out.gameover.reason?.startsWith(NO_WIN_REASON)).toBe(true);
      // Declined before dispatching anything, so the reason can't be a stand-in policy's collapse.
      expect(out.actionsApplied).toBe(0);
    },
    30_000,
  );

  it('derives the search depth from the sweep cutoff, and only from an explicit finite one', () => {
    expect(searchBoundsFor({ maxRounds: 120 })).toEqual({ maxRounds: 120 });
    // An absent or disabled cutoff must leave the calibrated default rather than write `undefined` over
    // it (the options spread would) or search unbounded.
    expect(searchBoundsFor({})).toEqual({});
    expect(searchBoundsFor(undefined)).toEqual({});
    expect(searchBoundsFor({ maxRounds: Infinity })).toEqual({});
  });

  it(
    'prover replays a search-proven line to the same victory the oracle finds',
    () => {
      const config = simConfig({ deckCardIds: BUILD_DECK, board: TEST_BOARD_ID, missionId: 'test_win', seed: 'prover-winnable' });

      const policy = createProverPolicy('prover-winnable', TEST_OPTS);
      const out = simulateRun(config, policy);

      expect(policy.foundLine).toBe(true);
      expect(out.gameover.outcome).toBe('victory');
    },
    60_000,
  );
});
