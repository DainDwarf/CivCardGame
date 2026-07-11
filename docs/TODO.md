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

  **DAG shape** — a chain that fans into a 3-way branch, then reconverges on a capstone:
  ```
  6.1 ─▶ 6.2 ─▶ 6.3 ─┬─▶ 6.4 events  ─┐
  col0   col1   col2  ├─▶ 6.5 threat  ─┼─▶ 6.7 wonder (col4)
                      └─▶ 6.6 science ─┘
                           all col3
  ```
  All `age: 'stone'` → the age slice grows to `[0,5)`. The player must clear all three branch
  missions (6.4/6.5/6.6) before the capstone unlocks.

  **Cross-cutting sequencing rule** (surfaced while planning 6.7): a mission that *spotlights a
  player-played card* as its objective needs that card **unlocked by an upstream mission** — a
  reward is granted on clear, so you can't build/play what you don't yet own. This is why the
  Göbekli Tepe wonder card is *unlocked* upstream (6.3) but *forced* (built) at the capstone (6.7).

  - **6.1 — First Settlement** ✅ DONE — col 0. `[shipped]` (details in *Done / shipped*;
    tutorial → Step 9.1)
  - **6.2 — Growing Numbers** ✅ DONE — col 1. `[shipped]` (details in *Done / shipped*;
    tutorial → Step 9.2)
  - **6.3 — Rites & Rituals** ✅ DONE — col 2. `[shipped]` (details in *Done / shipped*;
    tutorial → Step 9.3)
  - **6.4 — Events branch: military attack/defense** (*"Raiders at the Border"*) — col 3, row -1,
    prereq 6.3. **Teaches:** the **event** card mechanic (mission-injected disasters that auto-resolve
    from hand). **PARTIALLY SHIPPED** — the mission + its event landed; the **Chiefdom board unlock is
    deferred** to a follow-up (needs the new `unlockBoardIds` reward kind). Done this session:
    - The `raider` **event** card — the debut resource-*draining* event: 3⚔️ cost, drains 1🌾 on the
      unplayed auto-resolve, defused for good by playing it (banished to `removed` unresolved).
    - The `raiders_at_border` mission — seeds `RAIDER_WAVES` (**3**, lowered from 4 for balance —
      `7ec1b12`) raiders into the deck; **objective:** defeat all 3 (count in `removed`), owned by
      `raiders_at_border_goal`. Deadline-free — the food drain is the pressure, famine the only loss.
      Influence-only reward (8⭐, provisional).
    - `sim/objective.ts` gradient (normalized raiders-defused) so the standard mission is sweepable —
      it rewards each raider *played*, but nothing on the path there (drawing one, banking military),
      so it's the growing_numbers dilemma again (a naive `min(military,3)` readiness term cancels on
      the play, since military is *consumed*, unlike territory). Left at the simple form — re-tuning
      with zero sim data is guessing.
    - **Sim sweep done (manually, a separate session):** the sweep confirmed the mission runs and
      surfaced that 4 waves was too hard, so `RAIDER_WAVES` was lowered to **3** (`7ec1b12`). The two
      concerns it was watching — (a) **greedy termination** on this deadline-free mission (a
      survival-first greedy sitting at a non-winning equilibrium) and (b) **winnability** with
      Founding/Tribe (now 9⚔️ total + recurring food drain vs. Bow/Dogs military) — held up under the
      lower wave count. The reward tuning (8⭐) stays provisional.
    - **Deferred (the board half):** the **Chiefdom board** — first *military-focused* government board
      (more Military, leaner Population), where the arc teaches **board choice** (Tribe vs. Chiefdom at
      launch). Needs a **new reward kind (`unlockBoardIds`)** in `rules/rewards.ts` + `MissionDef.reward`
      (boards aren't a reward type yet — only card / card-sticker / board-sticker), the Chiefdom board
      authored in `content/boards.ts`, and this mission's reward extended to grant it. `[size: S] [?]`
  - **6.5 — Threat branch: population unrest** (working name *"Restless People"*) — col 3, row 0,
    prereq 6.3. **Teaches:** the **threat** mechanic (persistent board hazard). **Threat:** each
    point of population drains 1💰 **every deck reshuffle** — unrest that scales with your own
    size. **Objective:** reach **culture level 3** (culture placates the people — thematic).
    **Unlocks:** a money/order card. ~9⭐ (provisional). **Flags:** (a) "per deck reshuffle" has
    no bus trigger today — event types are draw/discard/resourceChange/endTurn, *not* reshuffle;
    either add a `reshuffle` event or have the threat diff `G.reshuffleCount` at the `endTurn`
    broadcast. (b) culture goal → same `scoreState` sim dependency as 6.3. `[size: M] [?]`
  - **6.6 — Science branch: foresight & planning** (working name *"Reading the Seasons"*) —
    col 3, row +1, prereq 6.3. **Teaches:** the **Science** role — card manipulation / foresight
    (the debut of the built-but-unused peek family, `deck.ts`'s `peekTop`/`drawInstance`).
    **Content:** a science-pressure mission (reach a science threshold, or one that rewards
    seeing/reshaping the draw), leaning on the existing science cards (Fire, Storytelling) to win.
    **Objective:** a science threshold (TBD — refine once the peek cards exist). **Unlocks:** the
    **Calendar** card (cf. IDEAS → Stone Age) — the age's foresight entry: agricultural astronomy,
    a peek/predict-the-draw card, the first to exercise `peekTop`. ~9⭐ (provisional). **Note:** the
    reward *introduces* peek to the collection (built in later, like Conquest post-6.1); no
    sequencing constraint, since the objective doesn't require owning Calendar. `[size: M] [?]`
  - **6.7 — Wonder capstone: Göbekli Tepe** (working name *"The First Temple"*) — col 4, row 0,
    prereq **all** of 6.4 / 6.5 / 6.6. **Teaches:** **wonders** (a building tagged `wonder` —
    distinct banner/flavour, *not* a new kind). **Objective:** **build Göbekli Tepe** (the wonder
    unlocked back at 6.3) — a culmination forcing territory (a slot), production (its cost), and a
    culture gate together. **Unlocks:** the first **Influence-rewarding infinite mission** — a
    real escalating-threat endless node (distinct from the no-drain `sandbox` *baseline*), paying
    Influence = rounds survived per attempt, as the age's repeatable grind/graduation node.
    ~12⭐ (provisional, one-time clear reward — separate from the infinite node's per-attempt pay).
    **Flag — new engine support (build here, as noted):** infinite missions aren't
    reward-unlockable today — `sandbox` is always-available with no prereqs, and the `reward` type
    can't unlock a *mission* (only card / card-sticker / board-sticker / — pending 6.4 — board). Needs a
    **new reward kind (`unlockMissionIds`)** (or gateable infinite missions), wired through
    `rules/campaign.ts` availability *and* the campaign map's always-available infinite bottom
    banner (hide until unlocked), plus the infinite mission itself authored. `[size: M] [?]`

  **Mechanics coverage — the whole Stone Age arc (the point of the age).** Covered: run loop /
  work+action / draw+food-upkeep (6.1) · deck-building (post-6.1) · buildings + territory +
  worker staffing (6.2) · conquest (6.1/6.2) · card+board stickers + Influence/shop/copy-tiers
  (6.2 + post) · culture levels + `cultureLevelReq` gate (6.3) · events (6.4) · **boards / board
  choice** (6.4, Chiefdom) · threats (6.5) · **science card-manipulation / foresight** (6.6,
  Calendar) · wonders (6.7). Interactive cards (`pendingInteraction`) ride in on the Paleolithic
  baseline (Storytelling). **Deferred out of the Stone Age (deliberate):**
  - **Destroy / demolish** (`effect.destroy`) — a fully-built-but-unused engine verb, **not** a
    Stone Age mechanic. It's a card-effect (like the peek family was), not one of DESIGN's headline
    core mechanics (buildings / territory / conquest / culture), so deferring it doesn't contradict
    "Stone Age teaches all core mechanics." Lands in a later age (Bronze/Iron), where a built-up
    settlement gives tearing-down its natural context. `[?]`

- **Step 7 — Bronze Age arc** (content expansion; flavor TBD) — new cards + missions themed
  to the Bronze Age, **no new mechanics**. Continues unlocking cards/stickers through mission
  rewards. Specific flavor/content **not yet decided** — placeholder until designed. If any
  building here needs 2–3 workers, the `[blocked]` multi-pip staffing UI + bulk-worker-transfer
  items (below) unblock. Balance via simulator. `[size: L]` `[?]` `[phase: 4]`

- **Step 8 — Iron Age arc** (content expansion; flavor TBD) — same shape as Step 7, Iron Age
  period; flavor/content **undecided**, placeholder until designed. Balance via simulator.
  `[size: L]` `[?]` `[phase: 4]`

- **Step 9 — Tutorial onboarding UI** — the scripted popups/indicators layer over the
  **Stone Age** arc (the sole tutorial age), so new mechanics aren't dumped on the player at
  once. "Tutorial seen" state belongs in device-local `Settings` (`meta/settings.ts`), **not**
  `PlayerStore` (not game progress). Mild tension with the anti-surprise unlock convention
  (tutorials reveal; unlocks surprise). `[size: L]` `[?]` `[phase: 4]`

  **Per-mission tutorial substeps** — one scripted lesson per Stone Age mission, covering the
  gameplay elements that mission introduces and (post-clear) what its reward hands the player.
  The shipped missions (6.1–6.3) are ready to script; 6.4–6.7 land as those missions ship.
  - **9.1 — First Settlement tutorial** — teach the **run loop**: work + action cards, the
    draw/food upkeep, the objective stockpile. **Post-clear:** teach **deck-building** (add the
    newly-unlocked Farm/Toolmaker/Hut + Conquest cards into the deck — the reward's whole building
    set + military→territory conquest).
  - **9.2 — Growing Numbers tutorial** — teach **buildings, territory, and worker staffing** (and
    the territory squeeze that forces Conquest). **Post-clear:** teach **stickers +
    Influence/shop** (the reward debuts the Irrigation card sticker + Territory board sticker —
    the sticker-unlock reward kinds).
  - **9.3 — Rites & Rituals tutorial** — teach the **Culture** gauge: culture levels (each raises
    hand size) and the `cultureLevelReq` play-gate. **Reward:** unlocks Göbekli Tepe (the age's
    first wonder, culture-gated), owned here so the 6.7 capstone can build it.

> **Cross-cutting (not a step):** the Influence economy — shop tier + sticker prices — is
> tuned to the *old* content and must be re-tuned as new content lands, running *through*
> Steps 5–7, simulator-informed, not as a one-shot.

## Cards & content ideas — Phase 4 idea pool (unslotted)

> A pool to draw from while authoring the age arcs (Steps 5–7); each will land in whichever
> age's mechanics fit. All `[phase: 4]`.

- **Disasters — expand** — the `event` card mechanic shipped (see `CHANGELOG.md`); grow it out with more disaster types and missions that inject them (first one now slotted as Step 6.4) `[?]`
- New mission type: "Metropolis" `[?]`
- New mission: "Build the Wonder" → **slotted as Step 6.7** (Göbekli Tepe capstone)
- Culture-based missions (depend on the Culture resource) → **slotted as Steps 6.3 / 6.5**
- Building that changes hand size (e.g. +1 card drawn per round) `[?]`
- Resources transformation? Like a building that transforms production into science for example
- Card that gives a draw when expanding territory `[?]`
- Card effects that trigger on discard / on draw, to enable combos `[?]`

## UI (`src/components/`)

- **Multi-pip staffing UI** ✅ SHIPPED — a building's box now shows one pip per worker-capacity slot
  (filled up to the staffed count) instead of the single staff toggle, so partial staffing is visible;
  click an empty pip to staff one, a filled pip to unstaff one. Landed with the Göbekli Tepe wonder (the
  first multi-worker building — `workers` is now a *capacity*, per-worker scaling is the universal
  staffing model; see [[multi-worker-buildings-roadmap]]). **Deferred follow-up:** independent per-pip
  *drag* (a specific pip to another box) — box-level worker drag still moves one worker at a time.
  - **jot (sim)** ✅ DONE — the heuristic policy's staffing rung now uses `assignWorker` (fills a
    multi-worker box a pip at a time) instead of `toggleStaffing`, in `sim/heuristicPolicy.ts`.
- **Bulk-move modifier for worker transfers** — a modifier (e.g. shift-drag) to move N workers from one building to another in one gesture, instead of one pip-drag per worker. Now unblocked (multi-pip staffing exists). `[size: S] [?]` `[phase: 4]`
- **BoardMini: color starting numbers vs. a baseline** — on the board widget, tint each starting counter relative to a baseline (probably the average of all boards): above baseline → green with an up-arrow, below → red with a down-arrow; a 0 against a 0 baseline greys out/ghosts. Makes a board's strengths/weaknesses legible at a glance. `[?]`

## Tech debt / architecture

- **Simulator: full move-surface fuzz test over synthetic fixtures** — a fuzz pass exercising the
  building/destroy/`discardCost` move surface (the paths the current random-policy smoke test doesn't
  hit yet), built on synthetic fixtures. Deferred until real content exists in Step 6, or an explicit
  later fuzz pass. `[size: S] [blocked]` `[phase: 4]`
- ~~**Simulator: `scoreState` is blind to sub-level culture**~~ ✅ DONE — `sim/value.ts` now scores
  the *fractional* culture level (`cultureProgress`'s `level + ratio`, monotonic and boundary-equal to
  the old integer term) so culture accumulating *within* a band registers, and `sim/objective.ts` has a
  `rites_rituals_goal` progress gradient so the goal-directed policies steer toward culture level 2.
  Both feed the `founding/tribe/rites-rituals` sim scenario. `[phase: 4]`

---

## Done / shipped

> Completed items move here (newest first) so the backlog stays current but nothing
> silently vanishes. Everything through **v0.0.3 (end of Phase 3)** has been moved to
> [`CHANGELOG.md`](../CHANGELOG.md); this section restarts empty for Phase 4 onward.

- **Step 6.3 — Rites & Rituals (Culture mission)** ✅ — col 2, row 0, prereq 6.2. The **Culture**
  gauge: culture *levels* (each raises hand size) and the `cultureLevelReq` play-gate. Objective:
  reach **culture level 2** (climbed by decking in owned Cave Art/Clothing — the intended lesson; no
  deadline). Unlocks **Göbekli Tepe** — the age's first wonder, itself the culture-gated card (a
  `'wonder'`-tagged building with `cultureLevelReq`), owned here so 6.7 can *build* it. Reward 8⭐.
  Göbekli Tepe is the first **multi-worker / per-worker** building (3-worker capacity, +1🔨+1🪙+1🎭
  per staffed worker, 🎭 level-1 gate); its cost stays provisional (6.7 tunes it). The culture-aware
  `scoreState` sim fix + a `rites_rituals_goal` progress gradient landed alongside, so 6.3 is
  sim-sweepable (`founding/tribe/rites-rituals` scenario).

- **Step 6.2 — Growing Numbers (+ sticker-unlock reward infra)** ✅ — col 1. Buildings, territory,
  worker staffing. Objective: build Hut + Farm + Toolmaker at once (a territory squeeze that forces
  Conquest). Unlocks the first card sticker (**Irrigation**) + board sticker (**Territory**), debuting
  the sticker-unlock reward kinds (`unlockStickerIds`/`unlockBoardStickerIds`); post-clear teaches
  stickers + Influence/shop.

- **Step 6.1 — First Settlement (+ Stone Age building set)** ✅ — col 0. The run loop (work + action
  cards, draw/food upkeep). Objective: stockpile 10🔨 + 10⚔️. Unlocks Farm, Toolmaker, Hut, Conquest
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
  or collection (buildings arrive with the Stone Age arc in Step 6). Authored: 10 base cards in `CARDS`
  (Foraging/Toolmaking work + Fire/Bow/Cave Art/Clothing/Jewelry/Bartering/Dogs/Storytelling actions);
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
