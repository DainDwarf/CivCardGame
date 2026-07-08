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

## Phase 3 — planned steps (economy & progression)

> The Phase 3 design is locked in [`DESIGN.md`](DESIGN.md) (*Economy & progression*); this is
> the actionable cut, held here for later sessions. Suggested order: 1 → 2 & 3 → 4 → 5 → 6 → 7 → 8
> (Steps 0, 1, 2, and 3 are **done**). **Steps 1+2+3+4 form a playable spine** — unlock cards from
> missions, own copies, build capped decks — before the map/shop UI (Step 5) lands.
> Pre-alpha: **no save migration**, replace the store shape freely.

- **Step 1 — Ownership & currency core** ✅ done — see *Done / shipped* below. `[phase: 3]`
- **Step 2 — Deck-editor copy caps** ✅ done — see *Done / shipped* below. `[phase: 3]`
- **Step 3 — Mission model + campaign-map data** ✅ done — see *Done / shipped* below. `[phase: 3]`
- **Step 4 — Reward computation + run-end wiring** ✅ done (standard-mission half) — see
  *Done / shipped* below. `[phase: 3]`
- **Step 5 — Meta UI: map + shop** — Influence display in the nav ✅ done (see
  *Done / shipped* below); the rest is split into substeps. `[phase: 3]`
  - **Step 5.1 — Campaign Map screen** — ✅ done — see *Done / shipped* below. `[size: M]` `[phase: 3]`
  - **Step 5.2 — Shop** — ✅ done — see *Done / shipped* below. `[size: M]` `[phase: 3]`
  - **Step 5.3 — Mission detail panel** — ✅ done — see *Done / shipped* below. `[size: M]` `[phase: 3]`
- **Step 6 — Infinite missions** — endless, replayable missions that never win and pay
  Influence = rounds survived. Cut into substeps; suggested order **6.1 → 6.2 → 6.3a → 6.3b → 6.3c**.
  `[phase: 3]`
  - **Step 6.1 — Non-fixed (dynamic) card effects** — ✅ done — see *Done / shipped* below.
    `[size: M]` `[phase: 3]`
  - **Step 6.2 — Infinite-mission plumbing + campaign UI + scoring** — ✅ done — see
    *Done / shipped* below. `[size: M]` `[phase: 3]`
  - **Step 6.3a — Threat zone (pure core)** — ✅ done — see *Done / shipped* below.
    `[size: S]` `[phase: 3]`
  - **Step 6.3b — Threat UI + Long Winter's food drain as a real threat card** — ✅ done — see
    *Done / shipped* below. `[size: M]` `[phase: 3]`
  - **Step 6.3c — Creeping Decay infinite mission** — ✅ done — see *Done / shipped* below.
    `[size: M]` `[phase: 3]`
- **Step 7 — Card stickers** *(last, deepest)* — permanent per-copy card buffs bought with Influence
  (DESIGN.md *Economy & progression*: "a card sticker buffs a *single owned copy* forever"). **Design
  settled in discussion (2026-07-07):** model the meta collection as **uniform card instances** — every
  owned copy is an identified `CardInstance` and decks reference copies by instance id — rather than
  lazily minting identity only when a sticker is applied. Rationale: with uniform instances, stickering
  is a pure *in-place mutation of one instance that touches nothing else* — no bare-count→instance
  conversion, so no deck reconciliation and no way to duplicate a copy by forgetting a branch (the trap
  the first attempt hit: the deck already held both farms, was unaware of the sticker, and a stickered
  3rd farm slipped past the 2-copy cap). Every deck referencing that instance sees the sticker for free
  (single source of truth); the "which of my two farms gets it, the decked one or the shelf one?"
  ambiguity is resolved by an explicit per-instance pick (7.3) over stable, ordered identities (7.4).
  The run boundary still deep-copies each meta instance into a fresh run `CardInstance` (run `counters`
  mutate and must never persist back). The precursor is already **done** (Stage 4 of the resolver
  rewrite): pile cards are `CardInstance`s with per-copy state (`counters`). Suggested order 7.1 → 7.9
  (7.7/7.8/7.9 added 2026-07-07, after 7.6 shipped — polish/expansion, not required for the core loop).
  `[size: L]` `[phase: 3]`
  - **Step 7.1 — Bounded copy tiers (drop `'unlimited'`)** — ✅ done — see *Done / shipped* below.
    `[size: S]` `[phase: 3]`
  - **Step 7.2 — Uniform meta card instances** — ✅ done — see *Done / shipped* below.
    `[size: L]` `[phase: 3]`
  - **Step 7.3 — Collection per-instance view** — ✅ done — see *Done / shipped* below.
    `[size: M]` `[phase: 3]`
  - **Step 7.4 — Ordered deck assignment** — ✅ done — see *Done / shipped* below.
    `[size: M]` `[phase: 3]`
  - **Step 7.5 — Card stickers in the meta (not yet in the run)** — ✅ done — see *Done / shipped*
    below. `[size: M]` `[phase: 3]`
  - **Step 7.6 — Card stickers in the run loop** — ✅ done — see *Done / shipped* below.
    `[size: M]` `[phase: 3]`
  - **Step 7.7 — Raise the sticker cap to 2 per instance** — ✅ done — see *Done / shipped* below.
    `[size: S]` `[phase: 3]`
  - **Step 7.8 — Add Irrigation sticker** — ✅ done — see *Done / shipped* below. `[size: S]` `[phase: 3]`
  - **Step 7.9 — Sticker UI: per-sticker icons, bottom-left badge, effective values everywhere** —
    four related gaps left after 7.5/7.6:
    1. **Distinct icons** ✅ done — see *Done / shipped* below.
    2. **Bottom-left placement** ✅ done — see *Done / shipped* below.
    3. **Meta screens show effective values too** ✅ done — see *Done / shipped* below.
    4. **Loop cards stay visibly stickered** ✅ done — see *Done / shipped* below.
- **Step 8 — Board stickers** — ✅ done — see *Done / shipped* below. `[size: M]` `[phase: 3]`
- **Step 9 — Meta UI rework** — a multi-part pass over the meta screens now that the
  economy (Steps 1–8) is in place; cut into substeps. Only ordering constraint is **9.1 → 9.2**
  (9.2 reworks the detail view 9.1 fuses into); 9.3/9.4/9.5 are independent of each other and of
  9.1/9.2. `[phase: 3]`
  - **Step 9.1 — Fuse Shop into Collection** — ✅ done — see *Done / shipped* below.
    `[phase: 3]`
  - **Step 9.2 — Collection UI rework + card upgrades** — ✅ done — see *Done / shipped* below.
    `[phase: 3]`
  - **Step 9.3 — Board UI rework** ✅ done — see *Done / shipped* below.
  - **Step 9.4 — Mission lore and select rework** — includes the now-folded-in "Barbarian
    Tide's lore should show the Barbarian card" ticket: `MissionDetailPanel` only shows the
    mission's *reward* card face today; its lore column should also preview the mission's
    own threat/event card (Barbarian Tide's Barbarian, Long Winter/Long Decline's threats),
    since that's the card the mission is actually about. `[size: S]` `[?]` `[phase: 3]`
  - **Step 9.5 — Stats UI rework** — `Stats.tsx` is currently a plain list of run-result rows
    (shell-only, shipped with Phase 2 step 6); revisit its look once there's more to show
    (rewards, trends across runs). `[?]` `[phase: 3]`

## Phase 4 — planned steps (content & balance)

> Phase 4 is content expansion + balance tuning with the headless simulator (see
> [`DESIGN.md`](DESIGN.md) *Build roadmap*). It kicks off with tutorial onboarding, since new
> content is what a new player meets first.

- **Step 1 — Tutorial missions** — the first few meta missions double as tutorials,
  introducing mechanics progressively; tutorial entry-node missions on the map. Covers
  designing several missions, onboarding indicators/popups, and careful pacing so new
  mechanics aren't dumped on the player all at once. Rough pacing: the starting deck holds
  only `work`/`action` cards, no buildings — mission 1 unlocks the first buildings (House,
  Farm, Workshop); mission 2 introduces territory limitation (and maybe conquest?) alongside
  them. Goal is to reach a certain population. Unlocks culture stuff. Mission 3 explains culture, goal to reach culture lvl2. `[size: L]` `[?]` `[phase: 4]`

## Meta loop (`src/meta/`)

