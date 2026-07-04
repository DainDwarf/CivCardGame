import type { GameState } from '../rules/state';
import { shuffleFromState } from '../rules';

/** Number of Barbarian event cards seeded into the deck by Barbarian Tide. */
const BARBARIANS = 4;

/**
 * A mission is the unit of a run. It defines the win (objective) and any
 * mission-specific lose condition (failure) as predicates over the run state, plus
 * optional per-turn effects. Core resource floors (any of the 5 resources going
 * negative) are a *universal* failure enforced by the run loop via `coreCollapse`,
 * not by individual missions. Objective/failure are pure functions so they are
 * unit-testable and reusable by the headless simulator.
 */
export interface MissionDef {
  id: string;
  name: string;
  description: string;
  /** Mission ids that must be completed (see `rules/campaign.ts`) before this one is
   *  available. Empty = a DAG root, always available. */
  prereqs: string[];
  /** One-time setup tweaks to the initial state (mission vars, modifiers). */
  setup?: (G: GameState) => void;
  /** Applied every round during upkeep (threat tick, food drain, ...). */
  onUpkeep?: (G: GameState) => void;
  /** Win condition. */
  objective: (G: GameState) => boolean;
  /** Mission-specific lose condition (core resource floors are handled universally elsewhere). */
  failure: (G: GameState) => boolean;
  /** Short human-readable progress line for the UI. */
  progress: (G: GameState) => string;
  /** One-liner describing the victory condition shown in the mission tooltip. */
  victoryHint: string;
  /** One-liner describing the mission-specific defeat condition; null if famine is the only loss. */
  failureHint: string | null;
  /** `'standard'` missions are binary complete/not; `'infinite'` (Step 6) has no win state and
   *  scores an attempt instead. All current missions are `'standard'`. */
  kind: 'standard' | 'infinite';
}

export const MISSIONS: Record<string, MissionDef> = {
  enlightenment: {
    id: 'enlightenment',
    name: 'The Enlightenment',
    description: 'Reach 30 Science by the end of round 12.',
    // Test DAG (docs/TODO.md Phase 3 Step 3): gated behind The Long Winter.
    prereqs: ['long_winter'],
    objective: (G) => G.resources.science >= 30,
    failure: (G) => G.round > 12 && G.resources.science < 30,
    progress: (G) => `Science ${G.resources.science}/30`,
    victoryHint: 'Accumulate 30 Science before round 12 ends.',
    failureHint: 'Failing to reach 30 Science by round 12.',
    kind: 'standard',
  },

  long_winter: {
    id: 'long_winter',
    name: 'The Long Winter',
    description:
      'Endure 15 rounds of brutal winters. Each round drains 2 extra Food on top of your population — keep famine at bay.',
    // DAG root: always available, unlocks enlightenment/barbarian_tide.
    prereqs: [],
    onUpkeep: (G) => {
      G.resources.food -= 2;
    },
    objective: (G) => G.round > 15,
    // No mission-specific failure: the universal core resource floor handles defeat here.
    failure: () => false,
    progress: (G) => `Endured ${Math.min(G.round, 15)}/15 · Food ${G.resources.food}`,
    victoryHint: 'Endure 15 rounds of brutal winter without starving.',
    failureHint: null,
    kind: 'standard',
  },

  barbarian_tide: {
    id: 'barbarian_tide',
    name: 'Barbarian Tide',
    description:
      `Four waves of Barbarians are hidden in your deck. Each one you draw strikes at the end of the round — draining 4 Military — then is gone. Build up your Military and survive all ${BARBARIANS} to win; let it fall below zero and your civilization is overrun.`,
    prereqs: ['long_winter'],
    setup: (G) => {
      for (let i = 0; i < BARBARIANS; i++) G.deck.push('barbarian');
      // Shuffle the barbarians into the deck deterministically from the run's RNG stream.
      const { result, rngState } = shuffleFromState(G.deck, G.rngState);
      G.deck = result;
      G.rngState = rngState;
      G.resources.military += 4; // capital garrison — layer on top of the starting baseline
    },
    objective: (G) =>
      G.removed.filter((id) => id === 'barbarian').length >= BARBARIANS && G.resources.military >= 0,
    // No mission-specific failure: the universal core resource floor handles defeat (Military < 0).
    failure: () => false,
    progress: (G) =>
      `Barbarians beaten ${G.removed.filter((id) => id === 'barbarian').length}/${BARBARIANS} · Military ${G.resources.military}`,
    victoryHint: `Survive all ${BARBARIANS} Barbarian waves without your Military falling below zero.`,
    failureHint: 'Your Military falling below zero — the barbarians overrun you.',
    kind: 'standard',
  },
};
