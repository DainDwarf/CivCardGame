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
  3. **Accounting** — mechanics DONE (balance pending; see *Done / shipped*). **Writing** (+ optional
     Hammurabi leaf) remains — the literacy half of the spine.
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
  - **Writing** → **Library/scribe** (science + hand-size building — DESIGN's worked example). Optional
    leaf **Hammurabi's Code** off here (law/culture — a sticker or stability card, not a wonder).
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

- **Unsaved-changes warning on leaving the deck editor** — if the player has made edits in `DeckEditor.tsx`
  that aren't saved, prompt/confirm before discarding them on exit. `[?]` `[phase: 4]`
- **Pre-Stone-Age chronology gutter** — a purely visual, unreachable band *before* the Stone Age on the
  campaign map (no missions, no nodes — decoration only), so history reads as an ever-extending timeline
  the player emerged out of rather than starting at a hard left edge. Looks only. `[?]` `[phase: 4]`
- **Per-pip worker drag** — independent per-pip *drag* (drag a specific pip to another box); box-level
  worker drag still moves one worker at a time. Deferred follow-up from the shipped multi-pip staffing UI. `[?]` `[phase: 4]`
- **Bulk-move modifier for worker transfers** — a modifier (e.g. shift-drag) to move N workers from one building to another in one gesture, instead of one pip-drag per worker. Now unblocked (multi-pip staffing exists). `[size: S] [?]` `[phase: 4]`
- **Re-polish the victory / gameover screens + flow** — revisit the end-of-run overlay and the transition back to the meta loop now that missions grant real rewards: the win/loss screen should surface what the run earned (Influence, any unlocks) and read well for both outcomes, and the hand-back-to-meta flow should feel finished rather than functional. `[?]` `[phase: 4]`
- **BoardMini: color starting numbers vs. a baseline** — on the board widget, tint each starting counter relative to a baseline (probably the average of all boards): above baseline → green with an up-arrow, below → red with a down-arrow; a 0 against a 0 baseline greys out/ghosts. Makes a board's strengths/weaknesses legible at a glance. `[?]`
- **Work reordering + insert-at-drop** — let the player reorder placed work cards, and have a newly-played
  work card insert at the drop position rather than appending. `[?]`
- **Sticker locked/unlocked visual on mission preview** — rework how a mission's sticker reward reads locked vs. unlocked (currently a generic locked chip → real face). Maybe extract a **shared sticker widget** (the `CardFace`/`BoardMini` counterpart for a single sticker) reused across the mission-detail preview and elsewhere. `[?]`

## Tech debt / architecture

- **See if the objective `OVERRIDES` can be removed** — the per-mission progress-gradient overrides in
  `sim/objective.ts` (e.g. Masonry crediting territory) were kept as a **bring-up safety net** while the
  planner landed. Now that `sim/enablers.ts` derives conversion slopes mechanically from card `cost`→
  `produces`, check whether the planner still needs the overrides — retire any the enabler layer subsumes.
  Watch the structural couplings the overrides encode (Huts need a free territory slot, so
  territory↔population); confirm nothing regresses via the planner Masonry integration test + a sim sweep. `[size: M] [?] [phase: 4]`
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

- Pet the doggo

---

## Done / shipped

> Completed items move here (newest first) so the backlog stays current but nothing
> silently vanishes. Everything through **v0.0.4 (Stone Age arc)** has been moved to
> [`CHANGELOG.md`](../CHANGELOG.md); this section restarts empty for the rest of Phase 4.

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
  Masonry row 1). No threats/events. Unlocks the **House** (building, 8🔨, +2🧍 one-shot like a bigger
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
