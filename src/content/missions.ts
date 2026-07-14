import type { GameState } from '../rules/state';
import { addThreat, instancesFromCardIds, nextInstanceId, shuffleFromState } from '../rules';
import { RAIDER_WAVES } from './cards';

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
  /** Opts an `'infinite'` mission out of scoring: no Influence payout and no `bestInfinite`
   *  best-score entry — a pure no-stakes practice space (the sandbox). One flag, both consequences,
   *  so a scored infinite mission stays the default and the "rounds survived is a reward" and "…is a
   *  score" branches can't diverge. Meaningless on a `'standard'` mission. */
  rewardless?: boolean;
  /** Granted once, the first time this mission is cleared (see `rules/rewards.ts`'s
   *  `computeRewards`) — replays pay nothing. A `'standard'` mission's unlocks are **all optional**:
   *  it may grant any mix across four symmetric kinds — card unlocks (`unlockCardIds`, each naming a
   *  real `content/cards.ts` id), card-sticker unlocks (`unlockStickerIds`, `content/stickers.ts`),
   *  board-sticker unlocks (`unlockBoardStickerIds`, `content/boardStickers.ts`), and board unlocks
   *  (`unlockBoardIds`, each naming a real `content/boards.ts` id) — or **none at all** (an
   *  Influence-only reward, or no reward object). A coherence test pins only that whatever ids a
   *  mission *does* name are real. Unlike cards, a sticker/board unlock simply makes it *available*
   *  (hidden-until-unlocked, like a card); a board carries no Influence cost. `'infinite'` missions
   *  have no reward object — they score Influence = rounds survived instead (unless `rewardless`).
   *
   *  `boardUpgrade` is the odd one out — not an *unlock* but a board *replacement*: it retires the
   *  `from` board in favour of `to` (carrying its stickers across), so the player's government reads as
   *  upgraded rather than a second board appearing. Applied once on first clear by `applyBoardUpgrade`
   *  (`rules/boardUpgrade.ts`), it names two real `content/boards.ts` ids. */
  reward?: {
    influence: number;
    unlockCardIds?: string[];
    unlockStickerIds?: string[];
    unlockBoardStickerIds?: string[];
    unlockBoardIds?: string[];
    boardUpgrade?: { from: string; to: string };
  };
  /** Authored position on the campaign map's DAG grid (`meta/CampaignMap.tsx`): `col` is
   *  the horizontal chronology slot (later = further along history), `row` a *signed* vertical
   *  branch offset from the center axis — `0` sits on the middle line, positive fans downward and
   *  negative upward, so a single-row chain stays vertically centered. Authored rather than
   *  auto-computed — matches the "authored DAG" in docs/DESIGN.md and keeps control over the
   *  narrow tree's shape.
   *  `'infinite'` missions have none — they never appear as a timeline node, only in the
   *  campaign map's bottom banner (shown once their prereqs are met, like any mission). */
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
 * The mission catalogue: the opening of the Stone Age arc plus two endless missions. The endless pair
 * both use a never-winning objective and end only on collapse, but differ in stakes: `ice_age` is a
 * *scored survival* mission — a deepening food-drain threat (`long_winter`) guarantees eventual famine,
 * and rounds survived pay out as Influence — while `sandbox` is `rewardless`, a no-stakes practice space
 * with no bounding threat that ends only on collapse or when the player quits. The simulator drives
 * neither (a never-winning objective offers it no gradient to climb).
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
    // Settling upgrades the Tribe board into the settled `settlement` government (fuller stores, the
    // first worked fields, a patch of owned territory) — the arc's first taste of board progression.
    reward: {
      influence: 0,
      unlockCardIds: ['farm', 'hut', 'conquest'],
      boardUpgrade: { from: 'tribe', to: 'settlement' },
    },
    map: { col: 0, row: 0 },
    age: 'stone',
  },
  growing_numbers: {
    id: 'growing_numbers',
    name: 'Growing Numbers',
    lore:
      'The stores are safe and the spears are ready — now the people need a place to live and work. A ' +
      'Hut for shelter, a Farm for bread: raise them both and a wandering band becomes a settlement ' +
      'that stays.',
    prereqs: ['first_settlement'],
    objectiveCardId: 'growing_numbers_goal',
    victoryHint: 'Build a 🛖 Hut and a 🌱 Farm.',
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
    victoryHint: 'Reach 🎭 culture level 1.',
    failureHint: null,
    kind: 'standard',
    reward: { influence: 8, unlockCardIds: ['burial'] },
    map: { col: 2, row: -1 },
    age: 'stone',
  },
  raiders_at_border: {
    id: 'raiders_at_border',
    name: 'Raiders at the Border',
    lore:
      'A settled people with full granaries does not go unnoticed. Beyond the ridgeline, hungry ' +
      'bands have marked the easy pickings, and wave after wave will come for the stores. Spears ' +
      'alone will not hold them: raise the warriors, meet each raid head-on, and drive the raiders ' +
      'off for good — or watch the harvest bleed away, season after season.',
    prereqs: ['rites_rituals'],
    // One `raider` event per wave, tied to the objective's threshold by the shared RAIDER_WAVES const
    // so the mission can't seed a different count than the win asks for. `Array.from` (not `.fill`)
    // for a clean `string[]`.
    events: Array.from({ length: RAIDER_WAVES }, () => 'raider'),
    objectiveCardId: 'raiders_at_border_goal',
    victoryHint: `Defeat all ${RAIDER_WAVES} raider waves — pay 3 ⚔️ to play (drive off) each one.`,
    failureHint: null,
    kind: 'standard',
    // Unlocks the Chiefdom board — the first military-leaning government, so the arc teaches board
    // choice (Tribe vs. Chiefdom at launch). Influence amount + board stats are provisional.
    reward: { influence: 8, unlockBoardIds: ['chiefdom'] },
    map: { col: 3, row: -1 },
    age: 'stone',
  },
  restless_people: {
    id: 'restless_people',
    name: 'Restless People',
    lore:
      'A people grown large grows restless. The stores are full and the walls are strong, yet a ' +
      'muttering runs through the settlement — too many mouths, too little meaning, and idle hands ' +
      'that turn to grievance every time the seasons come round again. Give them rites and revelry ' +
      'enough to bind them, or watch the coin drain away keeping the peace, season after season.',
    prereqs: ['reading_seasons'],
    threats: ['unrest'],
    objectiveCardId: 'restless_people_goal',
    victoryHint: 'Reach 🎭 culture level 2 to placate the restless people.',
    failureHint: 'Unrest drains 🪙 on every deck reshuffle — bankruptcy ends the run.',
    kind: 'standard',
    // Unlocks Beer — a work card costing 2🌾 to play that then yields 5🎭 per staffed round. Influence amount is provisional.
    reward: { influence: 9, unlockCardIds: ['beer'] },
    map: { col: 3, row: 1 },
    age: 'stone',
  },
  reading_seasons: {
    id: 'reading_seasons',
    name: 'Reading the Seasons',
    lore:
      'The seasons keep their own calendar — the flood, the frost, the return of the herds — and a ' +
      'people who can read it eats well while others starve. Watch the sky, mark the days, and learn ' +
      'to see the turning of the year before it arrives.',
    prereqs: ['growing_numbers'],
    objectiveCardId: 'reading_seasons_goal',
    victoryHint: 'Stockpile 10 🔬 science.',
    failureHint: null,
    kind: 'standard',
    // Unlocks the Calendar card — the age's foresight entry, first to exercise the peek family. The
    // objective doesn't require owning it, so there's no build-what-you-don't-have sequencing bind.
    // Influence amount provisional (balance pending a sim sweep).
    reward: { influence: 9, unlockCardIds: ['calendar'] },
    map: { col: 2, row: 1 },
    age: 'stone',
  },
  first_temple: {
    id: 'first_temple',
    name: 'Göbekli Tepe',
    lore:
      'The people have bread, walls, and warriors — everything a settlement needs to endure. What ' +
      'they raise now they raise for no need at all: a ring of carved stones on the hilltop, hauled ' +
      'and set by hands that could have been tilling. It feeds no one, yet the whole valley comes to ' +
      'build it. When the last pillar stands, the Stone Age has given all it can — and a people who ' +
      'build temples are a people no longer merely surviving.',
    prereqs: ['raiders_at_border', 'restless_people'],
    objectiveCardId: 'first_temple_goal',
    victoryHint: 'Reach 3 🧍 population and 🎭 culture level 2 while holding 30 🔨 and 30 🪙 at once.',
    failureHint: null,
    kind: 'standard',
    // Unlocks the Göbekli Tepe wonder — the age's capstone build. Influence amount provisional.
    reward: { influence: 12, unlockCardIds: ['gobekli_tepe'] },
    map: { col: 4, row: 0 },
    age: 'stone',
  },
  ice_age: {
    id: 'ice_age',
    name: 'Return of the Ice Age',
    lore:
      'The temples are raised and the granaries full — but the air has turned. Each season bites deeper ' +
      'than the last, the herds thin, and the frost creeps down from the north and does not retreat. ' +
      'There is no winning against a cold that only deepens: there is only holding out, one hungry winter ' +
      'at a time, and seeing how long a people can endure before the harvest fails for good.',
    // Opened by the Stone Age capstone — the first endless *survival* mission (a scored infinite, unlike
    // the rewardless sandbox), so it earns Influence for every round the deepening winter is outlasted.
    prereqs: ['first_temple'],
    threats: ['long_winter'],
    objectiveCardId: 'ice_age_goal',
    victoryHint: 'No victory to reach — outlast the deepening winter, earning ⭐ Influence for every round survived.',
    failureHint: 'The Long Winter drains more 🌾 each round than the last — the run ends when the harvest can no longer feed the people.',
    kind: 'infinite',
  },
  sandbox: {
    id: 'sandbox',
    name: 'The Long Wander',
    lore:
      'Before cities, before harvests — only the band, the seasons, and the long walk between them. ' +
      'No clock, no foe, no prize: a quiet place to try a deck or simply watch a civilization grow. ' +
      'Wander as long as you like, and end the run whenever you please.',
    // Gated behind the Stone Age capstone: the endless sandbox opens once the age is mastered.
    prereqs: ['first_temple'],
    objectiveCardId: 'sandbox_goal',
    victoryHint: 'Nothing to win, nothing to earn — a no-pressure space to test decks and enjoy the build.',
    failureHint: 'The wander never ends on its own — it lasts until a core resource collapses, or you choose to stop.',
    kind: 'infinite',
    rewardless: true,
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
