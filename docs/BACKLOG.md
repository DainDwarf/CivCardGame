# CivCardGame — Phase 4 Content Backlog

> The **Phase 4 content roadmap** — the mission arcs (Bronze, Iron) and their planned cards,
> stickers, and boards, plus the tutorial-onboarding layer. Longer-lived than [`TODO.md`](TODO.md)
> (which holds *transversal* bugs / improvements / features): this persists across the whole content
> push, and the **status board** below tracks each mission through Design → Implement → Balance →
> Polish. Each mission's live detail lives in its dossier (`docs/missions/<name>.md`).
>
> **Lifecycles:** decided design graduates to [`DESIGN.md`](DESIGN.md); a mission graduates to a
> one-line [`CHANGELOG.md`](../CHANGELOG.md) entry (drawn from its dossier) once **all four stages**
> are done. Narrative/age framing candidates live in [`IDEAS.md`](IDEAS.md).

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
  Balance via simulator. `[size: L]` `[?]`

  **The arc (DAG).** Göbekli Tepe is the Stone-Age anchor (where we come from), not a Bronze node:

  ```
                   ┌─→ Copper ──┐                        ┌─→ Wheel+roads (×2) ─┐
  Göbekli Tepe ────┤            ├─→ Accounting ─→ Writing ┼─→ Horse (×2) ───────┼─→ Bronze ─→ Sword & chariot ─→ The Sea Peoples
   (Stone anchor)  └─→ Masonry ─┘                    │    └─→ Naval (×2) ───────┘                                   (capstone)
                        │                            │                                                                   │
                   (leaf) Pyramid            (leaf) Hammurabi's Code                                  unlocks infinite → Fall of the Bronze Age
  ```

  **Status board** — the index; each mission's *detail* lives in its dossier
  (`docs/missions/<name>.md`), this table is the glance. Stages: **Design** (number-less form
  converged) · **Implement** (code + content, provisional numbers) · **Balance** (sim + feel-play) ·
  **Polish** (card text, art, lore). Legend: ✅ done · 🟡 in progress/pending · ⬜ not started.

  | Mission | Dsn | Impl | Bal | Pol | Dossier |
  |---|:-:|:-:|:-:|:-:|---|
  | Copper | ✅ | ✅ | ✅ | ⬜ | [copper](missions/copper.md) |
  | Masonry | ✅ | ✅ | 🟡 | ⬜ | [masonry](missions/masonry.md) |
  | Pyramid *(leaf)* | ✅ | ✅ | 🟡 | ⬜ | [pyramid](missions/pyramid.md) |
  | Accounting | ✅ | ✅ | 🟡 | ⬜ | [accounting](missions/accounting.md) |
  | Writing | ✅ | ✅ | 🟡 | ⬜ | [writing](missions/writing.md) |
  | Hammurabi's Code *(leaf)* | 🟡 | ⬜ | ⬜ | ⬜ | — |
  | Roads | ✅ | ✅ | ✅ | ⬜ | [roads](missions/roads.md) |
  | Wheel | ✅ | ✅ | 🟡 | ⬜ | [wheel](missions/wheel.md) |
  | Horse taming | ✅ | ⬜ | ⬜ | ⬜ | [horse-taming](missions/horse-taming.md) |
  | Raiding | ✅ | ⬜ | ⬜ | ⬜ | [raiding](missions/raiding.md) |
  | Naval (×2) | 🟡 | ⬜ | ⬜ | ⬜ | — |
  | Bronze *(convergence)* | 🟡 | ⬜ | ⬜ | ⬜ | — |
  | Sword & chariot | 🟡 | ⬜ | ⬜ | ⬜ | — |
  | The Sea Peoples *(capstone)* | 🟡 | ⬜ | ⬜ | ⬜ | — |
  | Fall of the Bronze Age *(infinite)* | 🟡 | ⬜ | ⬜ | ⬜ | — |

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
  1. **Copper** — DONE (see [`missions/copper.md`](missions/copper.md)).
  2. **Masonry** — mechanics DONE (balance pending; see [`missions/masonry.md`](missions/masonry.md)). Optional **Pyramid** leaf — mechanics DONE (balance pending; see [`missions/pyramid.md`](missions/pyramid.md)).
  3. **Accounting** — mechanics DONE (balance pending; see [`missions/accounting.md`](missions/accounting.md)). **Writing** — mechanics
     DONE (balance pending; see [`missions/writing.md`](missions/writing.md)). The optional **Hammurabi's Code** leaf off Writing
     remains — the last piece of the literacy half.
  4. **Wheel+roads (×2)** first (now the **expansion/territory** branch — repositioned from the money
     identity; see the reward proposal below). **Roads** — mechanics DONE (balance pending; see
     [`missions/roads.md`](missions/roads.md)). **Wheel** — mechanics DONE (balance pending; see [`missions/wheel.md`](missions/wheel.md)).
  5. **Horse (×2)**, **Naval (×2)**.
  6. **Bronze** convergence → **Sword & chariot** → **capstone + infinite**.

  **Mechanical identity `[?]`:** IDEAS frames the age as "trade-dependent palace civilizations" → the
  throughline is the **money economy** (underused in the Stone Age). Trade branches produce 🪙; Bronze
  consumes 🪙 (tin trade) for superior 🔨/⚔️. (Update: **Wheel+roads** has since been repositioned to
  *expansion/territory* rather than a 🪙 faucet — Naval + Trader carry the trade-money supply.)

  **Per-node reward proposals** — unbuilt nodes only; shipped nodes live in the status board +
  their dossiers. All `[?]` unless decided:

  - **Hammurabi's Code** (optional leaf off Writing) → law/culture: a sticker or stability card, not a
    wonder. Still to author.
  - **Horse taming → Raiding (×2, military branch)** — the **predatory money faucet** (military→money via
    raiding; Naval's aggressive twin). M1 rewards the **War Horse** (work, staffed → +⚔️/round) + the
    **Raiding** action (⚔️→🪙); M2 rewards the **Chiefdom → Warband** board upgrade (military+money,
    Chiefdom's low-territory/high-pop shape; needs a Chiefdom rebalance first). Draft/traction horse
    dropped; mounted cavalry stays *out* (Iron Age). Both missions' goal + pressure are now converged
    (design-complete). See [`missions/horse-taming.md`](missions/horse-taming.md) +
    [`missions/raiding.md`](missions/raiding.md).
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
  `[size: L]` `[?]`
  - Iron Age mission arcs — structure as 2–3 parallel quest lines (branching DAG paths, echoing how the Stone Age forks Rites & Rituals / Reading the Seasons after Growing Numbers), themed around distinct early civilizations:
    - Roman Empire — a military/expansion-leaning line
    - China — a distinct cultural/technological line
    - Central Arabia (maybe) — a trade/desert line, tentative third branch

- **Step 9 — Tutorial onboarding UI** — the scripted popups/indicators layer over the
  **Stone Age** arc (the sole tutorial age), so new mechanics aren't dumped on the player at
  once. "Tutorial seen" state belongs in device-local `Settings` (`meta/settings.ts`), **not**
  `PlayerStore` (not game progress). Mild tension with the anti-surprise unlock convention
  (tutorials reveal; unlocks surprise). `[size: L]` `[?]`

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

> A pool to draw from while authoring the age arcs; each will land in whichever age's mechanics
> fit.

- Building that changes hand size (e.g. +1 card drawn per round) `[?]`
- Card that gives a draw when expanding territory `[?]`
- Card effects that trigger on discard / on draw, to enable combos `[?]`
