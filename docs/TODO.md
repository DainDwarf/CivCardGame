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

- **Steps 1–6 — SHIPPED** ✅ (v0.0.4) — content reset, the Paleolithic start, the headless
  simulator, the ages-map infrastructure, and the **full Stone Age arc** (missions 6.1–6.7, the
  tutorial age introducing every core mechanic through a wonder capstone). See
  [`CHANGELOG.md`](../CHANGELOG.md) → [0.0.4]. Two forward notes are kept live for the remaining ages:

  - **Cross-cutting sequencing rule** (future missions): a mission that *spotlights a player-played
    card* as its objective needs that card **unlocked by an upstream mission** — a reward is granted on
    clear, so you can't build/play what you don't yet own.
  - **Destroy / demolish** — deliberately deferred out of the Stone Age. The engine verb was removed
    during the card tech-debt pass rather than carried through unused; reimplement it cleanly on the
    resolver spine (a `resolve` closure) when a real card wants it — Bronze/Iron, where a built-up
    settlement gives tearing-down its natural context. `[?]`

- **Step 7 — Bronze Age arc** (content expansion) — new cards + missions themed to the Bronze
  Age, **no new mechanics**. Continues unlocking cards/stickers through mission rewards. Balance
  via simulator. `[size: L]` `[?]` `[phase: 4]`

  - **7.1 — Finding Copper — SHIPPED** ✅ (code done, **balance not yet tuned**) — the age's opening
    mission, opened by gobekli (`prereqs: ['first_temple']`, bronze col 5). Mine all 3 copper-vein
    events (2🔨+5🔬 each, played → `removed`) under the Failing Stone Tools threat (−1🔨 per round per
    worker staffed *in a building*; work cards exempt). Unlocks the **Forge** (building, 4🔨, 2🔨/worker
    — deliberately obsoletes Toolmaking).
    **Open:** the numbers are a first pass and want a sim sweep + hand-play. Known risk: works are
    exempt from the drain, so a works-only deck (Toolmaking + Storytelling) can fund the whole vein
    cost while the threat never fires — the threat only bites a player who wants buildings. Decide
    whether that's the intended trade or the drain needs to reach further.
  - **7.2 — the second mission** — unlocks the wheel (−1🔨 cost sticker for buildings/works) and
    trader (1🪙 building). `[?]`

**Content ideas (unslotted):**
  - **Bronze tools** — a sticker for production buildings *and* work cards granting **+1🔨**. `[?]`
  - **Masonry** - A better house, makes 2 people?
  - **Wall** - A no-worker building with 1prod upkeep that gives 1military
