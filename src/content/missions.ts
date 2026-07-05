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
  /** Narrative flavour text — the bulk of the Step 5.3 mission detail panel
   *  (`meta/CampaignMap.tsx`'s `MissionDetailPanel`). Distinct from `description`, which
   *  states the mechanical objective. */
  lore: string;
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
  /** Granted once, the first time this mission is cleared (see `rules/rewards.ts`'s
   *  `computeRewards`) — replays pay nothing. `unlockCardId` is required because every
   *  mission grants exactly one unlock by design (docs/DESIGN.md, "Economy & progression");
   *  it must name a real `content/cards.ts` id (pinned by a coherence test). */
  reward: { influence: number; unlockCardId: string };
  /** Authored position on the campaign map's DAG grid (`meta/CampaignMap.tsx`): `col` is
   *  the horizontal chronology slot (later = further along history), `row` the vertical
   *  branch offset among siblings. Authored rather than auto-computed — matches the
   *  "authored DAG" in docs/DESIGN.md and keeps control over the narrow tree's shape. */
  map: { col: number; row: number };
}

export const MISSIONS: Record<string, MissionDef> = {
  enlightenment: {
    id: 'enlightenment',
    name: 'The Enlightenment',
    lore:
      'Salons and printing presses spread new ideas faster than any army could march. ' +
      'Scholars who once worked in isolation now trade letters across borders, and a citizenry ' +
      'that can read starts asking its rulers harder questions.',
    description: 'Reach 30 Science by the end of round 12.',
    // Test DAG (docs/TODO.md Phase 3 Step 3): gated behind The Long Winter.
    prereqs: ['long_winter'],
    objective: (G) => G.resources.science >= 30,
    failure: (G) => G.round > 12 && G.resources.science < 30,
    progress: (G) => `Science ${G.resources.science}/30`,
    victoryHint: 'Accumulate 30 Science before round 12 ends.',
    failureHint: 'Failing to reach 30 Science by round 12.',
    kind: 'standard',
    reward: { influence: 2, unlockCardId: 'university' },
    map: { col: 1, row: 0 },
  },

  long_winter: {
    id: 'long_winter',
    name: 'The Long Winter',
    lore:
      'The sky has not cleared in months. Rivers freeze over, game vanishes from the woods, ' +
      'and every granary in the settlement is being watched a little too closely. Your people ' +
      'do not need conquest or invention right now — they need to survive until spring.',
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
    reward: { influence: 1, unlockCardId: 'granary' },
    map: { col: 0, row: 1 },
  },

  barbarian_tide: {
    id: 'barbarian_tide',
    name: 'Barbarian Tide',
    lore:
      'Riders have been seen on the horizon — first scouts, then whole warbands, drawn by ' +
      'rumors of your granaries and gold. They do not come all at once; they come in waves, ' +
      'testing your walls each time before falling back to gather strength for the next.',
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
    reward: { influence: 2, unlockCardId: 'conquest' },
    map: { col: 1, row: 2 },
  },
};
