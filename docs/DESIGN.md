# CivCardGame — Design

> Status legend: ✅ decided · 🔧 proposed (sensible default, open to change) · ❓ open question

A single-player, browser-based **roguelite deckbuilder** about building a
civilization. It has two game loops with a strict separation of concerns:

- **Meta loop — "the Workshop":** persistent. All planning happens here — manage
  your card collection, **construct/edit your deck**, spend currency in a shop,
  and choose your next mission. ✅
- **Run loop — "the Gauntlet":** ephemeral. Take your **locked** deck into the
  chosen mission and play it out. ✅

## Core philosophy ✅

**Strategy lives in the meta loop; the run is the verdict.** The deck is *fixed*
for the entire run — there is no mid-run drafting. Deck
construction is the strategic puzzle; a run answers one question: *does this build
survive this mission under the variance of the draw?*

Two consequences we deliberately design toward:

1. Choosing a mission chooses **both** the win condition **and** the failure
   condition. The same deck is a different test in every mission.
2. Because the deck is fixed and runs are **seeded**, runs are reproducible — which
   enables replays and **headless simulation** (run a deck vs. a mission over many
   seeds to measure win rate). This is our balancing tool. ✅ (Seeded RNG is planned;
   the engine currently uses a deterministic deck order — shuffle + seed wiring arrives
   with the meta/sim phase.)

## Theme & framing

- A **run is one civilization's rise** — from a single settlement to an empire over
  the run's turns. When the run ends (win or lose) that civilization's story is over;
  this *is* the roguelite "reset". ✅
- The **meta-map is humanity's history** — a persistent, branching **tech tree** of
  real historical advancements. Progressing the map is the persistent
  meta-progression. ✅
- The two scales are **macro vs. micro** ✅: across a campaign you guide *humanity*
  through history (the macro map), one *civilization-rise* (a run) at a time. A run
  attempts to achieve the advancement of the map node you chose; on victory that
  advancement is unlocked on the tree (and grants themed cards), opening new branches.
  **Macro = humanity / persistent; micro = one civ / ephemeral.**

## The contract — the spine between the loops ✅ / 🔧

The two loops are different kinds of software (the run is turn-based, driven by
`src/run/engine.ts`; the meta is plain React, menu/UI-driven). They communicate only
through a narrow, serializable contract — `src/contract.ts`:

```
RunConfig   (meta → run)
  deck: CardId[]        // the run deck: player's meta deck + mission-injected cards
                        //   (e.g. disasters); locked for the whole run
  board: BoardId        // government board — sets the run's starting resources
  mission: MissionDef   // objective + failure + setup + modifiers + rewards
  seed: string          // deterministic draws → replays & simulation

RunResult   (run → meta)
  outcome: 'victory' | 'defeat'
  missionId: string
  rewards: { currency: number; unlockedCards?: CardId[] }  // applied on return
  stats:   { turnsTaken: number; finalResources: Resources; ... }
```

**The `RunConfig` is an *assembled* starting state, not a raw snapshot of the player's
meta choices.** Building it is the contract's real job: take the player's persistent
choices (their saved deck, their chosen board) and compose the mission's modifiers on top
of them to produce the state a run actually begins from. Two examples already in scope:

- **Disasters** — a mission may inject negative cards into the run `deck` at assembly
  time. The player's saved meta deck is the *input*; the run deck is a derived copy — the
  saved deck is never mutated.
- **Government boards** — the `board` sets the run's baseline starting resources, which
  the mission's `setup` then modifies (board = baseline, `setup` = deltas; see
  *Government boards*).

So the meta owns durable choices, the mission owns per-run modifiers, and the contract is
where the two are merged into one immutable run configuration. 🔧

## Run loop (the Gauntlet)

### Card kinds — Hybrid ✅ / 🔧 details

Cards differ by how they leave your hand:

