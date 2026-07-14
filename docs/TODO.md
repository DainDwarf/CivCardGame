# CivCardGame — TODO / Planner

> A **rudimentary, temporary planner** — a lightweight ticket manager and
> scratchpad, *not* a durable record. Items are planned here, executed one by one,
> and brainstormed/refined in place. Content is grouped by codebase area, with a
> *Done / shipped* archive at the bottom.
>
> **This content is designed to be discarded:** at each version bump the shipped
> items are erased and replaced by short one-line [`CHANGELOG.md`](../CHANGELOG.md)
> entries. So TODO.md holds *transient* planning state; [`DESIGN.md`](DESIGN.md)
> holds the *decided design*, and `CHANGELOG.md` the *durable history*. Nothing
> durable should reference an item here — the citation would rot when this is wiped.

**How we use it:** say *"jot: …"* or *"TODO: …"* (or "note that down") mid-task and
the idea lands here as a one-liner without derailing what we're doing. We triage
later — promote items into `DESIGN.md` / real work, or drop them.

> Tags (optional): `[size: S/M/L]` rough effort · `[?]` needs design discussion ·
> `[blocked]` waiting on something else · `[phase: N]` roadmap phase (1 = run loop · 2 = contract + meta shell · 3 = economy & progression · 4 = content & balance).

## Phase 4 — planned steps (content & balance)

> Phase 4 is content expansion + balance tuning with the headless simulator (see
> [`DESIGN.md`](DESIGN.md) *Build roadmap*). The content target is the **first three ages —
> Stone Age, Bronze Age, Iron Age**. **Stone Age is the whole tutorial age** and introduces
> *all* core gameplay (buildings, territory, conquest, culture); Bronze Age + Iron Age add
> **no new mechanics** — they are content expansion, and their flavor is not yet decided
> (only the historical period is fixed). Steps are loosely independent; hard dependencies are
> noted inline.

- **Step 1 — Deck-construction constraints** DONE ✅

- **Step 2 — Reset ALL content + decouple tests** DONE ✅

- **Step 3 — Starting content: Paleolithic set + Founding deck + Tribe board + sandbox mission** DONE ✅

- **Step 4 — Headless simulator (balance tooling)** ✅

- **Step 5 — Ages map infrastructure** DONE ✅