Don't forget: Mathematics (or accounting), writing, sailing (and fishing?)

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
  All seven missions (6.1–6.7) have shipped, so every substep below is ready to script.
  - **9.1 — First Settlement tutorial** — teach the **run loop**: work + action cards, the
    draw/food upkeep, the objective stockpile. **Post-clear:** teach **deck-building** (add the
    newly-unlocked Farm/Hut + Conquest cards into the deck — the reward's whole building
    set + military→territory conquest).
  - **9.2 — Growing Numbers tutorial** — teach **buildings, territory, and worker staffing** (and
    the territory squeeze that forces Conquest). **Post-clear:** teach **stickers +
    Influence/shop** (the reward debuts the Irrigation card sticker + the Granary/Stockpile board
    stickers — the sticker-unlock reward kinds).
  - **9.3 — Rites & Rituals tutorial** — teach the **Culture** gauge: culture levels (each raises
    hand size) and the `cultureLevelReq` play-gate. **Post-clear:** the reward unlocks the **Burial**
    building — a culture producer (+1🎭 per staffed round). (The Göbekli Tepe wonder is *not* unlocked
    here; the capstone `first_temple` grants it — see 9.7.)
  - **9.4 — Raiders at the Border tutorial** — teach the **event** card mechanic: mission-injected
    disasters (the raider waves) that auto-resolve from hand each round, draining a resource, and are
    defused for good by *playing* them (paying the cost banishes the card unresolved). **Post-clear:**
    teach **board choice** — the reward unlocks the **Chiefdom** board (first military-leaning
    government), so future launches choose Tribe vs. Chiefdom.
  - **9.5 — Restless People tutorial** — teach the **threat** mechanic: a persistent board hazard (the
    Unrest card in the threat zone) that drains 🪙 per population on every deck reshuffle, and the
    culture goal that placates it. **Post-clear:** the reward unlocks the **Beer** work card (costs 2🌾
    to play, then +5🎭 per staffed round).
  - **9.6 — Reading the Seasons tutorial** — the science branch (mission 6.6, a *parallel* fork off
    Growing Numbers, so it's played before Restless People / 9.5 despite the higher substep number).
    Teach the **Science** gauge (🔬): the planning/foresight resource, expressed through **card
    manipulation** — and take the moment to **recap the flavour of every resource**, now that the arc has
    surfaced them all (each resource's thematic feel per DESIGN's *Resources* — food = population,
    production = the build currency, money = the treasury, science = planning, military = power; plus the
    three strategic gauges). In-mission the objective is simply to **stockpile 10 🔬** (science comes off
    the Storytelling work card). **Post-clear:** the reward unlocks the **Calendar** action (cost 1🔬,
    a look-only peek at the top 3 cards) — the first peek-family card, showing what science *does*
    (foresight + the look-only interaction popup).
  - **9.7 — Göbekli Tepe tutorial** — the capstone (mission 6.7 / `first_temple`, prereq **both** branch
    tips). Teach **wonders**: a wonder plays exactly like a building (tableau slot, staffed, produces every
    round — Göbekli Tepe is the multi-worker one: +1🔨+1🪙+1🎭 *per* staffed worker, culture-level-1
    gated), but it's the age's capstone monument. Spotlight its **special decking rule**: at most
    `MAX_WONDERS_PER_DECK` (currently 1) per deck, its own Collection/deck-editor category, **no**
    shop-bought copies, and **no** stickers. In-mission the objective is the broad end-of-age stockpile
    (3🧍 pop · 🎭 level 2 · 30🔨 · 30🪙 held at once). **Post-clear:** the reward unlocks the **Göbekli
    Tepe wonder card** (add it to a deck under the wonder rule) and opens the endless sandbox — the age is
    mastered.

> **Cross-cutting (not a step):** the Influence economy — shop tier + sticker prices — is
> tuned to the *old* content and must be re-tuned as new content lands, running *through*
> Steps 5–7, simulator-informed, not as a one-shot.

## Cards & content ideas — Phase 4 idea pool (unslotted)

> A pool to draw from while authoring the age arcs (Steps 5–7); each will land in whichever
> age's mechanics fit. All `[phase: 4]`.

- New mission type: "Metropolis" `[?]`
- Building that changes hand size (e.g. +1 card drawn per round) `[?]`
- Resources transformation? Like a building that transforms production into science for example
- Card that gives a draw when expanding territory `[?]`
- Card effects that trigger on discard / on draw, to enable combos `[?]`

## UI (`src/components/`)

- **Per-pip worker drag** — independent per-pip *drag* (drag a specific pip to another box); box-level
  worker drag still moves one worker at a time. Deferred follow-up from the shipped multi-pip staffing UI. `[?]` `[phase: 4]`
- **Bulk-move modifier for worker transfers** — a modifier (e.g. shift-drag) to move N workers from one building to another in one gesture, instead of one pip-drag per worker. Now unblocked (multi-pip staffing exists). `[size: S] [?]` `[phase: 4]`
- **Re-polish the victory / gameover screens + flow** — revisit the end-of-run overlay and the transition back to the meta loop now that missions grant real rewards: the win/loss screen should surface what the run earned (Influence, any unlocks) and read well for both outcomes, and the hand-back-to-meta flow should feel finished rather than functional. `[?]` `[phase: 4]`
- **BoardMini: color starting numbers vs. a baseline** — on the board widget, tint each starting counter relative to a baseline (probably the average of all boards): above baseline → green with an up-arrow, below → red with a down-arrow; a 0 against a 0 baseline greys out/ghosts. Makes a board's strengths/weaknesses legible at a glance. `[?]`
- **Work reordering + insert-at-drop** — let the player reorder placed work cards, and have a newly-played
  work card insert at the drop position rather than appending. `[?]`
- **Sticker locked/unlocked visual on mission preview** — rework how a mission's sticker reward reads locked vs. unlocked (currently a generic locked chip → real face). Maybe extract a **shared sticker widget** (the `CardFace`/`BoardMini` counterpart for a single sticker) reused across the mission-detail preview and elsewhere. `[?]`

## Tech debt / architecture

- **Simulator: full move-surface fuzz test over synthetic fixtures** — a fuzz pass exercising the
  building/`discardCost` move surface (the paths the current random-policy smoke test doesn't
  hit yet), built on synthetic fixtures. Deferred until real content exists in Step 6, or an explicit
  later fuzz pass. `[size: S] [blocked]` `[phase: 4]`

## Misc

- Pet the doggo

---

## Done / shipped

> Completed items move here (newest first) so the backlog stays current but nothing
> silently vanishes. Everything through **v0.0.4 (Stone Age arc)** has been moved to
> [`CHANGELOG.md`](../CHANGELOG.md); this section restarts empty for the rest of Phase 4.
