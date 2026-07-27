import type { GameState } from '../rules/state';
import { addThreat, instancesFromCardIds, nextInstanceId, shuffleFromState } from '../rules';
import { isAvailable } from '../rules/campaign';
import { CLAY_TABLETS, COPPER_VEINS, FIRST_TRADES_FOOD, GROWING_NUMBERS_TERRITORY, HARSH_WINTER_BREAK, HARSH_WINTER_ONSET, PHARAOH_DEADLINE, RAIDER_WAVES, ROADWORKS, THIEVES_PER_GOLD, WHEEL_TERRITORY, WILD_HORSES } from './cards';

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
 * The mission catalogue: the Stone Age arc, the opening of the Bronze Age, and two endless missions. The endless pair
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
      'Today your tribe has found a very promising land, one that could sustain us for a long time to ' +
      'come. Now we must make this place ours — and defend it from anything that would take it from us.',
    prereqs: [],
    objectiveCardId: 'first_settlement_goal',
    victoryHint: 'Stockpile 10 🔨 production and 10 ⚔️ military at once.',
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
    victoryHint: `Build a 🛖 Hut and a 🌱 Farm, while holding ${GROWING_NUMBERS_TERRITORY} 🗺️ territory.`,
    failureHint: null,
    kind: 'standard',
    // Raising the roof is what upgrades the Tribe board into the settled `settlement` government — so
    // this mission is the last one played on Tribe, and its own territory goal is fought at Tribe's 2 🗺️.
    reward: {
      influence: 6,
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
      'It is time to defend the food supplies you fought so hard to gather.',
    prereqs: ['growing_numbers'],
    // One `raider` event per wave, tied to the objective's threshold by the shared RAIDER_WAVES const
    // so the mission can't seed a different count than the win asks for. `Array.from` (not `.fill`)
    // for a clean `string[]`.
    events: Array.from({ length: RAIDER_WAVES }, () => 'raider'),
    objectiveCardId: 'raiders_at_border_goal',
    victoryHint: `Defeat all ${RAIDER_WAVES} raider waves — pay 3 ⚔️ to drive off each one.`,
    failureHint: null,
    kind: 'standard',
    // Unlocks the Chiefdom board — the first military-leaning government, so the arc teaches board
    // choice (Tribe vs. Chiefdom at launch) — plus the money pair, which is the next mission's
    // toolkit: Bead Workshop is 🪙's only faucet and Bartering the only sink that spends it. The faucet is
    // a building because the route's rent is charged every round, which no drawn card can cover.
    // Influence amount + board stats are provisional.
    reward: { influence: 8, unlockCardIds: ['bead_workshop', 'bartering'], unlockBoardIds: ['chiefdom'] },
    map: { col: 2, row: -1 },
    age: 'stone',
  },
  first_trades: {
    id: 'first_trades',
    name: 'The First Trades',
    lore:
      'The raiders are driven off, and the border holds. But not every tribe beyond it came with ' +
      'spears — some came with salt, with obsidian, with shells from a sea none of your people have ' +
      'ever seen. War made the border. Now make it worth holding: open a road to your neighbours, ' +
      'pay what they ask, and let the grain pile up in stores you never dug from your own soil.',
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
    reward: { influence: 8, unlockCardIds: ['beer'] },
    map: { col: 3, row: -1 },
    age: 'stone',
  },
  harsh_winter: {
    id: 'harsh_winter',
    name: 'Harsh Winter',
    lore:
      'The cold came early this year, and it came to stay. The herds have gone thin and moved on, the ' +
      'ground has shut like a fist, and every night something circles the stores your people spent the ' +
      'summer filling. There is nothing to win here and nothing to build — only a winter to be outlasted, ' +
      'on what you thought to set aside before it began. Come through it, and your people will swear ' +
      'never to be caught by the turning of the year again.',
    prereqs: ['growing_numbers'],
    threats: ['deep_cold'],
    objectiveCardId: 'harsh_winter_goal',
    victoryHint: `Outlast the winter — survive to round ${HARSH_WINTER_BREAK}.`,
    failureHint:
      `From round ${HARSH_WINTER_ONSET} the cold drains 🌾 every round, deepening until it breaks — ` +
      'starve and the run ends.',
    kind: 'standard',
    // Grants the science pair, which is `reading_seasons`' toolkit: the branch's pressure mission pays
    // for its resource mission, the same shape the upper branch uses. Both *make* 🔬 and neither spends
    // it — the mission they feed asks the player to stockpile science. Influence amount inherited from
    // the mission this replaces, so the downstream faucet ledger is unmoved — provisional either way.
    reward: { influence: 9, unlockCardIds: ['storytelling', 'fire'] },
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
    // Grants the branch's culture card, so the convergence node downstream is reached with a culture
    // *building* from this tip and a culture *work card* (Beer) from the other — two different kinds of
    // producer rather than a second copy of one. Its rate is provisional: nothing has yet asked for a
    // culture level, so the convergence node's sweep is the first thing able to judge it.
    reward: { influence: 9, unlockCardIds: ['sun_stone'] },
    map: { col: 3, row: 1 },
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
    prereqs: ['first_trades', 'reading_seasons'],
    objectiveCardId: 'first_temple_goal',
    victoryHint: 'Reach 3 🧍 population and 🎭 culture level 2 while holding 30 🔨 and 30 🪙 at once.',
    failureHint: null,
    kind: 'standard',
    // Unlocks the Göbekli Tepe wonder — the age's capstone build. Influence amount provisional.
    reward: { influence: 12, unlockCardIds: ['gobekli_tepe'] },
    map: { col: 4, row: 0 },
    age: 'stone',
  },
  finding_copper: {
    id: 'finding_copper',
    name: 'Finding Copper',
    lore:
      'The temple stands, and the valley is yours — but the tools that built it are failing you. Flint ' +
      'chips, stone blunts, and every hand you put to work wears through more of it than the work gives ' +
      'back. The elders speak of a green-streaked rock in the hills that the fire can soften and the ' +
      'hammer can shape, and that does not shatter. Find it, and your people will never work in stone again.',
    prereqs: ['first_temple'],
    threats: ['failing_stone_tools'],
    // One `copper_vein` event per vein, tied to the objective's threshold by the shared COPPER_VEINS
    // const so the mission can't seed a different count than the win asks for.
    events: Array.from({ length: COPPER_VEINS }, () => 'copper_vein'),
    objectiveCardId: 'finding_copper_goal',
    victoryHint: `Mine all ${COPPER_VEINS} copper veins — pay 2 🔨 and 5 🔬 for each.`,
    failureHint: 'Failing stone tools drain 1 🔨 each round for every worker staffed in a building.',
    kind: 'standard',
    // Opens the Bronze Age: unlocks the Forge, the answer to the very drain this mission inflicts.
    // Influence amount provisional (balance pending a sim sweep).
    reward: { influence: 12, unlockCardIds: ['forge'] },
    map: { col: 5, row: -1 },
    age: 'bronze',
  },
  masonry: {
    id: 'masonry',
    name: 'Masonry',
    lore:
      'The temple drew your people together; now they mean to stay. Flint and mud give way to dressed, ' +
      'fitted stone — walls that stand a lifetime, houses that outlast the hands that raised them. Lay ' +
      'the courses true, and a village becomes a city.',
    prereqs: ['first_temple'],
    objectiveCardId: 'masonry_goal',
    victoryHint: 'Grow your civilization to 6 🧍 population.',
    failureHint: null,
    kind: 'standard',
    // Opens the Bronze government: City Walls (a standing garrison), the House (a bigger population
    // grant), and the City board that retires the Settlement. Influence amount provisional.
    reward: {
      influence: 12,
      unlockCardIds: ['city_walls', 'house'],
      boardUpgrade: { from: 'settlement', to: 'city' },
    },
    map: { col: 5, row: 1 },
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
    victoryHint: "Amass 50 🪙, 40 🔨, and 🎭 culture level 2 before the pharaoh's reign ends.",
    failureHint: `The tomb must be finished within ${PHARAOH_DEADLINE} rounds, before the pharaoh's reign ends.`,
    kind: 'standard',
    // An optional challenge leaf off Masonry — a bigger reward for a harder clear: unlocks the Pyramid
    // wonder (the culture powerhouse). Influence amount provisional.
    reward: { influence: 25, unlockCardIds: ['pyramid'] },
    map: { col: 6, row: 1 },
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
    threats: ['envious_population'],
    objectiveCardId: 'accounting_goal',
    victoryHint: 'Amass 40 🪙. The richer you grow, the more thieves envy breeds — pay ⚔️ to catch them.',
    failureHint: `Each reshuffle, envy adds a thief to your deck for every ${THIEVES_PER_GOLD} 🪙 you hold; an uncaught thief skims 🪙 and 🔨 every round.`,
    kind: 'standard',
    // Opens the money spine: unlocks the Trader (a 🪙 faucet) and the Opulence board sticker (a starting
    // treasury). Influence amount provisional.
    reward: { influence: 12, unlockCardIds: ['trader'], unlockBoardStickerIds: ['opulence'] },
    // Mainline convergence rejoining the centre axis (like first_temple); the pyramid leaf sits below at
    // col 6 row 1.
    map: { col: 6, row: 0 },
    age: 'bronze',
  },
  writing: {
    id: 'writing',
    name: 'Writing',
    lore:
      'Your scribes can tally what the storehouses hold, but nothing holds what your people know. The ' +
      'oldest potter dies and her glaze dies with her; a flood comes a generation after the last one ' +
      'and no one living recalls how high the water rose. Tallies were only the beginning — press the ' +
      'stories, the measures, and the laws into wet clay, and your civilization will outlive the ' +
      'memory of any single elder.',
    prereqs: ['accounting'],
    // One `clay_tablet` per record, tied to the objective's threshold by the shared CLAY_TABLETS const
    // so the mission can't seed a different count than the win asks for.
    events: Array.from({ length: CLAY_TABLETS }, () => 'clay_tablet'),
    objectiveCardId: 'writing_goal',
    victoryHint: `Record all ${CLAY_TABLETS} clay tablets — pay 3 🔨 and 2 🌾 for each.`,
    failureHint:
      'A tablet you draw and leave unrecorded loses 1 🔬 that round; let too much knowledge slip and a dark age ends the run.',
    kind: 'standard',
    // Opens the literacy half of the Bronze spine: the Archives (the first science *building*) and the
    // Writing action. Influence amount provisional (balance pending a sim sweep).
    reward: { influence: 12, unlockCardIds: ['archives', 'writing'] },
    map: { col: 7, row: 0 },
    age: 'bronze',
  },
  horse_taming: {
    id: 'horse_taming',
    name: 'Horse Taming',
    lore:
      'Out past the last ploughed field the grass runs on without end, and the herds run with it — ' +
      'faster than any runner, stronger than any ox, and answering to no one. Your riders have watched ' +
      'them at the watering places for a season now, learning where they drink and how they startle. ' +
      'Take them, and no war party on the steppe will match you. But a horse is not a harvest: every one ' +
      'you break to the halter must be fed for the rest of its life, out of the same fields that feed you.',
    prereqs: ['writing'],
    threats: ['tamed_horses'],
    // One `wild_horse` per horse, tied to the objective's threshold by the shared WILD_HORSES const so
    // the mission can't seed a different count than the win asks for.
    events: Array.from({ length: WILD_HORSES }, () => 'wild_horse'),
    objectiveCardId: 'horse_taming_goal',
    victoryHint: `Tame all ${WILD_HORSES} wild horses — pay 6 ⚔️ for each.`,
    failureHint:
      'Every horse you tame eats 1 🌾 each round for the rest of the run; starve the herd and the run ends.',
    kind: 'standard',
    // Opens the military branch: unlocks the War Horse (the first recurring ⚔️ work box) and Raiding
    // (⚔️ → 🪙, the predatory money faucet) — the pair the next mission is built around. Influence
    // amount provisional.
    reward: { influence: 12, unlockCardIds: ['war_horse', 'raiding'] },
    map: { col: 8, row: 0 },
    age: 'bronze',
  },
  roads: {
    id: 'roads',
    name: 'Roads',
    lore:
      'Your settlements sit scattered across the valley, each an island reached only by the tracks your ' +
      'feet have worn — impassable in the rains, and every haul of grain a day lost to the mud. Cut the ' +
      'roadbed, lay the stone, and bind your holdings into one. What the road reaches, your people can ' +
      'feed and defend; what it cannot, the wilderness keeps.',
    prereqs: ['writing'],
    // One `roadwork` per segment, tied to the objective's threshold by the shared ROADWORKS const so the
    // mission can't seed a different count than the win asks for. No threat: the segments are the pressure.
    events: Array.from({ length: ROADWORKS }, () => 'roadwork'),
    objectiveCardId: 'roads_goal',
    victoryHint: `Pave all ${ROADWORKS} road segments — pay 8 🔨 for each.`,
    failureHint:
      'Each unpaved segment you hold drains 2 🌾 at end of round — let your settlements starve and the run ends.',
    kind: 'standard',
    // Opens the expansion branch: unlocks the Road, Conquest's economic twin (🪙+🔨 → +1 territory), the
    // tool the Wheel mission's territory goal is built around. Influence amount provisional.
    reward: { influence: 12, unlockCardIds: ['road'] },
    map: { col: 8, row: -1 },
    age: 'bronze',
  },
  wheel: {
    id: 'wheel',
    name: 'The Wheel',
    lore:
      'The road is laid, but the realm it binds now strains to hold together — every league of stone ' +
      'demands hands to mend it, and the farther your borders reach, the more the roadbed eats. The ' +
      'potter\'s wheel turns, and turned on its side it carries what a hundred bearers could not. Fit the ' +
      'axle, spoke the rim, and let the cart do the hauling — expand until the valley is yours, and pray ' +
      'your fields can feed the roads that made it one.',
    prereqs: ['roads'],
    threats: ['overextension'],
    objectiveCardId: 'wheel_goal',
    victoryHint: `Gain ${WHEEL_TERRITORY} territory — build Roads (🪙+🔨) and conquer (⚔️).`,
    failureHint:
      'Every territory you gain drains 🔨 in upkeep each round; overreach your economy and the run falls to ruin.',
    kind: 'standard',
    // Closes the expansion branch: unlocks the Wheel sticker (−1🔨 on buildings/works), the 🔨 relief
    // that resolves the mission's own 🔨 crisis. Influence amount provisional.
    reward: { influence: 12, unlockStickerIds: ['wheel'] },
    map: { col: 9, row: -1 },
    age: 'bronze',
  },
  ice_age: {
    id: 'ice_age',
    name: 'Return of the Ice Age',
    lore:
      'Food is the most basic need of every civilization. Should a future ice age come and threaten ' +
      'our crops, how long would we manage to survive?',
    // Opened by the Stone Age capstone — the first endless *survival* mission (a scored infinite, unlike
    // the rewardless sandbox), so it earns Influence for every round the deepening winter is outlasted.
    prereqs: ['first_temple'],
    threats: ['long_winter'],
    objectiveCardId: 'ice_age_goal',
    victoryHint: 'Outlast the deepening winter, earning ⭐ Influence for every round survived.',
    failureHint: 'The Long Winter drains more 🌾 each round than the last.',
    kind: 'infinite',
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