- **Step 6 — Stone Age arc** (the full tutorial content, mechanics-only, no onboarding UI) —
  the meat of Phase 4 gameplay: a chain of missions introducing **all** core mechanics
  progressively, culminating in the age's first wonder. Author their unlock cards, reward
  amounts, prereqs, and DAG shape; balance via the Step 4 simulator. `[size: L] [?] [phase: 4]`

  **DAG shape** — the chain forks at 6.2 into two parallel branches that reconverge on a capstone:
  ```
  6.1 ─▶ 6.2 ─┬─▶ 6.3 rites ───▶ 6.4 events ──┐
  col0   col1 │  col2            col3          │
              └─▶ 6.6 science ─▶ 6.5 threat ──┴─▶ 6.7 wonder (col4)
                 col2            col3
  ```
  All `age: 'stone'` → the age slice grows to `[0,5)`. The player must clear both branch tips
  (6.4 Raiders and 6.5 Restless People — which in turn require 6.3/6.6) before the capstone unlocks.

  **Cross-cutting sequencing rule** (keep for future missions): a mission that *spotlights a
  player-played card* as its objective needs that card **unlocked by an upstream mission** — a
  reward is granted on clear, so you can't build/play what you don't yet own. (No longer exercised
  by 6.7, which shipped with a resource-stockpile objective, not a build-the-wonder one.)

  - **6.1 — First Settlement** ✅ DONE — col 0. `[shipped]` (details in *Done / shipped*;
    tutorial → Step 9.1)
  - **6.2 — Growing Numbers** ✅ DONE — col 1. `[shipped]` (details in *Done / shipped*;
    tutorial → Step 9.2)
  - **6.3 — Rites & Rituals** ✅ DONE — col 2, row -1 (top branch, prereq 6.2). `[shipped]` (details
    in *Done / shipped*; tutorial → Step 9.3)
  - **6.4 — Raiders at the Border** ✅ DONE — col 3, row -1 (top branch, prereq 6.3). `[shipped]`
    (details in *Done / shipped*; tutorial → Step 9.4)
  - **6.6 — Reading the Seasons** (science branch) ✅ DONE — col 2, row +1, prereq 6.2. `[shipped]`
    (details in *Done / shipped*; tutorial → a later Step 9 substep)
  - **6.5 — Restless People** (threat branch) ✅ DONE — col 3, row +1, prereq 6.6. `[shipped]`
    (details in *Done / shipped*; tutorial → Step 9.5)
  - **6.7 — Wonder capstone: Göbekli Tepe** ✅ DONE — col 4, row 0, prereq **both** branch tips
    (6.4 / 6.5). `[shipped]` (details in *Done / shipped*; tutorial → a later Step 9 substep)

  **Mechanics coverage — the whole Stone Age arc (the point of the age).** Covered: run loop /
  work+action / draw+food-upkeep (6.1) · deck-building (post-6.1) · buildings + territory +
  worker staffing (6.2) · conquest (6.1/6.2) · card+board stickers + Influence/shop/copy-tiers
  (6.2 + post) · culture levels + `cultureLevelReq` gate (6.3) · events (6.4) · **boards / board
  choice** (6.4, Chiefdom) · threats (6.5) · **science card-manipulation / foresight** (6.6,
  Calendar) · wonders (6.7). Interactive cards (`pendingInteraction`) ride in with the science
  card-manipulation cards (Calendar's `reveal` peek). **Deferred out of the Stone Age (deliberate):**
  - **Destroy / demolish** — **not** a Stone Age mechanic. Was a fully-built-but-unused engine verb
    (a declarative `effect.destroy` + a `destroyInstanceId` targeting channel), **removed** during the
    card tech-debt pass rather than carried through the refactor unused — it's a card-effect (like the
    peek family), not one of DESIGN's headline core mechanics (buildings / territory / conquest /
    culture). Reimplement it cleanly on the resolver spine (a `resolve` closure) when a real card wants
    it — Bronze/Iron, where a built-up settlement gives tearing-down its natural context. `[?]`

- **Step 7 — Bronze Age arc** (content expansion; flavor TBD) — new cards + missions themed
  to the Bronze Age, **no new mechanics**. Continues unlocking cards/stickers through mission
  rewards. Specific flavor/content **not yet decided** — placeholder until designed. If any
  building here needs 2–3 workers, the `[blocked]` multi-pip staffing UI + bulk-worker-transfer
  items (below) unblock. Balance via simulator. `[size: L]` `[?]` `[phase: 4]`

  **Content ideas (unslotted):**
  - **Smelting** — mission/unlock granting an early **Forge** building (produces 1🔨). `[?]`
  - **Bronze tools** — a sticker for production buildings *and* work cards granting **+1🔨**. `[?]`

- **Step 8 — Iron Age arc** (content expansion; flavor TBD) — same shape as Step 7, Iron Age
  period; flavor/content **undecided**, placeholder until designed. Balance via simulator.
  `[size: L]` `[?]` `[phase: 4]`
  - Iron Age mission arcs — structure as 2–3 parallel quest lines (branching DAG paths, echoing how the Stone Age forks Rites & Rituals / Reading the Seasons after Growing Numbers), themed around distinct early civilizations:
    - Roman Empire — a military/expansion-leaning line
    - China — a distinct cultural/technological line
    - Central Arabia (maybe) — a trade/desert line, tentative third branch