- **End-of-Phase-3 cleanup: simplify save parsing, not remove it** — `meta/store.ts`'s `SCHEMA_VERSION`/`exportSave`/`importSave` plumbing stays (still the real save/load-file mechanism); what should go is `parsePlayerStore`'s per-field *leniency* (the decks-missing fallback, the field-by-field shape checks written to tolerate a store that predates some Phase 3 field). Once Phase 3 ships, assume every save in the world is already Phase-3-shaped — pre-alpha players are told to clear their save regularly — so `parsePlayerStore` can go back to a plain "does this parse as a `PlayerStore`" check instead of carrying per-field pre-Phase-3 fallbacks. `[phase: 3]`
- **Available-upgrade hints (cards · nav tabs · boards)** — surface, *without* the player opening
  every detail view, where Influence can still be usefully spent. Deferred out of **Step 9.2** (which
  shipped the card detail view but no at-a-glance affordability hints); split into three layers that
  should share one "is an upgrade available here, and can I afford it?" predicate rather than three
  bespoke checks:
  - **Card tiles** — a card's Collection grid tile/group hints when it has an available upgrade (a
    buyable copy tier, or a copy with a free sticker slot for an *applicable + affordable* sticker),
    so the player needn't open each card.
  - **Board tiles** — the Board-tab equivalent: a `BoardMini` hints when the board can still take an
    *applicable + under-cap + affordable* board sticker (mirrors the card-tile hint; the same
    `isValidTarget` shape the `BoardMenu` drag already computes).
  - **Nav-tab badges** — a small marker on the `MetaMenu` nav tabs (Collection, Board) when *anything*
    inside is upgradeable-and-affordable, so a fresh Influence balance advertises where it can go
    without visiting every screen. Roll up the per-tile predicate above.

  Open design question: should a hint mean "an upgrade *exists*" or the stricter "upgrade exists *and*
  you can afford it right now"? Affordable-only avoids nagging with buys the player can't make, but
  flickers as Influence crosses a price; decide when picking this up. `[size: M]` `[?]` `[phase: 3]`

## Cards & content (`src/content/`)

- **Remove Settlers, replace with a Hut building** `[?]` `[phase: 4]`
- **Disasters — expand** — the `event` card mechanic shipped (see `CHANGELOG.md`); grow it out with more disaster types beyond the Barbarian and missions that inject them (details TBD) `[?]` `[phase: 4]`
- New mission type: "Metropolis" `[?]` `[phase: 4]`
- New mission: "Build the Wonder" `[?]` `[phase: 4]`
- Culture-based missions (depend on the Culture resource) `[?]` `[phase: 4]`
- Building that changes hand size (e.g. +1 card drawn per round) `[?]` `[phase: 4]`
- Resources transformation? Like a building that transforms production into science for example `[phase: 4]`
- **Age tag on cards** — tag each card with the age it unlocks in, so the player can sort/filter by age `[?]` `[phase: 4]`
- **Foresight corner case: empty draw pile silently wastes the card** — `content/cards.ts`'s Foresight resolver does `G.deck.slice(0, 3)` and bails on `length === 0` without reshuffling, so playing it with an empty deck (but a full discard) pays its 1🌾science, files to discard, and does *nothing* — no peek, no feedback — contradicting its own "Peek the top 3" text. `unplayableReason` (`rules/playability.ts`) has no draw-pile gate, so nothing stops the play. Fix depends on the eager-reshuffle item above (once `G.deck` is empty only when the discard is too, Foresight's `slice` sees the real pile); then **also handle the deck-AND-discard-both-empty case** — either gate the card as unplayable then (add an `UnplayableReason` kind, mirroring `noBuildingsToDestroy`) so it can't be wasted, or let it peek/draw fewer than 3 gracefully. Decide which; a hard gate matches the existing "don't let a play fizzle for nothing" precedent. `[size: S]` `[phase: 3]`

## UI (`src/components/`)

- **Multi-pip staffing UI** — once a building can require 2–3 workers, its box needs one pip per worker slot (not the current single staff-toggle icon), so partial staffing is visible and each pip can be dragged independently. Follow-up to the now-shipped building→building worker drag; blocked on a multi-worker building actually existing (see [[multi-worker-buildings-roadmap]]). `[size: M] [?] [blocked]` `[phase: 4]`
- **Bulk-move modifier for worker transfers** — a modifier (e.g. shift-drag) to move N workers from one building to another in one gesture, instead of one pip-drag per worker. Only pays off once multi-pip staffing (above) exists. `[size: S] [?] [blocked]` `[phase: 4]`
- **Stable card ordering across views** — cards currently "move around" when adding/removing in the deck editor (and potentially other card grids); pick a sensible, stable sort order (by kind? cost? catalogue order?) and apply it consistently everywhere cards are listed — collection, deck editor picker/banner, pile viewers. `[size: S] [?] ` `[phase: 3]`
- **BoardMini: color starting numbers vs. a baseline** — on the board widget, tint each starting counter relative to a baseline (probably the average of all boards): above baseline → green with an up-arrow, below → red with a down-arrow; a 0 against a 0 baseline greys out/ghosts. Makes a board's strengths/weaknesses legible at a glance. `[?]`

## Game design & balance

- Card that gives a draw when expanding territory `[?]` `[phase: 4]`
- Card effects that trigger on discard / on draw, to enable combos `[?]` `[phase: 4]`
- **Minimum deck size — 20 cards** — enforce a floor on deck size (mirrors the existing
  `MAX_DECKS` cap precedent — a core rule enforced at the deck writer, not just a UI gate);
  also means adjusting `content/decks.ts`'s starter deck up to 20 cards to satisfy it.
  `[phase: 4]`
- **Default hand limit — 4 instead of 5** — lower the base starting hand size from 5 to 4.
  `[phase: 4]`

## Tech debt / architecture

_(none open)_

---

## Rejected

> Considered and turned down — kept (not deleted) so we don't re-litigate the same idea
> without new information.

