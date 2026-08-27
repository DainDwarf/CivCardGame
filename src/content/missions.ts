import type { GameState } from '../rules/state';
import { addThreat, instancesFromCardIds, nextInstanceId, shuffleFromState } from '../rules';
import { isAvailable } from '../rules/campaign';
import { BRONZE_TRIALS, CLAY_TABLETS, COPPER_VEINS, CREW_PATIENCE, FIRST_TRADES_FOOD, GROWING_NUMBERS_TERRITORY, HARSH_WINTER_BREAK, HARSH_WINTER_ONSET, INVASION_WAVES, MUSTER_TARGET, OVEREXTENSION_GRACE, PHARAOH_DEADLINE, RAID_STEP, RAID_TARGETS, RAIDER_WAVES, ROADWORKS, SEA_LANE_ROUTES, SNAP_STEP, THIEVES_PER_GOLD, VOYAGES, WHEEL_TERRITORY, WILD_HORSES } from './cards';

/**
 * A mission is the unit of a run. It defines the win (objective) and any
 * mission-specific lose condition (failure) as predicates over the run state, plus
 * optional per-turn effects. Core resource floors (any of the 5 going negative) and an
 * emptied population are *universal* failures enforced by the run loop
 * (`rules/collapse.ts`), not by individual missions. Objective/failure are pure functions so they are
 * unit-testable and reusable by the headless simulator.
 */