- **Step 9 — Tutorial onboarding UI** — the scripted popups/indicators layer over the
  **Stone Age** arc (the sole tutorial age), so new mechanics aren't dumped on the player at
  once. "Tutorial seen" state belongs in device-local `Settings` (`meta/settings.ts`), **not**
  `PlayerStore` (not game progress). Mild tension with the anti-surprise unlock convention
  (tutorials reveal; unlocks surprise). `[size: L]` `[?]` `[phase: 4]`

  **Per-mission tutorial substeps** — one scripted lesson per Stone Age mission, covering the
  gameplay elements that mission introduces and (post-clear) what its reward hands the player.
  The shipped missions (6.1–6.5) are ready to script; 6.6–6.7 land as those missions ship.
  - **9.1 — First Settlement tutorial** — teach the **run loop**: work + action cards, the
    draw/food upkeep, the objective stockpile. **Post-clear:** teach **deck-building** (add the
    newly-unlocked Farm/Hut + Conquest cards into the deck — the reward's whole building
    set + military→territory conquest).
  - **9.2 — Growing Numbers tutorial** — teach **buildings, territory, and worker staffing** (and
    the territory squeeze that forces Conquest). **Post-clear:** teach **stickers +
    Influence/shop** (the reward debuts the Irrigation card sticker + Territory board sticker —
    the sticker-unlock reward kinds).
  - **9.3 — Rites & Rituals tutorial** — teach the **Culture** gauge: culture levels (each raises
    hand size) and the `cultureLevelReq` play-gate. **Reward:** unlocks Göbekli Tepe (the age's
    first wonder, culture-gated), owned here so the 6.7 capstone can build it.
  - **9.4 — Raiders at the Border tutorial** — teach the **event** card mechanic: mission-injected
    disasters (the raider waves) that auto-resolve from hand each round, draining a resource, and are
    defused for good by *playing* them (paying the cost banishes the card unresolved). **Post-clear:**
    teach **board choice** — the reward unlocks the **Chiefdom** board (first military-leaning
    government), so future launches choose Tribe vs. Chiefdom.
  - **9.5 — Restless People tutorial** — teach the **threat** mechanic: a persistent board hazard (the
    Unrest card in the threat zone) that drains 🪙 per population on every deck reshuffle, and the
    culture goal that placates it. **Post-clear:** the reward unlocks the **Beer** work card (costs 2🌾
    to play, then +5🎭 per staffed round).

> **Cross-cutting (not a step):** the Influence economy — shop tier + sticker prices — is
> tuned to the *old* content and must be re-tuned as new content lands, running *through*
> Steps 5–7, simulator-informed, not as a one-shot.

## Cards & content ideas — Phase 4 idea pool (unslotted)

> A pool to draw from while authoring the age arcs (Steps 5–7); each will land in whichever
> age's mechanics fit. All `[phase: 4]`.

- **Disasters — expand** — the `event` card mechanic shipped (see `CHANGELOG.md`); grow it out with more disaster types and missions that inject them (first one now slotted as Step 6.4) `[?]`
- New mission type: "Metropolis" `[?]`
- ~~New mission: "Build the Wonder"~~ → **shipped as Step 6.7** (Göbekli Tepe capstone — a
  resource-stockpile objective rather than a build-the-wonder one)
- Culture-based missions (depend on the Culture resource) → **slotted as Steps 6.3 / 6.5**
- Building that changes hand size (e.g. +1 card drawn per round) `[?]`
- Resources transformation? Like a building that transforms production into science for example
- Card that gives a draw when expanding territory `[?]`
- Card effects that trigger on discard / on draw, to enable combos `[?]`

## UI (`src/components/`)

- **Per-pip worker drag** — independent per-pip *drag* (drag a specific pip to another box); box-level
  worker drag still moves one worker at a time. Deferred follow-up from the shipped multi-pip staffing UI. `[?]` `[phase: 4]`