- **Ignore worker assignment in the undo list** — assign/unassign worker moves would skip pushing undo snapshots, so undo only steps through "meaningful" turn actions. Tried it (a `quietMove` action updating `present` without touching `past`), then reverted: having worker reassignment silently bundled into the prior card-play's undo step is confusing to the player, while the alternative — reconciling worker state done in the "present" back onto a restored past snapshot — is deeply error-prone (instance-count and population-total edge cases). For now, worker reassignments stay part of the regular undo list; revisit if a cleaner solution presents itself.
- **UI size via `document.documentElement.style.zoom`** — tried a Config-submenu slider applying CSS `zoom` to the document root, on the theory that a root-level zoom would keep everything (including `Board.tsx`'s pointer-drag math) internally consistent, the way real browser zoom does. It doesn't: CSS `zoom` doesn't rescale the viewport that `clientX`/`clientY`/`getBoundingClientRect()` are reported against, so raw pixel values captured from those and written back into inline styles (drag/slotDrag/workerDrag clone positions, the ghost clone, the drop-zone position, the gamearea/gameover-pill insets) get re-zoomed a second time on render. Patched that specific issue with a `px()` real→local conversion helper at each of those six call sites (confirmed fixed at 130% — drag clones tracked the cursor correctly). But testing then surfaced a second, broader problem: run-screen layout broke anyway — building slots sliding under the resource banner, background color bleeding past the bottom hand bar — because `Board.tsx` also leans heavily on `position: fixed` elements, which a root-level zoom interacts with in ways the `px()` patch doesn't cover. Reverted entirely (settings.ts's `uiScale` field, the `App.tsx` zoom effect, `Board.tsx`'s `px()` helper and its six call sites, the GameMenu slider UI). See *UI size setting* above for what a real attempt would need to account for.

## Done / shipped

> Completed items move here (newest first) so the backlog stays current but nothing
> silently vanishes. Everything through **v0.0.2 (end of Phase 2)** has been moved to
> [`CHANGELOG.md`](../CHANGELOG.md); this section restarts empty for Phase 3 onward.

- **Objective cards moved onto the event bus** — win/lose is now entirely **bus-written flag-reads**,
  the last reactive concern that was still polled. The objective card still owns its win via the
  pure-read `objective.met` hook, but `rules/objective.ts`'s new `evaluateObjective` re-derives it into
  `G.pendingVictory` (the victory counterpart to a threat's `G.pendingDefeat`) at the **tail of every
  `flushEvents`** — so the flag is fresh before every `checkEndIf`, even on a flush that dispatched no
  events (e.g. a round-based win at `beginTurn`). `checkEndIf` collapsed to reads only
  (`pendingVictory` → `coreCollapse` → `pendingDefeat`; precedence preserved so a round-12 goal still
  beats the Stagnation deadline). Chose `flushEvents`-tail over `dispatchEvent`-tail (runs
  unconditionally, once per flush) and behavior-preservation over `endTurn`-only (which would delay
  mid-turn threshold wins and structurally break `barbarian_tide`, whose 4th wave files to `removed`
  *after* the upkeep broadcast). The unused `objective.failed` hook was **dropped** (a driven defeat is
  a threat's job) — removed from the hook type, `objectiveFailed`, and its ~5 dead test assertions.
  Docs synced (`CLAUDE.md`, `DESIGN.md`, `state.ts`/`cards.ts`/`missions.ts` inline). New bus-path unit
  tests in `missions.test.ts`; the `engine.test.ts` win/defeat integration tests carried over unchanged
  (they now exercise the flag path). Followed
  `.claude/plans/refactor-the-objective-cards-fizzy-dijkstra.md`. `[size: M]` `[phase: 3]`

- **Enlightenment deadline as a threat that owns its own defeat** — the mission's
  currently-invisible round-12 deadline is now a real, visible **threat card, Stagnation**
  (`content/cards.ts`, `kind: 'threat'`), seeded via the `enlightenment` mission's new `setup`
  (`addThreat`) like Long Winter's Harsh Winter. It renders the live countdown in the board threat
  zone (`dynamicText`: `Round n/12` — the deadline is its concern; the science tally stays on the
  Enlightenment objective card) and **owns the gameover itself**: its `on.endTurn`
  handler sets `G.pendingDefeat = { reason: 'stagnation' }` once round 12 ends short of 30 Science,
  which `run/engine.ts`'s `checkEndIf` already polls as a defeat — no engine/objective predicate.
  The old `enlightenment_goal.objective.failed` predicate was removed (the objective now owns only
  the win); `Board.tsx`'s `COLLAPSE_MESSAGES` gained a `stagnation` line for the gameover overlay.
  Timing hinges on threats dispatching **last** in `dispatchEvent` (after production), so hitting 30
  via round-12 upkeep still wins (`objectiveMet` is polled before `pendingDefeat`). `on.endTurn` (a
  round passing) is the trigger, not `resourceChange`. Since this left `objective.failed` with zero
  users, its "e.g. a deadline" example (in `cards.ts` + `rules/objective.ts`) was re-pointed to the
  threat/`pendingDefeat` pattern; the hook stays as a documented, still-polled seam (tested via
  `barbarian_tide`). Covered by the rewritten `content/missions.test.ts` enlightenment block
  (`dispatchEvent`-driven, mirroring the Long Winter / Long Decline threat tests); the
  `pendingDefeat` → defeat wiring was already proven at `run/engine.test.ts`. Followed the approved
  plan `.claude/plans/now-that-the-event-polished-crescent.md`. `[size: M]` `[phase: 3]`

- **Event-bus / trigger layer for card effects** — the general trigger layer so a card can react
  to an event whose *timing it doesn't own* (on-draw, on-discard, on-resource-threshold), via a
  `CardDef.on?: { draw?/discard?/resourceChange?: Resolver }` handler run through the *existing*
  `resolveCard`/`EffectContext` spine (extended with `ctx.event`) — no new bespoke branches in
  moves/upkeep. New `rules/events.ts`: sites **emit** (`emitEvent` → push to `G.events`, at a
  semantic site as a step runs — a `draw` in `deck.ts`, a `discard` *with its reason* at each
  discard site); step boundaries **flush** (`flushEvents(G, before)` in `applyMove`/`beginTurn`/
  `endTurn`/`applyUpkeep`) — synthesize a `resourceChange` from a before-snapshot, then drain
  `G.events` to `dispatchEvent`, cascade-capped by `MAX_EVENT_CASCADE`. Dispatch runs `on[type]` on
  the event's *subject* (self-triggered) + every operating tableau building & threat (observer,
  reusing production's `isOperating` gate), fixed order for determinism. **Uniform queue on `G`**,
  always drained to `[]` in a committed/undo state (so structuredClone/undo/determinism untouched).
  Added the **declare-defeat** capability (`G.pendingDefeat`, polled by `checkEndIf`) that unblocks
  the Enlightenment-threat ticket above. Proven with three real deckable cards (Scriptorium on
  effect-draw, Salvage on-discard-sacrifice, Treasury on-10-threshold) + a full unit suite (`events.test.ts`,
  plus engine/upkeep integration incl. projection reachability). Followed the approved plan
  `.claude/plans/we-are-opening-a-magical-teapot.md`. `[size: L]` `[phase: 3]`

- **Phase 3 Step 9.2 — Collection UI rework + card upgrades** — reworked `meta/CardInstancePanel.tsx`
  (the fused detail view Step 9.1 created) from a text row-list into the **Board tab's model**: each
  owned copy now renders as a real `CardFace` (its `effectiveCard` sticker-adjusted numbers + bottom-left
  sticker badge) in a grid, beside a right-side **sticky tray**. The tray's pinned top carries the
  Influence balance + the **buy-next-copy-tier button** (pinned at top per request); below it, one
  draggable sticker badge per sticker that `stickerAppliesTo` the card (badge styled like the on-card
  `StickerRow` one, just larger — the same shared tokens `BoardMenu`'s tray uses). Stickers are now
  bought+applied by **drag-and-drop** — dragging a badge out of the tray onto a copy buys and attaches
  it in one gesture, replacing Step 7.5's separate attach sub-mode (`pickingStickerId` and the per-copy
  Attach buttons are gone). A hand-rolled pointer-drag mirroring `BoardMenu.tsx` (no DnD library) with a
  single `isValidTarget(inst, sticker)` predicate (`!isStickerFull · affordable`) gating both the
  mid-drag highlight and the drop; stacking the same sticker twice (1→2) stays a valid target, and an
  invalid/missed drop no-ops. The Step 7.3 **anti-surprise** info survives the visual change: each face
  keeps a caption naming the deck(s) that copy sits in ("1/2 · in Aggro" / "1/2 · unused") via
  `decksContaining`, so a sticker still lands on a *known* copy. Clicking a copy (not dragging onto it)
  still zooms it (`CardZoomOverlay` with the copy's `effectiveCard`/stickers). The drag clone's layer is
  `z-index: 90` — **above** the modal backdrop (75), unlike `BoardMenu`'s non-modal 60, so it renders
  over the panel. `uiScale` is now threaded `MetaMenu → Collection → CardInstancePanel` for the clone's
  visual→local px conversion (the transform:scale() invariant). No rule logic changed — existing suite
  green (310 tests). **Deferred out of this step** into its own backlog item (*Meta loop* →
  "Available-upgrade hints"): the at-a-glance "upgrade available" affordances — on Collection card
  tiles, on Board-tab boards, and as nav-tab badges — so the player needn't open each detail view to
  find where Influence can go.

- **Phase 3 Step 9.1 — Fuse Shop into Collection** — the standalone card **Shop** tab is gone; its
  two abilities (buy the next copy tier · attach a sticker to a chosen instance) now live in
  Collection's per-card detail view, `meta/CardInstancePanel.tsx`. Collection gains an optional `shop`
  bundle (`influence`/`onBuyTier`/`onAttachSticker`, already flowing from `App.tsx` via `MetaMenu`)
  that it forwards to the panel; the panel shows the Influence balance, a buy-next-tier button
  (`nextTier`), and one sticker-offer button per `stickerAppliesTo` sticker (gated on some copy still
  having room). Picking a sticker drops into an *attach sub-mode* that reuses the panel's existing
  per-copy attach rows (the old external `attach` prop, whose only caller was Shop, folded into an
  internal `pickingStickerId`); "← Back" or a successful attach returns to browse. `rules/shop.ts`
  stays (the copy-tier economy); only `meta/Shop.tsx` + `Shop.module.css` and the Shop nav entry were
  deleted — the meta shell is now five tabs. No rule logic changed (existing suite green). Deferred to
  Step 9.2 (the full detail-view rework into real `CardFace`s + a drag-drop sticker tray, the Board
  tab's model): a per-tile "upgrade available" affordance so the player needn't open each card to
  discover it's buyable.

- **Phase 3 Step 9.3 — Board UI rework** — the board-select/launch UI equivalent now that Step 8's
  board stickers exist; replaces Step 8's interim `Shop.tsx` Boards section with an in-place Board
  menu. Shipped in three substeps:
  1. **Move boards to their own tab** — a new **Board** nav tab (`meta/BoardMenu.tsx`) lifting the
     interim, button-based Boards buy surface out of `Shop.tsx`; no game logic changed. The single
     navbar Influence badge (`MetaMenu.tsx`) covers every screen, so per-screen Influence counts
     were dropped (Shop's, then the Board page's).
  2. **Mini-boards** — `components/BoardMini.tsx` (+ `.module.css`) is a reusable, read-only,
     board-agnostic miniature of the run board (tinted ground · a top banner of starting counters ·
     the territory slot grid · bottom-left sticker badges · a bottom-right name pill), driven off
     `effectiveBoard` so its numbers match a launched run. Presentational only (no `GameContext`/
     logic), so mission-select can reuse it later.
  3. **Drag-drop sticker tray** — available board stickers sit in a right-side tray pinned beside
     the boards (sticky within the meta scroll area, not `position: fixed` — UI-scaling invariant),
     each a box: a draggable sticker badge (styled like the on-board one via the shared StickerRow
     tokens, just larger) + name on top, effect + price below. Dragging a badge onto a board
     buys+attaches in one gesture (a hand-rolled pointer-drag like `DeckEditor.tsx`, no DnD
     library). A single `isValidTarget` predicate (applies · under the cap · affordable) gates both
     the mid-drag highlight and the drop; an invalid/missed drop no-ops. Replaced the interim
     per-board buy `<button>`s.

- **Phase 3 Step 8 — Board stickers** — the board counterpart to card stickers, and the *easy*
  half (a board is singular, so no per-instance identity question — entirely independent of Step 7's
  collection rework). A **separate catalogue** from card stickers, not an extension: `content/
  boardStickers.ts`'s `BoardStickerDef` owns its logic via a single one-time `applyToBoard(board)`
  hook (may touch any of the 8 starting values, including the strategic gauges that aren't in
  `Resources`) plus an optional `appliesTo(board)`; `rules/boardStickers.ts` is the generic
  dispatcher — `boardStickerAppliesTo`, the `effectiveBoard` fold (the board counterpart to
  `effectiveCard`, stacking/composing fall out for free), and the immutable `buyBoardSticker`
  (mirrors `buyTier`/`buySticker`). Starter set: Fertile Land / Garrison / Frontier. Attached per
  board on `PlayerStore.boardStickers` (`Record<BoardId, string[]>`, absent = none; pre-alpha reset,
  no migration). **Snapshotted into `RunConfig.boardStickers` at launch** (sibling of `board`, not a
  reshape) — never re-looked-up in the core `run/setup.ts` (which seeds off `effectiveBoard`), so a
  sticker bought mid-campaign can't retroactively alter an in-progress/restarted run; `reshuffle
  RunConfig`'s `...config` spread carries the snapshot for free. Provisional cap of 2 per board
  (`MAX_BOARD_STICKERS`; DESIGN defers stacking as balance). UI: a **minimal interim buy surface**
  (each board's `effectiveBoard` profile + one-click board-sticker buys, no `CardInstancePanel` since
  a board is singular) — the "separate board-shop section" DESIGN Step 9.1 flags for replacement by
  the future in-place board menu. Shipped inside `Shop.tsx`, then moved to its own **Board** nav tab
  (`meta/BoardMenu.tsx`) in Step 9.3.1; the launch popup's board picker
  (`CampaignMap.tsx`) shows the effective profile + attached icons too. The board-profile formatter
  (`describeBoard`/`RESOURCE_ICON`/`BOARD_IDS`) was extracted to a shared `meta/boardDisplay.ts`
  (BoardMenu + CampaignMap both need it). Board *unlocking* stays out of scope — boards remain
  all-available. Covered by `rules/boardStickers.test.ts` (fold, eligibility, purchase edge cases)
  and a `contract.test.ts` snapshot case.
- **Bug fix: white flash between mission lore panel and board/deck popup** — root cause matched
  the TODO's hypothesis: `MissionDetailPanel` and `LaunchPopup` (`meta/CampaignMap.tsx`) were two
  separate components, each mounting its own `.popupBackdrop` (which carries a mount-time `fadeIn`
  animation from `opacity: 0`). Clicking "Continue" unmounted the first backdrop and mounted the
  second, replaying that fade-in from transparent and briefly exposing the light screen behind.
  Fixed by merging both into one `MissionFlowPopup` component sharing a single, persistent
  backdrop/popup shell across both steps (`step: 'detail' | 'launch'` on one `flow` state instead
  of two separate `detail`/`launching` state slots) — "Continue" now just flips `step`, swapping
  the inner content only, so the backdrop never remounts and the fade-in never replays.
- **Phase 3 Step 7.9 (item 1/4) — Distinct sticker icons** — `content/stickers.ts`'s `StickerDef`
  gained an `icon` field (💪 Reinforced, ⚡ Efficient, 💧 Irrigation); `CardFace`'s `stickerBadge`
  prop changed from a bare boolean to the attached sticker id(s), rendering each one's own icon
  (via a `STICKERS` lookup) instead of one hardcoded 🏷️ regardless of identity — a duplicate id
  (a stacked sticker, Step 7.7) renders its icon twice rather than deduplicating, so the badge
  itself hints at the stack. The badge's CSS moved from a fixed `width` to `min-width` + padding
  so it widens for a second icon instead of clipping. Every caller now threads the real id(s)
  through: `deckBuilder.ts`'s `groupCounts` already carried `stickers` per entry, so
  `DeckDisplay.tsx`/`DeckEditor.tsx`'s banner and picker tiles pass it straight through;
  `DeckEditor.tsx`'s drag-clone needed a new `stickers` field on its `DragState`, captured at
  pointer-down alongside `instanceId` so the dragged clone shows the same badge as the tile it
  was picked up from. `Shop.tsx`'s per-sticker "Attach" button also swapped its generic 🏷️ for
  `s.icon`, for the same reason (a distinct offer button showing an identical glyph for every
  sticker was the same bug in miniature). Items 2–4 of Step 7.9 (bottom-left placement, meta
  screens' effective values, run-loop badge wiring) are still open.
- **Phase 3 Step 7.9 (item 2/4) — Bottom-left sticker badge placement** — the sticker marker moved
  from a single top-left pill (concatenated icons in one badge, sharing the ×N count badge's
  opposite corner) to a bottom-left row (`CardFace.module.css`'s `stickerRow`/`sticker`) of
  individual circles, one per attached sticker id — straddling the bottom edge the way `countBadge`
  straddles its own corner, card-toned (`--card-face-top` + a thin border) rather than the accent
  `--badge-bg`, so it reads as "part of the card" rather than a count/notification marker. A
  stacked sticker (a duplicate id) now renders as two circles side by side instead of a doubled
  glyph crowded into one badge, and each circle carries its sticker's name as a hover title. Items
  3–4 of Step 7.9 (meta screens' effective values, run-loop badge wiring) are still open.
- **Phase 3 Step 7.9 (item 3/4) — Meta screens show effective values too** — every meta-side
  `CardFace` for a stickered instance now shows *both* pieces of information together, not one
  replacing the other — the bottom-left badge (which sticker) alongside the card's own displayed
  cost/output text now reflecting what that sticker actually does (via `rules/stickers.ts`'s
  `effectiveCard`, the same function the run loop already used), rather than the plain catalogue
  numbers a badge alone would leave ambiguous next to. `effectiveGain`/`effectiveCost`/
  `effectiveCard`'s `self` parameter was narrowed from the run's `CardInstance` to a new minimal
  `StickeredInstance` (`{ stickers?: string[] }`) so the same three functions serve a meta
  `MetaCardInstance` and a deck-editor `DeckGroupEntry` too, not just a run instance. `DeckEditor.tsx`'s
  picker/banner/drag-clone tiles and `DeckDisplay.tsx`'s deck-tile fan/list-view tiles (which item
  2/4 wired for `stickerBadge` but left showing the raw catalogue card) now pass `effectiveCard(...)`
  through too; `CardZoomOverlay` gained the same `stickerBadge` pass-through prop `overrideCard`
  already had, and `CardInstancePanel`'s zoom (`Collection`'s and `Shop`'s shared per-copy drill-down)
  now tracks *which* instance was clicked (not just an open/closed boolean) so its zoom can resolve
  that instance's `effectiveCard`/stickers too.
- **Phase 3 Step 7.9 (item 4/4) — Loop cards stay visibly stickered** — completes Step 7.9:
  `Board.tsx`'s every `CardFace` render site (hand, the play/discard-cost ghost clone, the drag
  clone, the pile viewer, an interactive effect's revealed options, the threat column, and the
  zoom overlay) now passes `stickerBadge` through alongside the `effectiveCard` numbers Step 7.6
  already wired — the `Ghost` interface and `spawnGhost`/`ghostFromSlot` gained a `stickers` field/
  param so the flying clone carries the played instance's badge too, and the `zoom` state gained a
  `stickerBadge` field threaded into every `setZoom` call. `BuildingBox`/`WorkBox` (the tableau/
  work-strip boxes) render bespoke markup, not a `CardFace`, so they needed their own badge: rather
  than have `Board.tsx` reach into `CardFace.module.css`'s classes directly (coupling a different
  component to CardFace's internals), the bottom-left badge row was pulled out into its own
  `StickerRow` component (`CardFace.tsx`) — `CardFace` renders it for its own `stickerBadge` prop,
  and `BuildingBox`/`WorkBox` import the component itself, so the row's one visual definition stays
  in one place. `.buildingBox` gained `position: relative` so the badge (straddling the box's
  bottom-left corner, same as a `CardFace`) has a positioning context to anchor to.
- **Phase 3 Step 7.8 — Add Irrigation sticker (self-contained sticker model)** — Irrigation
  (`content/stickers.ts`) is the first sticker whose eligibility depends on the *card*, not just
  the copy: it attaches only to a food-producing building (+1 food, nothing else). Rather than
  hard-code that check at the shop's selection site (the trap a prior attempt fell into —
  scattering sticker rules the way over-specific card logic scattered before the resolver
  rewrite), a sticker now **owns its own logic** on its `StickerDef`: an optional `appliesTo(card)`
  predicate (absent = any card) plus `applyGain`/`applyCost` effect hooks (applied once per
  attached copy). `rules/stickers.ts` became a generic dispatcher with *no* sticker-specific
  knowledge — `stickerAppliesTo(sticker, card)` routes every eligibility question (shop
  listing/offer, and `buySticker`'s authoritative reject), and `effectiveGain`/`effectiveCost`
  are now a plain **fold** over `self.stickers` applying each attached copy's own hook (`?? out`
  skips a sticker lacking that hook), so stacking/composing fall out for free and their
  `(base, self)` signatures — hence the whole run-loop wiring — are untouched. Reinforced/Efficient
  migrated onto hooks with no behavior change; the removed `stickerCount` is subsumed by the fold.
  `Shop.tsx` lists/offers only the stickers whose `appliesTo` matches a card (Irrigation hidden on
  non-food buildings and non-buildings). The two hooks cover output + play-cost only; a future
  sticker touching `workers`/`cultureOutput`/`draw` adds a new hook here plus one compose site in
  `effectiveCard` — the named extensibility seam. The v1 gap noted here at the time (a sticker
  augmenting only the *declarative* producer, never a card's bespoke `produce()`) is since closed:
  `effects.ts`'s `gainResources` now folds `effectiveGain` into a bespoke resolver's output too, so
  Irrigation would apply the same way to a bespoke food producer, not just a declarative one.
- **Phase 3 Step 7.7 — Raise the sticker cap to 2 per instance** — `rules/collection.ts` splits
  what used to be one conflated concept (cap=1 made "has a sticker" and "is full" the same check)
  into two: `hasSticker` (unchanged, `>= 1`) still drives fungible-pool exclusion and display
  grouping (`deckBuilder.ts`'s `addCard`/`removeCard`/`groupCounts`, `DeckEditor.tsx`'s picker) — a
  once-stickered instance is still non-fungible and still gets its own tile/badge, exactly as
  before. The new `isStickerFull`/`MAX_STICKERS` (2) is the "can't take another" check instead,
  used only by the attach flow: `rules/stickers.ts`'s `buySticker` now appends to `stickers`
  rather than replacing, rejecting only once already full. Attaching the *same* sticker id twice
  is allowed on purpose, not a gap: two Reinforced on one copy stacks to +2 — `effectiveGain`/
  `effectiveCost` were changed from a presence check (`.includes`) to an occurrence *count*
  (`stickerCount`) so a duplicate compounds instead of being a no-op. `CardInstancePanel`'s attach
  button/title only guards the full case now. `Shop.tsx`'s "does this card still have a sticker
  slot" check moved to a new `stickerableInstancesOf` (room for another, i.e. not full) rather
  than `unstickeredInstancesOf` (no sticker at all) — the old check would have hidden a card's
  second-sticker slot once every copy had one sticker already. No run-loop changes needed:
  `effectiveGain`/`effectiveCost` already iterate by sticker id and now by count, so stacking
  (same sticker twice) and composing (two different stickers) both fall out of the same code path
  (tested).

- **Phase 3 Step 7.6 — Card stickers in the run loop** — `state.ts`'s `CardInstance` gained an
  optional `stickers?: string[]`, copied once at mint and never written to during a run.
  `rules/deckBuilder.ts`'s `resolveDeckCards` now returns `DeckCard[]` (`{cardId, stickers?}`, stickers
  copied out of the collection rather than aliased) instead of a bare `string[]`; `RunConfig.deck` is
  `DeckCard[]` accordingly, and `run/setup.ts`'s new `instancesFromDeckCards` (mirroring
  `instancesFromCardIds`) mints each entry's stickers onto its run instance. `rules/stickers.ts` is now
  also the run-side home for interpreting a sticker's actual effect: `effectiveGain` (Reinforced's +1
  per produced resource) and `effectiveCost` (Efficient's −1 per cost resource, floored at 0) are the
  *only* places a sticker id is read and interpreted — `rules/effects.ts`'s `defaultProduce`/
  `specToResolver` compose `effectiveGain` in, and the two cost sites (`playability.ts`'s
  `unplayableReason`, now taking a `self: CardInstance` param, and `moves.ts`'s `playCard`) compose
  `effectiveCost` in — so resolution never reads `self.stickers` ad hoc. A bespoke `resolve`/`produce`
  (Cornucopia, threats) was *not* composed through either function at the time — a v1 gap since
  closed: `effects.ts`'s `gainResources` now routes every card's resource output, bespoke or
  declarative, through `effectiveGain`, so a bespoke resolver's `dynamicText` display and its actual
  gain agree with a sticker the same way the declarative default does.
  `rules/population.ts`'s `addBuilding`/`addWork` gained an optional `stickers` param — without it a
  stickered building/work card would silently lose its bonus the instant it left hand for the
  tableau/workZone, since a fresh instance used to be minted from just `cardId`.
  `rules/stickers.ts`'s new `effectiveCard(card, self)` is the display-side counterpart: a shallow
  `CardDef` copy with `cost`/`produces`/`effect.gain` swapped for their effective values, so every
  `Board.tsx` render site that already did `card={CARDS[cardId]}` swaps in `effectiveCard(...)`
  with no `CardFace` changes at all (hand, tableau `BuildingBox`/`WorkBox`, drag clone, play/discard
  ghosts, the pile viewer, zoom overlay, Foresight's interaction options) — `CardZoomOverlay` gained an
  `overrideCard` prop for this. `groupCards` (the run's pile-viewer grouping) now also singles out a
  stickered instance instead of folding it into a ×N stack, same reasoning as its existing
  `dynamicText` exception. Meta-screen display (Collection/Shop/CardInstancePanel showing effective
  values) and an in-run sticker badge are explicitly **not** part of this step — see Step 7.9.

- **Phase 3 Step 7.5 — Card stickers in the meta (not yet in the run)** — `content/stickers.ts`'s
  `STICKERS` is a small, deliberately inert catalogue (Reinforced/Efficient — name/description/cost
  only, nothing reads them yet; Step 7.6 wires an effect in). `rules/collection.ts`'s
  `MetaCardInstance` gained an optional `stickers?: string[]`, capped at one per instance;
  `rules/stickers.ts`'s `buySticker` spends Influence and mutates one chosen instance in place
  (mirrors `shop.ts`'s `buyTier`), wired via `App.tsx`'s `attachSticker`. A stickered instance
  stops being fungible: `deckBuilder.ts`'s `addCard`/`removeCard` now draw only from
  `unstickeredInstancesOf`, and two new functions, `addInstance`/`removeInstance`, add/remove a
  chosen instance *by identity*. `groupCounts` breaks a stickered instance out of its cardId's ×N
  stack into its own entry; `DeckEditor.tsx`'s picker mirrors this — a card's fungible tile plus one
  addressable tile per owned, not-yet-in-deck stickered instance. `CardFace` gained a `stickerBadge`
  (a bare 🏷️ glyph, no new color token) so a stickered tile reads as distinct everywhere. The
  purchase flow reuses Step 7.3's `CardInstancePanel` via a new `attach` mode (shows each row's
  existing sticker and an "Attach ⭐cost" button) rather than a second picker; `Shop.tsx` opens it
  from a card's new "🏷️ ⭐cost → StickerName" buttons, alongside the existing tier-upgrade button.

- **Phase 3 Step 7.4 — Ordered deck assignment** — `rules/deckBuilder.ts`'s `addCard`/`removeCard`
  now assign *fungible* copies in a deterministic order instead of picking by incidental deck-array
  or collection-iteration position: `addCard` already picked the lowest-index free instance (via
  `instancesOf`'s granted order — unchanged), and `removeCard` now mirrors it, popping the
  *highest*-index in-deck instance rather than the first one found scanning the deck array. Net
  effect: a still-identical card's copies in a deck stay a stable, low-index-first prefix of the
  owned instances as the deck is edited — add, remove, add again returns the same instance rather
  than churning to a different one. This is the ordering Step 7.5's per-instance sticker pick
  (7.3's `CardInstancePanel`) needs to stay meaningful: once copies can differ, this LIFO order is
  only the *default* for the copies still identical to each other.

- **Phase 3 Step 7.3 — Collection per-instance view** — clicking a card tile in `Collection.tsx`
  now opens `meta/CardInstancePanel.tsx` instead of jumping straight to the card zoom: a row per
  owned instance ("Farm 1/2", "Farm 2/2"), each naming the deck(s) it currently sits in (via the
  new `rules/deckBuilder.ts`'s `decksContaining(instanceId, decks)`, filtering decks whose `cards`
  includes that instance id) or "unused" if it's in none. Clicking a row opens the same shared
  `CardZoomOverlay` (every instance looks identical today — no sticker field yet, Step 7.5).
  This is the anti-surprise mechanism Step 7.5 needs: attaching a future sticker becomes an
  *informed* pick of one instance whose deck consequences are already on screen, rather than a
  surprise landing on the wrong copy. `Collection.tsx` now takes a `decks` prop (threaded from
  `MetaMenu.tsx`, which already had it) to resolve usage.
- **Phase 3 Step 7.2 — Uniform meta card instances** — the collection stops being a per-cardId
  count and becomes a set of identified copies: `rules/collection.ts`'s `OwnedCards` is now
  `{ instances: MetaCardInstance[], nextId }` (`MetaCardInstance` just `{ id, cardId }` — no
  sticker field yet, that's Step 7.5), with `nextId` a persistent, append-only allocator distinct
  from the run's `population.ts`'s `nextInstanceId` (that one scans run zones; this one just
  counts up — buying ×2→×4 or a mission unlock appends fresh ids via `grantCopies`, never
  renumbering, so a `DeckDef`'s instance-id references never go stale). `copiesOwned`/`isOwned`
  are now derived by filtering instances. `DeckDef.cards` (`content/decks.ts`) changed meaning
  from cardIds to meta instance ids; `rules/deckBuilder.ts`'s `addCard`/`removeCard` pick *any*
  owned/in-deck instance of a cardId (copies are still fungible — Step 7.4 will pick a stable
  order once stickers make instances worth distinguishing), and `groupCounts`/`resolveDeckCards`
  now take the collection to resolve instance ids back to cardIds for display and for the run
  boundary respectively. Content authoring stays in cardIds: `content/decks.ts`'s `DEFAULT_DECKS`
  is now `DeckSeed[]` (plain cardId lists, since instance identity doesn't exist until a
  collection is actually seeded) and `content/collection.ts`'s `STARTING_COLLECTION` is a plain
  `Record<cardId, count>`; `deckBuilder.ts`'s new `buildSeedDecks` resolves a `DeckSeed[]` into
  real `DeckDef[]` against a freshly-granted collection — the one function `meta/store.ts`'s
  `emptyStore` (and its `parsePlayerStore` decks-fallback) goes through. `contract.ts`'s
  `buildRunConfig` gained a required `collection` param to do that same instance→cardId
  translation when assembling a `RunConfig`; `App.tsx`/`MetaMenu.tsx`/`CampaignMap.tsx`/
  `Decks.tsx`/`DeckDisplay.tsx` all thread `collection` down to wherever a deck's cards are
  displayed or launched. `parsePlayerStore` also gained a shape check on `collection.instances`/
  `nextId` (not just "is an object") so a pre-Step-7.2 save (a bare `{ cardId: count }` map)
  resets to a fresh store instead of crashing deep inside `copiesOwned`. `cloneDecks` is gone —
  `buildSeedDecks` already returns fresh objects, so nothing needed it. No sticker yet; this is
  the identity substrate Steps 7.3–7.6 build on.
- **Phase 3 Step 7.1 — Bounded copy tiers (drop `'unlimited'`)** — copy counts are now ×1/×2/×4/×8,
  no infinite tier — instances are bounded (you can't instantiate infinity), the precondition for
  Step 7.2's uniform meta card instances. `rules/shop.ts`'s `TIER_LADDER`/`nextTier` lost the
  terminal `'unlimited'` rung (the ladder now ends at ×8); `rules/collection.ts`'s `OwnedCards` is
  now a plain `Record<string, number>` (`copiesOwned`/`isOwned` simplified to match), and
  `rules/deckBuilder.ts`'s `addCard` lost its `'unlimited'`-skips-the-cap branch. `CardFace`'s
  `countBadge` prop dropped its `'unlimited'` arm (no more "∞" badge; `Shop.tsx`'s tier-upgrade
  label too). `content/collection.ts`'s `STARTING_COLLECTION` reseeded the three basics that were
  `'unlimited'` (settlers/corvee/harvest) to `2` each — matching every other starting card's "just
  enough for the starting deck" count, since the starting deck only ever needs 2 of each. Pre-alpha:
  no migration.
- **Phase 3 Step 6.3c — Creeping Decay infinite mission** — the first *real* infinite mission,
  and the first *escalating* threat. **Creeping Decay** (`content/cards.ts`, a `threat` card) owns
  its drain via a bespoke `resolve` — reads its own `getCounter(self, 'level')`, scales a base
  −1🔨 by `level + 1`, applies it via `scaleResources`/`subtractResources`, then bumps its own
  counter — mirroring Cornucopia's per-play growth resolver (Step 6.1), just tick-triggered instead
  of play-triggered. **The Long Decline** (`content/missions.ts`, `kind: 'infinite'`) seeds it once
  via `addThreat` in `setup`; its `objective`/`failure` are both `() => false` — an infinite mission
  never wins or fails on its own, so the escalating drain forcing Production negative and tripping
  the universal `coreCollapse` → `'ruin'` (`run/engine.ts`) is its *only* ending, at which point
  `computeRewards`' existing infinite branch pays Influence = rounds survived. No gameover-overlay
  or campaign-map changes were needed — the generic `'infinite'`-kind plumbing (gameover reward
  line, the campaign map's bottom banner, `MissionDetailPanel`, `applyRunResult`) already built in
  Step 6.2 renders/handles a real infinite mission with zero further changes, confirmed both by a
  `run/run.test.ts` integration test (a Farm keeps Food flat so Production, not famine, is what
  collapses first — proving the threat, not an unrelated resource floor, ends the run) and an
  in-browser click-through of the full mission → threat-zone → zoom → end-run path.
- **Phase 3 Step 6.3b — Threat UI + Long Winter's food drain as a real threat card** — `G.threats`
  now renders on the board: `Board.tsx`'s new `ThreatZone` is a real, in-flow **left column** of
  `.gamearea` (`.threatColumn`, its own `overflow-y: auto`), not a floating overlay — a first pass
  stacked it under the fixed-position `MissionWidget`, but that doesn't reserve layout space, so
  it crept in front of the slot grid's first row once taller than one card; `.gamearea` is now a
  row (`.threatColumn` beside a new `.gameContent` wrapping the slot grid + work strip) so the
  tableau reflows beside the threat column instead of sitting under it. Each threat is a real
  `CardFace` reading only `GameState`, never the mission — reuses `card.dynamicText?.(G, self)` (the
  same hook Cornucopia's growing gain already threads through every render site) for a growing
  threat's live drain, falling back to the static `description` for a flat one; click opens the
  shared `CardZoomOverlay`. Threats get their own `CardKind`, `'threat'`, rather than reusing
  `'event'`: `CardFace`'s `describeConditions` hard-codes event-only text ("resolves at end of
  round") that would misdescribe a persistent, tick-every-upkeep hazard. `'threat'` reuses `'event'`'s
  already-CVD-vetted red identity (`kindClass`) — just a different banner label — and is excluded
  everywhere `'event'` already is (`Collection.tsx`/`DeckEditor.tsx`/`Shop.tsx`'s picker filters,
  `deckBuilder.addCard`'s reject-on-add). The Long Winter mission's `onUpkeep` hand-drain of 2 Food
  is gone, replaced by a real card — **Harsh Winter** (`content/cards.ts`, a flat non-escalating
  `effect.loss: { food: 2 }`, no bespoke `resolve` needed) — seeded once via `addThreat` in the
  mission's (now-added) `setup`.
- **Phase 3 Step 6.3a — Threat zone (pure core)** — `GameState` gained `threats: ThreatInstance[]`
  (`rules/state.ts` — `ThreatInstance` is just a `CardInstance`, empty in `blankState`;
  mission-seeded only, so a no-op field on every run that doesn't use one) and a new
  `rules/threats.ts`: `addThreat(G, cardId)` seeds one bare (no counters yet). Escalation is
  **the card's responsibility, not the engine's** — an earlier draft had `tickThreats` read and
  scale `CARDS[cardId].effect.loss` itself, which was caught in review as bypassing the resolver
  spine (`effects.ts`'s `resolveCard`, "the single path 'the card's effect' runs through").
  Corrected: `tickThreats(G)` just calls `resolveCard({ G, self: t })` per threat — the threat
  card's own `resolve` computes and applies its drain and bumps its own counter, mirroring
  Cornucopia's per-play growth (Step 6.1) but tick-triggered instead of play-triggered, so a
  future Creeping Decay never touches the declarative `effect` bag at all (same as Cornucopia
  doesn't). `rules/population.ts`'s `nextInstanceId` now also scans `G.threats`, since it shares
  the run-wide instance-id space. `tickThreats` is called unconditionally from `upkeep.ts`'s
  `applyUpkeep` (a no-op when `threats` is empty), so it flows into `projectedDelta`'s UI preview
  for free with no risk of drift between preview and actual — confirmed by an `applyUpkeep`-level
  test alongside `rules/threats.test.ts`'s direct coverage (a flat-loss card ticking unscaled, a
  counter-scaling resolver escalating across ticks, no-threats no-op). No UI, no real
  threat-seeding mission yet — that's Step 6.3b's board UI and Step 6.3c's Creeping Decay.
- **Phase 3 Step 6.2 — Infinite-mission plumbing + campaign UI + scoring** — `MissionDef`'s
  `reward` and `map` are now optional (`'infinite'` missions have neither). `rules/rewards.ts`'s
  `computeRewards` gains an infinite branch — Influence = rounds survived
  (`RunResult.stats.turnsTaken`), paid regardless of `alreadyCompleted` or unlock, no collection
  change. The actual store fold was pulled out of `App.tsx`'s `recordResult` into a new pure,
  unit-tested `meta/store.ts`'s `applyRunResult(store, result, mission)`: a `'standard'` mission
  marks `mapProgress` and pays its reward only on a victory outcome, same as before; an
  `'infinite'` mission never touches `mapProgress` and pays on *every* attempt, win or lose —
  `recordResult` is now a one-line `persist(applyRunResult(...))`. The direct
  `mission.reward.unlockCardId` reads in the gameover overlay (`Board.tsx`) and
  `MissionDetailPanel` (`CampaignMap.tsx`) are now guarded, and both render an infinite-specific
  line ("Influence = rounds survived" / "No unlock — paid every attempt") instead of a card face.
  `CampaignMap.tsx` splits missions by `kind`: `'infinite'` ones are filtered out of the
  DAG/timeline and into a new always-visible bottom banner (`.infiniteBanner`, a `flex: 0 0 auto`
  sibling of `.canvas`, never `position: fixed` — matches the map's existing viewport-fixed
  workaround) reusing the already-CVD-vetted `--map-node-available` tokens plus a glyph + text
  label (no color-only state). Verified end-to-end in-browser with a throwaway `toto` mission
  (`kind: 'infinite'`, objective `round > 10`, no failure of its own) — banner placement, detail
  panel, launch, ~equal-to-round-count Influence paid on both a victory-outcome stop and a
  famine-defeat-outcome stop, and the mission staying un-cleared after either — then removed
  once confirmed, since it's a harness, not real content. `rules/rewards.test.ts` and
  `meta/store.test.ts` cover the infinite branch directly (no real infinite mission exists yet to
  exercise via `run/run.test.ts` — that's Step 6.3c's Creeping Decay).
- **Dynamic cards show their live value everywhere in the run, split into two bands** —
  `CardDef` gains `dynamicRule?: string`, a static line describing *how* a dynamic card's effect
  scales (e.g. Cornucopia's "+1 each time played"), rendered in the existing conditions
  band (`CardFace.tsx`'s `describeConditions`) alongside discard cost / culture-level gates — in
  every context, live instance or not, since the rule text itself never changes. `dynamicText`
  keeps its old job — the bottom-most text band's actual *current* number — but is now threaded
  through every run render site, not just the hand: the discard-cost and destroy-targeting ghost
  flights (`spawnGhost`/`ghostFromSlot` gained an `overrideText` param, computed from
  `G.hand[handIdx]` before the play resolves, so the flying clone matches what the hand card just
  showed), the drag clone, the zoom overlay (`Board.tsx`'s `zoom` state became `{ cardId,
  overrideText } | null`; `CardZoomOverlay` gained an `overrideText` prop, unused by its two
  static callers), and the discard/removed pile viewers. The pile viewers needed a real rework,
  not just threading: `pileView` now carries `CardInstance[]` (not `cardId[]`), and `groupCards`
  no longer coalesces a dynamic card's copies into one shared-count tile (two Cornucopia with
  different play counts can't share one number) — a card with `dynamicText` always renders as its
  own single-count entry, keyed by its stable instance id. Foresight's peek modal is covered too —
  `pendingInteraction.options` were already full `CardInstance`s, just missing the `overrideText`
  wiring, so a revealed Cornucopia now shows its real current gain instead of the base "+1🌾".
- **Card-effect resolver + interaction rewrite** (plan: `.claude/plans/we-are-doing-code-wondrous-hoare.md`)
  — replaced the flat `CardEffect` data-bag + growing `applyEffect` switch with a **resolver spine**:
  every card resolves through one path, `resolveCard(ctx)`, picking its own `CardDef.resolve` closure
  or the declarative default `specToResolver(effect)`; the `EffectContext` (`{ G, self, target?,
  answer? }`) is the seam that lets an effect know which card is resolving and what it targets. Shipped
  in four green stages (one commit each):
  - **Stage 1** — resolver spine, behavior-preserving; `destroy`/`remove` folded in from `playCard`.
  - **Stage 2** — Cornucopia (first dynamic-effect card) + `scaleResources` primitive.
  - **Stage 3** — interaction layer: plain-data `pendingInteraction` on `G`, a two-branch re-entrant
    resolver + `resolveInteraction` move, resolve-only modal; Foresight (first interactive card).
  - **Stage 4** — **per-copy identity**: card zones (`hand`/`deck`/`discard`/`removed`) went from
    `string[]` to `CardInstance[]` (`{ id, cardId, counters? }`), `PlacedCard` extends `CardInstance`,
    and `nextInstanceId` now scans every zone so ids are unique run-wide. Per-instance run state lives
    in each copy's own `counters` (via `getCounter`/`bumpCounter`), replacing the interim central
    `GameState.cardState` bag; Cornucopia's growth is now genuinely per-copy (playing one never buffs
    another). `instancesFromCardIds` is the shared mint path (setup, mission-injected cards, tests).
- **Phase 3 Step 6.1 — Non-fixed (dynamic) card effects** — delivered across Stages 2 and 4 of the
  resolver rewrite just above: `scaleResources` (`rules/resources.ts`) is the reusable "scale an
  effect by a counter" primitive (Step 6.3's threat drain reuses it), and Stage 4's per-instance
  `counters` gave every card copy its own run-scoped number — **reversing the earlier "add a typed
  field, no generic bag" guidance**: card-specific numbers belong on the card instance, not
  accreted onto `GameState` as named fields. First card shipped: **Cornucopia** (`content/cards.ts`)
  — a `resolve`-driven `action` gaining `+1🌾` plus `+1` per prior play *of that same copy* this run
  (playing one copy never buffs another); its growing value surfaces via a card-owned
  `dynamicText(G, self)` hook (see "Dynamic cards show their live value everywhere" below for the
  full render-site list).
- **Mystery card reuses `CardFace`** — `CampaignMap.tsx`'s hand-rolled `MysteryCard` (a
  one-off grey box borrowing only `CardFace.module.css`'s outer `.card` class) is gone;
  `CardFace` now takes a `faceDown` prop (a discriminated union with `card`, so `card` is
  only required when not face-down) rendering the same 118×162 box and header/banner/
  description band layout as a real face — all blank grey, no text — plus a "?" glyph in the
  art slot, instead of real card content. `MissionDetailPanel` calls `<CardFace faceDown />`
  for the pre-clear reward slot.
- **Bug fix: corner count-badge clipped in card grids** — root cause was a `box-sizing`
  mismatch, not the badge position: `CardFace.module.css`'s `.card` never set `box-sizing`,
  so a `<div>` instance (Collection/Shop) inherited the default `content-box` and rendered
  136×179 — 18px wider than its `118px` grid track — while an `as="button"` instance (hand,
  deck-editor picker) got the UA `border-box` and fit at 118×162. The oversized divs
  overlapped their right-hand neighbour, which painted over the `top:-8px; right:-8px`
  badge. Fixed with one line — `box-sizing: border-box` on `.card` — so every `CardFace`
  renders an identical 118×162 box regardless of `as`; tiles now sit inside their tracks
  and the badge protrudes cleanly into the grid gap. Verified in-browser across the
  Collection, Shop, and deck-editor grids (0 clipped badges each).
- **Phase 3 Step 1 — Ownership & currency core** — `rules/collection.ts` (`OwnedCards`,
  `copiesOwned`, `isOwned`); `content/collection.ts`'s narrow `STARTING_COLLECTION`;
  `content/decks.ts` trimmed to a single starting deck (`starter`/"Founding Deck"), built
  entirely from what `STARTING_COLLECTION` owns; `PlayerStore` gains `influence` /
  `collection` / `mapProgress` (all required — no migration path for a pre-alpha save
  missing them).
- **Phase 3 Step 2 — Deck-editor copy caps** — visibility half: `Collection` and
  `DeckEditor`'s picker omit not-yet-unlocked cards entirely (not shown locked), no total
  count hint. Cap half: `deckBuilder.addCard` rejects an add past the copies owned
  (`'unlimited'` never caps); `DeckEditor`'s picker tile dims/disables once every owned
  copy is already in the deck (click and drag both no-op) instead of silently rejecting;
  its count badge shows *remaining* copies left to add, not total owned (`CardFace` gained
  an `alwaysShowBadge` prop so this badge can surface even at ×1/×0, unlike every other
  `countBadge` use, which stays hidden at 1 since those show a stack count instead).
- **Phase 3 Step 3 — Mission model + campaign-map data** — `MissionDef` gains `prereqs`
  (mission ids required first, empty = DAG root) and `kind: 'standard' | 'infinite'`;
  `rules/campaign.ts` (`isCompleted`/`isAvailable`/`availableMissions`) + tests, including a
  pinned "completed stays available" replay case. Test DAG reuses the 3 existing missions:
  The Long Winter is the root, The Enlightenment and Barbarian Tide both gate on it.
  `MissionSelect` hides not-yet-unlocked missions entirely; `App.recordResult` marks
  `mapProgress` on victory, so the unlock chain is live end-to-end (Influence/unlock reward
  computation itself stays Step 4). `reward`/map-position fields deferred — no consumer yet,
  shape isn't settled by the design doc.
- **Phase 3 Step 4 — Reward computation + run-end wiring** — `MissionDef` gains a required
  `reward: { influence, unlockCardId }` (Long Winter 1⭐/Granary, Enlightenment 2⭐/University,
  Barbarian Tide 2⭐/Conquest); `rules/rewards.ts`'s `computeRewards` is the one pure function
  that decides the payout — a no-op replay if the mission was *already* completed (checked
  against `mapProgress` from *before* this result, so back-to-back wins of the same mission
  can't double-grant), and a no-op unlock if the card is somehow already owned. `App.recordResult`
  applies it to `store.influence`/`store.collection` alongside the existing `mapProgress` write.
  The gameover overlay (`Board.tsx`) previews the same payout off the same pure function and
  the pre-run `mapProgress`/`collection` App passes down — a preview, not a second source of
  truth — showing "+N ⭐ Influence · Unlocked X" on a first clear or "Already cleared — no
  reward for a replay." otherwise. A coherence test pins every mission's `unlockCardId`
  resolving to a real `content/cards.ts` id. `RunResult.score`/infinite-mission payout stays
  deferred to **Step 6**, since there's no infinite mission yet to produce a score; `Stats`
  surfacing a per-run reward is also deferred — `RunResult` deliberately excludes rewards
  (see `contract.ts`), and there's no per-run record of whether *that* run was a first clear
  (`mapProgress` is current state, not a history snapshot).
- **Influence nav display** (pulled forward from Step 5) — `MetaMenu`'s left nav shows a
  `⭐ <count>` pill between the game title and the screen buttons, reading `store.influence`.
- **Phase 3 Step 5.1 — Campaign Map screen** — `CampaignMap.tsx` replaces the flat
  `MissionSelect` with humanity's history as a horizontally-scrollable branching tech tree
  (drag-to-pan reusing the Board/DeckEditor pointer convention). `MissionDef` gains an authored
  `map: { col, row }` grid position; nodes are placed from it, edges drawn from `prereqs`, and
  per-node state comes from `rules/campaign.ts` (cleared ✓ / available ▶ / locked). Locked
  nodes are **silhouettes** — position + lock glyph shown to orient the player in history, but
  name/objective/reward hidden and the node inert (a deliberate divergence from the earlier
  hide-everything precedent). A single "Testing" age band (`content/ages.ts`, a right-arrow
  shape) spans the top; the age→column-range mapping for multiple ages is deferred (only one
  age to place). Clicking a cleared/available node opens a launch popup (board picker left,
  deck picker right, nothing pre-selected, "Start Mission" disabled until both chosen); the
  reward preview shows the Influence amount and that a card unlocks but not which. The deck
  picker's tile-fan + list-view display is extracted into shared `components/DeckDisplay.tsx`
  (`DeckTile`/`DeckListOverlay`, also now used by `Decks.tsx`) minus the edit/copy/delete
  buttons — clicking an unselected deck selects it, clicking the selected one opens its
  list-view. New map/age/node theme tokens in `index.css` (Light + Dark; CVD themes fall
  through to Light since node state carries glyph + text-label backups, not color alone).
- **Phase 3 Step 5.2 — Shop** — `rules/shop.ts` is the one pure place the copy-tier economy
  lives: `TIER_LADDER` (×1→×2→×4→unlimited at 1/2/5 Influence — numbers balance-tunable, the
  ladder a core rule like `MAX_DECKS`), `nextTier` (next rung + cost, or null for a
  maxed/not-owned/off-ladder count — one predicate meaning "owned *and* still upgradeable"), and
  `buyTier` (the immutable `{ influence, collection }` purchase, returning null for an
  unaffordable/maxed/not-owned card, mirroring `computeRewards`). `meta/Shop.tsx` (the new `🛒
  Shop` nav tab) lists only upgradeable owned cards (the `nextTier !== null` filter hides both
  the ∞ basics and anything not unlocked), grouped like `Collection.tsx`, each tile a `CardFace`
  (current tier badge) over a one-click buy button (`⭐cost → ×N`, disabled when unaffordable —
  no confirm, since a purchase only ever adds copies). `App.tsx`'s `buyCardTier` runs `buyTier`
  and `persist`s the reduced Influence + bumped collection, so the nav ⭐ pill and the list
  update live (a card bought to unlimited drops out). Stickers stay Step 7 (need per-copy
  identity first). `rules/shop.test.ts` covers the ladder + purchase edge cases.
- **Phase 3 Step 5.3 — Mission detail panel** — `MissionDef` gains a `lore` field (narrative
  flavour text, distinct from the existing mechanical `description`). Clicking a cleared/
  available map node now opens `MissionDetailPanel` first: left column is lore + description +
  victory/failure hints, right column is the reward — an Influence line (struck through once
  already cleared) with a subtitle ("1 new card" / "Cards already unlocked"), and either a
  grey face-down `MysteryCard` (pre-clear) or the real unlocked `CardFace` (post-clear) below
  it. Its "Continue" hands off to the existing `LaunchPopup` (board/deck picker), which no
  longer repeats lore/reward text in its own header now that Step 5.3 owns that.
