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
  *Done / shipped* below. `RunResult.score` / infinite-mission payout stays deferred to
  **Step 6**, since there's no infinite mission yet to produce a score. `Stats` surfacing
  a per-run reward is also deferred — `RunResult` deliberately excludes rewards (see
  `contract.ts`), and there's no per-run record of whether *that* run was a first clear
  (`mapProgress` is current state, not a history snapshot); revisit if/when that's worth
  breaking the invariant. `[phase: 3]`
- **Step 5 — Meta UI: map + shop** — Influence display in the nav ✅ done (see
  *Done / shipped* below); the rest is split into substeps. `[phase: 3]`
  - **Step 5.1 — Campaign Map screen** — ✅ done (see *Done / shipped* below): `CampaignMap.tsx`
    replaces `MissionSelect`'s flat list with a horizontally-scrollable DAG; node → launch popup.
    `[size: M]` `[phase: 3]`
  - **Step 5.2 — Shop** — ✅ done (see *Done / shipped* below): `meta/Shop.tsx` + `rules/shop.ts`;
    buy copy tiers, spend Influence. `[size: M]` `[phase: 3]`
  - **Step 5.3 — Mission detail panel** — insert a new panel between the map and the
    board/deck popup: clicking a cleared/available node opens mission lore, explanation, and
    reward preview first; board/deck selection becomes a second step from there, rather than
    the single launch popup `CampaignMap.tsx` opens today. New flow: mission DAG → mission
    lore/explanation/rewards → board + deck selection. `[size: M]` `[?]` `[phase: 3]`
- **Step 6 — Infinite missions (run loop)** — endless play in `run/engine.ts` (escalating
  threat, `score` = round, ends only on failure); author one infinite mission; infinite
  framing in gameover / `Stats`. `[size: M]` `[phase: 3]`
- **Step 7 — Stickers** *(last, deepest)* — resolve per-copy identity first (deck entries
  → `{ cardId, instanceId? }`). Board stickers (`setup.ts` modifiers); card stickers
  (per-copy, read by `effects.ts` / `production.ts`); shop sells + attach UI.
  `[size: L]` `[?]` `[phase: 3]`
- **Step 8 — Tutorial missions** — the first few meta missions double as tutorials,
  introducing mechanics progressively; tutorial entry-node missions on the map. Covers
  designing several missions, onboarding indicators/popups, and careful pacing so new
  mechanics aren't dumped on the player all at once. Rough pacing: the starting deck holds
  only `work`/`action` cards, no buildings — mission 1 unlocks the first buildings (House,
  Farm, Workshop); mission 2 introduces territory limitation (and maybe conquest?) alongside
  them. `[size: L]` `[?]` `[phase: 3]`
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

## UI (`src/components/`)

- **Multi-pip staffing UI** — once a building can require 2–3 workers, its box needs one pip per worker slot (not the current single staff-toggle icon), so partial staffing is visible and each pip can be dragged independently. Follow-up to the now-shipped building→building worker drag; blocked on a multi-worker building actually existing (see [[multi-worker-buildings-roadmap]]). `[size: M] [?] [blocked]` `[phase: 4]`
- **Bulk-move modifier for worker transfers** — a modifier (e.g. shift-drag) to move N workers from one building to another in one gesture, instead of one pip-drag per worker. Only pays off once multi-pip staffing (above) exists. `[size: S] [?] [blocked]` `[phase: 4]`
- **Stable card ordering across views** — cards currently "move around" when adding/removing in the deck editor (and potentially other card grids); pick a sensible, stable sort order (by kind? cost? catalogue order?) and apply it consistently everywhere cards are listed — collection, deck editor picker/banner, pile viewers. `[size: S] [?] `
- **Bug: corner count-badge clipped in card grids** — `CardFace`'s `countBadge` (the ×N/∞ pill) sits at `top:-8px; right:-8px`, protruding past the tile; in a multi-column grid the tile to its right paints over it, so every card except the last-in-row shows only a partial badge. Affects the **Collection** and **Shop** grids (the deck editor's horizontal banner strip is unaffected — single row + top padding). Fix by insetting/raising the badge or nudging it inside the tile bounds, applied consistently across the card grids. `[size: S]`

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
  resolving to a real `content/cards.ts` id. `RunResult.score`/infinite payout and `Stats`
  surfacing stay deferred — see the planned-steps note above for why.
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