- **Bulk-move modifier for worker transfers** — a modifier (e.g. shift-drag) to move N workers from one building to another in one gesture, instead of one pip-drag per worker. Now unblocked (multi-pip staffing exists). `[size: S] [?]` `[phase: 4]`
- **Reload game when wiping save** — after a destructive Save-menu action (Clear, Load/import),
  reload/re-init the app so the running UI reflects the new store instead of stale in-memory state. `[?]`
- **Re-polish the victory / gameover screens + flow** — revisit the end-of-run overlay and the transition back to the meta loop now that missions grant real rewards: the win/loss screen should surface what the run earned (Influence, any unlocks) and read well for both outcomes, and the hand-back-to-meta flow should feel finished rather than functional. `[?]` `[phase: 4]`
- **BoardMini: color starting numbers vs. a baseline** — on the board widget, tint each starting counter relative to a baseline (probably the average of all boards): above baseline → green with an up-arrow, below → red with a down-arrow; a 0 against a 0 baseline greys out/ghosts. Makes a board's strengths/weaknesses legible at a glance. `[?]`
- **Show remaining cards in deck** — a view of the cards still in the draw pile, **not** in draw order (that would leak the future/shuffle) but sorted and grouped by the default deck order (×N grouping like the deck editor). Lets the player see what's left to draw without revealing the sequence. `[?]`

## Tech debt / architecture

- **Simulator: full move-surface fuzz test over synthetic fixtures** — a fuzz pass exercising the
  building/`discardCost` move surface (the paths the current random-policy smoke test doesn't
  hit yet), built on synthetic fixtures. Deferred until real content exists in Step 6, or an explicit
  later fuzz pass. `[size: S] [blocked]` `[phase: 4]`

---

## Done / shipped

> Completed items move here (newest first) so the backlog stays current but nothing
> silently vanishes. Everything through **v0.0.3 (end of Phase 3)** has been moved to
> [`CHANGELOG.md`](../CHANGELOG.md); this section restarts empty for Phase 4 onward.

- **Step 6.7 — Göbekli Tepe (Wonder capstone)** ✅ — col 4, row 0, prereq **both** branch tips
  (6.4 Raiders + 6.5 Restless People), extending the Stone Age slice to `[0,5)`. The **wonder** role
  (a `building` tagged `wonder`) and the arc's culminating "you've mastered the age" node.
  Implementation:
  - The **`first_temple`** mission — objective a broad end-of-age stockpile held at once: 3 🧍
    population, 🎭 culture level 2, 30 🔨, and 30 🪙 (`first_temple_goal`, four plain
    numeric-threshold goals; deadline-free). Reward **12⭐ + unlocks the Göbekli Tepe wonder card**.
    Mission id `first_temple` (distinct from the `gobekli_tepe` card it unlocks).
  - The `first_temple_goal` objective card overrides `dynamicText` so the culture term reads as a
    **level** (🎭 Level N/2), consistent with the other culture goals, not the raw /30 the generic
    readout would show.
  - **Gates the existing `sandbox` infinite mission** behind the capstone (`sandbox.prereqs:
    ['first_temple']`) — the endless sandbox opens once the age is mastered. No new reward kind was
    needed: prereq-gating already worked for infinite missions. The only wiring was the campaign
    map's infinite bottom banner, which now **filters by `isAvailable`** so a locked infinite
    mission is hidden until unlocked (anti-surprise).
  - **Shipped simpler than the original 6.7 plan:** the objective is a resource stockpile, not
    "build the wonder" — so the wonder is a pure clear reward (no upstream-unlock + forced-build
    sequencing), and gating the *existing* sandbox replaced the planned new escalating-threat
    infinite node + `unlockMissionIds` reward kind.
  - No `sim/objective.ts` override needed — the four plain-threshold goals feed the generic
    goals-average gradient directly, so the mission is sweepable out of the box. **Balance
    (3/L2/30/30 thresholds, 12⭐) stays provisional — sim sweep + manual feel-check pending.**

