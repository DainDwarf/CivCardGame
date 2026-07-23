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
  Age, **no new mechanics**. Continues unlocking cards/stickers/boards through mission rewards.
  Balance via simulator. `[size: L]` `[?]` `[phase: 4]`

  **The arc (DAG).** Göbekli Tepe is the Stone-Age anchor (where we come from), not a Bronze node:

  ```
                   ┌─→ Copper ──┐                        ┌─→ Wheel+roads (×2) ─┐
  Göbekli Tepe ────┤            ├─→ Accounting ─→ Writing ┼─→ Horse (×2) ───────┼─→ Bronze ─→ Sword & chariot ─→ The Sea Peoples
   (Stone anchor)  └─→ Masonry ─┘                    │    └─→ Naval (×2) ───────┘                                   (capstone)
                        │                            │                                                                   │
                   (leaf) Pyramid            (leaf) Hammurabi's Code                                  unlocks infinite → Fall of the Bronze Age
  ```

  **Decided structure** (with the user):
  - The three middle branches (**Wheel+roads / Horse / Naval**) are **2 missions each**; Copper and
    Masonry stay **single** missions.
  - **Writing** is a node after Accounting (it's the age's defining tech; historically follows accounting).
  - **Pyramid** and **Hammurabi's Code** are **optional leaves** — off Masonry and Writing respectively.
  - The capstone is a **standard** collapse mission (*The Sea Peoples*) that **unlocks a matching
    infinite** survival mission (*Fall of the Bronze Age*, named apart so the two don't both read as
    "the collapse"). Bridges to the Iron Age ("societies emerge *after* a collapse").

  **Scale — stated plainly, not trimmed:** ≈13 critical nodes + 2 leaves + 1 infinite ≈ **16 missions**,
  more than double the 7-mission Stone Age, all remixing existing mechanics. So author it in **order**,
  not as one push (each still balance-swept):
  1. **Copper** — DONE (see *Done / shipped*).
  2. **Masonry** — mechanics DONE (balance pending; see *Done / shipped*). Optional **Pyramid** leaf — mechanics DONE (balance pending; see *Done / shipped*).
  3. **Accounting** — mechanics DONE (balance pending; see *Done / shipped*). **Writing** — mechanics
     DONE (balance pending; see *Done / shipped*). The optional **Hammurabi's Code** leaf off Writing
     remains — the last piece of the literacy half.
  4. **Wheel+roads (×2)** first (it carries the money identity).
  5. **Horse (×2)**, **Naval (×2)**.
  6. **Bronze** convergence → **Sword & chariot** → **capstone + infinite**.
  7. **Golden scenarios — simulator trust harness** (end-of-arc, once Bronze content is stable) — author a
     small set of hand-verified `(deck, mission)` fixtures where the true answer is known (winnable/not, rough
     competent win rate), as regression pins for the *instrument* — decoupling "policy too weak" from "content
     too hard". Soundness only: a found win is fact; a *not*-found win is only "not within budget", never a
     mission verdict. Aim human playtests at these fixtures (the sole non-circular calibration for policy
     strength). Prime the oracle first (safer oracle = better-spent time than tuning the greedies). Ties into
     the oracle-gap difficulty readout idea + the ECONOMY-EXPLORER demand phase. `[size: M] [?] [phase: 4]`

  **Mechanical identity `[?]`:** IDEAS frames the age as "trade-dependent palace civilizations" → the
  throughline is the **money economy** (underused in the Stone Age). Trade branches produce 🪙; Bronze
  consumes 🪙 (tin trade) for superior 🔨/⚔️.

  **Per-node reward proposals** (all `[?]` candidates unless marked decided):

  - **Copper — DONE** ✅ (shipped + balanced) — see [*Done / shipped*](#done--shipped).
  - **Masonry — mechanics DONE** 🟡 (balance pending) — see [*Done / shipped*](#done--shipped). Shipped
    the City Walls + House cards and the Settlement → City board upgrade; the City drawback (per
    IDEAS) is still to author. The optional **Pyramid** wonder leaf is mechanics-DONE (see *Done / shipped*).
  - **Accounting — mechanics DONE** 🟡 (balance pending) — see [*Done / shipped*](#done--shipped). Shipped
    the **Trader** (work card, 3🪙/worker — *not* the old "1🪙 building" note) + the **Opulence** board
    sticker (+10 starting 🪙).
  - **Writing — mechanics DONE** 🟡 (balance pending) — see [*Done / shipped*](#done--shipped). Shipped
    the **Archives** building + the **Writing** action (superseding the old "Library/scribe hand-size
    building" note). Optional leaf **Hammurabi's Code** off here (law/culture — a sticker or stability
    card, not a wonder) still to author.
  - **Wheel+roads (×2)** → **Wheel** −1🔨 cost sticker for buildings/works (relocated from old 7.2), then
    a land-trade money work (caravan/roads).
  - **Horse (×2)** → draft/traction (cost/production) then a military-feeder war-horse. Keep mounted
    cavalry *out* — that's Iron Age.
  - **Naval (×2)** → a sea-trade money work (sailing ship), then the **tin route** (long-distance trade
    that enables Bronze). IDEAS' "defend your trade routes" money-drain event/threat fits here.
  - **Bronze** (convergence) → **Bronzeworking** building (consumes 🪙 → 🔨) + **Bronze tools** sticker
    (+1🔨 for production buildings *and* work cards).
  - **Sword & chariot** → Sword (military, needs bronze) + Chariot (spoked wheel + horse + bronze).
  - **The Sea Peoples** (capstone, standard) → systems-collapse mission; reward **unlocks the infinite**
    below (City board already granted at Masonry).
  - **Fall of the Bronze Age** (infinite, scored survival) → escalating money/military/production pressure
    (parallels Ice Age for Stone).

  **Framing notes to honour when authoring:**
  - The two **convergences** (Accounting, Bronze) are ludic tree-narrowing, *not* historical dependencies —
    each wants a lore line so the gate feels earned (metal + monumental economies create the surplus
    Accounting tracks; the trade branches create the tin routes Bronze needs).
  - **Superseded:** the old 7.2 plan (Wheel + Trader at mission #2) is dropped — Wheel moves to the
    Wheel+roads branch, Trader to Accounting.
  - Not-this-age (belong to the Stone Age, already covered or noted): **fishing** and basic **boats**
    (Stone-Age floating things — sails are the Bronze part); **Ziggurat** (if ever wanted, a mudbrick
    temple-economy wonder off Writing/Accounting, not Masonry).

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

- Building that changes hand size (e.g. +1 card drawn per round) `[?]`
- Card that gives a draw when expanding territory `[?]`
- Card effects that trigger on discard / on draw, to enable combos `[?]`

## UI (`src/components/`)

- **Fix Pyramid wonder card overflow** — the Pyramid's effect text is too long; the bottom text overflows and the card extends past its fixed size. `[?]` `[phase: 4]`
- **Unsaved-changes warning on leaving the deck editor** — if the player has made edits in `DeckEditor.tsx`
  that aren't saved, prompt/confirm before discarding them on exit. `[?]` `[phase: 4]`
- **Per-pip worker drag** — independent per-pip *drag* (drag a specific pip to another box); box-level
  worker drag still moves one worker at a time. Deferred follow-up from the shipped multi-pip staffing UI. `[?]` `[phase: 4]`
- **Bulk-move modifier for worker transfers** — a modifier (e.g. shift-drag) to move N workers from one building to another in one gesture, instead of one pip-drag per worker. Now unblocked (multi-pip staffing exists). `[size: S] [?]` `[phase: 4]`
- **Re-polish the victory / gameover screens + flow** — revisit the end-of-run overlay and the transition back to the meta loop now that missions grant real rewards: the win/loss screen should surface what the run earned (Influence, any unlocks) and read well for both outcomes, and the hand-back-to-meta flow should feel finished rather than functional. `[?]` `[phase: 4]`
- **BoardMini: color starting numbers vs. a baseline** — on the board widget, tint each starting counter relative to a baseline (probably the average of all boards): above baseline → green with an up-arrow, below → red with a down-arrow; a 0 against a 0 baseline greys out/ghosts. Makes a board's strengths/weaknesses legible at a glance. `[?]`
- **Work reordering + insert-at-drop** — let the player reorder placed work cards, and have a newly-played
  work card insert at the drop position rather than appending. `[?]`
- **Sticker locked/unlocked visual on mission preview** — rework how a mission's sticker reward reads locked vs. unlocked (currently a generic locked chip → real face). Maybe extract a **shared sticker widget** (the `CardFace`/`BoardMini` counterpart for a single sticker) reused across the mission-detail preview and elsewhere. `[?]`

## Tech debt / architecture

- **Audit existing tests for the integration split** — the `*.integration.test.ts` convention (end-to-end/
  balance-sensitive suites that drive a full `simulateRun`; see CLAUDE.md → *Conventions*) so far tags only
  `plannerPolicy`. Sweep the rest of the suite for tests that belong there too (anything driving whole runs
  / asserting emergent balance) and rename them, so `npm run test:unit` is a genuinely fast, deterministic
  inner loop. `[size: S] [phase: 4]`
- **Buildings pay upkeep even when unstaffed** `[?]` — today a staffable's `upkeep` only fires while it's
  *operating* (staffed), because `resolveEndTurn` runs only on operating boxes (the `isOperating` gate in
  `events.ts`'s `dispatchEvent`). Make a built-but-idle building still pay its maintenance — an idle
  structure is a cost, not free. Reverses the documented "idle staffable box never reacts" contract, so
  decide the scope: upkeep only (production still gated on staffing), or the whole `endTurn` handler?
  `workers: 0` cards (City Walls) are unaffected (always operating); the Pyramid's −2🌾 would then bleed
  while idle. `[size: M] [phase: 4]`
- **Simulator: full move-surface fuzz test over synthetic fixtures** — a fuzz pass exercising the
  building/`discardCost` move surface (the paths the current random-policy smoke test doesn't
  hit yet), built on synthetic fixtures. Deferred until real content exists in Step 6, or an explicit
  later fuzz pass. `[size: S] [blocked]` `[phase: 4]`

## Misc

---

## Done / shipped

> Completed items move here (newest first) so the backlog stays current but nothing
> silently vanishes. Everything through **v0.0.4 (Stone Age arc)** has been moved to
> [`CHANGELOG.md`](../CHANGELOG.md); this section restarts empty for the rest of Phase 4.

- **Calibrate the planner's search knobs** ✅ — the planner's search knobs had **never been measured**.
  Calibrating three of them (`determinizations` 2 → 8, `turnConfigLimit` 8 → 16, `depth` 1 → 2) beats the
  shipped planner on every cell tested — pyramid 0.23 → 0.82, accounting 0.54 → 0.88, writing-A 0.20 → 0.73,
  masonry 0.92 → 0.96, restless_people 0.59 → 0.96 — against an oracle ceiling of 0.90 / 1.00 / 0.93 /
  1.00 / 1.00, and shipped as the `deepPlanner` tier. `nodeBudget` never binds (0% aborts against a 100k
  cap); `beamWidth` is inert at `depth: 1` by construction. The step counts recorded during that sweep
  (peak ~2.9k) do **not** hold for the calibrated config — `bareBest` on pyramid measures mean 17.8k /
  max 31.7k steps per re-plan (see the profile entry below). Treat the ~2.9k figure as superseded,
  whatever its origin.

  - `beamWidth` 2/6 at `depth: 2` — measured since: no significant change either way, so the default
    (4) stands.

  - **The reveal-boundary design** (decided; dormant until a card that draws/reads the deck *mid-turn*
    first ships, e.g. the idea pool's draw-on-expand / on-draw combo cards — such a card breaks the
    within-turn-play-never-touches-the-deck invariant the planner's shared line enumeration *and* the
    shipped world-graft both rest on): don't detect deck-touching lines and fall back to full replay —
    instead make any deck-touching action **terminate the candidate line**, the same rule `commitPrefix`
    already applies to a parked peek. The line becomes a chance node valued per-world (resolve the draw
    with that world's deck, continue the turn in-world, look ahead, average) — so every candidate line is
    deck-independent *by construction* and the graft stays valid forever. Costs are per-world post-draw
    continuation search + shorter commit horizons (more re-plans), not correctness. (The parked-line half
    of this — valuing a line that ends at a reveal through its answers instead of its bare leaf — shipped
    ahead of the rest; see the *Value parked planner lines through their answers* entry below. What stays
    blocked on content is the draw-as-chance-node machinery itself.) One gap the line-termination rule
    does *not* cover: an effect that **reads** deck contents without touching them (e.g. a "deck holds N
    of X" goal) — a deck-dependent state with no deck-touching action to terminate on. No current content
    does this; it would need its own treatment. And a ceiling to keep expectations honest: **PIMC cannot
    value information prospectively** — inside a sampled world the lookahead already knows that world's
    deck, so an information-only action (a peek) has no modeled upside in any world and its play cost is
    pure downside (strategy fusion). No leaf-valuation surgery changes that; making the planner *seek*
    reveals would need an explicit information bonus, a separate (hackier) design. `[size: M]` `[blocked]`
    `[phase: 4]`
    **Behavioral baseline** (re-pinned 2026-07-23 after the parked-line valuation shipped): on the
    committed `restless_people` fixture × 10 sweep seeds, Calendar is played only by **seed 9 under both
    deepPlanner and bareBest** (turn 8, mid-line, healthy run — incidental near-tie), winRate 0.8 / 0.9
    (replay via `--baseline scripts/sim/baselines/restless_people.json --policies <p> --seed <i>`). The
    pre-valuation baseline (deepPlanner 6/7/8, bareBest 1/7 — late desperation plays in dying runs) is
    superseded; this is the reference point for the draw-era chance-node work. Bonus fix folded in: today a
    line parked at a peek is valued as its **bare leaf** (`evalLine`'s no-op-`endTurn` path) with no
    in-world continuation, undervaluing information moves — the chance-node valuation is the refinement
    that fixes that too.

- **Per-cell progress line on stderr** ✅ — a multi-hour sweep no longer prints nothing until it
  finishes: `runBatch` fires an optional `onProgress` after every run (the sim library writes no I/O
  itself — tests stay quiet), and `scripts/sim.ts` renders a `\r`-updated stderr line tracking the whole
  sweep (`runsDone/runsTotal` across every policy × scenario cell, plus the active policy/scenario).
  stdout (report / JSON) stays clean.

- **Value parked planner lines through their answers** ✅ — the parked-line half of the reveal-boundary
  design (above), shipped ahead of the content that needs the rest: `evalLine` no longer scores a line
  that ends at a parked interaction as its **bare leaf** — it takes the best answer's continuation
  (resolve, then end the turn into the sampled world), so commit-at-the-reveal lines are valued through
  the same future as every other line. **Measured effect was the opposite sign of "peeks now valued
  fairly"**: the bare leaf had been *over*valuing parked lines in collapsing positions (present-state
  score vs. every real continuation being valued through the incoming famine — a freeze-frame illusion),
  so the change *removed* Calendar desperation plays: restless_people 10-seed sweep, plays 3→1
  (shapedBest) / 2→1 (bareBest), the survivors' old late-game dying-run plays (seeds 6/7/8 · 1/7) all
  gone, one healthy mid-game near-tie play (seed 9, both policies) appearing instead; win rates
  unchanged (0.8/0.9), pyramid/masonry byte-identical (control). The planner still never *seeks* a peek
  — the PIMC strategy-fusion ceiling (noted above) stands, as predicted; the desperation-play removal
  was the part no one predicted, which is why the test ran.

- **Graft sampled worlds onto planner line states** ✅ — `plannerPolicy.ts` no longer replays each
  candidate line into each sampled world (`applyActions`, 16 × 8 = 128 replays per re-plan): `expandTurn`
  already computed every line's end state on the *real* state, and within-turn play never touches the
  deck, so each world is **grafted** on — a shallow `G` copy with the world's `deck` + `rngState`
  spliced in (safe because `endTurn` clones `G` before mutating, so the shared arrays stay pristine).
  Output verified **byte-identical** (sweep JSON + stderr budget stats; restless_people/pyramid/masonry
  × shapedBest,bareBest × 10 seeds — restless_people's Calendar exercising the parked-peek path, the
  one field-divergent case: a grafted parked line carries the *real* peeked `pendingInteraction.options`
  where a replay would carry the world's, and nothing downstream reads them). Measured ~**6% wall
  clock** by min-of-3 interleaved A/B reps on pyramid (means unusable — the machine was under game
  load, spread 310–601 s; min is sound since interference only adds time). **The ticket's premise was
  wrong**: the 128 replays were never part of the ~17.8k measured steps — `budget.steps` counts only
  `expandTurn` expansions, so the real cost is the 128 independent per-(line,world) lookahead beams and
  their uncounted `endTurn`s, which the graft can't touch. That's the follow-up lever if the calibrated
  config ever needs a real speedup; the reveal-boundary design (above) is the plan for content that
  touches the deck mid-turn.

- **Ship the lean enabler-term set as the planner default** ✅ — `DEFAULT_ENABLER_TERMS` =
  capacity + producers + cardCosts (conversions/floor/handSize off), now `PlannerOptions.enablers`'s
  default; `enablers: true` remains the full all-on model (`plannerFull`), and the **oracle keeps the
  full model** — its job is proving winnability and the full model finds strictly more wins.
  Measured (full baseline set, paired seeds; full → lean → lean+conversions):
  - **Planner @ 100 seeds**: pyramid 30→**44**→32 · restless_people 59→**74**→67 · writing
    61→**71**→71 · masonry 92→87→87 · first_temple 100→94→**100** · accounting 50→44→49; the six
    easy cells unchanged. Aggregate **+23pp** (lean) / +15pp (lean+conv) over full.
  - **Tuned depth-2 config @ 10 seeds** (bare/full/lean): masonry 9/10/**10** · writing 7/10/**10** ·
    pyramid 6/**10**/9 · restless 9/6/**8** · first_temple 10/10/10 · accounting 8/9/**9** — totals
    49/55/**56** of 60. The lean set's depth-1 stall-cell regressions (first_temple/accounting) are
    shallow-search artifacts; restless's bare > lean > full ordering is the one term effect stable
    across depths.
  - **Oracle @ 10 seeds**: full 12×10/10 · lean drops accounting to 8/10 · lean+conv drops accounting
    and pyramid to 9/10 — hence the oracle's full-model default.
  The shipped set is recorded on `DEFAULT_ENABLER_TERMS` in `sim/enablers.ts` and test-pinned in
  `enablers.test.ts`.

- **Split the enabler shaping into separately-togglable terms** ✅ — `EnablerTerms` on both
  `PlannerOptions`/`OracleOptions` (`enablers: boolean | EnablerTerms`; a missing key = on): `conversions` ·
  `capacity` · `floor` · `handSize` · `producers`, ablated at model *derivation* (`deriveEnablers(G, terms)`).
  The floor/capacity `max` is now orthogonal (`strategicWeight`), and each enabled term prices through
  whatever model the other enabled terms built — no synthetic cross-terms. All-on is exactly the old model
  (test-pinned; the post-split planner reproduced writing-A 7/30 verbatim). New `batch.ts` policies:
  `plannerNo*`/`plannerOnly*` ×5 and `bareOracle`. **Measured** (shipped planner, 30 paired seeds per cell;
  endpoints = `planner`/`bareW2`; writing-A = `scripts/sim/decks/writing-variant-a.json` on `city`, the
  recovered calibration cell):
  - **Endpoints**: masonry 83↔20 · pyramid 27↔7 · restless_people 63↔83 · writing-A 23↔33 (shaped↔bare).
    The oracle (beam 64) only feels the shaping on masonry (100 vs 87 bare); elsewhere ≤1 seed.
  - **writing-A** (card-count goal): the **floor is the whole harm** — necessary (NoFloor = bare 33%) *and*
    sufficient (OnlyFloor 20%; every other single term = bare). Nothing is goal-valued there, so the derived
    terms are empty and only the unconditional floor acts.
  - **restless_people**: the −20 is **emergent stacking** — no single removal recovers more than +7, and
    every term alone is ≈ harmless (Only\* 77–83% vs bare 83%).
  - **masonry**: **capacity alone ≈ the whole benefit** (OnlyCap 80% vs all-on 83%, bare 20%); conversions
    alone partial (33%); every leave-one-out ≥ 80%, so the terms are redundant here. OnlyFloor lands *below*
    bare (10%, 22/30 stalls).
  - **pyramid**: **producers alone = all-on** (27%) and capacity near it (23%); conversions/hand-size alone
    = bare (7%), and *removing* either from the full model helps (NoConv +10, NoHand +7).
  Follow-up: the default-term-set decision (since made — see the lean-default entry above). The card-cost
  probe later landed as a sixth term (`cardCosts`, with `plannerNoCardCost`/`plannerOnlyCardCost`); the
  writing-A numbers above predate it. Re-measured with the probe in play (30 seeds): all-on 33% = bare
  33% (the probe is what closed the old −10), NoFloor jumps to **60%**, OnlyFloor stays 20% — the floor's
  liability sharpened rather than washed out.

- **Drop `tsx`'s `keepNames` from the sim run path** ✅ — the dev scripts (`sim`/`seed-save`/`economy`)
  now run as a plain esbuild bundle under bare `node` (`scripts/bundle.mjs`, rebuilt each `npm run`)
  instead of through `tsx`, whose default `keepNames` transform wrapped every closure with an `__name`
  call. Confirmed the premise structurally first: two bundles from one esbuild invocation differing
  only in `--keep-names`, profiled back to back — `__name` + `set metrics` (~15% self combined) don't
  shrink, they **vanish** when off, and the `run` dispatch closure reappears at its real ~4.8% self.
  `tsx` can't toggle it (CLI exposes only `--no-cache`/`--tsconfig`; dist hardcodes `keepNames: true`),
  and Node's native type-stripping chokes on the codebase's directory imports — so bundling is the
  route. `deepClone` is now the unambiguous top cost (~33% self). Pure dev-tooling: no `src/` change,
  identical sweep output. `esbuild` added as a direct devDep; `tsx` kept for ad-hoc use.

- **Hash the transposition key** ✅ — the answer to the interning attempt's challenge below (*eliminate
  the per-instance touch or the final string*): `hashOf` does both, folding each unordered zone
  **commutatively** into a 53-bit fingerprint so the sort, the intermediate array and the join all
  disappear rather than move. `keyOf` stays as the readable statement of the equivalence relation and
  as the test oracle the hash is checked against. Measured on pyramid · `oracle` · 20 seeds under the
  profiler: key cost **18.8% → 9.9%** cum (~26 s → ~12 s), accounting for essentially the whole
  139.9 → 124.7 s drop; `deepClone`'s sample count was flat (88 → 87), so its larger *share* is
  dilution, not a regression. Sweep output identical (win rate, turns, actions, end resources).
  A collision now merges two distinct states — affordable because it costs **completeness, never
  soundness**, over ~10⁴ live states against 2⁵³. No clean unprofiled A/B was run, so the ~11%
  wall-clock figure is indicative only.

- **Profile the calibrated planner** ✅ — measured on pyramid · `bareBest` · 10 seeds (372.6 s,
  1,613 samples, `profile` skill). **Both premises of the original ticket were wrong.** A `bareBest`
  re-plan touches **mean 17.8k engine steps (max 31.7k)**, not ~340 — that figure was a *depth-1*
  number that did not transfer to `depth: 2`, so what grew is **search size**, not per-step cost.
  `nodeBudget` still never binds (0% aborts), which now says the cap is loose rather than the search
  small. Where the time goes: `deepClone` **23.3%** self · `keyOf` **21.5%** cum · esbuild `keepNames`
  (`__name` + `set metrics`) **~14.1%** · engine advancement **~35.7%** (hand-summed from the call
  tree; flame truncates caller lists). The ticket's prime suspect — `scoreState` running
  `cloneState`+upkeep twice per leaf (`projectNextTurn` + `permanentDelta`) — is **exonerated**: the
  *duplicated* clone is worth ~2.6%, and the engine path outweighs it ≈4.7 : 1. Follow-ups split into
  the two open items above.
  - **Tried and reverted: interning content keys to ints in `oracleKey.ts`.** Correctness was exact —
    byte-identical sweep JSON and identical `replans`/`meanSteps`/`maxSteps`, confirming the token
    scheme preserved the key's merge classes — but performance was a **wash**: `keyOf` 21.5% → **22.8%**
    cum, wall clock 372.6 → **380.7 s**. The numeric sort worked as designed (`multiset` 8.2% → 5.4%
    self, `contentKey` 4.4% → 3.3%), but the new per-instance `Map` lookup cost **6.6%** self, more
    than the ~5.2% saved across the other frames — and `join()` re-stringifies every int anyway, so
    string materialization was moved rather than removed. **The generalizable lesson: `keyOf`'s cost is
    per-instance work + string materialization, not comparison order** — so a count/multiset
    representation (which only shrinks the sort) would not rescue it either. Any future attempt must
    eliminate the per-instance touch or the final string. Kept the four invariant tests it motivated
    (stickers folded order-independently, empty `counters`/`stickers` treated as bare, no `#` in any
    cardId — the separator the `contentKey` format depends on), all passing against the unchanged
    implementation.

- **Retire the objective `OVERRIDES` seam** ✅ — the per-mission progress-gradient overrides in
  `sim/objective.ts` were a bring-up safety net; `sim/enablers.ts` now derives the between-thresholds
  conversion slope mechanically from card `cost`, subsuming them. Finding Copper was the last entry
  (Masonry/Growing Numbers already gone). A 100-seed sweep (stone-age deck / settlement) showed it was
  net-*harmful*: its "bank 🔨/🔬 toward the next vein" gradient drove policies to hoard and starve —
  removing it took greedy 99→100% and planner 85→99% (famine deaths 15→1). Dropped the override, then
  folded `objectiveProgress`/`hasObjectiveGradient` down to the goals-average path and deleted the vacated
  coherence test. (En route: fixed a planner deadlock where a parked look-only peek — Calendar — was never
  resolved, looping a no-op `endTurn` to the action wall.)
- **Pet the doggo** ✅ — "can you pet the dog?" easter egg: clicking the Dogs card's art band in the
  zoom overlay puffs floating *pet* *pet* text + a woof! bubble instead of closing. Lives in
  `CardZoomOverlay` (gated on `cardId === 'dogs'`) via a new `CardFace` `onArtClick` prop, so it works
  on every zoom surface.
- **Step 7 — Writing** 🟡 (mechanics shipped; **balance/numbers pending** sim + feel-play) — the Bronze
  Age's literacy node (`prereqs: ['accounting']`, bronze col 7 row 0, staying on the centre axis). Five
  **Clay Tablet** events (6🔨+2🌾 each) seeded into the deck; recording one exiles it to `removed`, which
  the goal counts. An unrecorded tablet files to discard and comes back around, its 🔬 drain **worsening
  each time it fires** (−0, then −1, −2, … per copy, off a per-instance `level` counter) — and since 🔬 is
  a core pool, letting too much slip collapses the run into a **dark age**.
  No threat card: the events *are* the pressure (like Raiders). Deliberately costs 🔨/🌾 rather than 🔬,
  since Storytelling is the only science faucet until this mission's own reward lands. Unlocks the
  **Archives** (building, 4🔨, 2🔬/worker — the Forge's science twin, obsoleting Storytelling) and the
  **Writing** action (2🔬, return a chosen card from discard to hand) — the first shipping consumers of
  the `chooseCard` interaction, `recoverFromDiscard`, and the `discardEmpty` gate. Reward influence 12.
  - **Balance watch (open):** the 🔬 drain is the design's load-bearing number, not just its most
    movable one — it is the mission's *only* pressure. An unrecorded tablet fires upkeep **once** then
    files to discard, so at −1 the total bleed (≈−5🔬 per full deck cycle) may be too slight to force
    the record-early-or-bleed decision, leaving the mission a softer *Finding Copper*. Too high and an
    opening-hand tablet on a low-science board can dark-age before the player can act. The sim question
    is whether a value exists inside that window; if not, scale the drain by tablets *in hand*, add a
    grace round, or introduce a light threat.
- **Step 7 — Accounting** 🟡 (mechanics shipped; **balance/numbers pending** sim + feel-play) — the Bronze
  Age's money-spine convergence: `prereqs: ['finding_copper', 'masonry']` (the first two-prereq gate — both
  branches required), bronze col 6 row 0, rejoining the centre axis. A single 🪙-stockpile goal (40, provisional)
  fought against a **theft economy**: the **Envious Population** threat mints **Thief** events into the deck
  each reshuffle, `floor(money / THIEVES_PER_GOLD)` of them (=10, provisional) — so a fat treasury floods your
  own draws. An unpaid Thief skims 🪙+🔨 and recurs; paying its ⚔️ cost catches it (→ `removed`). First use of
  the new **`spawnIntoDeck`** primitive (cards breeding cards mid-run). Unlocks the **Trader** (work, free,
  3🪙/staffed worker) + the **Opulence** board sticker (+10 starting 🪙, the first money board sticker).
  Reward influence 12 (provisional). Copper→Forge→🔨→Jewelry is the income; Masonry→City Walls is the ⚔️ that
  catches thieves — each prereq feeds one half of the fight.
- **Step 7 — Pyramid** 🟡 (mechanics shipped; **balance/target pending** sim + feel-play) — the optional
  challenge leaf off Masonry (`prereqs: ['masonry']`, bronze col 6 row 1). A money-weighted accumulation
  goal (50🪙 · 40🔨 · 🎭 level 2 held at once) under the **Pharaoh's Reign** deadline threat — the first
  shipped use of the `defeat` hook (lose if the tomb isn't done by round `PHARAOH_DEADLINE` = 40; no drain,
  just the clock). Unlocks the **Pyramid** wonder — the culture powerhouse (+2🎭 +1🪙 per worker, 4 workers,
  culture-L2 gated, −2🌾 upkeep while staffed). Reward influence 25 (challenge → bigger reward). All numbers
  provisional pending a sim sweep.
- **Step 7 — Masonry** 🟡 (mechanics shipped; **balance/target pending** sim + feel-play) — the Bronze
  Age's second mission, a *megalopolis* goal: reach 6 🧍 population (provisional target). Forks off gobekli
  (`prereqs: ['first_temple']`) opposite Copper — bronze col 5, symmetric fork (Copper moved to row -1,
  Masonry row 1). No threats/events. Unlocks the **House** (building, 6🔨, +2🧍 one-shot like a bigger
  Hut), the **City Walls** (building, 4🔨, self-sufficient: +1⚔️/round, −1🔨 upkeep — the first standing
  military producer), and upgrades **Settlement → City** board (12🌾 6🔨 2🪙 3🧍 2🏞️; the age's
  government, drawback still deferred per IDEAS).
  - **Balance watch (open):** the in-mission population lever is thin — House and City are *this
    mission's own rewards*, so while playing it the only population source is **Hut (+1, one-shot,
    costs a territory slot)**. On Settlement (pop 2 / territory 2) or Chiefdom (pop 3 / territory 0),
    hitting 6 leans hard on **Conquest** chains (military → territory) to open building slots for more
    Huts while Farms compete for those same slots and 6 pop eats 6🌾/round. So 6 may be *structurally*
    steep, not just a high number — verify winnability with a sim sweep before locking the target (or
    consider unlocking a population producer upstream). Tune target + House/City-Walls costs + Influence
    (all provisional) from there.
- **Step 7 — Copper (Finding Copper)** ✅ (shipped + balanced) — the Bronze Age's opening mission,
  opened by gobekli (`prereqs: ['first_temple']`, bronze col 5). Mine all 3 copper-vein events
  (2🔨+5🔬 each, played → `removed`) under the Failing Stone Tools threat (−1🔨 per round per worker
  staffed *in a building*; work cards exempt). Unlocks the **Forge** (building, 4🔨, 2🔨/worker —
  deliberately obsoletes Toolmaking). Balance confirmed by simulation + hand-play — the works-are-exempt
  trade (a works-only deck can dodge the drain) is intended, not a leak.

## Jot — `permanentDelta` comment/code mismatch (which side is authoritative?)

`sim/value.ts`'s `permanentDelta` comment says it drops the *transient* contributors — "the work zone
… **and the hand** (an unplayed event's drain is hand-contingent, not permanent)" — but the code only
sets `clone.workZone = []`. It still runs `applyUpkeep`, whose `resolveHandEvents` fires any unplayed
`event`'s `upkeep`, so a hand event's drain **does** land in the band-3 permanent buffer. Either the
comment is stale (add `clone.hand = []` to match it) or the code is intended and the comment is wrong.
A band-3 (survival-buffer) question, not a perf one — decide which is authoritative. Found while
profiling the oracle's clone cost (the two `scoreState` projections).

## Jot — Writing tablet cost mismatch (needs a call: which side is authoritative?)

`missions.ts` `writing.victoryHint` promises "pay 3 🔨 and 2 🌾 for each" tablet, but `cards.ts`'s
`clay_tablet` costs `{ production: 6, food: 2 }`. Over `CLAY_TABLETS` = 5 that is 30🔨 vs the 15🔨 the
player is told to budget. Either the hint went stale when the tablet escalated, or 6 is the typo —
unknown which, so no fix applied. Found while baselining `writing` for the strategic-valuation work
(the mission is mid-balance and has no committed baseline fixture yet).
