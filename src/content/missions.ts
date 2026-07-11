import type { GameState } from '../rules/state';
import { addThreat, instancesFromCardIds, nextInstanceId, shuffleFromState } from '../rules';

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
   *  N times for N copies (e.g. several event entries for a mission's successive waves). Same
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
   *  scores an attempt instead. */
  kind: 'standard' | 'infinite';
  /** Granted once, the first time this mission is cleared (see `rules/rewards.ts`'s
   *  `computeRewards`) — replays pay nothing. A `'standard'` mission grants **one or more** unlocks
   *  across three symmetric, all-optional kinds — card unlocks (`unlockCardIds`, each naming a real
   *  `content/cards.ts` id), card-sticker unlocks (`unlockStickerIds`, `content/stickers.ts`), and
   *  board-sticker unlocks (`unlockBoardStickerIds`, `content/boardStickers.ts`) — a mission omits
   *  whichever kind it doesn't grant (all pinned by a coherence test). Unlike cards, a sticker unlock
   *  simply makes the sticker *purchasable* (hidden-until-unlocked, like a card); the Influence to buy
   *  it is separate. `'infinite'` missions have no reward — they score Influence = rounds survived. */
  reward?: {
    influence: number;
    unlockCardIds?: string[];
    unlockStickerIds?: string[];
    unlockBoardStickerIds?: string[];
  };
  /** Authored position on the campaign map's DAG grid (`meta/CampaignMap.tsx`): `col` is
   *  the horizontal chronology slot (later = further along history), `row` a *signed* vertical
   *  branch offset from the center axis — `0` sits on the middle line, positive fans downward and
   *  negative upward, so a single-row chain stays vertically centered. Authored rather than
   *  auto-computed — matches the "authored DAG" in docs/DESIGN.md and keeps control over the
   *  narrow tree's shape.
   *  `'infinite'` missions have none — they never appear as a timeline node, only in the
   *  campaign map's always-available bottom banner. */
  map?: { col: number; row: number };
  /** The historical age (`content/ages.ts`'s `AGES`) this mission lives under — the campaign
   *  map band it sits beneath. Each age *covers a slice of the DAG*: its band + gradient wash
   *  span exactly the columns its missions occupy, derived from the `map.col`s of same-age
   *  missions (`ages.ts`'s `ageColSpans`). Required for `'standard'` missions and must name a
   *  real `AGES` id in chronological order relative to siblings (pinned by a coherence test);
   *  `'infinite'` missions sit outside the tree and carry none, like `map`. (This tag is also
   *  what a later "age tag on cards" would derive from: a card's age = its unlocking mission's.) */
  age?: string;
}

/**
 * The mission catalogue. Holds the baseline `sandbox` infinite mission plus the opening of the
 * Stone Age arc.
 *
 * `sandbox` is an `'infinite'` mission (no win state — it scores Influence = rounds survived and
 * renders in the campaign map's bottom banner, not as a DAG node). Its `sandbox_goal` objective
 * never wins by design; run length is bounded purely by the `sands_of_time` deadline threat, a
 * no-drain `defeat` predicate that ends the run once round `SANDBOX_DEADLINE` elapses — so the
 * sandbox measures the economy baseline for the Step 4 simulator without any drain skewing it.
 *
 * `first_settlement` is the first `'standard'` mission: a DAG root (no prereqs) at the start of the
 * Stone Age band. It seeds no threat and no event — a pure stockpile race against nothing but
 * famine — and its first clear unlocks the whole Stone Age building set at once (Farm, Toolmaker,
 * Hut) plus Conquest. It carries no Influence (the cards are the prize).
 *
 * `growing_numbers` follows it (prereq: `first_settlement`): stand up a working settlement — a
 * Hut, a Farm, and a Toolmaker at once — again no threat/event, the challenge being to grow
 * territory (via replayable Conquest) enough to place all three. Its clear pays 6 Influence and
 * unlocks the first card sticker (Irrigation) and the first
 * board sticker (Territory) — the debut of the sticker-unlock reward kinds.
 *
 * `rites_rituals` follows it (prereq: `growing_numbers`): the culture mission — accumulate 🎭
 * culture to reach level 2 (each level raises hand size). No threat/event and no deadline; the
 * challenge is decking in the culture cards you own (Cave Art, Clothing) to climb the gauge. Its
 * clear pays 8 Influence and unlocks Göbekli Tepe — the age's first *wonder*, a culture-gated
 * building owned here so the capstone (6.7) can build it.
 */
export const MISSIONS: Record<string, MissionDef> = {
  first_settlement: {
    id: 'first_settlement',
    name: 'The First Settlement',
    lore:
      'The band has wandered long enough. The valley is fertile, the water clean — here, at last, is a ' +
      'place worth staying. Gather the stores and raise the spears to defend them, and the first roofs ' +
      'of a settled people can rise.',
    prereqs: [],
    objectiveCardId: 'first_settlement_goal',
    victoryHint: 'Stockpile 10 🔨 production and 10 ⚔️ military at once.',
    failureHint: null,
    kind: 'standard',
    reward: { influence: 0, unlockCardIds: ['farm', 'toolmaker', 'hut', 'conquest'] },
    map: { col: 0, row: 0 },
    age: 'stone',
  },
  growing_numbers: {
    id: 'growing_numbers',
    name: 'Growing Numbers',
    lore:
      'The stores are safe and the spears are ready — now the people need a place to live and work. A ' +
      'Hut for shelter, a Farm for bread, a Toolmaker for the crafts: raise all three and a wandering ' +
      'band becomes a settlement that stays.',
    prereqs: ['first_settlement'],
    objectiveCardId: 'growing_numbers_goal',
    victoryHint: 'Build a 🛖 Hut, a 🌱 Farm, and an ⛏️ Toolmaker.',
    failureHint: null,
    kind: 'standard',
    reward: { influence: 6, unlockStickerIds: ['irrigation'], unlockBoardStickerIds: ['territory'] },
    map: { col: 1, row: 0 },
    age: 'stone',
  },
  rites_rituals: {
    id: 'rites_rituals',
    name: 'Rites & Rituals',
    lore:
      'A settled people needs more than bread and shelter — it needs meaning. Around the fire the ' +
      'first rites take shape: the painted hand, the carved bone, the story told and retold until it ' +
      'binds the band together. Let the culture of the people rise, and they will remember who they are.',
    prereqs: ['growing_numbers'],
    objectiveCardId: 'rites_rituals_goal',
    victoryHint: 'Reach 🎭 culture level 2.',
    failureHint: null,
    kind: 'standard',
    reward: { influence: 8, unlockCardIds: ['gobekli_tepe'] },
    map: { col: 2, row: 0 },
    age: 'stone',
  },
  sandbox: {
    id: 'sandbox',
    name: 'The Long Wander',
    lore:
      'Before cities, before harvests — only the band, the seasons, and the long walk between them. ' +
      'There is nothing here to win. Wander well, and see how long the age carries you.',
    prereqs: [],
    threats: ['sands_of_time'],
    objectiveCardId: 'sandbox_goal',
    victoryHint: 'There is no victory — only rounds survived.',
    failureHint: 'The run ends once the age turns (round 50), or if a core resource collapses.',
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