- **Step 6.6 — Reading the Seasons (Science branch + Calendar card)** ✅ — col 2, row +1, prereq 6.2.
  The **Science** role — card manipulation / foresight — debuting the peek family (`deck.ts`'s
  `peekTop`) and a new **look-only interaction**. Implementation:
  - The **`'reveal'` `PendingInteraction` kind** — the view-only sibling of `'chooseCard'`: the player
    reads the parked options and acknowledges (choosing nothing, `pick: 0`). `enumerateActions` collapses
    it to a single dismiss; the Board modal renders the cards display-only (no pointer/hover) under a
    **Continue** button; `resolveInteraction` is the shared resume path unchanged.
  - The **Calendar** action (reward unlock) — cost **1🔬**, a pure-read peek at the top **3**
    cards *in order*. `effect` is resolve-only (no declarative `resources` — `resolveInteraction`
    re-runs the whole effect on resume, which would double-apply a resource field): first pass `peekTop`s
    + suspends a `'reveal'`, resume clears it (a look keeps nothing). Gated unplayable on an **empty draw
    pile** (`deck.length === 0`, reusing the pre-wired `emptyDrawPile` reason) — peeking never reshuffles,
    so that's the right emptiness test, and it avoids parking a zero-option reveal.
  - The **`reading_seasons`** mission — objective **reach 10🔬 science** (`reading_seasons_goal`,
    deadline-free); reward **9⭐ + unlocks Calendar**. This mission branches off `growing_numbers`
    (6.2) as the science branch (col 2, row +1) and leads to Restless People (6.5) → Stone Age slice
    stays `[0,4)`.
  - `sim/objective.ts` gains a `reading_seasons_goal` gradient (`min(science,10)/10`) so the standard
    mission is sweepable. Calendar itself is mechanically inert for the sim (a look-only info card that
    *spends* science) — the fuzzer plays+dismisses it; `assertRunInvariants` is unaffected (it never reads
    `pendingInteraction.options`, which alias live deck instances). **Balance (10🔬 threshold, 9⭐,
    winnability with Founding/Tribe) stays provisional — sim sweep + manual feel-check pending.**

- **Card model tech-debt pass** ✅ — a structural refactor of the card/effect/resource model (the
  `tech-debt/cards` branch), no gameplay change. Highlights:
  - **One combined `resources` bundle** — `population`/`territory`/`culture` folded off `GameState`
    into `resources`, split into `CoreResources` (the 5 spendable) + `StrategicResources` (the 3
    gauges) = `Resources`; a card's *cost* stays `Partial<CoreResources>`.
  - **Unified `CardEffect`** — `gain`/`loss`/`draw`/`population`/`territory`/`culture` collapse into one
    signed `resources` delta plus a `resolve` escape hatch; the two *compose* through one `runEffect`.
    Timing is now four explicit slots on `CardDef`: `effect` (play), `produces` (per-worker per round),
    `upkeep` (flat per round), and `on.*`.
  - **Extracted `CardGate`** (culture-req / discard-cost / bespoke `check`) and **`CardDisplay`**
    (description / dynamicText / art) off `CardDef`; `RESOURCE_ICON` unified over all 8 resources.
  - **Fail-fast `workers`** — a staffable card must declare `workers` (no silent default); pinned by
    `cards.test.ts`.
  - **Dropped the unused destroy/demolish verb** — reimplement cleanly on the resolver spine when a real
    card wants it (see the Stone Age deferral note above).

