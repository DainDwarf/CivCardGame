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
> the actionable cut, held here for later sessions. Suggested order: 1 → 2 & 3 → 4 → 5 → 6 → 7
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
- **Step 5 — Meta UI: map + shop + tutorials** — Campaign Map screen (DAG replacing
  `MissionSelect`'s flat list; node → launch panel); Shop tab (`meta/Shop.tsx`, buy copy
  tiers, spend Influence). Influence display in the nav ✅ done (see *Done / shipped*
  below) — the rest (map, shop, tutorial entry-node missions) still open.
  `[size: L]` `[phase: 3]`
- **Step 6 — Infinite missions (run loop)** — endless play in `run/engine.ts` (escalating
  threat, `score` = round, ends only on failure); author one infinite mission; infinite
  framing in gameover / `Stats`. `[size: M]` `[phase: 3]`
- **Step 7 — Stickers** *(last, deepest)* — resolve per-copy identity first (deck entries
  → `{ cardId, instanceId? }`). Board stickers (`setup.ts` modifiers); card stickers
  (per-copy, read by `effects.ts` / `production.ts`); shop sells + attach UI.
  `[size: L]` `[?]` `[phase: 3]`
- **Step 8 — Peripheral** — culture → hand size; `Stats` rework once rewards/trends exist.
  Independent. `[phase: 3]`

## Meta loop (`src/meta/`)

- **Tutorial missions** — the first few meta missions double as tutorials, introducing mechanics progressively → folded into **Step 5** above. `[?]` `[phase: 3]`
- **Card modifiers** — attach persistent modifiers to individual cards → **decided as stickers**; see **Step 7** above. `[phase: 3]`
- **Stats screen UI rework** — `Stats.tsx` is currently a plain list of run-result rows (shell-only, shipped with Phase 2 step 6); revisit its look once there's more to show (rewards, trends across runs) → **Step 8** above. `[?]` `[phase: 3]`

## Cards & content (`src/content/`)

- **Disasters — expand** — the `event` card mechanic shipped (see `CHANGELOG.md`); grow it out with more disaster types beyond the Barbarian and missions that inject them (details TBD) `[?]` `[phase: 4]`
- New mission type: "Metropolis" `[?]` `[phase: 4]`
- New mission: "Build the Wonder" `[?]` `[phase: 4]`
- Culture-based missions (depend on the Culture resource) `[?]` `[phase: 4]`
- Building that changes hand size (e.g. +1 card drawn per round) `[?]` `[phase: 4]`
- Culture thresholds change hand size by default (no building required) — culture as a passive progression axis `[?]` `[phase: 4]`
- Resources transformation? Like a building that transforms production into science for example `[phase: 4]`

## UI (`src/components/`)

- **Multi-pip staffing UI** — once a building can require 2–3 workers, its box needs one pip per worker slot (not the current single staff-toggle icon), so partial staffing is visible and each pip can be dragged independently. Follow-up to the now-shipped building→building worker drag; blocked on a multi-worker building actually existing (see [[multi-worker-buildings-roadmap]]). `[size: M] [?] [blocked]` `[phase: 4]`
- **Bulk-move modifier for worker transfers** — a modifier (e.g. shift-drag) to move N workers from one building to another in one gesture, instead of one pip-drag per worker. Only pays off once multi-pip staffing (above) exists. `[size: S] [?] [blocked]` `[phase: 4]`

## Game design & balance

- Card that gives a draw when expanding territory `[?]` `[phase: 4]`
- Card effects that trigger on discard / on draw, to enable combos `[?]` `[phase: 4]`
- Actually let Culture upgrade the hand size → **Step 8** above. `[?]` `[phase: 3]`



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
