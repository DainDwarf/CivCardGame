import type { GameState } from '../rules/state';
import { addThreat, instancesFromCardIds, nextInstanceId, shuffleFromState } from '../rules';
import { BARBARIANS } from './cards';

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
  /** Narrative flavour text — the bulk of the mission detail panel
   *  (`meta/CampaignMap.tsx`'s `MissionFlowPopup`, 'detail' step). */
  lore: string;
  /** Mission ids that must be completed (see `rules/campaign.ts`) before this one is
   *  available. Empty = a DAG root, always available. */
  prereqs: string[];
  /** Threat cards this mission seeds at setup, one instance each (`rules/threats.ts`'s `addThreat`).
   *  Declarative rather than an imperative `addThreat` call inside `setup` so the mission-detail
   *  panel (`meta/CampaignMap.tsx`'s `MissionFlowPopup`) can read the *same* list `setup` injects
   *  from, instead of a parallel hardcoded list that could drift. */
  threats?: string[];
  /** Event cards this mission shuffles into the deck at setup, one instance per entry — repeat an id
   *  N times for N copies (e.g. four `'barbarian'` entries for Barbarian Tide's four waves). Same
   *  single-source-of-truth reasoning as `threats`. */
  events?: string[];
  /** The mission's win condition, made into a card. Names a real `content/cards.ts` id of kind
   *  `'objective'` (pinned by a coherence test); `run/setup.ts` seeds it into `GameState.objective`
   *  and the card owns the win (the `objective` predicate) logic plus its live progress readout — so it's the
   *  objective card, not the mission, that holds the predicate (it used to live here as
   *  `objective`/`progress`). A mission-specific *defeat* is a threat's job (its own `defeat` hook,
   *  `rules/threats.ts`'s `evaluateDefeat` into `G.pendingDefeat`). */
  objectiveCardId: string;
  /** One-liner describing the victory condition shown in the mission tooltip. */
  victoryHint: string;
  /** One-liner describing the mission-specific defeat condition; null if famine is the only loss. */
  failureHint: string | null;
  /** `'standard'` missions are binary complete/not; `'infinite'` has no win state and
   *  scores an attempt instead. All current missions are `'standard'`. */
  kind: 'standard' | 'infinite';
  /** Granted once, the first time this mission is cleared (see `rules/rewards.ts`'s
   *  `computeRewards`) — replays pay nothing. `unlockCardId` must name a real
   *  `content/cards.ts` id (pinned by a coherence test). Every `'standard'` mission grants
   *  exactly one unlock by design (docs/DESIGN.md, "Economy & progression"); `'infinite'`
   *  missions have none — they score Influence = rounds survived instead. */
  reward?: { influence: number; unlockCardId: string };
  /** Authored position on the campaign map's DAG grid (`meta/CampaignMap.tsx`): `col` is
   *  the horizontal chronology slot (later = further along history), `row` the vertical
   *  branch offset among siblings. Authored rather than auto-computed — matches the
   *  "authored DAG" in docs/DESIGN.md and keeps control over the narrow tree's shape.
   *  `'infinite'` missions have none — they never appear as a timeline node, only in the
   *  campaign map's always-available bottom banner. */
  map?: { col: number; row: number };
}

export const MISSIONS: Record<string, MissionDef> = {
  enlightenment: {
    id: 'enlightenment',
    name: 'The Enlightenment',
    lore:
      'Salons and printing presses spread new ideas faster than any army could march. ' +
      'Scholars who once worked in isolation now trade letters across borders, and a citizenry ' +
      'that can read starts asking its rulers harder questions.',
    // Test DAG: gated behind The Long Winter.
    prereqs: ['long_winter'],
    // The round-12 deadline is a real threat card (Stagnation) — it renders the visible countdown
    // and owns the loss itself via its own `defeat` predicate, rather than the objective card
    // carrying a `failed` predicate.
    threats: ['enlightenment_deadline'],
    objectiveCardId: 'enlightenment_goal',
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
    // DAG root: always available, unlocks enlightenment/barbarian_tide.
    prereqs: [],
    // The 2-extra-Food-per-round drain is a real threat card (Harsh Winter) — it ticks via the
    // same `endTurn`-broadcast → `resolveCard` spine every other threat uses.
    threats: ['harsh_winter'],
    objectiveCardId: 'long_winter_goal',
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
    prereqs: ['long_winter'],
    events: Array(BARBARIANS).fill('barbarian'),
    objectiveCardId: 'barbarian_tide_goal',
    victoryHint: `Survive all ${BARBARIANS} Barbarian waves without your Military falling below zero.`,
    failureHint: 'Your Military falling below zero — the barbarians overrun you.',
    kind: 'standard',
    reward: { influence: 2, unlockCardId: 'conquest' },
    map: { col: 1, row: 2 },
  },

  the_long_decline: {
    id: 'the_long_decline',
    name: 'The Long Decline',
    lore:
      'Every empire believes itself eternal. Foundations that took generations to lay begin, ' +
      'imperceptibly, to crumble — a beam here, a bridge there — and no council session ever ' +
      'votes to let it happen. It simply does. There is no enemy at the gate; the rot is already ' +
      'inside the walls, and it never stops getting worse.',
    prereqs: [],
    threats: ['creeping_decay'],
    // Never wins on its own — an 'infinite' mission has no fixed win state (its objective card's
    // `met` is always false). The only ending is the universal core-resource-floor collapse, forced
    // eventually by the threat's own escalation.
    objectiveCardId: 'the_long_decline_goal',
    victoryHint: 'There is no victory — only rounds survived.',
    failureHint: 'Your Production falling below zero as the decay outpaces your economy.',
    kind: 'infinite',
  },
};

/**
 * Inject a mission's declarative `threats`/`events` lists into a fresh run's state — the single
 * place this happens, so the mission-detail panel's card-face list (which reads the same lists)
 * can never drift from what a launched run actually sees. Called once by `run/setup.ts` at setup.
 */
export function seedMissionCards(mission: MissionDef, G: GameState): void {
  mission.threats?.forEach((cardId) => addThreat(G, cardId));
  if (mission.events?.length) {
    // Mint the event cards as card instances continuing past the deck's existing ids, then
    // shuffle them into the deck deterministically from the run's RNG stream.
    G.deck.push(...instancesFromCardIds(mission.events, nextInstanceId(G)));
    const { result, rngState } = shuffleFromState(G.deck, G.rngState);
    G.deck = result;
    G.rngState = rngState;
  }
}