- **Step 6.5 — Restless People (Threat branch)** ✅ — col 3, row +1, prereq 6.6. The **threat** mechanic
  (a persistent, mission-seeded board hazard), plus a new first-class **`reshuffle` bus event**.
  Implementation:
  - The **`reshuffle` event** — a broadcast (no subject) emitted by `rules/deck.ts`'s `reshuffleIntoDeck`
    when the discard folds back into the deck, drained at the next flush like any leaf-emitted event
    (`GameEvent` union in `state.ts`; `subjectOf` in `events.ts`). No default behaviour — only a card
    declaring `on.reshuffle` reacts. Chosen over diffing `G.reshuffleCount` in a counter (a cleaner,
    stateless fit for the projection-clone purity contract).
  - The **`unrest`** threat — a stateless `on.reshuffle` handler draining **1🪙 per population point**
    on every reshuffle, so a bigger civilization is a heavier burden. No `defeat` of its own; the
    pressure is 🪙 bled into a **bankruptcy** collapse (the money counterpart to raider famine).
  - The **`restless_people`** mission — seeds `unrest`; objective **reach 🎭 culture level 2**
    (`restless_people_goal`, its own objective card mirroring `rites_rituals_goal`); deadline-free.
    Reward 9⭐ + unlocks **Beer** (provisional). This mission sits downstream of Reading the Seasons
    (6.6, the science branch) at col 3, row +1.
  - The **Beer** work card (reward unlock) — costs **2🌾** to play, then yields **+5🎭** per staffed
    round (a plain declarative producer: the food is a one-time play cost, the culture a per-worker
    output — no bespoke `produces.resolve`).
  - `sim/objective.ts` gains a `restless_people_goal` gradient (identical culture-toward-level-2 form as
    `rites_rituals_goal`), so the standard mission is sweepable. Mechanism tests over the reshuffle
    event + Unrest drain in `rules/{deck,events}.test.ts`. **Balance
    (reward 9⭐, drain magnitude) stays provisional — sim sweep + manual feel-check pending.**

- **Step 6.4 — Raiders at the Border (Events branch + Chiefdom board)** ✅ — col 3, row -1, prereq 6.3.
  The **event** card mechanic (mission-injected disasters that auto-resolve from hand) + **board choice**
  (Tribe vs. Chiefdom at launch). Implementation:
  - The `raider` **event** card — the debut resource-*draining* event: 3⚔️ cost, drains 1🌾 on the
    unplayed auto-resolve, defused for good by playing it (banished to `removed` unresolved).
  - The `raiders_at_border` mission — seeds `RAIDER_WAVES` (**3**, lowered from 4 for balance —
    `7ec1b12`) raiders into the deck; objective: defeat all 3 (count in `removed`), owned by
    `raiders_at_border_goal`. Deadline-free — the food drain is the pressure, famine the only loss.
    Influence-only reward (8⭐, provisional).
  - `sim/objective.ts` gradient (normalized raiders-defused) so the standard mission is sweepable — it
    rewards each raider *played*, but nothing on the path there (drawing one, banking military), so it's
    the growing_numbers dilemma again (a naive `min(military,3)` readiness term cancels on the play,
    since military is *consumed*, unlike territory). Left at the simple form — re-tuning with zero sim
    data is guessing.
  - **Sim sweep done** (manually, a separate session): confirmed the mission runs and surfaced that 4
    waves was too hard, so `RAIDER_WAVES` was lowered to **3** (`7ec1b12`). The two concerns it watched —
    (a) **greedy termination** on this deadline-free mission (a survival-first greedy sitting at a
    non-winning equilibrium) and (b) **winnability** with Founding/Tribe (9⚔️ total + recurring food
    drain vs. Bow/Dogs military) — held up under the lower wave count. Reward tuning (8⭐) stays provisional.
  - **The board half** — the **Chiefdom board**, first *military-leaning* government (more Military,
    leaner Population); the arc teaches **board choice**. Landed the new **`unlockBoardIds` reward kind**
    (the 4th symmetric unlock, alongside card / card-sticker / board-sticker) — `computeRewards` folds all
    four unlock sets through one `UnlockProgress` bundle; a `PlayerStore.unlockedBoards` set; a
    `BoardDef.starting` flag + the `availableBoardIds` picker seam (`starting || unlocked`, so a fresh
    profile always has Tribe); the Chiefdom board authored in `content/boards.ts` (**provisional stats —
    to tune**); this mission's reward extended to grant it. Board unlocks preview as a locked chip →
    `BoardMini` reveal.

