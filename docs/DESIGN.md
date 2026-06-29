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
for the entire run — there is no mid-run drafting (unlike Slay the Spire). Deck
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

## The contract — the spine between the loops ✅

The two loops are different kinds of software (the run is turn-based, driven by
`src/run/engine.ts`; the meta is plain React, menu/UI-driven). They communicate only
through a narrow, serializable contract — `src/contract.ts`:

```
RunConfig   (meta → run)
  deck: CardId[]        // locked for the whole run
  mission: MissionDef   // objective + failure + setup + modifiers + rewards
  seed: string          // deterministic draws → replays & simulation

RunResult   (run → meta)
  outcome: 'victory' | 'defeat'
  missionId: string
  rewards: { currency: number; unlockedCards?: CardId[] }  // applied on return
  stats:   { turnsTaken: number; finalResources: Resources; ... }
```

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

Five resources are implemented, each with a distinct role:

- **Food** — survival. Population eats 1 food/round; hitting zero triggers famine (run loss).
- **Production** — the build currency. Spent to play permanent building cards.
- **Money** — the action currency. Spent to play recurring action cards (Eureka, Inspiration, …). Produced by Market / Trading Post buildings.
- **Science** — advancement metric. Produced by Libraries and Universities; the win target for science missions.
- **Military** — defense metric. Produced by walls and barracks; the buffer against threat in military missions.

Further expansion axes (`Culture`, `Faith`) remain possible for future missions.

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
  *Failure* Food < 0 at any upkeep.
- **Barbarian Tide** (escalating threat): *Objective* build 3 Wonders.
  *Failure* a rising Threat track reaches your Defense.

Same deck, three completely different tests — and the player tailors their deck in
the meta loop to the mission they pick.

## Meta loop (the Workshop) 🔧

- **Collection** — every card you own (persistent). Starts small, grows over time.
- **Deck construction** — build a run deck from the collection under constraints
  (deck size, copy/rarity limits, maybe a civilization identity). *The core puzzle.*
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
- **Branches are strategic paths** (science / culture / military / economic lineages),
  so a campaign can't grab everything at once — you choose a route. 🔧
- **Victory unlocks the advancement**: it is marked achieved on the tree, opens the
  next nodes, and grants **card unlocks themed to that advancement** (e.g. clearing
  *Writing* adds Library/scribe cards to your collection). 🔧 This ties unlock content
  directly to map position — clean, thematic content growth.
- Procedural variation (which nodes are offered, per-node modifiers/seeds) can layer
  on later; v1 is authored. 🔧

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
- **Phase 1 — Real run loop** ✅ done: `src/game/` → `src/run/`; hybrid cards
  (permanent vs. recurring), the 5-resource core (Food / Production / Money / Science /
  Military), the turn phases, and **mission-driven objective + failure** evaluators;
  3 missions (The Enlightenment, The Long Winter, Barbarian Tide). Rules unit-tested +
  a headless run integration test (`src/run/run.test.ts`). A run is now genuinely
  winnable *and* losable.
- **Phase 2 — Contract + meta shell:** define `contract.ts`; build a minimal meta
  layer (collection + deck construction + mission select) that emits a `RunConfig`,
  launches a run, and consumes the `RunResult`. Persist to localStorage. → the loop
  closes.
- **Phase 3 — Economy & progression:** currency, shop, mission map, unlocks.
- **Phase 4 — Content & balance:** expand cards/missions/resources; use the headless
  simulator to tune.

## Deferred decisions

Resolved: theme framing (run = one civilization's rise) and the mission map (a
branching tech tree of human history) — see *Theme & framing* and *Campaign map*.

Still open, deferred until the phase that needs them:

- **Resource set** ✅ — resolved in Phase 1: Food / Production / Money / Science / Military. See *Resources* section above.
- **Deck construction constraints** ❓ (deck size, copy/rarity limits, a
  "civilization" identity that gates combos) — revisit during **Phase 2**, when we
  build the deck editor.