- **Permanent (commit):** Buildings, Wonders. Pay a cost to play; they leave the
  deck and enter your **tableau**, producing/affecting **every turn** for the rest
  of the run. They thin your deck. → the *engine*.
- **Recurring (recycle):** Actions, Units. Resolve an effect, then go to the
  **discard**; reshuffled when the deck empties. → repeatable *tactics*.

### Turn structure 🔧

A "round" = one turn:

1. **Upkeep / Produce** — tableau generates resources; mission pressure ticks.
2. **Draw** — draw up to hand size.
3. **Action** — commit permanents (pay cost) and play recurring cards.
4. **End** — evaluate the mission's objective (win?) and failure (lose?); discard;
   advance the round.

### Resources ✅

All resources know nothing about missions. Missions sit on top: they reference resources as objective targets, failure triggers, or pressure multipliers. The resource definitions don't change; only the mission's lens on them does.

#### Core resources

Five spendable/trackable resources, each with a **mechanical role** and a **thematic feel** (design guidelines, not hard rules). Any core resource going negative ends the run immediately, regardless of the active mission:

- **Food** — population management. Population eats food each round. Going negative: **Famine**. More food supports more population, which means more workers available to staff buildings.
- **Production** — the build currency. Represents the material the civilization has accumulated — housing, industry, infrastructure. Spent to play permanent building cards. Going negative: **Ruin**.
- **Money** — the treasury. Spent on immediate, temporary actions. Not a universal wildcard: its value depends on which action cards and buildings you run. It complements your economy rather than replacing it. Going negative: **Bankruptcy**.
- **Science** — anticipation and planning. Primarily expressed through card manipulation: drawing extra cards, discarding strategically, retrieving cards from the discard pile, peeking at the top of the deck. Going negative: **Dark Age**.
- **Military** — power projection, both defensive and offensive. Defends against external threats (disasters, invasion event cards) and enables aggression: expanding territory and pillaging resources. Going negative: **Revolt**.

#### Strategic resources

Three civilization-level gauges that constrain and enable play. They are never directly spent; they define the shape of your civilization.

- **Population** — your workforce. Workers are drawn from the idle population pool to staff buildings (which need workers to operate) and to pay for population-reserving actions. Food production determines how large a population you can sustain.
- **Territory** — the land your civilization controls. You cannot build more buildings than your territory allows. Expand by conquest or development; or free up slots by demolishing existing buildings.
- **Culture** — how much your civilization shines. Accumulated over time; the more you have, the more willing your people are to act. Mechanically: culture thresholds increase hand size, and some cards require a minimum culture to be playable.

Further expansion axes (`Faith`, …) remain possible.

## Mission system — objective & failure as data ✅

A mission is the unit of a run. It carries everything that varies between runs,
and **both** the objective and the failure are predicates over the run state:

```
MissionDef
  id, name, description
  setup:     modifiers to the starting state (resources, deck constraints, era)
  objective: (state) => { met: boolean; progress: number }   // the WIN
  failure:   (state) => boolean                               // the LOSE
  rewards:   granted on victory (currency, card unlocks)
  tier/difficulty
```

Objective/failure evaluators are **pure functions in `src/rules/`**, so they are
unit-testable and reusable by the headless simulator.

### Illustrative missions 🔧 (show the variety the system buys us)

- **The Enlightenment** (race the clock): *Objective* reach 30 Science by round 12.
  *Failure* round 12 ends without it.
- **The Long Winter** (resource collapse): *Objective* survive 15 rounds.
  *Failure* the universal core-resource floor — extra Food drain each round risks **Famine**.
- **Barbarian Tide** (escalating threat): *Objective* build 3 Wonders.
  *Failure* the universal core-resource floor — a rising Threat drains Military each round, and hitting negative triggers **Revolt**.

Same deck, three completely different tests — and the player tailors their deck in
the meta loop to the mission they pick.

## Meta loop (the Workshop) 🔧

- **Collection** — every card you own (persistent). Starts small, grows over time.
- **Deck construction** — build a run deck from the collection under constraints
  (deck size, copy/rarity limits, maybe a civilization identity). *The core puzzle.*