- **Multi-pip staffing UI** ✅ — a building's box now shows one pip per worker-capacity slot
  (filled up to the staffed count) instead of the single staff toggle, so partial staffing is visible;
  click an empty pip to staff one, a filled pip to unstaff one. Landed with the Göbekli Tepe wonder (the
  first multi-worker building — `workers` is now a *capacity*, per-worker scaling is the universal
  staffing model; see [[multi-worker-buildings-roadmap]]). The heuristic policy's staffing rung was
  switched to `assignWorker` (fills a multi-worker box a pip at a time) instead of `toggleStaffing`, in
  `sim/heuristicPolicy.ts`. (Deferred follow-up — independent per-pip drag — kept as an active UI item.)

- **Simulator: `scoreState` is blind to sub-level culture** ✅ — `sim/value.ts` now scores
  the *fractional* culture level (`cultureProgress`'s `level + ratio`, monotonic and boundary-equal to
  the old integer term) so culture accumulating *within* a band registers, and `sim/objective.ts` has a
  `rites_rituals_goal` progress gradient so the goal-directed policies steer toward culture level 1.
  Both feed the `founding/tribe/rites-rituals` sim scenario.

- **Step 6.3 — Rites & Rituals (Culture mission)** ✅ — col 2, row -1, prereq 6.2. The **Culture**
  gauge: culture *levels* (each raises hand size) and the `cultureLevelReq` play-gate. Objective:
  reach **culture level 1** (climbed by decking in owned Cave Art — the intended lesson; no
  deadline). Unlocks **Göbekli Tepe** — the age's first wonder, itself the culture-gated card (a
  `'wonder'`-tagged building with `cultureLevelReq`), owned here so 6.7 can *build* it. Reward 8⭐.
  Göbekli Tepe is the first **multi-worker / per-worker** building (3-worker capacity, +1🔨+1🪙+1🎭
  per staffed worker, 🎭 level-1 gate); its cost stays provisional (6.7 tunes it). The culture-aware
  `scoreState` sim fix + a `rites_rituals_goal` progress gradient landed alongside, so 6.3 is
  sim-sweepable (`founding/tribe/rites-rituals` scenario).

- **Step 6.2 — Growing Numbers (+ sticker-unlock reward infra)** ✅ — col 1. Buildings, territory,
  worker staffing. Objective: build Hut + Farm at once (a territory squeeze that forces
  Conquest). Unlocks the first card sticker (**Irrigation**) + board sticker (**Territory**), debuting
  the sticker-unlock reward kinds (`unlockStickerIds`/`unlockBoardStickerIds`); post-clear teaches
  stickers + Influence/shop.

- **Step 6.1 — First Settlement (+ Stone Age building set)** ✅ — col 0. The run loop (work + action
  cards, draw/food upkeep). Objective: stockpile 10🔨 + 10⚔️. Unlocks Farm, Hut, Conquest
  (whole building set + military→territory conquest). Post-clear teaches deck-building (adding the new
  cards).

- **Step 5 — Ages map infrastructure** ✅ — each age *covers its slice of the DAG*. A mission
  declares its age (`MissionDef.age`), and `content/ages.ts`'s new `ageColSpans` derives each
  present age's contiguous, gap-free column slice from its missions' `map.col` (ordered by `AGES`;
  first age fills from col 0, each later age from its own earliest column, tiling to the next age's
  start). `CampaignMap.tsx` positions each age's arrow band + gradient wash over that slice
  (absolute px on the node grid, replacing the old equal `flex` split), with a flat-tint fallback
  when empty — so with **no `'standard'` missions placed yet the derivation is dormant (`[]` → no
  bands)** and lights up automatically when Step 6's Stone Age missions land. Guards: unit tests over
  synthetic missions (`ages.test.ts`) + catalogue coherence (`missions.test.ts` — every standard
  mission has a valid `map`+`age`, slices tile gap-free, and each mission's col sits inside its own
  age slice, catching interleaving the tiling would otherwise smooth away). Verified live with
  throwaway stub missions (bands tile edge-to-edge over their nodes, wash tracks the boundaries),
  then reverted. The optional **age tag on cards** (Collection sort/filter) is deferred to Step 6,
  where a card's age can derive from its unlocking mission's `age`.

