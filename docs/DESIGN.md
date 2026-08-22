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

## The contract — the spine between the loops ✅

The two loops are different kinds of software (the run is turn-based, driven by
`src/run/engine.ts`; the meta is plain React, menu/UI-driven). They communicate only
through a narrow, serializable contract — `src/contract.ts`:

```
RunConfig   (meta → run)
  deck: DeckCard[]      // the run deck ({ cardId, stickers? }): player's meta deck +
                        //   mission-injected event cards; locked for the whole run
  board: BoardId        // government board — sets the run's starting resources
  missionId: string     // looked up in the MISSIONS registry — the run resolves it
  seed: string          // deterministic draws → replays & simulation

RunResult   (run → meta)
  outcome: 'victory' | 'defeat'
  missionId: string
  stats:   { turnsTaken: number; score?: number; finalResources: Resources; ... }
  // No rewards field: the meta loop looks rewards up from the mission (by
  // missionId) or derives them from stats — the run itself doesn't carry them.
```

**The `RunConfig` is an *assembled* starting state, not a raw snapshot of the player's
meta choices.** Building it is the contract's real job: take the player's persistent
choices (their saved deck, their chosen board) and compose the mission's modifiers on top
of them to produce the state a run actually begins from. Two examples already in scope:

- **Mission-injected cards** — a mission may seed cards (events into the deck, threats
  onto the board) at assembly time. The player's saved meta deck is the *input*; the run
  deck is a derived copy — the saved deck is never mutated.
- **Government boards** — the `board` sets the run's baseline starting resources; the
  mission then seeds its threat/event cards on top (board = baseline, mission = additions;
  see *Government boards*).

So the meta owns durable choices, the mission owns per-run modifiers, and the contract is
where the two are merged into one immutable run configuration. ✅

## Run loop (the Gauntlet)

### Card kinds ✅

There are **eight** card kinds — the `CardKind` values in `content/cards.ts`:
`building`, `wonder`, `action`, `work`, `trade`, `event`, `threat`, `objective`. The first five differ
by how they leave your hand; `threat` and `objective` are the odd ones out — they never enter a hand or
pile at all, living instead in persistent board zones (see below). By default a card returns to the
**discard** pile once it's done being useful (reshuffled into the deck when it runs
dry) — the **removed** pile is the exception. What routes a card there is a *path*, not a
static kind rule: the `event` kind's played-vs-unplayed split (a *played* event is banished;
see below). An *effect* can route a card there too — see the building note.

- **Building (commit):** the card *is* the building. Pay a cost to play; it leaves
  the deck and enters your **tableau** (one territory slot), producing **every
  turn** while staffed for the rest of the run, thinning your deck. While pinned in
  the tableau its card is filed nowhere — not discard, not removed. Where the card
  goes *once it leaves* the tableau isn't a property of being a building; it's
  decided by whatever effect took it out — a demolish effect could file it to
  **removed**, a reclaim-territory effect to **discard**, like anything else. → the *engine*.
- **Wonder (unique monument):** its *own* kind, but plays exactly like a building —
  occupies a tableau slot, is staffed, and produces every turn while staffed (it
  routes through the shared `isStructure`/`isStaffable` paths). What sets it apart is
  meta identity, not run behaviour: it's its own Collection/deck-editor category, its
  copies can never be bought (`shop.ts`), it takes no stickers (`stickerAppliesTo`),
  and a deck may hold at most `MAX_WONDERS_PER_DECK` of them (`deckBuilder.ts`). The
  face shows a gold "Wonder" banner over the ordinary building colour. → the *capstone*.
- **Action (recycle):** resolve an effect, then go to the **discard**. →
  repeatable *tactics*.
- **Work (labour):** sticks onto the board as a staffable box instead of resolving
  on play — no idle population required to play it. Produces its effect only while
  staffed, then goes to **discard** at *end of turn* (not immediately, like Action).
  It costs **no territory**: a work box is labour, not land, so what limits how much of it you
  field is the hand it comes from and the population free to staff it. Because it files at end of
  turn, its `produces` fires **exactly once per play** — it shares the building's production field
  and the building's production path, and differs only in how long it stands. → staffed *labour*.
- **Trade route (standing rent):** pay a cost to open it into the persistent
  `GameState.tradeRoutes` zone. It stands there for the rest of the run — **nothing the player does
  closes a route**, though a card effect may cut one (`rules/tradeRoutes.ts`'s `closeTradeRoute`,
  which files it back to the discard) — yielding its `produces` and paying its `upkeep` rent every
  round. It takes **no workers** and **no territory**: a route is access, not land or labour. So the
  rent is its only cap, and it is a hard one — a treasury that can't pay goes
  **bankrupt**. This is the sink money's one-way-hub topology spends through: money *rents standing
  access* rather than converting into things, which is a sink with no exchange rate to arbitrage.
  → a standing *commitment*.
- **Event (recurring hazard):** missions inject it into the deck; the player can't
  build with it, but *can play it* once drawn. Its two fates are the mechanic:
  **play it** — pay its cost to banish it to **removed**, resolving its one-shot `effect` (if any)
  but *pre-empting* the recurring disaster (its `upkeep` never fires), so playing is *preventive*; or
  **leave it** — at upkeep it auto-resolves its `upkeep` for free and goes to **discard**, so it
  reshuffles back and *recurs* round after round. Doing nothing lets the disaster keep striking;
  paying to play it pre-empts it for good. (Because an event can fire unplayed with no UI present, its
  `upkeep` must be non-interactive.) → mission *pressure* you pay to end.
