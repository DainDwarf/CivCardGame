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
   seeds to measure win rate). This is our balancing tool. ✅ (Seeded RNG is
   implemented: `rules/rng.ts` seeds the deck shuffle from `RunConfig.seed`, and the
   in-run discard-pile reshuffle draws from the persisted `GameState.rngState` stream.)

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
  deck: DeckCard[]      // the run deck ({ cardId, stickers? }): player's meta deck +
                        //   mission-injected cards (e.g. disasters); locked for the whole run
  board: BoardId        // government board — sets the run's starting resources
  missionId: string     // looked up in the MISSIONS registry — the run resolves it
  seed: string          // deterministic draws → replays & simulation

RunResult   (run → meta)
  outcome: 'victory' | 'defeat'
  missionId: string
  stats:   { turnsTaken: number; finalResources: Resources; ... }
  // No rewards field: the meta loop looks rewards up from the mission (by
  // missionId) or derives them from stats — the run itself doesn't carry them.
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

### Card kinds ✅ / 🔧 details

There are **six** card kinds — the `CardKind` values in `content/cards.ts`:
`building`, `action`, `work`, `event`, `threat`, `objective`. The first four differ by how they
leave your hand; `threat` and `objective` are the odd ones out — they never enter a hand or pile
at all, living instead in persistent board zones (see below). By default a card returns to the
**discard** pile once it's done being useful (reshuffled into the deck when it runs
dry) — the **removed** pile is the exception, used only where a specific *effect* says
so. Discard-vs-removed is never a property of the *kind*; it's decided by the effect
that files the card:

- **Building (commit):** the card *is* the building. Pay a cost to play; it leaves
  the deck and enters your **tableau** (one territory slot), producing **every
  turn** while staffed for the rest of the run, thinning your deck. While pinned in
  the tableau its card is filed nowhere — not discard, not removed. Where the card
  goes *once it leaves* the tableau isn't a property of being a building; it's
  decided by whatever effect took it out. Today the only such card is Destroy,
  whose effect specifies **removed**; a future card could instead reclaim territory
  by discarding a building, sending it to **discard** like anything else.
  **Wonders are the same kind** — building cards tagged `wonder` (a distinct banner
  and flavour, not a distinct kind). → the *engine*.
- **Action (recycle):** resolve an effect, then go to the **discard**. →
  repeatable *tactics*.
- **Work (labour):** sticks onto the board as a staffable box instead of resolving
  on play — no idle population required to play it. Produces its effect only while
  staffed, then goes to **discard** at *end of turn* (not immediately, like Action).
  → staffed *labour*.
- **Event (disaster):** never player-playable — missions inject it into the deck.
  Left in hand at end of turn, it auto-resolves its effect, then files to
  **discard** by the same default as anything else — unless that effect says
  otherwise. Barbarian, the only event so far, specifies it's exiled to
  **removed** instead — gone for the rest of the run — but that's Barbarian's
  own effect talking, not an inherent property of being an Event. → mission
  *pressure*.
- **Threat (board hazard):** never in a hand, pile, or deck — a mission seeds it
  directly into the persistent `GameState.threats` zone at setup, where it stays for
  the rest of the run. What it does is up to the card. Never player-owned or
  player-playable, so it's excluded everywhere `event` is. → persistent *pressure*.
- **Objective (win/lose goal):** the mission's victory/defeat condition made into a card,
  the positive counterpart to `threat`. A mission names one `objectiveCardId`; it's seeded
  into the `GameState.objective` zone at setup and owns its mission's win/lose *logic* via a
  pure-read `objective` predicate (bus-driven into `G.pendingVictory`, read by the engine's
  `checkEndIf`) plus a live progress readout. Never in a hand/pile/deck and excluded everywhere `event`/`threat`
  are (`isDeckable`). → the mission's *goal*.

### Turn structure 🔧

A "round" = one turn:

1. **Upkeep / Produce** — tableau generates resources; mission pressure ticks.
2. **Draw** — draw up to hand size.
3. **Action** — commit buildings (pay cost) and play action/work cards.
4. **End** — evaluate the mission's objective (win?) and failure (lose?); any Event
   still in hand auto-resolves; the turn's Work cards and the rest of the hand file
   to **discard**; advance the round.

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