- **Step 4 — Headless simulator (balance tooling)** ✅ — a code-driven, no-browser/no-React
  runner over the pure core, for statistical balance answers no human can play enough games to reach
  (is a mission winnable? is a sticker overpowered? is a card ever played? is the food economy too
  tight?). Shipped: `simulateRun` + random/greedy/heuristic policies, batch + reporting, the
  `npm run sim` CLI. Two follow-ons extracted as standalone items under *Tech debt / architecture*
  (fuzz test · culture-aware `scoreState`), both blocked on Step 6 content.

- **Step 3 — Starting content (Paleolithic)** ✅ — refilled the minimum coherent slice so the game is
  launchable again, scoped to a **Paleolithic hunter-gatherer** start with **no buildings** in the deck
  or collection (buildings arrive with the Stone Age arc in Step 6). Authored: 8 base cards in `CARDS`
  (Foraging/Toolmaking/Cave Art work + Fire/Bow/Jewelry/Bartering/Dogs actions);
  a 20-card buildingless **Founding** deck (`DEFAULT_DECKS`); the **Tribe** board (`BOARDS`: food 5,
  pop 2, everything else 0 incl. territory); and the baseline **`sandbox`** infinite mission — a
  never-win `sandbox_goal` objective (`() => false`) plus a no-drain `sands_of_time` deadline threat
  ending the run once `SANDBOX_DEADLINE` (50) elapses, so it bounds the Step 4 simulator without
  skewing the economy. `STARTING_COLLECTION` counts are copy-tier-attainable (1/2/4/8, never 3);
  `rules/collection.test.ts` re-armed to pin that it covers the deck, and a new `cards.test.ts` pins
  catalogue coherence. Numbers are first-pass, to be tuned by the Step 4 sim. Pre-alpha: **wipe local
  save** (new card/board/mission ids) — [[prealpha-no-save-migration]].

- **Step 2 — Reset ALL content + decouple tests** ✅ — every content catalogue emptied to an empty
  export (files + types kept, never deleted): `CARDS`/`DEFAULT_DECKS`/`STARTING_COLLECTION`/`MISSIONS`/
  `STICKERS`/`BOARD_STICKERS`/`BOARDS` all `{}`/`[]`; `BoardId` widened to `string`. Suite runs green on
  a shared synthetic-fixture module (`rules/testFixtures.ts`: `test_*` `CardDef`s + `test_board` +
  synthetic stickers, spliced into the live maps via `installFixtures`/`uninstallFixtures`, state minted
  through the real prod functions). All `rules/`+`run/` mechanism tests decoupled off catalogue values;
  mislabeled content-module mechanism blocks (`compareCards`, the mission win/defeat spine) relocated to
  synthetic fixtures. Content-side coherence iterators (missions/decks/boards) kept but pass **vacuously**
  on empty catalogues — earmarked for Step 3 rewrite (incl. `STARTING_COLLECTION` owns-enough coverage).
  Game is knowingly **non-launchable** until Step 3 refills content (tests/typecheck stay green);
  `parsePlayerStore` confirmed shape-only so dead saved ids don't crash — pre-alpha **wipe local save**
  when Step 3 lands new ids ([[prealpha-no-save-migration]]).

- **Step 1 — Deck-construction constraints** ✅ — `MIN_DECK_SIZE` floor (provisional 20, enforced at
  `rules/deckBuilder.ts` + `App.saveDeck`, reflected by the deck editor's disabled Save + `X / 20`
  readout), default hand limit lowered 5→4 (`blankState`), per-card copy cap already existed. Founding
  deck padded to 20 (placeholder — reset in Step 2).