- **Threat (board hazard):** never in a hand, pile, or deck — a mission seeds it
  directly into the persistent `GameState.threats` zone at setup, where it stays for
  the rest of the run. What it does is up to the card: a one-time entry `effect` resolved once at
  seed (its only "on entry" moment) plus a recurring `upkeep` drain each round. Never player-owned and
  (unlike a playable `event`) never player-playable; like `event` it's mission-only, excluded from
  deck-building/collection (`isDeckable`). → persistent *pressure*.
- **Objective (win/lose goal):** the mission's victory/defeat condition made into a card,
  the positive counterpart to `threat`. A mission names one `objectiveCardId`; it's seeded
  into the `GameState.objective` zone at setup and owns its mission's win *logic* via declarative
  `goals` — the single source the win boolean, the live readout, and the sim's steering gradient all
  derive from (bus-driven into `G.pendingVictory`, read by the engine's `checkEndIf`). Never in a hand/pile/deck and excluded everywhere `event`/`threat`
  are (`isDeckable`). → the mission's *goal*.

### Turn structure ✅

A "round" = one turn:

1. **Draw** — draw up to hand size.
2. **Action** — commit buildings (pay cost) and play action/work cards.
3. **Upkeep / Produce** — staffed tableau + Work cards generate resources; standing trade routes
   yield and charge their rent; mission pressure ticks (threat drains *and* any Event left unplayed
   in hand firing its `upkeep`); the population eats. The round's win/lose verdict is read here, with
   all of that counted.
4. **End** — the turn's Work cards and the rest of the hand file to **discard**; advance the round.

Upkeep and End are the two halves of the *end-turn boundary* (`run/engine.ts`'s `endTurn`
runs `applyUpkeep` then `settleEndOfTurn`, and only then the next `beginTurn`) — so a Work
card played this turn is collected before the round closes, which is what the HUD's
end-of-round projection previews. An unplayed Event is *mission pressure*, so it fires in the
Upkeep pass alongside the threats (not in the later hand-recycle), which is why a hazard you
leave in hand is counted in that same win/lose verdict. Win/lose isn't a phase: it's
re-derived at *every* step boundary from the objective's `goals` and each threat's `defeat`
(see *Card kinds*), so the engine only ever reads a flag.

### Determinism & order-independence ✅

Runs are seeded and deterministic (the foundation for replays + headless simulation).
On top of raw determinism the engine holds a stronger, deliberately-designed property:
**everything but the draw pile is unordered.** The draw pile's order *is* the future; a
discard pile, a hand, the tableau — these are unordered in the player's mental model, and
the engine matches that:

- **The discard reshuffle is order-independent.** When the discard folds back into an
  empty deck it is *canonicalized by content* before the (uniform, seeded) shuffle, so the
  resulting deck is a pure function of the discard *multiset* and the RNG state — the order
  cards happened to file into the discard never leaks into a future draw. (Uniform shuffling
  is uniform regardless of input order, so this is imperceptible in play; nothing reads the
  discard positionally.)
- **Batch processing is order-independent.** No card's effect may make the *committed*
  outcome of an end-of-round batch — production across the tableau, threat drains, the
  auto-resolution of Events left in hand — depend on the order its siblings resolve in. The
  engine dispatches in a *fixed* order (for replay determinism), but the result must be the
  same under any order.
- **A standing card's claim on another's output is order-independent.** Every gain passes through
  each standing card's gain modifier in turn, and those cards sit in unordered zones — so any two
  such hooks that can stand together must **commute**, exactly as two stickers on one copy must.

Both together mean the whole run state reduces to *one ordered draw pile + a set of
unordered heaps*. This is a genuine game-design choice (it's the faithful model), and it is
also what makes the headless **seeded oracle** cheap: its search can treat those zones as
multisets and merge the vast number of states that differ only in bookkeeping order (see
*Code architecture*). A simulator property test permutes the zones and asserts an identical
committed state — over a fixed fixture, so a card added with a cross-sibling batch effect must
be added to it (a miss only costs the oracle completeness, never soundness).

### Resources ✅

All resources know nothing about missions. Missions sit on top: they reference resources as objective targets, failure triggers, or pressure multipliers. The resource definitions don't change; only the mission's lens on them does.

#### Core resources

Five spendable/trackable resources, each with a **mechanical role** and a **thematic feel** (design guidelines, not hard rules). Any core resource going negative ends the run immediately, regardless of the active mission:

- **Food** — population management. Population eats food each round. Going negative: **Famine**. More food supports more population, which means more workers available to staff buildings.
- **Production** — the build currency. Represents the material the civilization has accumulated — housing, industry, infrastructure. Spent to play permanent building cards. Going negative: **Ruin**.
- **Money** — the treasury, and the economy's **one-way hub**: it is *earned* only from producers and spent *outward* toward the other four, never converted back into. That asymmetry is the invariant — no card turns another resource into money — and it is what keeps the resource graph acyclic, so the five resources stay five resources instead of one wearing five costumes. It has to hold one step further than it first reads: **a route may produce money, or non-money, but no card may convert that non-money output back into money.** A route that pays food plus any card converting food to money is a pump at *any* rate, so the invariant is about the whole cycle rather than about single cards. What it forbids is a **repeatable** inward edge: a **single-use** card — one that exiles itself to `removed` on play, the Bow shape — converts inward a bounded number of times, its total output capped by copies owned rather than by turns elapsed, so it closes no pump and is admissible. Money buys standing **access** rather than raw materials: its principal sink is a **trade route**, a card that pays a per-round money upkeep, gating what it carries for as long as it runs — and no move of yours closes one, so opening it is a commitment, not a lease you can end. So money is flexibility you *rent* — a wildcard in reach, without an exchange rate to arbitrage. Going negative: **Bankruptcy**.
- **Science** — anticipation and planning. Primarily expressed through card manipulation: drawing extra cards, discarding strategically, retrieving cards from the discard pile, peeking at the top of the deck. Going negative: **Dark Age**.
- **Military** — power projection, both defensive and offensive. Defends against external threats (disasters, invasion event cards) and enables aggression: expanding territory and pillaging resources. Going negative: **Revolt**.

#### Strategic resources

Three civilization-level gauges that constrain and enable play. They are never directly spent; they define the shape of your civilization.

- **Population** — your workforce. Workers are drawn from the idle population pool to staff buildings (which need at least one worker to operate) and to pay for population-reserving actions. Food production determines how large a population you can sustain, and it does so on a **superlinear** curve: the population eats `floor(pop²/4)` food each round, so the *next* head costs `floor(n/2)` (`foodPerNextPop`) rather than a flat rate. Growth is therefore self-limiting without any explicit cap — every civilization has a population its food rates cannot pass, and raising that ceiling means a better faucet, not more farmers. A building has a worker **capacity**: most take a single worker, but some (starting with the Göbekli Tepe wonder) hold several, and their output **scales per staffed worker** — a partly-staffed multi-worker building still runs, just at reduced output, so how you spread a scarce workforce across your buildings is a lever.
- **Territory** — the land your civilization controls, and the cap on what you can **build** on it. A building or wonder takes one slot for the rest of the run; nothing else takes any. The play area is wider than the land: a Work box and a trade route stand on the board too, but they are labour and access rather than land, and each carries its own limit instead — a worker to run it, a rent to pay. So territory answers one question only, and answers it permanently: how many standing producers your civilization can commit to. That is what makes it worth spending a whole turn's labour to gain, and why a mission can squeeze you by demanding buildings faster than you can find room for them. Expand by conquest or development.
- **Culture** — how much your civilization shines. Accumulated over time; the more you have, the more willing your people are to act. Mechanically: culture thresholds increase hand size, and some cards require a minimum culture to be playable.

Further expansion axes (`Faith`, …) remain possible.

#### Rating cards — the worker-turn

The **worker-turn** is what makes a work card and a building comparable at all: a work box pays its printed number once per play and hands the worker back, while a building pays it every round it holds one. Equal printed numbers therefore mean equal throughput *per worker*, and the building's edge is reliability (never undrawn) and deck-thinning rather than rate. A card that takes no workers — a trade route, a wall — sits outside the basis entirely and is amortized against draw frequency instead.

The basis is a **detector, not a target.** It exists to find the card that is wildly off, not to flatten the catalogue onto one rate: resources that all convert at par are one resource wearing five costumes, and deliberate unevenness is what keeps them five. The opening deck happens to sit near 1:1 across 🌾/🔨/⚔️, which is why the first mission has one live axis instead of two — tolerable as an opening, not a template.

A **standing obligation** — a route's rent, a building's upkeep — is charged every round, so income against it has to clear it *in expectation*: draw probability × per-play yield × copies, with margin, because a core resource going negative ends the run immediately and a cold streak does not average out. The trap is a faucet whose per-play yield merely matches the obligation, since then no number of copies rescues it; lift the yield instead and a drawable faucet funds a permanent debt perfectly well.

## Mission system — objective & failure as data ✅

A mission is the unit of a run. It carries everything that varies between runs. Its
win/lose condition is a **card** (`kind: 'objective'`, see *Card kinds*) — the mission
just names an `objectiveCardId`, and that card owns the win/lose predicates so it behaves
like every other card that owns its logic:

```
MissionDef
  id, name, lore
  prereqs:          mission ids gating availability (the DAG edges)
  threats?/events?: cards seeded onto the board / shuffled into the deck at setup
  alsoDisplay?:     cards the detail panel shows that setup does *not* seed — ones a run
                    injects mid-play, which no seed list can name
  objectiveCardId:  the mission's win card, seeded into GameState.objective at setup
  reward?:          granted once on first clear (Influence + zero or more unlocks)
  kind:             'standard' | 'infinite'

CardDef (kind: 'objective')
  objective: (G, self) => boolean            // WIN condition (defeat is a threat's job)
  display.dynamicText: (G, self) => string   // live progress line (display-only fields nest under `display`)
```

The `objective` hook is a **pure read function** (it never mutates `G`), living on the catalogue
in `src/content/`. It's **bus-driven**: `rules/objective.ts`'s `evaluateObjective` re-derives it into
`G.pendingVictory` at every event-bus flush boundary, and the engine's `checkEndIf` reads that flag
(the win counterpart to a threat's own `defeat` predicate feeding `G.pendingDefeat`, re-derived the
same set-or-clear way by `rules/threats.ts`'s `evaluateDefeat`) — so it stays unit-testable and
reusable by the headless simulator, and a threshold win registers at the flush where it's crossed. A
mission-specific *defeat* belongs on a threat's `defeat` hook, and core-resource collapse
(Famine/Revolt/…) stays a *universal* failure in the engine, independent of any mission.

**Hoard goals are a lever, not a hazard.** A goal that asks you to *hold* a resource pulls against
spending it, and against money that pull is sharpest because the whole point of a one-way hub is to
spend outward. That tension is worth having when the mission gives it something to bite on — a threat
that reads the pile makes hoarding itself the pressure. It is worth avoiding when the mission has no
other demand for the resource, because then the goal simply switches the resource off for its own
duration.

### Illustrative missions 🔧 (show the variety the system buys us)

- **Race the clock:** *Objective* reach a resource threshold by a deadline round.
  *Failure* the deadline passes without it.
- **Resource collapse:** *Objective* survive N rounds.
  *Failure* the universal core-resource floor — an extra drain each round risks **Famine**.
- **Escalating threat:** *Objective* hit a build count (e.g. Wonders).
  *Failure* the universal core-resource floor — a rising threat drains a resource each round, and hitting negative triggers its collapse (e.g. **Revolt**).

Same deck, three completely different tests — and the player tailors their deck in
the meta loop to the mission they pick.

## Meta loop (the Workshop) ✅

- **Collection** — every card you own (persistent). Starts small, grows over time.
- **Deck construction** ✅ — build/edit run decks from the collection (`src/meta/DeckEditor.tsx`).
  Every deck is player-editable — there's no separate "premade" tier; a fresh
  profile just starts with a few seeded decks (`content/decks.ts`'s `DEFAULT_DECKS`)
  the player can edit or delete like any other. A **minimum deck size** and the per-card
  **copy cap = copies owned** now bite; **rarity limits** and the possible **civilization
  identity** are both dropped (see *Deferred decisions*). *The core puzzle.*
- **Government boards** — the civilization's starting configuration, chosen alongside
  the deck: it sets the run's opening resources and reskins the run loop, and is
  unlocked/upgraded through mission rewards. See *Government boards* below.
- **Currency & shop** — completing a mission grants **Influence** (⭐), the meta-currency;
  spend it in the shop on *depth* — extra copies of cards you already own, and permanent
  **stickers** (card/board modifiers). New cards, boards, wonders, and newly unlocked stickers
  come from missions, not the shop. See *Economy & progression* below. ✅
- **Campaign map** — a branching tech tree of human history; each node is a
  mission/advancement. You pick your next node along the tree; each shows its
  objective, failure, difficulty, and reward so you can tailor your deck. See
  *Campaign map* below.
- **Progression / unlocks** — missions are **binary** (complete / not); completing one
  grants a fixed Influence reward and **zero or more unlocks** (cards, a board, or a wonder — a
  mission may grant none, an Influence-only reward). See
  *Economy & progression* below. ✅
- **Persistence** — all of the above saved to localStorage/IndexedDB (one profile).

### Economy & progression ✅

**Influence (⭐)** is the single meta-currency. Completing a mission for the first time pays
a fixed, authored amount (*not* scaled by how you played); infinite missions pay by score,
per attempt — that's the only performance-scaled source. Influence is spent only in the shop.

**Ownership & copies.** The collection tracks, per card, how many copies you own
(`number`; an absent entry = not yet unlocked). A mission unlock grants the
first copy; the **shop** raises that along a bounded ×1 / ×2 / ×4 / ×8 ladder (no infinite
tier — every owned count is a finite, instantiable number). The deck editor caps each card
at the number you own — the first deck-construction constraint to bite
(a minimum deck size now joins it; rarity limits are dropped).

**Two non-overlapping channels.** *Missions = breadth* (a new card type, board, or wonder).
*Shop = depth* (more copies of owned cards; permanent **stickers**). There are **no rating
tiers** on missions — the copper/silver/gold/platinum idea was considered and cut in favour
of buying copies outright in the shop.

**Stickers** are permanent modifiers bought with Influence: a **card sticker** alters a
*single owned copy* of a card forever; a **board sticker** modifies a board's starting
profile (board stickers *are* the "board modifiers" — one concept, not two). Card stickers
need per-copy identity — decks reference owned copies by instance id, not bare `CardId[]`.

A card sticker is a **trade-off, not an upgrade**: it buys one thing — a raised output, a cut price —
and **charges for it in another currency**. A pure buff makes the only decision "can I afford it"; a
trade-off makes it "what is this copy giving up", which is the decision a per-copy permanent purchase
should carry. The charge may land on any part of the price, not just its resources — a culture-level
prerequisite, a discarded card — and it may land on a card with no printed price at all, which is where
the trade-off bites hardest, because there the sticker *creates* the cost.

What it buys is symmetric: a sticker may grant a **per-round output to a card that prints none**, not
only raise one the card already has. That is what lets an escort ride a lane whose whole return is
standing access — the sticker is the yield, and the card's own economics are the price it is weighed
against.

Two stickers may meet on one copy, and **their folds must commute**: attach order is normalized away by
the fungibility key (`rules/collection.ts`'s `stickerSignature`), so two copies the collection pools as
one variant would otherwise price two different ways in a run. That is a real authoring constraint, not
a theoretical one — it is why a sticker raising a *prerequisite* raises it to a floor rather than
stepping it, so two such stickers compose to the same gate whichever went on first.

*Permanent* here means "attached, not consumed per run" — not "irreversible". Either kind can be
**destroyed** to free its slot, and destroying one **refunds nothing**: the slot comes back, the
Influence doesn't. That's deliberate. A cap of 2 with a cheap undo would make attaching a sticker a
draft rather than a decision; burning the cost is what gives the choice weight, and re-applying costs
full price. The two catalogues keep **separate affordances** for it — a card sticker is destroyed from
the Collection card's detail panel, a board sticker from the Board tab — each behind a confirm, the one
place that no-refund cost is spelled out.

A sticker must first be **unlocked** via a mission reward (the breadth channel —
`rules/rewards.ts` extends beyond card unlocks to card/board stickers) before the shop can
sell it: new stickers arrive as you progress the ages, rather than all being buyable from
the start. ✅

### Campaign map — humanity's tech tree ✅

The mission map is a **branching, authored DAG of historical advancements** — e.g.
Agriculture → Pottery / Animal Husbandry → Writing → Philosophy → … — *not* a
procedurally generated map.

- **Each node is a mission** themed as a historical advancement (technology, cultural
  development, milestone). ✅
- **Edges are prerequisites** — you reach a node only after its predecessor(s). The
  tree's shape provides the branching. ✅
- **Victory unlocks the advancement**: it is marked achieved on the tree, opens the
  next nodes, and grants **card unlocks themed to that advancement** (e.g. clearing
  *Writing* adds Library/scribe cards to your collection). ✅ This ties unlock content
  directly to map position — clean, thematic content growth.
- **Completion is binary — no rating tiers.** A node is either cleared or not; clearing it
  (once) pays a fixed Influence reward and grants whatever unlocks it carries (possibly none).
  Owning *more copies* of
  a card is a separate, shop-side axis (see *Economy & progression*), not a function of how
  well you cleared. ✅
- **Infinite nodes** are a distinct kind: an endlessly escalating threat with no win state —
  you survive for a score, which pays Influence *per attempt* (the only performance-scaled
  currency source) and tracks a best. ✅
- **Ages partition the tree** ✅ — the DAG is grouped into historical **ages**,
  **Stone Age → Bronze Age → Iron Age** to start (`content/ages.ts`), rendered as bands
  across the map. **Stone Age is the tutorial age**, carrying every core mechanic (buildings,
  territory, conquest, culture); later ages add content, not mechanics. A mission declares its age
  (`MissionDef.age`) and each age *covers its slice of the DAG* — its band + gradient wash span
  exactly the columns its missions occupy, derived from their `map.col` (`content/ages.ts`'s
  `ageColSpans`).
  The **Nomadic Age** (the Paleolithic) sits *before* this tree: it's the always-owned
  pre-game baseline — a small hunter-gatherer starting collection (buildingless actions + work
  cards) and the **Tribe** board — that a fresh player begins with, out of which the Stone Age
  (the first campaign age, where buildings/territory/conquest/culture are unlocked) grows. It carries
  no missions, so it isn't one of the mission-derived age bands; the campaign map echoes it only as a
  purely decorative green gutter off the left edge, revealed when you elastic-overscroll leftward.
- Procedural variation (which nodes are offered, per-node modifiers/seeds) can layer
  on later; v1 is authored. 🔧

### Government boards ✅

Alongside the deck, a run is launched with a **government board** — the civilization's
starting configuration. Where the deck is *what you can do*, the board is *where you
begin*. Themed as a form of government/era (Tribe, Monarchy, Republic, …).

**What a board is.** A board defines the run's **starting resource values** — both the
five *core* resources (Food / Production / Money / Science / Military) and the three
*strategic* gauges (Population / Territory / Culture). Choosing a board is choosing your
opening economy: a martial board might open with Military and a lean Population; a
mercantile one with Money and extra Territory. It may also stand structures **pre-built** on the
table (see *Behaviour, as a card on the table* below). `createInitialState` seeds a run from
the chosen board.

**Where a board's identity actually lives.** Five of the eight starting numbers are one-time: they are
spent or eaten early and have washed out by the time a run is decided. Only **population** and
**territory** are standing capacities, felt every round for the whole run — so they are the persistent
differentiation budget a board has, and a board that differs only in its spendable pools reads as a
head start rather than as a different civilization.

**Behaviour, as a card on the table.** A board is not only numbers: it may stand structures
**pre-built** when the run opens (`BoardDef.prebuilt`), and a standing card may carry a rule keyed to
a *concept* rather than to a named card — "whenever you take territory, take spoils with it" — through
the gain seam every card's output already passes down (`rules/effects.ts`'s `modifyGain`). The two
together are what lets a board differ in *how it plays* and not merely in what it starts holding.

Doing it as a card is the point. A board rule that quietly changed a **card's printed numbers** is
ruled out — it makes the same card face lie on one board and tell the truth on another. Here the
printed card is untouched and the extra output comes from a second card the player can see, read and
zoom, standing in a slot it visibly paid for. A landless board is no obstacle: it is granted the slot
its pre-built structure stands in, so its free building room is unchanged and the perk costs land it
never had.

**A board's rule should pay what that board is short of, not more of what it already does.** The
first cut of Chiefdom's Raider Camp paid *more territory* per conquest — doubling the thing the board was
already best at, which compounds a lead rather than covering a weakness, and on the one mission that
both counts territory and taxes it, scaled the reward and the punishment together. It pays **food**
instead: the martial board's actual failure mode is that three people and no fields starve, so plunder
is what turns a war party into a civilization. A board that converts its own surplus into its own
scarcity is a different shape to play, not a strictly better one — which is what keeps such a rule a
*choice* rather than the **answer** to every mission that wants what it grants.

**Where the ceiling is.** That guard is measurable, and it bounded the number: the perk was swept at
several rates against the settled boards' recorded cells. Paying food *and* production put Chiefdom
above its counterpart on half the campaign; food alone at a rate that still clears famine leaves it
ahead on a handful of cells and behind on the rest. A board's rule is tuned against that comparison,
not against its own before/after — "did this board get better" is the wrong question, "did it pass the
board it is an alternative to" is the right one.

**Board vs. mission setup.** The two compose cleanly and keep their existing roles:
the **board is the baseline** starting state, and the **mission seeds its threat/event
cards on top**. In `setup.ts`: seed from the board, *then* seed the mission's cards.
Missions stay a *lens/modifier*; boards own the *baseline*.

**Visual identity.** A board reskins the run loop, not just its numbers — the ground
backdrop tints per board today, with deeper palette/framing later — so a run *looks* like
the government you are playing. This is where progression becomes visible on screen.

**Progression — earned, not scaled.** Boards do **not** scale continuously with player
progress. Progress is legible and discrete: **missions grant whole new boards** (breadth),
while the **shop sells board stickers** — permanent modifiers that tweak a board's starting
profile (depth; see *Economy & progression*). A board **upgrade** is a further kind of mission
reward: it retires an owned board for a stronger variant, carrying its stickers across.

So the player *sees* growth — "I unlocked the Republic", "I stuck a +Military modifier on my
Monarchy" — instead of watching an invisible number climb. This plugs boards into the reward
economy (missions for new boards, shop for stickers), not any auto-scaling.

**Contract.** The `RunConfig` carries the chosen board (its id + any applied modifiers);
on victory the meta loop looks up the mission's rewards (by the `RunResult`'s
`missionId`) to unlock new boards, upgrades, or modifiers.

**Open questions `[?]`:**

- The per-board sticker **cap** (provisionally 2) and how freely stickers should stack are
  balance details, still being tuned.

## Code architecture ✅

Builds on the existing core/shell split. `rules/` and `content/` stay shared and
framework-free; each loop is its own shell over them.

```
src/
  rules/        # pure logic + core state, shared (effects, events, objective/threat evaluators)
  content/      # data + per-entry logic, shared (cards, missions, boards, stickers, ages)
  run/          # turn engine + React context — the gauntlet
  meta/         # React + store + persistence — the workshop
  contract.ts   # RunConfig / RunResult
  app/          # top-level shell: routes Meta UI <-> Run, owns the save
  sim/          # headless run simulator for balancing (simulateRun + policies)
```

**`sim/` is a consumer, never a hook into the game.** Just as the core never imports the shell,
the game data model (`content/` cards/missions/boards, `rules/`) never carries a field that exists
only to serve the simulator. Anything that is a property of *how the simulator plays* — for
instance the objective **progress gradient** the goal-directed policies steer by (`sim/objective.ts`)
— lives strictly in `sim/`, computed from what the game already exposes (an objective's win predicate
is a boolean; the sim derives its own gradient). The policies stay mission-agnostic by keying that
gradient off the objective card id in one sim-local registry, so a new mission adds an entry there,
not a hook on the card.

**The seeded oracle proves winnability, and its soundness rests on determinism, not its key.**
Because `cloneState(G)` already reveals the whole future draw order, the oracle (`sim/oracle.ts`)
searches directly for a *winning line of play* rather than rolling out. Four structural bounds keep it
tractable: it collapses each turn into one search edge, a transposition table keys an ordered `deck` (it
*is* the future draw sequence) against every other zone as an unordered **multiset** (`sim/oracleKey.ts`,
resting on the order-independence guarantees above), a deadline + territory cap bounds depth/branching,
and a beam ranked by the shipping value function keeps the top-*W* states per round-depth. Every line it
returns is real actions
replayed through the real engine to an observed `victory` — so a found line is a **sound proof** of
winnability, and a looser multiset key can only ever *miss* wins (incompleteness), never manufacture a
false one. That headroom is what lets the searches index by a 53-bit **fingerprint** of the key
(`hashOf`) rather than the key itself: a collision merges two genuinely distinct states, which is one
more way to miss a line and no way at all to fake one. `searchWinningLine`/`proveWinnable` are the search
APIs, wrapped two ways that differ only when no line is found: `createOraclePolicy` falls back to a
deep-search planner (so its wins are the best-achievable ceiling), while `createProverPolicy` declines the
seed — a prover win rate is therefore a search-proven **lower bound on winnability**, and it is the
ceiling column the baseline fixtures record.

**The `planner` is the fair competent policy — the oracle's search made honest and shallow.** The
one-ply greedies plateau on a mission whose win needs a multi-turn *conversion chain* (bank a resource
now to afford a play that only pays off later — Masonry is the trigger case), because an intermediate
banking turn doesn't raise the one-ply heuristic. The `planner` (`sim/plannerPolicy.ts`) searches a few
turns ahead to see past that, but must not cheat the way the oracle does: it may know only what the
player knows — the current hand, and the deck as an unordered **multiset**, never the real shuffle. So it
plays *determinized expectimax* — sample fair worlds (`sim/determinize.ts` reshuffles the hidden deck
from the policy's own seed stream), search each as the oracle does (reusing the within-turn skeleton
`sim/turnSearch.ts` and the multiset key), and **average** across worlds (Perfect-Information Monte
Carlo), re-planning per turn. What keeps the horizon shallow enough to stay cheap is the strength of the
leaf value (next paragraph): a leaf that already prices the future is what spares the beam from walking
it. The policy is tuned for *good*, not perfect, play: an occasional winnable seed is lost to sampling
optimism, recoverable by raising the world count.

**The value every competent policy ranks by is a race, denominated in rounds.** A state is worth its
margin `min(T̂loss, slackCap) − T̂win` (`sim/race.ts`): rounds-to-win against rounds-to-death, both read
off one stripped projection of the standing economy plus per-goal completion clocks — a resource goal is
`need / throughput`; a card-count goal is a **landing plan**, the copies' worker-round price run down at
the run's real income, folded softly against the rounds the deck needs to deal them — and where the
measure counts the *distinct* cards standing, a second copy of one buys nothing, so the plan is a **set**
of them against one summed bill and the latest arrival. The currency is the
design decision: a score-point value needs every mission-directed term normalized by the goal's target
size, so its steering signal shrinks as missions grow and each retune fixes one mission while silently
moving the rest — with both sides of every clock in raw units and rounds, that normalization has nowhere
to appear. Rounds also make engine value fall out instead of being shaped in (a producer is worth the
rounds it shaves off `T̂win`, zero once it cannot repay before `T̂loss`) and let the model trade survival
for tempo continuously (collapsing in six rounds while winning in four is a good state). The discipline
that survives from the tuning eras: the model carries exactly **seven tuned constants**, each stating its
units and why it is tuned rather than derived, on the constant itself; everything else derives from card
`cost`→`produces`/`effect` data through shared probes (`sim/probes.ts`), never from a per-mission table.

**A rescue is charged for while it is pending, never credited before it is made.** `T̂loss` is a hard `min`
over the pools, so the purchase that permanently ends a famine is worth nothing until the turn it is made —
and its price shortens some *other* pool's clock the whole way there. So each threatened pool derives its
**rescue routes** at the run root (a producer whose standing output feeds it, or the defusal of a circulating
`event` that drains it), the leaf costs them through the same payment ⊕ delivery fold a goal route uses, and
the margin is charged the soonest one's landing clock weighted by how little runway the pool has left — zero
at `slackCap`, so a run not in trouble is scored as before. The charge is deliberately **not** an extension
of `T̂loss`: crediting a *reachable* rescue removes the pressure that would perform it — a win plan's clock
shortens only by being executed, while a loss-side extension is near-invariant to execution — so the term
instead vanishes by *executing* the rescue (the projection flips and the pool leaves the death list through
the ordinary drain reading) and shrinks by approaching one. Alongside it, the near-death steepening reads the
**shortfall the coming boundary opens** wherever a pool's clock has reached zero: `level / drain` stops
discriminating at an empty pool, so without it the play that quadruples the burn at zero food reads as free.

**A never-winning mission is steered by what it is paid, not by a win it cannot reach.** An `'infinite'`
objective pins `T̂win` at the horizon whatever the run does, so the margin above it is pure survival and the
attempt's own tally — the thing the payout settles on — reaches the value nowhere: the simulator would
measure how long a policy hides rather than how much Influence an attempt delivers. So a state is
additionally worth what it has **scored** under the objective card's own `score` measure, at one round of
runway per point. Par is the rate the content already states: the Ice Age scores exactly its rounds
survived, so any other exchange would contradict a measure the mission authored. An objective declaring no
measure never folds the term at all, which leaves every standard mission's rows byte-identical to a model
that had never heard of scoring — and the frozen band scorer, which gains no such term, reads an infinite
blind by construction.

**The band scorer stays on as a frozen second opinion.** The pre-race value function — `scoreState`'s
survival-first score bands plus the **enabler potential** (`sim/enablers.ts`), the leaf term that credits
a banked consumable for the objective progress it converts into, a held strategic resource for the
capacity it unlocks, and a standing producer for the output rounds past the horizon — remains selectable
as `--scorer band`. It shares no arithmetic with the race margin, so a cell the two disagree on is a
reading about the value function rather than the search under it. Frozen means never re-tuned: its
constants were cut against today's content, and the day one would need adjusting to stay useful is the
day the scorer is deleted instead.

## Build roadmap 🔧

- **Phase 0 — Skeleton** ✅: a runnable turn-based run with a tiny card set.
- **Phase 1 — Real run loop** ✅ [`v0.0.1`](../CHANGELOG.md): hybrid cards (building vs.
  action), the 5-resource core (Food / Production / Money / Science / Military), the turn
  phases, and **mission-driven objective + failure** evaluators — a run genuinely winnable
  *and* losable.
- **Phase 2 — Contract + meta shell** ✅ [`v0.0.2`](../CHANGELOG.md): `contract.ts`
  (`RunConfig`/`RunResult`, incl. the **government board**) plus a full meta layer
  (mission/board/deck select, collection, deck construction, stats) and a **game menu**
  (save/config/Codex); everything persists to `localStorage`.
- **Phase 3 — Economy & progression** ✅ [`v0.0.3`](../CHANGELOG.md): the **Influence**
  currency, the shop (copy tiers + card *and* board stickers), the campaign-map DAG (binary
  + infinite missions, prereq gating), reward/unlock wiring — plus the card-effect
  **resolver spine** and **event bus** underneath. See *Economy & progression*.
- **Phase 4 — Content & balance** (in progress): reset all content and rebuild it as the
  **first three ages — Stone Age, Bronze Age, Iron Age**. The **Stone Age** — the tutorial
  age, introducing every core mechanic (buildings, territory, conquest, culture) — is
  **shipped**, along with the deferred **deck-construction constraints** (min deck size, hand
  limit) and the **headless simulator** (`src/sim/`) used to tune it; boards and card/board
  stickers were reset alongside the cards, and **stickers now unlock through mission rewards**
  (breadth), not only the shop. **Bronze Age + Iron Age remain ahead** — content expansion
  only, no new mechanics (their flavor is undecided beyond the historical period). No new
  resources this phase. See BACKLOG.md for the step breakdown.

## Demo scope 🔧

The first public build — and the project's **final planned scope** (decided 2026-08): what 0.1
teaches moves into a successor game designed from scratch, not into further ages here.
[`IDEAS.md`](IDEAS.md) frames ten ages through the Space Age; 0.1 ships two. The point of drawing
the line this tight is that a scope with no stated edge can never close — and this one must.

**In scope** — the Stone Age ✅ and the **Bronze Age** (its remaining nodes authored trunk-first
under a time-box, so the arc ends coherently wherever the box closes), plus:

- **Culture as it stands** — the gauge is the weakest leg of the eight resources and ships anyway;
  the rework is cancelled, jank accepted. **Hammurabi's Code**, held back as that rework's vehicle,
  is cut with it.
- **The endless missions as they stand** — `ice_age`/`sandbox` keep their current shape with a
  light polish pass; the mini-arc rework is cancelled.
- **Polish** — the victory/gameover → meta hand-back flow, and each mission's card text / art /
  lore.
- **Community + publish** — outbound links (Discord / GitHub / contact), the feedback funnel, the
  itch page — which also carries the onboarding (a how-to-play blurb, pointing at the in-game
  Codex), since the tutorial layer is cut.

**Out of scope** — the **Iron Age**, the **tutorial layer**, the **culture rework**, the **endless
rework**, the **meta-economy retune** (shop tiers + sticker prices stay as tuned today, minus a
sanity glance), every age from Empire onward, procedurally-generated mission arcs, and the
**civilization identity** that gates combos, which is dropped rather than deferred.

**The demo is where pre-alpha ends.** Shipping it as **0.1** closes the "an unrecognized store shape
resets to `emptyStore()`" rule: from 0.1 on, a save shape that changes owes a migration. So the demo
is the *last* build free to reset saves, and the first that may not — which makes save handling a
boundary the demo marks rather than an item it carries. This being the last planned version, the
obligation likely never fires, but the boundary is future-proof either way.

**Order.** Finish Bronze first (time-boxed), then the transversal fixes (defeat on population ≤ 0;
the endless polish), then the closing polish pass, then the publish surface.

**Polish is continuous, not a step.** It appears in no position above because it belongs in all of
them: card text, art and lore are the entire surface a stranger judges, and the work is cheap,
visible, and independent of whatever else is in flight — so it is the designated low-motivation
reservoir rather than a phase to schedule.

**Publishing.** Pages already serves `Latest` off the tail of CI, so hosting is solved and **itch.io
is bought for discovery and a comment thread** rather than for hosting — which makes the community
item a feedback funnel first and a set of badges second. One constraint is stated on the page rather
than absorbed by the build: the UI is mouse-only by design, so the demo is desktop-only.

## Deferred decisions

Resolved: theme framing (run = one civilization's rise) and the mission map (a
branching tech tree of human history) — see *Theme & framing* and *Campaign map*.

Still open, deferred until the phase that needs them:

- **Resource set** ✅ — resolved in Phase 1: Food / Production / Money / Science / Military. See *Resources* section above.
- **Deck construction constraints** — shipped ✅: a **minimum deck size** (`MIN_DECK_SIZE`,
  provisional 20) and a **default hand limit** lowered 5→4, both enforced at the deck writer
  (`rules/deckBuilder.ts` + `App.saveDeck`, the `MAX_DECKS` precedent — a core rule, not a UI
  gate). The **per-card copy cap = copies owned** shipped alongside the shop (see
  *Economy & progression*). The two that were open past it are now closed: **rarity limits** are
  **dropped** with the meta retune they were to be decided in (see *Demo scope*);
  the **"civilization" identity** that gates combos is **dropped** ✅.