- **Government boards** — the civilization's starting configuration, chosen alongside
  the deck: it sets the run's opening resources and reskins the run loop, and is
  unlocked/upgraded through mission rewards. See *Government boards* below.
- **Currency & shop** — runs grant currency by outcome/performance; spend it to buy
  new cards (grow the collection) or upgrades.
- **Campaign map** — a branching tech tree of human history; each node is a
  mission/advancement. You pick your next node along the tree; each shows its
  objective, failure, difficulty, and reward so you can tailor your deck. See
  *Campaign map* below.
- **Progression / unlocks** — finishing missions unlocks cards, missions,
  civilizations, and difficulty tiers.
- **Persistence** — all of the above saved to localStorage/IndexedDB (one profile).

### Campaign map — humanity's tech tree ✅ / 🔧

The mission map is a **branching, authored DAG of historical advancements** — e.g.
Agriculture → Pottery / Animal Husbandry → Writing → Philosophy → … — *not* a
procedurally generated map.

- **Each node is a mission** themed as a historical advancement (technology, cultural
  development, milestone). ✅
- **Edges are prerequisites** — you reach a node only after its predecessor(s). The
  tree's shape provides the branching. ✅
- **Victory unlocks the advancement**: it is marked achieved on the tree, opens the
  next nodes, and grants **card unlocks themed to that advancement** (e.g. clearing
  *Writing* adds Library/scribe cards to your collection). 🔧 This ties unlock content
  directly to map position — clean, thematic content growth.
- Procedural variation (which nodes are offered, per-node modifiers/seeds) can layer
  on later; v1 is authored. 🔧

### Government boards 🔧 `[?]`

Alongside the deck, a run is launched with a **government board** — the civilization's
starting configuration. Where the deck is *what you can do*, the board is *where you
begin*. Themed as a form of government/era (Tribe, Monarchy, Republic, …).

**What a board is.** A board defines the run's **starting resource values** — both the
five *core* resources (Food / Production / Money / Science / Military) and the three
*strategic* gauges (Population / Territory / Culture). Choosing a board is choosing your
opening economy: a martial board might open with Military and a lean Population; a
mercantile one with Money and extra Territory. This is the seed `createInitialState`
currently hard-codes — it becomes the board's job.

**Board vs. mission `setup`.** The two compose cleanly and keep their existing roles:
the **board is the baseline** starting state, and the **mission's `setup` applies
modifiers on top** (it is already documented as "modifiers to the starting state"). In
`setup.ts`: seed from the board, *then* run `mission.setup`. Missions stay a
*lens/modifier*; boards own the *baseline*.

**Visual identity.** A board reskins the run loop, not just its numbers — a distinct
palette/backdrop (and, later, framing) so a run *looks* like the government you are
playing, rather than the near-uniform look it has today. This is where progression
becomes visible on screen.

**Progression — earned, not scaled.** Boards do **not** scale continuously with player
progress. Progress is legible and discrete: **mission rewards grant boards.** A reward
can be

