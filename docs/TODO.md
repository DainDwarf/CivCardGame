# CivCardGame — TODO / Idea Backlog

> A scratch list for ideas caught **in passing** so they aren't lost — *not* a
> committed plan. Anything here is a candidate, not a promise. Decided, designed
> work lives in [`DESIGN.md`](DESIGN.md); this is the inbox that feeds it.

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
  Influence = rounds survived. Cut into substeps; suggested order **6.1 → 6.2 → 6.3a → 6.3b**.
  `[phase: 3]`
  - **Step 6.1 — Non-fixed (dynamic) card effects** — ✅ done — see *Done / shipped* below.
    `[size: M]` `[phase: 3]`
  - **Step 6.2 — Infinite-mission plumbing + campaign UI + scoring** — ✅ done — see
    *Done / shipped* below. `[size: M]` `[phase: 3]`
  - **Step 6.3a — Threat zone (pure core)** — ✅ done — see *Done / shipped* below.
    `[size: S]` `[phase: 3]`
  - **Step 6.3b — Threat on the board + Creeping Decay mission** — render + author the real
    infinite mission. `Board.tsx` renders `G.threats` (near the mission HUD) as `CardFace`s with
    a live "−N 🔨/round (growing)" badge and click → existing `CardZoomOverlay`; reads only
    `GameState`, never the mission. Reframe the gameover overlay for a threat-driven collapse
    (Influence = rounds survived). Add the **Creeping Decay** `event` card (`content/cards.ts`,
    `effect: { loss: { production: 1 } }` = per-turn base) and an infinite mission whose `setup`
    seeds it via `addThreat`; the growing production drain forces `coreCollapse` → `'ruin'`
    (`run/engine.ts`), which realizes the score. `[size: M]` `[phase: 3]`
  - **Link 6.1 ↔ 6.3:** both express a value that *changes over the run* by scaling a card's
    effect by an integer counter. They differ in **trigger and storage** — 6.1 escalates *per copy
    played* (Cornucopia, counter in that copy's own `CardInstance.counters`) while 6.3 escalates
    *per turn* (the threat tick, counter is `ThreatInstance.level`). 6.1 shipped the "scale an
    effect's magnitude by a counter" primitive as the **pure helper** `scaleResources` (bundle ×
    factor); 6.3a consumes that same helper for its drain.
- **Step 7 — Stickers** *(last, deepest)* — the per-copy-identity precursor is now **done** (Stage 4
  of the resolver rewrite): pile cards are already `CardInstance`s (`{ id, cardId, counters? }`) with
  stable run-wide ids, and per-copy run state has a home (`counters`). What remains: board stickers
  (`setup.ts` modifiers); card stickers (per-copy, read by `effects.ts` / `production.ts` — note these
  would need to persist *across runs* on the collection, unlike `counters` which are run-scoped);
  shop sells + attach UI. `[size: L]` `[?]` `[phase: 3]`
- **Step 8 — Tutorial missions** — the first few meta missions double as tutorials,
  introducing mechanics progressively; tutorial entry-node missions on the map. Covers
  designing several missions, onboarding indicators/popups, and careful pacing so new
  mechanics aren't dumped on the player all at once. Rough pacing: the starting deck holds
  only `work`/`action` cards, no buildings — mission 1 unlocks the first buildings (House,
  Farm, Workshop); mission 2 introduces territory limitation (and maybe conquest?) alongside
  them. Goal is to reach a certain population. Unlocks culture stuff. Mission 3 explains culture, goal to reach culture lvl2. `[size: L]` `[?]` `[phase: 3]`
- **Step 9 — Peripheral** — `Stats` rework once rewards/trends exist.
  Independent. `[phase: 3]`

## Meta loop (`src/meta/`)

- **Card modifiers** — attach persistent modifiers to individual cards → **decided as stickers**; see **Step 7** above. `[phase: 3]`
- **Stats screen UI rework** — `Stats.tsx` is currently a plain list of run-result rows (shell-only, shipped with Phase 2 step 6); revisit its look once there's more to show (rewards, trends across runs) → **Step 9** above. `[?]` `[phase: 3]`

## Cards & content (`src/content/`)

- **Remove Settlers, replace with a Hut building** `[?]` `[phase: 3]`
- **Disasters — expand** — the `event` card mechanic shipped (see `CHANGELOG.md`); grow it out with more disaster types beyond the Barbarian and missions that inject them (details TBD) `[?]` `[phase: 4]`
- New mission type: "Metropolis" `[?]` `[phase: 4]`
- New mission: "Build the Wonder" `[?]` `[phase: 4]`
- Culture-based missions (depend on the Culture resource) `[?]` `[phase: 4]`
- Building that changes hand size (e.g. +1 card drawn per round) `[?]` `[phase: 4]`
- Resources transformation? Like a building that transforms production into science for example `[phase: 4]`
- **Long Winter's food drain as a real event card** — currently `onUpkeep` hand-drains 2 extra Food each round (a mission special-case); instead make it a genuine `event` card that's auto-played at the start of the run, can't be removed, and sticks on the board for the mission's duration. `[?]` `[phase: 3]`
- **Foresight corner case: empty draw pile silently wastes the card** — `content/cards.ts`'s Foresight resolver does `G.deck.slice(0, 3)` and bails on `length === 0` without reshuffling, so playing it with an empty deck (but a full discard) pays its 1🌾science, files to discard, and does *nothing* — no peek, no feedback — contradicting its own "Peek the top 3" text. `unplayableReason` (`rules/playability.ts`) has no draw-pile gate, so nothing stops the play. Fix depends on the eager-reshuffle item above (once `G.deck` is empty only when the discard is too, Foresight's `slice` sees the real pile); then **also handle the deck-AND-discard-both-empty case** — either gate the card as unplayable then (add an `UnplayableReason` kind, mirroring `noBuildingsToDestroy`) so it can't be wasted, or let it peek/draw fewer than 3 gracefully. Decide which; a hard gate matches the existing "don't let a play fizzle for nothing" precedent. `[size: S]` `[phase: 3]`

