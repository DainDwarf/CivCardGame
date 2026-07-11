import { describe, it, expect } from 'vitest';
import { DEFAULT_DECKS } from '../content/decks';
import { createOraclePolicy, proveWinnable, type OracleOptions } from './oracle';
import { simConfig, simulateRun } from './simulate';

// "Growing Numbers" with the basic post-First-Settlement deck (mirrors the CLI scenario): a genuinely
// winnable multi-step build (Conquest ×3 for territory → three distinct buildings) that greedy2 clears on
// most seeds, so the oracle ceiling should find a line on at least one of a small scan.
const GROWING_DECK = [...DEFAULT_DECKS[0].cards, 'hut', 'farm', 'toolmaker', 'conquest'];

// Small-but-capable search bounds keep the tests to a handful of seconds each while still reliably finding
// the Growing Numbers win when one exists. Not the shipped defaults (those trade cost for completeness).
const TEST_OPTS: OracleOptions = { beamWidth: 40, turnConfigLimit: 24, maxRounds: 30 };

describe('seeded oracle — winnability search + replay seam', () => {
  it(
    'a search-proven win replays through the real engine to victory (the dispensing seam)',
    () => {
      let anyFound = false;
      for (let i = 0; i < 5; i++) {
        const seed = `oracle-grow-${i}`;
        const config = simConfig({ deckCardIds: GROWING_DECK, board: 'tribe', missionId: 'growing_numbers', seed });
        const policy = createOraclePolicy(seed, TEST_OPTS);
        const out = simulateRun(config, policy);
        // The claim that matters: whenever the offline search claims a line, dispensing it one action per
        // step drives the *real* drive loop to an actual victory. (When it finds none, the greedy2 fallback
        // plays out — not asserted here, covered by the termination test below.)
        if (policy.foundLine) {
          anyFound = true;
          expect(out.result.outcome).toBe('victory');
        }
      }
      expect(anyFound).toBe(true); // non-vacuous: the search really proved at least one seed winnable
    },
    120_000,
  );

  it(
    'reports a genuinely-unwinnable mission as not winnable, and still terminates',
    () => {
      // The sandbox objective can never be met, so no line exists at any depth.
      const opts: OracleOptions = { beamWidth: 16, turnConfigLimit: 12, maxRounds: 12 };
      const config = simConfig({ deckCardIds: DEFAULT_DECKS[0].cards, board: 'tribe', missionId: 'sandbox', seed: 'oracle-sandbox' });

      const proof = proveWinnable(config, opts);
      expect(proof.winnable).toBe(false);
      expect(proof.line).toBeNull();

      // With no line, the policy falls back to greedy2 and the run still reaches a gameover (the sandbox's
      // round deadline), so `foundLine` stays false and the run terminates in defeat.
      const policy = createOraclePolicy('oracle-sandbox', opts);
      const out = simulateRun(config, policy);
      expect(policy.foundLine).toBe(false);
      expect(out.gameover.outcome).toBe('defeat');
    },
    120_000,
  );
});