A mission is the unit of a run. It carries everything that varies between runs. Its
win/lose condition is a **card** (`kind: 'objective'`, see *Card kinds*) — the mission
just names an `objectiveCardId`, and that card owns the win/lose predicates so it behaves
like every other card that owns its logic:

```
MissionDef
  id, name, description
  setup:           modifiers to the starting state (resources, deck constraints, era)
  objectiveCardId: the mission's win/lose card, seeded into GameState.objective at setup
  rewards:         granted on victory (currency, card unlocks)
  tier/difficulty

CardDef (kind: 'objective')
  objective: (G, self) => boolean            // WIN condition (defeat is a threat's job)
  dynamicText: (G, self) => string           // live progress line
```

The `objective` hook is a **pure read function** (it never mutates `G`), living on the catalogue
in `src/content/`. It's **bus-driven**: `rules/objective.ts`'s `evaluateObjective` re-derives it into
`G.pendingVictory` at every event-bus flush boundary, and the engine's `checkEndIf` reads that flag
(the win counterpart to a threat's own `defeat` predicate feeding `G.pendingDefeat`, re-derived the
same set-or-clear way by `rules/threats.ts`'s `evaluateDefeat`) — so it stays unit-testable and
reusable by the headless simulator, and a threshold win registers at the flush where it's crossed. A
mission-specific *defeat* belongs on a threat's `defeat` hook, and core-resource collapse
(Famine/Revolt/…) stays a *universal* failure in the engine, independent of any mission.

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
- **Deck construction** ✅ — build/edit run decks from the collection (`src/meta/DeckEditor.tsx`).
  Every deck is player-editable — there's no separate "premade" tier; a fresh
  profile just starts with a few seeded decks (`content/decks.ts`'s `DEFAULT_DECKS`)
  the player can edit or delete like any other. No construction *constraints* yet
  (deck size, copy/rarity limits, maybe a civilization identity) — deferred to
  **Phase 4**. *The core puzzle*, still open on the constraints side.
- **Government boards** — the civilization's starting configuration, chosen alongside
  the deck: it sets the run's opening resources and reskins the run loop, and is
  unlocked/upgraded through mission rewards. See *Government boards* below.
- **Currency & shop** — completing a mission grants **Influence** (⭐), the meta-currency;
  spend it in the shop on *depth* — extra copies of cards you already own, and permanent
  **stickers** (card/board modifiers). New cards, boards, and wonders come from missions,
  not the shop. See *Economy & progression* below. ✅
- **Campaign map** — a branching tech tree of human history; each node is a
  mission/advancement. You pick your next node along the tree; each shows its
  objective, failure, difficulty, and reward so you can tailor your deck. See
  *Campaign map* below.
- **Progression / unlocks** — missions are **binary** (complete / not); completing one
  grants a fixed Influence reward and **one unlock** (a card, a board, or a wonder). See
  *Economy & progression* below. ✅
- **Persistence** — all of the above saved to localStorage/IndexedDB (one profile).

### Economy & progression 🔧 (Phase 3)

**Influence (⭐)** is the single meta-currency. Completing a mission for the first time pays
a fixed, authored amount (*not* scaled by how you played); infinite missions pay by score,
per attempt — that's the only performance-scaled source. Influence is spent only in the shop.

**Ownership & copies.** The collection tracks, per card, how many copies you own
(`number`; an absent entry = not yet unlocked). A mission unlock grants the
first copy; the **shop** raises that along a bounded ×1 / ×2 / ×4 / ×8 ladder (no infinite
tier — every owned count is a finite, instantiable number). The deck editor caps each card
at the number you own — the first deck-construction constraint to bite
(general size/rarity constraints stay Phase 4).

**Two non-overlapping channels.** *Missions = breadth* (a new card type, board, or wonder).
*Shop = depth* (more copies of owned cards; permanent **stickers**). There are **no rating
tiers** on missions — the copper/silver/gold/platinum idea was considered and cut in favour
of buying copies outright in the shop.

**Stickers** are permanent modifiers bought with Influence: a **card sticker** buffs a
*single owned copy* of a card forever; a **board sticker** modifies a board's starting
profile (board stickers *are* the "board modifiers" — one concept, not two). Card stickers
needed per-copy identity — decks reference owned copies by instance id, not bare `CardId[]`
(Phase 3 Step 7.2) — which is why they shipped last, as the deepest piece.

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
- **Completion is binary — no rating tiers.** A node is either cleared or not; clearing it
  (once) pays a fixed Influence reward and grants its single unlock. Owning *more copies* of
  a card is a separate, shop-side axis (see *Economy & progression*), not a function of how
  well you cleared. ✅
- **Infinite nodes** are a distinct kind: an endlessly escalating threat with no win state —
  you survive for a score, which pays Influence *per attempt* (the only performance-scaled
  currency source) and tracks a best. 🔧
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
progress. Progress is legible and discrete: **missions grant whole new boards** (breadth),
while the **shop sells board stickers** — permanent modifiers that tweak a board's starting
profile (depth; see *Economy & progression*). (An *upgrade* to an owned board — a stronger
variant — remains a possible mission reward too; open question below.)

So the player *sees* growth — "I unlocked the Republic", "I stuck a +Military modifier on my
Monarchy" — instead of watching an invisible number climb. This plugs boards into the reward
economy (missions for new boards, shop for stickers), not any auto-scaling.

**Contract.** The `RunConfig` carries the chosen board (its id + any applied modifiers);
on victory the meta loop looks up the mission's rewards (by the `RunResult`'s
`missionId`) to unlock new boards, upgrades, or modifiers.

**Open questions `[?]`:**

- Does an **upgrade** replace the base board, or coexist as a selectable variant?
- **Board modifiers are permanent shop-bought stickers** (see *Economy & progression*) —
  attached to a board, not consumed per run. Whether several **stack** on one board is a
  balance detail, deferred.
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
  (building vs. action), the 5-resource core (Food / Production / Money / Science /
  Military), the turn phases, and **mission-driven objective + failure** evaluators;
  3 missions (The Enlightenment, The Long Winter, Barbarian Tide). Rules unit-tested +
  a headless run integration test (`src/run/run.test.ts`). A run is now genuinely
  winnable *and* losable.
- **Phase 2 — Contract + meta shell** ✅ done, tagged [`v0.0.2`](../CHANGELOG.md):
  `contract.ts` formalizes `RunConfig` (deck, mission, and **government board**, which
  sets the run's starting resources — see *Government boards*) and `RunResult`. A full
  meta layer (mission/board/deck select, a read-only collection, deck construction, a
  run-history stats screen) emits a `RunConfig`, launches a run, and consumes the
  `RunResult`; a **game menu** (save export/import, device-local config, a Codex rules
  reference) is the shell's global-action surface. Everything persists to `localStorage`.
  Deck construction *constraints* (size, copy/rarity limits) stay deferred to Phase 4.
- **Phase 3 — Economy & progression:** the **Influence** currency, the shop (copy tiers +
  stickers), the campaign-map DAG (binary missions, prereq gating), reward/unlock wiring, and
  infinite missions. See *Economy & progression*. The per-card deck-copy cap arrives here;
  broader deck constraints stay Phase 4.
- **Phase 4 — Content & balance:** expand cards/missions/resources; use the headless
  simulator to tune.

## Deferred decisions

Resolved: theme framing (run = one civilization's rise) and the mission map (a
branching tech tree of human history) — see *Theme & framing* and *Campaign map*.

Still open, deferred until the phase that needs them:

- **Resource set** ✅ — resolved in Phase 1: Food / Production / Money / Science / Military. See *Resources* section above.
- **Deck construction constraints** ❓ (deck size, rarity limits, a "civilization"
  identity that gates combos) — revisit during **Phase 4**, during content expansion and
  balance. *Exception:* the **per-card copy cap = copies owned** lands in **Phase 3** (see
  *Economy & progression*), since ownership makes it meaningful; the rest stays Phase 4.