- a **new board** (a different government with a different starting profile),
- an **upgrade** to a board you already own (a stronger version of it), or
- a **board modifier** (an attachable tweak to a board's starting profile).

So the player *sees* growth — "I unlocked the Republic", "my Monarchy is upgraded" —
instead of watching an invisible number climb. This plugs boards into the reward economy
(Campaign map / unlocks), not any auto-scaling.

**Contract.** The `RunConfig` carries the chosen board (its id + any applied modifiers);
the `RunResult`'s rewards can unlock new boards, upgrades, or modifiers.

**Open questions `[?]`:**

- Does an **upgrade** replace the base board, or coexist as a selectable variant?
- Do **modifiers stack**, and are they permanent unlocks or consumed per run?
- **Phasing:** board *selection* + baseline starting resources + the visual reskin can
  ship in **Phase 2** (a small fixed set of boards, as part of the contract). The
  reward-driven unlocking of new boards / upgrades / modifiers needs the reward economy,
  so it lands with **Phase 3**.

## Code architecture 🔧

Builds on the existing core/shell split. `rules/` and `content/` stay shared and
framework-free; each loop is its own shell over them.

```
src/
  rules/        # pure logic, shared (production, scoring, objective/failure evaluators)
  content/      # data, shared (cards/, missions/, shop)
  run/          # turn engine + React context — the gauntlet
  meta/         # React + store + persistence — the workshop
  contract.ts   # RunConfig / RunResult
  app/          # top-level shell: routes Meta UI <-> Run, owns the save
  sim/          # (later) headless run simulator for balancing
```

## Build roadmap 🔧

- **Phase 0 — Skeleton** ✅ done: a runnable turn-based run with a tiny card set.
- **Phase 1 — Real run loop** ✅ done, tagged [`v0.0.1`](../CHANGELOG.md): `src/game/` → `src/run/`; hybrid cards
  (permanent vs. recurring), the 5-resource core (Food / Production / Money / Science /
  Military), the turn phases, and **mission-driven objective + failure** evaluators;
  3 missions (The Enlightenment, The Long Winter, Barbarian Tide). Rules unit-tested +
  a headless run integration test (`src/run/run.test.ts`). A run is now genuinely
  winnable *and* losable.
- **Phase 2 — Contract + meta shell:** define `contract.ts` — the `RunConfig`
  carries the chosen deck, mission, **and government board** (which sets the run's
  starting resources; see *Government boards*). Build a minimal meta layer (collection +
  deck
  construction + board select + mission select) that emits a `RunConfig`, launches a
  run, and consumes the `RunResult`. Add a **game menu** (save, config, codex) as the
  shell's global-action surface. Persist to localStorage. → the loop closes.

  Sequenced build order (each step leaves something runnable; day-to-day tracking lives
  in [`TODO.md`](TODO.md)):

  1. **Scaffold meta content** — 2–3 government boards (`content/boards.ts` + `BoardId`,
     each setting all 8 starting resources) and 2–3 premade decks.
  2. **Mission-select menu** — first meta screen; replaces the direct-to-run mount in
     `main.tsx`. Picks mission / board / deck into a provisional selection shape; does not
     launch yet.
  3. **Define `contract.ts`** — formalize `RunConfig`/`RunResult` from that selection
     shape, including the run **`seed`** (wire a seeded shuffle to replace today's
     deterministic draw).
  4. **Wire the loop closed** — `app/` shell + meta↔run view switch; refactor the
     `missionId`-keyed pipeline (`createRun`/`createInitialState`/`GameProvider`/restart)
     to consume a `RunConfig`; apply board baseline-resources + disaster injection during
     setup assembly; end-of-run returns to the menu with a minimal `RunResult`.
  5. **Extend the meta menu** — collection view + deck-construction navigation (shell
     only).
  6. **localStorage persistence** — stand up the persisted player store (collection +
     saved decks + progress) *before* deck construction, so the editor is built on the
     real store rather than retrofitted.
  7. **Deck construction** — the deck editor, writing to the persisted store.
     Construction *constraints* stay deferred to Phase 4.
- **Phase 3 — Economy & progression:** currency, shop, mission map, unlocks.
- **Phase 4 — Content & balance:** expand cards/missions/resources; use the headless
  simulator to tune.

## Deferred decisions

Resolved: theme framing (run = one civilization's rise) and the mission map (a
branching tech tree of human history) — see *Theme & framing* and *Campaign map*.

Still open, deferred until the phase that needs them:

- **Resource set** ✅ — resolved in Phase 1: Food / Production / Money / Science / Military. See *Resources* section above.
- **Deck construction constraints** ❓ (deck size, copy/rarity limits, a
  "civilization" identity that gates combos) — revisit during **Phase 4**, during
  content expansion and balance.