export interface MissionDef {
  id: string;
  name: string;
  /** Narrative flavour text — the bulk of the mission detail panel
   *  (`meta/CampaignMap.tsx`'s `MissionFlowPopup`, 'detail' step). */
  lore: string;
  /** Mission ids that must be completed (see `rules/campaign.ts`) before this one is
   *  available. Empty = a DAG root, always available. Each id must name a real mission and the graph
   *  must stay acyclic (both pinned by a coherence test) — a prereq no clear can ever satisfy raises
   *  nothing on its own, it just drops the mission out of the campaign. */
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
  /** Extra cards for the mission-detail panel that no setup list names — ones a run only injects
   *  *mid-play* (Accounting's Thief, bred into the deck by the Unguarded Wealth threat), which the
   *  player would otherwise first meet in their own draw pile. Display-only, and authored rather than
   *  derived: unlike `threats`/`events` nothing seeds from it, so a mission whose injecting card
   *  changes has to be re-checked by hand. */
  alsoDisplay?: string[];
  /** The mission's win condition, made into a card. Names a real `content/cards.ts` id of kind
   *  `'objective'` (pinned by a coherence test); `run/setup.ts` seeds it into `GameState.objective`
   *  and the card owns the win (the `objective` predicate) logic plus its live progress readout — so it's the
   *  objective card, not the mission, that holds the predicate. A mission-specific *defeat* is a
   *  threat's job (its own `defeat` hook,
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
   *  so a scored infinite mission stays the default and the "the score is a reward" and "…is a
   *  best" branches can't diverge. Meaningless on a `'standard'` mission. */
  rewardless?: boolean;
  /** Display-only: the unit the Stats best-scores board renders after a scored `'infinite'`
   *  mission's best (default `'rounds'`). The score *measure* itself lives on the objective card
   *  (`CardDef.score`), where the win logic lives; this is just its label. */
  scoreUnit?: string;
  /** Granted once, the first time this mission is cleared (see `rules/rewards.ts`'s
   *  `computeRewards`) — replays pay nothing. A `'standard'` mission's unlocks are **all optional**:
   *  it may grant any mix across four symmetric kinds — card unlocks (`unlockCardIds`, each naming a
   *  real `content/cards.ts` id), card-sticker unlocks (`unlockStickerIds`, `content/stickers.ts`),
   *  board-sticker unlocks (`unlockBoardStickerIds`, `content/boardStickers.ts`), and board unlocks
   *  (`unlockBoardIds`, each naming a real `content/boards.ts` id) — or **none at all** (an
   *  Influence-only reward, or no reward object). A coherence test pins only that whatever ids a
   *  mission *does* name are real. Unlike cards, a sticker/board unlock simply makes it *available*
   *  (hidden-until-unlocked, like a card); a board carries no Influence cost. `'infinite'` missions
   *  have no reward object — they score Influence = the run's score instead (the objective card's
   *  `score` measure; unless `rewardless`).
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
 * The mission catalogue: the Stone Age arc, the Bronze Age arc, and three endless missions. The endless
 * set all use a never-winning objective and end only on collapse, but differ in stakes: `ice_age` and
 * `fall_of_bronze` are *scored survival* missions — each guarantees eventual collapse (an ever-growing
 * census of cold snaps; of raids) and pays its score out as Influence — while `sandbox`
 * is `rewardless`, a no-stakes practice space with no bounding threat that ends only on collapse or when
 * the player quits. A never-winning objective offers the simulator no *win* gradient; what it steers by on
 * the two scored ones is the `score` measure itself (`sim/race.ts`), and the sandbox, declaring none, is
 * driven by survival alone.
 */
export const MISSIONS: Record<string, MissionDef> = {
  first_settlement: {
    id: 'first_settlement',
    name: 'The First Settlement',
    lore:
      'Today your tribe has found a very promising land, one that could sustain your people for a long ' +
      'time to come. Now you must make this place yours — and defend it from anything that would take ' +
      'it from you.',
    prereqs: [],
    objectiveCardId: 'first_settlement_goal',
    victoryHint: 'Stockpile 10 🔨 production and 10 ⚔️ military.',
    failureHint: null,
    kind: 'standard',
    reward: { influence: 0, unlockCardIds: ['farm', 'hut', 'conquest'] },
    map: { col: 0, row: 0 },
    age: 'stone',
  },
  growing_numbers: {
    id: 'growing_numbers',
    name: 'Growing Numbers',
    lore:
      'Your people have lived in this new place in peace for several seasons now. It is, at last, a ' +
      'place you could call home. All that remains is to raise a roof over your heads, and to make ' +
      'sure you never run out of food to eat.',
    prereqs: ['first_settlement'],
    objectiveCardId: 'growing_numbers_goal',
    victoryHint: `Build a 🛖 Hut and a 🌱 Farm, while holding ${GROWING_NUMBERS_TERRITORY} 🏞️ territory.`,
    failureHint: null,
    kind: 'standard',
    // Raising the roof is what upgrades the Tribe board into the settled `settlement` government, so
    // this is the last mission played on Tribe.
    reward: {
      influence: 3,
      unlockStickerIds: ['irrigation'],
      unlockBoardStickerIds: ['granary', 'stockpile'],
      boardUpgrade: { from: 'tribe', to: 'settlement' },
    },
    map: { col: 1, row: 0 },
    age: 'stone',
  },
  raiders_at_border: {
    id: 'raiders_at_border',
    name: 'Raiders at the Border',
    lore:
      'Your settlement is stronger than it has ever been — and that has not gone unnoticed. Less ' +
      'fortunate tribes around your village have grown envious, and now turn to violence to survive. ' +
      'It is time to defend the food supplies you worked so hard to gather.',
    prereqs: ['growing_numbers'],
    // One `raider` event per wave, tied to the objective's threshold by the shared RAIDER_WAVES const
    // so the mission can't seed a different count than the win asks for. `Array.from` (not `.fill`)
    // for a clean `string[]`.
    events: Array.from({ length: RAIDER_WAVES }, () => 'raider'),
    objectiveCardId: 'raiders_at_border_goal',
    victoryHint: `Defeat all ${RAIDER_WAVES} Raiders.`,
    failureHint: null,
    kind: 'standard',
    // Unlocks the Chiefdom board — the first military-leaning government, so the arc teaches board
    // choice (Tribe vs. Chiefdom at launch) — plus the money pair, which is the next mission's
    // toolkit: Bead Workshop is 🪙's only faucet and Bartering the only sink that spends it. The faucet is
    // a building because the route's rent is charged every round, which no drawn card can cover.
    // Influence amount + board stats are provisional.
    reward: { influence: 4, unlockCardIds: ['bead_workshop', 'bartering'], unlockBoardIds: ['chiefdom'] },
    map: { col: 2, row: -1 },
    age: 'stone',
  },
  first_trades: {
    id: 'first_trades',
    name: 'The First Trades',
    lore:
      'The raiders are driven off, and the border holds. But not every tribe beyond it came with ' +
      'spears — some came with salt, with obsidian, with shells from a sea none of your people have ' +
      'ever seen. Open a road to your neighbours, pay what they ask, and let the grain pile up in ' +
      'stores you never dug from your own soil.',
    prereqs: ['raiders_at_border'],
    objectiveCardId: 'first_trades_goal',
    victoryHint: `Open a 🤝 trade route and stockpile ${FIRST_TRADES_FOOD} 🌾 food.`,
    failureHint: null,
    kind: 'standard',
    // No threat and no events: the standing rent a route charges every round is the mission's whole
    // pressure, and it is one the player chooses to take on.
    // Unlocks Beer, whose 🌾 price is only cheap once a route is paying food for no workers — so the
    // reward is worth having precisely because of what this mission taught you to build. Influence
    // amount provisional.
    reward: { influence: 4, unlockCardIds: ['beer'] },
    map: { col: 3, row: -1 },
    age: 'stone',
  },
  harsh_winter: {
    id: 'harsh_winter',
    name: 'Harsh Winter',
    lore:
      'The cold came early this year, and it means to stay. The herds have moved on, the ground is ' +
      'frozen solid, and what your people set aside over the summer is now all there is between them ' +
      'and spring. Outlast it, and they will never be caught by the turning of the year again.',
    prereqs: ['growing_numbers'],
    threats: ['deep_cold'],
    objectiveCardId: 'harsh_winter_goal',
    victoryHint: `Outlast the winter — survive to round ${HARSH_WINTER_BREAK}.`,
    failureHint: `From round ${HARSH_WINTER_ONSET} The Deep Cold drains 🌾 every round, deepening until it breaks.`,
    kind: 'standard',
    // Grants the science pair, which is `reading_seasons`' toolkit: the branch's pressure mission pays
    // for its resource mission, the same shape the upper branch uses. Both *make* 🔬 and neither spends
    // it — the mission they feed asks the player to stockpile science. Influence amount inherited from
    // the mission this replaces, so the downstream faucet ledger is unmoved — provisional either way.
    reward: { influence: 4, unlockCardIds: ['storytelling', 'fire'] },
    map: { col: 2, row: 1 },
    age: 'stone',
  },
  reading_seasons: {
    id: 'reading_seasons',
    name: 'Reading the Seasons',
    lore:
      'The winter broke, and your people counted what it had cost them. It came early and no one saw ' +
      'it coming — that is the part they cannot forgive. So the elders set the young to watching: where ' +
      'the sun stands at its lowest, which birds leave and when, how many nights fall between the first ' +
      'frost and the last. What they learn goes into stone — a marker raised on the ridge where the sun ' +
      'turns back, so the reckoning outlives the watchers who made it. Learn the turning of the year, ' +
      'and no season will ever arrive unannounced again.',
    prereqs: ['harsh_winter'],
    objectiveCardId: 'reading_seasons_goal',
    victoryHint: 'Stockpile 10 🔬 science.',
    failureHint: null,
    kind: 'standard',
    // Sun Stone is the branch's culture card, so the convergence node downstream is reached with a
    // culture *building* from this tip and a culture *work card* (Beer) from the other — two different
    // kinds of producer rather than a second copy of one.
    // Calendar is 🔬's first sink, granted by the mission that teaches you to bank it: the two cards
    // upstream both *make* science and nothing in the age spends it until the Bronze copper veins.
    // Granting it here rather than upstream is what keeps a sink out of the hand during the very run
    // that asks for a stockpile.
    reward: { influence: 4, unlockCardIds: ['sun_stone', 'calendar'] },
    map: { col: 3, row: 1 },
    age: 'stone',
  },
  rites_rituals: {
    id: 'rites_rituals',
    name: 'Rites & Rituals',
    lore:
      'Your people have come back from the border with goods, and down from the ridge with the ' +
      'reckoning of the year — and neither road was walked by all of them. What one half of the ' +
      'valley knows, the other half has only heard about. So set a night aside: the same fire, the ' +
      'same songs, the same words said over the same stones, until every family marks the turning ' +
      'year the same way. A people who feast together will build together.',
    // The reconvergence of both branches: an AND, so the player always arrives holding *both* culture
    // producers — Beer from the trade branch, Sun Stone from the season branch.
    prereqs: ['first_trades', 'reading_seasons'],
    objectiveCardId: 'rites_rituals_goal',
    victoryHint: 'Reach 🎭 culture level 1.',
    failureHint: null,
    kind: 'standard',
    // Elegant is the age's culture sticker, and the only reward that can be *spent* on either branch's
    // producer — Beer from one tip, Sun Stone from the other. Its culture-level surcharge makes it dead
    // on this mission (a single-term goal ends the run the moment the level lands) and live on the
    // conjunction goals downstream. Influence amount provisional: a fresh addition to the faucet ledger,
    // since the original mission's 8⭐ was inherited by The First Trades.
    reward: { influence: 5, unlockStickerIds: ['elegant'] },
    map: { col: 4, row: 0 },
    age: 'stone',
  },
  first_temple: {
    id: 'first_temple',
    name: 'The First Temple',
    lore:
      'With the population growing in number and in strength, and the land staying ever fertile and ' +
      'welcoming, the people begin to raise the greatest communal place they have ever known. On the ' +
      'hilltop, ring upon ring of towering carved stones takes shape — pillars hauled and set by ' +
      'hands that could have been tilling, adorned with the beasts of the world around them. It feeds ' +
      'no one, yet the whole valley comes to build it: the first temple.',
    prereqs: ['rites_rituals'],
    objectiveCardId: 'first_temple_goal',
    victoryHint: 'Reach 3 🧍 population and 🎭 culture level 2 at once.',
    failureHint: null,
    kind: 'standard',
    // Unlocks the Göbekli Tepe wonder — the age's capstone build. Influence amount provisional.
    reward: { influence: 6, unlockCardIds: ['gobekli_tepe'] },
    map: { col: 5, row: 0 },
    age: 'stone',
  },
  finding_copper: {
    id: 'finding_copper',
    name: 'Finding Copper',
    lore:
      'Diggers came back from the hills with rock too heavy for its size, broken green along the seam. ' +
      'In the fire it softened; under the hammer it spread instead of shattering; cooled, it held an edge ' +
      'for a season where flint held one for a morning. Whatever it is, there is more of it down there. ' +
      'Go and take it out.',
    prereqs: ['first_temple'],
    threats: ['failing_tools'],
    // One `copper_vein` event per vein, tied to the objective's threshold by the shared COPPER_VEINS
    // const so the mission can't seed a different count than the win asks for.
    events: Array.from({ length: COPPER_VEINS }, () => 'copper_vein'),
    objectiveCardId: 'finding_copper_goal',
    victoryHint: `Mine all ${COPPER_VEINS} Copper Veins.`,
    failureHint: 'Failing Tools drain 1 🔨 each round for every worker staffed in a building.',
    kind: 'standard',
    // Opens the Bronze Age: unlocks the Forge, the answer to the very drain this mission inflicts.
    // Influence amount provisional.
    reward: { influence: 6, unlockCardIds: ['forge'] },
    map: { col: 6, row: -1 },
    age: 'bronze',
  },
  masonry: {
    id: 'masonry',
    name: 'Masonry',
    lore:
      'Anyone can pile rock; fitting it is the trade. The face is chosen, the block dressed square, ' +
      'each one set so the weight of the next locks it in place. Houses raised that way outlast the ' +
      'hands that raised them, and people put down roots beside walls they expect to outlive them.',
    prereqs: ['first_temple'],
    objectiveCardId: 'masonry_goal',
    victoryHint: 'Grow your civilization to 5 🧍 population.',
    failureHint: null,
    kind: 'standard',
    // Opens the Bronze government: City Walls (a standing garrison), the House (a bigger population
    // grant), and the City board that retires the Settlement. Influence amount provisional.
    reward: {
      influence: 6,
      unlockCardIds: ['city_walls', 'house'],
      boardUpgrade: { from: 'settlement', to: 'city' },
    },
    map: { col: 6, row: 1 },
    age: 'bronze',
  },
  pyramid: {
    id: 'pyramid',
    name: 'Pyramid',
    lore:
      'The city stands in fitted stone, and its ruler means to be remembered past the span of any reign. ' +
      'He commands a house for his eternal rest — a mountain raised by hand, dressed with copper-cut ' +
      'masonry, taller than anything the land has known. But a tomb unfinished when its pharaoh dies is ' +
      'no tomb at all. Amass the wealth, the labour, and the grandeur to complete it before his reign ends.',
    prereqs: ['masonry'],
    threats: ['pharaohs_reign'],
    objectiveCardId: 'pyramid_goal',
    victoryHint: 'Amass 50 🪙, 40 🔨, and reach 🎭 culture level 2.',
    failureHint: `The tomb must be finished within ${PHARAOH_DEADLINE} rounds, before Pharaoh's Reign ends.`,
    kind: 'standard',
    // An optional challenge leaf off Masonry — a bigger reward for a harder clear: unlocks the Pyramid
    // wonder (the worker-free monument paying per card drawn past the base hand). Influence amount
    // provisional.
    reward: { influence: 12, unlockCardIds: ['pyramid'] },
    map: { col: 7, row: 1 },
    age: 'bronze',
  },
  accounting: {
    id: 'accounting',
    name: 'Accounting',
    lore:
      'Copper flows from the hills and the city rises in dressed stone, and with them comes a surplus ' +
      'your grandfathers never dreamed of — granaries too full to count by eye, storehouses no elder ' +
      'can hold in memory. And what no one tracks, someone takes. A tally pressed into wet clay, a mark ' +
      'for every measure in and every measure out, is the only wall that keeps your wealth from walking ' +
      'off in the night. Learn to keep the books, or watch the surplus vanish into other hands.',
    // The convergence: Accounting demands both the metal branch and the monumental one — the surplus that
    // must be tracked exists only once you have both the copper to make it and the city to store it.
    prereqs: ['finding_copper', 'masonry'],
    threats: ['unguarded_wealth'],
    alsoDisplay: ['thief'],
    objectiveCardId: 'accounting_goal',
    victoryHint: 'Amass a treasury of 40 🪙.',
    failureHint: `Each reshuffle, Unguarded Wealth adds a Thief to your deck for every ${THIEVES_PER_GOLD} 🪙 you hold.`,
    kind: 'standard',
    // Trader is a better 🪙 faucet than the Bead Workshop the player already owns, not their first one —
    // money opens five missions upstream. Plus the Opulence board sticker (a starting treasury).
    // Influence amount provisional.
    reward: { influence: 6, unlockCardIds: ['trader'], unlockBoardStickerIds: ['opulence'] },
    // Mainline convergence rejoining the centre axis (like first_temple); the pyramid leaf sits below at
    // col 7 row 1.
    map: { col: 7, row: 0 },
    age: 'bronze',
  },
  writing: {
    id: 'writing',
    name: 'Writing',
    lore:
      'A reed pressed into wet clay leaves a mark, and a fired tablet keeps that mark longer than ' +
      'anyone who made it. What began as a count of jars can hold a name, a measure, a law, the height ' +
      'of a flood — anything a person could say and no one could keep. Write it down, and your people ' +
      'stop losing what they learn.',
    prereqs: ['accounting'],
    // One `clay_tablet` per record, tied to the objective's threshold by the shared CLAY_TABLETS const
    // so the mission can't seed a different count than the win asks for.
    events: Array.from({ length: CLAY_TABLETS }, () => 'clay_tablet'),
    objectiveCardId: 'writing_goal',
    victoryHint: `Record all ${CLAY_TABLETS} Clay Tablets.`,
    failureHint:
      'A Clay Tablet left unrecorded drains 🔬 at the end of each round, deepening every time it ' +
      'goes unwritten.',
    kind: 'standard',
    // Opens the literacy half of the Bronze spine: the Archives (the first science *building*) and the
    // Writing action. Influence amount provisional (balance pending a sim sweep).
    reward: { influence: 6, unlockCardIds: ['archives', 'writing'] },
    map: { col: 8, row: 0 },
    age: 'bronze',
  },
  horse_taming: {
    id: 'horse_taming',
    name: 'Horse Taming',
    lore:
      'The horses come down to drink at dusk and are gone at any sound, and there is no fence on the ' +
      'steppe long enough to matter. What works is water, salt, a rope, and a man who will not leave — a ' +
      'week of standing close enough to be smelled and not fled from, until one morning the animal takes ' +
      'the weight of a man and distance stops being a wall. Break them one at a time; there is no other way.',
    prereqs: ['writing'],
    threats: ['tamed_horses'],
    // One `wild_horse` per horse, tied to the objective's threshold by the shared WILD_HORSES const so
    // the mission can't seed a different count than the win asks for.
    events: Array.from({ length: WILD_HORSES }, () => 'wild_horse'),
    objectiveCardId: 'horse_taming_goal',
    victoryHint: `Tame all ${WILD_HORSES} Wild Horses.`,
    failureHint:
      'Every Wild Horse you tame eats 1 🌾 each round for the rest of the run.',
    kind: 'standard',
    // Opens the military branch: unlocks the War Horse (the first ⚔️ work box) and Raiding
    // (a single-use ⚔️ → 🌾+🔨 plunder burst) — the pair the next mission is built around. Influence
    // amount provisional.
    reward: { influence: 6, unlockCardIds: ['war_horse', 'raiding'] },
    map: { col: 9, row: 0 },
    age: 'bronze',
  },
  raiding: {
    id: 'raiding',
    name: 'Raiding',
    lore:
      'The valley chiefs have stopped sending messengers and started sending timber up onto the ' +
      'palisade, which means they have done the same arithmetic you did and reached the same answer: ' +
      'what they hold is worth taking, and you are the ones who can take it. They are not wrong, and ' +
      'they are not going to be ready. Ride now — every season you spend deciding is another course of ' +
      'wood between you and the granary.',
    prereqs: ['horse_taming'],
    // One `stronghold` per target, tied to the objective's threshold by the shared RAID_TARGETS const
    // so the mission can't seed a different count than the win asks for. No threat: the strongholds are
    // the whole pressure, and they are the rare one that pushes *back* — each left standing raids you.
    events: Array.from({ length: RAID_TARGETS }, () => 'stronghold'),
    objectiveCardId: 'raiding_goal',
    victoryHint: `Sack all ${RAID_TARGETS} Strongholds.`,
    failureHint:
      'Every Stronghold you leave standing raids you back for 🪙, and each round it stands raises both ' +
      'its reprisal 2 🪙 and its walls 3 ⚔️.',
    kind: 'standard',
    // Closes the military branch: the reward is the government itself, upgrading the martial board into
    // Warband rather than handing out another card. Influence amount provisional.
    reward: { influence: 6, boardUpgrade: { from: 'chiefdom', to: 'warband' } },
    map: { col: 10, row: 0 },
    age: 'bronze',
  },
  roads: {
    id: 'roads',
    name: 'Roads',
    lore:
      'What you call a realm is six villages that happen to pay the same chief, and a chief is only as ' +
      'real as the days it takes him to arrive. Stone changes that. Lay the roadbed and the far fields ' +
      'come inside the border, the levy arrives before the raiders have gone, and a bad harvest in the ' +
      'uplands is a hard year instead of a burial. Lay it slowly, and the mud goes on deciding who is yours.',
    prereqs: ['writing'],
    // One `roadwork` per segment, tied to the objective's threshold by the shared ROADWORKS const so the
    // mission can't seed a different count than the win asks for. No threat: the segments are the pressure.
    events: Array.from({ length: ROADWORKS }, () => 'roadwork'),
    objectiveCardId: 'roads_goal',
    victoryHint: `Pave all ${ROADWORKS} Roadworks.`,
    failureHint:
      'Each unpaved Roadwork you hold drains 2 🌾 at end of round.',
    kind: 'standard',
    // Opens the expansion branch: unlocks the Road, Conquest's economic twin (🪙+🔨 → +1 territory), the
    // tool the Wheel mission's territory goal is built around. Influence amount provisional.
    reward: { influence: 6, unlockCardIds: ['road'] },
    map: { col: 9, row: -1 },
    age: 'bronze',
  },
  wheel: {
    id: 'wheel',
    name: 'The Wheel',
    lore:
      'The far fields are yours on the tablets and nobody else\'s in fact, because a sack of grain ' +
      'carried on a back from the upper valley arrives lighter than it left, having fed the man who ' +
      'carried it. That is the whole limit of your kingdom, and no length of stone repeals it. Wheels ' +
      'do. Cut the roadbed and put an axle on it, and land three ridges out becomes land that pays — ' +
      'so keep cutting, and keep taking, for as long as the carts come back full.',
    prereqs: ['roads'],
    threats: ['overextension'],
    objectiveCardId: 'wheel_goal',
    victoryHint: `Gain ${WHEEL_TERRITORY} territory.`,
    failureHint:
      `The first ${OVEREXTENSION_GRACE} territory you gain are toll-free; every one past that drains 🔨 in upkeep ` +
      'each round.',
    kind: 'standard',
    // Closes the expansion branch: the Wheel sticker (−1🔨 on any card paying 🔨) is the relief that
    // resolves the mission's own 🔨 crisis, and the two Caravans turn the 🪙 a wide realm earns back
    // into the 🌾 and 🔨 holding it costs. Influence amount provisional.
    reward: {
      influence: 6,
      unlockCardIds: ['food_caravan', 'material_caravan'],
      unlockStickerIds: ['wheel'],
    },
    map: { col: 10, row: -1 },
    age: 'bronze',
  },
  setting_sail: {
    id: 'setting_sail',
    name: 'Setting Sail',
    lore:
      'Every direction you can walk in ends at somebody\'s fence, and behind every fence stands a man ' +
      'who already knows what you want and has priced it accordingly. Inland is finished: surveyed, ' +
      'claimed, taxed and dull. The sea is the only side of your country with nothing written on it ' +
      'yet. Put ships on it and find out who lives at the far end — before your neighbours have the ' +
      'same idea.',
    prereqs: ['writing'],
    threats: ['impatient_crews'],
    // One `voyage` per ship, tied to the objective's threshold by the shared VOYAGES const so the
    // mission can't seed a different count than the win asks for.
    events: Array.from({ length: VOYAGES }, () => 'voyage'),
    objectiveCardId: 'setting_sail_goal',
    victoryHint: `Launch all ${VOYAGES} Voyages.`,
    failureHint: `Go ${CREW_PATIENCE} rounds without launching and the crews leave for another port.`,
    kind: 'standard',
    // Opens the naval branch: the Coastal Route gives the trade zone a second card (the next mission's
    // multi-route goal is unreachable with Bartering alone), and the Port board is a *new* government
    // line rather than an upgrade — few hands, but paid for the water it opens. Influence amount
    // provisional.
    reward: { influence: 6, unlockCardIds: ['coastal_route'], unlockBoardIds: ['port'] },
    map: { col: 9, row: 1 },
    age: 'bronze',
  },
  sea_lanes: {
    id: 'sea_lanes',
    name: 'Sea Lanes',
    lore:
      'The tin is real. Your crews saw it stacked on the quay, and everybody along that coast now knows ' +
      'your hulls sail home loaded. Out there piracy is not a disaster, it is a trade like any other — ' +
      'and yours is the newest and richest customer it has ever had. So you will pay for this metal ' +
      'twice: once to the islanders who dig it and once to the men you put aboard to see that it ' +
      'arrives. Open the lanes anyway. Bronze is not made out of tin you left on an island.',
    prereqs: ['setting_sail'],
    threats: ['escort_duty'],
    objectiveCardId: 'sea_lanes_goal',
    victoryHint: `Hold ${SEA_LANE_ROUTES} trade routes open at once.`,
    failureHint: 'Every trade route needs an escort, draining 1 ⚔️ in addition to its usual cost.',
    kind: 'standard',
    // Closes the naval branch: the Tin Route is the branch's deliverable to the Bronze convergence
    // (standing access, no yield), the Merchant Ship is the engine the goal itself feeds, and Convoy
    // answers the mission's own ⚔️ pressure one node downstream. Influence amount provisional.
    reward: {
      influence: 6,
      unlockCardIds: ['tin_route', 'merchant_ship'],
      unlockStickerIds: ['convoy'],
    },
    map: { col: 10, row: 1 },
    age: 'bronze',
  },
  bronze: {
    id: 'bronze',
    name: 'Bronze',
    lore:
      'You have held the stuff: a blade off a trader\'s belt that took the oak your own copper turned ' +
      'on, and its owner would say only that there is tin in it. How much tin, at what heat, poured ' +
      'into what — that he keeps, and so does everyone who knows. Your carts have asked up the roads, ' +
      'your riders across the plains, your hulls along every coast the lanes reach, and the answer ' +
      'comes back the same from all three: nobody here knows how. The metal comes to you and the ' +
      'knowing does not. So find it out yourself — set the smiths to the crucible and let them ruin as ' +
      'many pours as it takes.',
    // The convergence of the three middle branches — the carts, the riders and the hulls that between
    // them reach the tin.
    prereqs: ['wheel', 'raiding', 'sea_lanes'],
    threats: ['charcoal_fuel'],
    // One `casting_trial` per pour, tied to the objective's threshold by the shared BRONZE_TRIALS const
    // so the mission can't seed a different count than the win asks for.
    events: Array.from({ length: BRONZE_TRIALS }, () => 'casting_trial'),
    objectiveCardId: 'bronze_goal',
    victoryHint: `Master all ${BRONZE_TRIALS} Casting Trials, over a standing Tin Route.`,
    failureHint:
      'A trial you cannot pour costs 2 🔨, and every one you do master is a ' +
      'furnace kept lit, costing 1 🔨 every round after.',
    kind: 'standard',
    // Both grants read the same tin gate this mission enforces by hand — the sticker charges it in place
    // of a price — so each is worth only what the trade branches keep open. Influence amount provisional.
    reward: {
      influence: 6,
      unlockCardIds: ['marketplace'],
      unlockStickerIds: ['bronze_tools'],
    },
    map: { col: 11, row: 0 },
    age: 'bronze',
  },
  sword_chariot: {
    id: 'sword_chariot',
    name: 'Sword & Chariot',
    lore:
      'You are not the only ones pouring any more. Every chief with a lane to the islands has bronze, ' +
      'and their blades hold as long as yours do. When both sides carry the same edge, the fight is ' +
      'settled by how many carry it. So arm more men than the world has counted before. But a soldier ' +
      'has to be fed and paid, and his bronze has to be bought and bought again — the islands never ' +
      'sell you the last of it. Neither bill ever stops.',
    prereqs: ['bronze'],
    threats: ['soldiers_wages'],
    // No events, alone among the arc's late nodes: the goal is a standing muster rather than a set of
    // one-shots to work through, so the pressure is the payroll the muster itself raises.
    objectiveCardId: 'sword_chariot_goal',
    victoryHint: `Hold ${MUSTER_TARGET} ⚔️ at once.`,
    failureHint: 'Every 5 ⚔️ you hold past the first 10 costs 1 🪙 in wages.',
    kind: 'standard',
    // Opens the bronze military kit, split standing vs. burst: the Sword (⚔️ per worker every round, and
    // dark for as long as the tin route is cut) and the Chariot (the War Horse successor, a better rate
    // per worker behind the same tin gate). Influence amount provisional.
    reward: { influence: 6, unlockCardIds: ['sword', 'chariot'] },
    map: { col: 12, row: 0 },
    age: 'bronze',
  },
  sea_peoples: {
    id: 'sea_peoples',
    name: 'The Sea Peoples',
    lore:
      'Sails on the horizon flying no one\'s colours. They do not want your land and they do not want ' +
      'your throne — only what the season made, taken and gone before your soldiers reach the beach. ' +
      'Your bronze is better than anything they carry, so meet them on the sand. But every grain of tin ' +
      'in that bronze crossed nine days of open water, and a hull is easier to burn than a city is to ' +
      'storm. They do not have to beat your army. They only have to reach your lanes.',
    prereqs: ['sword_chariot'],
    // One `sea_raid` per wave, tied to the objective's threshold by the shared INVASION_WAVES const so
    // the mission can't seed a different count than the win asks for.
    events: Array.from({ length: INVASION_WAVES }, () => 'sea_raid'),
    objectiveCardId: 'sea_peoples_goal',
    victoryHint: `Repel all ${INVASION_WAVES} Sea Raids, while having a Tin Route.`,
    failureHint: 'Sea Raids discard your trade routes, unless a Convoy protects them.',
    kind: 'standard',
    // The age ends here, so the reward is Influence alone — no card, no sticker, no board. The
    // capstone premium is the whole payout, so it carries the arc's largest purse.
    reward: { influence: 20 },
    map: { col: 13, row: 0 },
    age: 'bronze',
  },
  ice_age: {
    id: 'ice_age',
    name: 'Return of the Ice Age',
    lore:
      'Food is the most basic need of every civilization. Should a future ice age come and threaten ' +
      'your crops, how long would your people manage to survive?',
    // Opened by the Stone Age capstone — the first endless *survival* mission (a scored infinite, unlike
    // the rewardless sandbox). The score is *snaps endured*, not rounds survived: skipping turns banks
    // nothing.
    prereqs: ['first_temple'],
    threats: ['long_winter'],
    // Two fronts to open on — one fewer than the Bronze infinite's three, the Stone collection being
    // thinner. The Long Winter supplies the rest, forever.
    events: ['cold_snap', 'cold_snap'],
    objectiveCardId: 'ice_age_goal',
    victoryHint: 'Gain 1⭐ Influence for every Cold Snap you removed.',
    failureHint:
      `Every Cold Snap costs ${SNAP_STEP}🔨 more to remove, eventually overrunning your production.`,
    kind: 'infinite',
    scoreUnit: '⭐',
  },
  fall_of_bronze: {
    id: 'fall_of_bronze',
    name: 'Fall of the Bronze Age',
    lore:
      'Bronze needs tin from the far side of the world, so every palace on this sea lives by its ' +
      'ships. Should armed fleets come in their place, how many could you turn back?',
    // Opened by the Bronze capstone — the age's scored survival mission (its Ice Age). The score is
    // *waves repelled*, not rounds survived: sitting out the storm banks nothing.
    prereqs: ['sea_peoples'],
    threats: ['long_storm'],
    // Opens two waves short of the capstone's five — the Long Storm supplies the rest, forever.
    events: ['endless_raid', 'endless_raid', 'endless_raid'],
    objectiveCardId: 'fall_of_bronze_goal',
    victoryHint: 'Gain 2⭐ Influence for every Endless Raid you removed.',
    failureHint:
      `Every Endless Raid costs ${RAID_STEP}⚔️ more to remove, eventually overrunning your military. ` +
      'Without a Tin Route, none can be removed at all.',
    kind: 'infinite',
    scoreUnit: '⭐',
  },
  sandbox: {
    id: 'sandbox',
    name: 'Sandbox',
    lore:
      'An idyllic place, where nothing ever seems to threaten or hinder your progress. But without ' +
      'risk, there can be no glory.',
    // Gated behind the Stone Age capstone: the endless sandbox opens once the age is mastered.
    prereqs: ['first_temple'],
    objectiveCardId: 'sandbox_goal',
    victoryHint: 'A no-pressure space to test decks and enjoy the build.',
    failureHint: 'Your civilization lasts until a core resource collapses, or you choose to stop.',
    kind: 'infinite',
    rewardless: true,
  },
};

/**
 * The *available* `'infinite'` missions in canonical display order — prereqs met (an unavailable one
 * stays hidden, anti-surprise), the rewardless sandbox pinned first (it's the special one), then the
 * scored survival missions. Shared by the campaign-map banner and the Stats leaderboard so the two
 * can never disagree on which infinite missions show or in what order.
 */
export function infiniteMissionsInOrder(mapProgress: Record<string, true>): MissionDef[] {
  return Object.values(MISSIONS)
    .filter((m) => m.kind === 'infinite' && isAvailable(m, mapProgress))
    .sort((a, b) => Number(b.rewardless ?? false) - Number(a.rewardless ?? false));
}

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
