import type { GameState } from '../rules/state';
import { countTag, totalDefense } from '../rules';

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
}

/** Inherent defense every civilization starts with (its capital). */
const BASE_DEFENSE = 4;

export const MISSIONS: Record<string, MissionDef> = {
  enlightenment: {
    id: 'enlightenment',
    name: 'The Enlightenment',
    description: 'Reach 30 Science by the end of round 12.',
    objective: (G) => G.resources.science >= 30,
    failure: (G) => G.round > 12 && G.resources.science < 30,
    progress: (G) => `Science ${G.resources.science}/30 · round ${Math.min(G.round, 12)}/12`,
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
  },

  barbarian_tide: {
    id: 'barbarian_tide',
    name: 'Barbarian Tide',
    description:
      'Build 3 Wonders before the rising Threat overwhelms your defenses. Threat grows every round — and a barracks only defends if a soldier is stationed there.',
    setup: (G) => {
      G.vars.threat = 0;
    },
    onUpkeep: (G) => {
      G.vars.threat += 2;
    },
    objective: (G) => countTag(G.tableau, 'wonder') >= 3,
    failure: (G) => (G.vars.threat ?? 0) > totalDefense(G.tableau) + BASE_DEFENSE,
    progress: (G) =>
      `Wonders ${countTag(G.tableau, 'wonder')}/3 · Threat ${G.vars.threat ?? 0} vs Defense ${
        totalDefense(G.tableau) + BASE_DEFENSE
      }`,
  },
};
