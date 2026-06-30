import type { GameState } from '../rules/state';
import { countTag } from '../rules';

/**
 * A mission is the unit of a run. It defines the win (objective) and any
 * mission-specific lose condition (failure) as predicates over the run state, plus
 * optional per-turn effects. (Famine — food going negative — is a *universal* failure
 * enforced by the run loop, not by individual missions.) Objective/failure are pure
 * functions so they are unit-testable and reusable by the headless simulator.
 */
export interface MissionDef {
  id: string;
  name: string;
  description: string;
  /** One-time setup tweaks to the initial state (mission vars, modifiers). */
  setup?: (G: GameState) => void;
  /** Applied every round during upkeep (threat tick, food drain, ...). */
  onUpkeep?: (G: GameState) => void;
  /** Win condition. */
  objective: (G: GameState) => boolean;
  /** Mission-specific lose condition (famine is handled universally elsewhere). */
  failure: (G: GameState) => boolean;
  /** Short human-readable progress line for the UI. */
  progress: (G: GameState) => string;
  /** One-liner describing the victory condition shown in the mission tooltip. */
  victoryHint: string;
  /** One-liner describing the mission-specific defeat condition; null if famine is the only loss. */
  failureHint: string | null;
}

export const MISSIONS: Record<string, MissionDef> = {
  enlightenment: {
    id: 'enlightenment',
    name: 'The Enlightenment',
    description: 'Reach 30 Science by the end of round 12.',
    objective: (G) => G.resources.science >= 30,
    failure: (G) => G.round > 12 && G.resources.science < 30,
    progress: (G) => `Science ${G.resources.science}/30`,
    victoryHint: 'Accumulate 30 Science before round 12 ends.',
    failureHint: 'Failing to reach 30 Science by round 12.',
  },

  long_winter: {
    id: 'long_winter',
    name: 'The Long Winter',
    description:
      'Endure 15 rounds of brutal winters. Each round drains 2 extra Food on top of your population — keep famine at bay.',
    onUpkeep: (G) => {
      G.resources.food -= 2;
    },
    objective: (G) => G.round > 15,
    // No mission-specific failure: starving (famine) is the universal loss condition.
    failure: () => false,
    progress: (G) => `Endured ${Math.min(G.round, 15)}/15 · Food ${G.resources.food}`,
    victoryHint: 'Endure 15 rounds of brutal winter without starving.',
    failureHint: null,
  },

  barbarian_tide: {
    id: 'barbarian_tide',
    name: 'Barbarian Tide',
    description:
      'Build 3 Wonders before the Threat drains your Military. Threat grows every round — each round it consumes that much Military from your stockpile.',
    setup: (G) => {
      G.vars.threat = 0;
      G.resources.military = 4; // capital garrison
    },
    onUpkeep: (G) => {
      G.vars.threat += 2;
      G.resources.military -= G.vars.threat;
    },
    objective: (G) => countTag(G.tableau, 'wonder') >= 3,
    failure: (G) => G.resources.military < 0,
    progress: (G) =>
      `Wonders ${countTag(G.tableau, 'wonder')}/3 · Military ${G.resources.military} · Threat ${G.vars.threat ?? 0}`,
    victoryHint: 'Construct 3 Wonders before the barbarians overwhelm you.',
    failureHint: 'Military drops below 0 (barbarian sack).',
  },
};