## UI (`src/components/`)

- **Multi-pip staffing UI** — once a building can require 2–3 workers, its box needs one pip per worker slot (not the current single staff-toggle icon), so partial staffing is visible and each pip can be dragged independently. Follow-up to the now-shipped building→building worker drag; blocked on a multi-worker building actually existing (see [[multi-worker-buildings-roadmap]]). `[size: M] [?] [blocked]` `[phase: 4]`
- **Bulk-move modifier for worker transfers** — a modifier (e.g. shift-drag) to move N workers from one building to another in one gesture, instead of one pip-drag per worker. Only pays off once multi-pip staffing (above) exists. `[size: S] [?] [blocked]` `[phase: 4]`
- **Stable card ordering across views** — cards currently "move around" when adding/removing in the deck editor (and potentially other card grids); pick a sensible, stable sort order (by kind? cost? catalogue order?) and apply it consistently everywhere cards are listed — collection, deck editor picker/banner, pile viewers. `[size: S] [?] `
- **Bug: white flash between mission lore panel and board/deck popup** — Step 5.3's `MissionDetailPanel` → `LaunchPopup` handoff on "Continue" shows a brief white flash, likely the backdrop unmounting/remounting between the two modals rather than one panel morphing into the next. `[size: S]` `[phase: 3]`
- **Barbarian Tide's lore should show the Barbarian card** — `MissionDetailPanel` (Step 5.3) only shows the mission's *reward* card face; Barbarian Tide's lore column should also preview the Barbarian event card itself, since that's the card the mission is actually about. `[size: S]` `[?]` `[phase: 3]`
- **Mission Lore cards should be click-to-zoom** — any `CardFace` shown in `MissionDetailPanel` (the reward unlock, and the Barbarian preview above) should open the shared `CardZoomOverlay` on click, same as hand/pile-viewer/Collection cards. `[size: S]` `[phase: 3]`
- **Bug: worker-drag start looks disabled when no idle population is free** — dragging a worker off a building/Work box onto another building's staffing area, when there's no idle population available to complete the move, shows the OS "unavailable" cursor because the staff-toggle `<button>` is `disabled`. That reads as "you can't drag this" rather than "there's nowhere for it to go yet," which will confuse the player. `[size: S]` `[?]`

## Game design & balance

- Card that gives a draw when expanding territory `[?]` `[phase: 4]`
- Card effects that trigger on discard / on draw, to enable combos `[?]` `[phase: 4]`
- **Minimum deck size — 20 cards** — enforce a floor on deck size (mirrors the existing
  `MAX_DECKS` cap precedent — a core rule enforced at the deck writer, not just a UI gate);
  also means adjusting `content/decks.ts`'s starter deck up to 20 cards to satisfy it.
  `[phase: 3]`
- **Default hand limit — 4 instead of 5** — lower the base starting hand size from 5 to 4.
  `[phase: 3]`



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

- **Phase 3 Step 6.3a — Threat zone (pure core)** — `GameState` gained `threats: ThreatInstance[]`
  (`rules/state.ts` — `{ id, cardId, level }`, empty in `blankState`; mission-seeded only, so a
  no-op field on every run that doesn't use one) and a new `rules/threats.ts`: `addThreat(G,
  cardId)` seeds one at level 0, `tickThreats(G)` drains `level * cardId`'s base `effect.loss`
  from `G.resources` (via `resources.ts`'s `scaleResources`, the same scale-by-counter primitive
  Step 6.1's Cornucopia uses) *then* increments `level` — apply-then-increment, so the round a
  threat is added deals no drain yet. `rules/population.ts`'s `nextInstanceId` now also scans
  `G.threats`, since it shares the run-wide instance-id space. `tickThreats` is called
  unconditionally from `upkeep.ts`'s `applyUpkeep` (a no-op when `threats` is empty), so it flows
  into `projectedDelta`'s UI preview for free with no risk of drift between preview and actual —
  confirmed by an `applyUpkeep`-level test alongside `rules/threats.test.ts`'s direct coverage of
  `addThreat`/`tickThreats` (level-0 no-drain, drain-then-escalate, no-threats no-op). No UI, no
  real threat-seeding mission yet — that's Step 6.3b's Creeping Decay.
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
  exercise via `run/run.test.ts` — that's Step 6.3b's Creeping Decay).
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
