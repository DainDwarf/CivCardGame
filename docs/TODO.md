# CivCardGame — TODO / Idea Backlog

> A scratch list for ideas caught **in passing** so they aren't lost — *not* a
> committed plan. Anything here is a candidate, not a promise. Decided, designed
> work lives in [`DESIGN.md`](DESIGN.md); this is the inbox that feeds it.

**How we use it:** say *"jot: …"* or *"TODO: …"* (or "note that down") mid-task and
the idea lands here as a one-liner without derailing what we're doing. We triage
later — promote items into `DESIGN.md` / real work, or drop them.

> Tags (optional): `[size: S/M/L]` rough effort · `[?]` needs design discussion ·
> `[blocked]` waiting on something else · `[phase: N]` roadmap phase (1 = run loop · 2 = contract + meta shell · 3 = economy & progression · 4 = content & balance).

## Phase 2 build plan — sequenced `[phase: 2]`

> The agreed task order for closing the loop (contract + meta shell). Numbered = do in
> order; each step is meant to leave something runnable. See *The contract* and
> *Government boards* in [[DESIGN]].

1. ~~**Scaffold meta content**~~ — done, see *Done / shipped* below. `[size: S]`
2. ~~**Mission-select menu**~~ — done, see *Done / shipped* below. `[size: M]`
3. ~~**Define `contract.ts`**~~ — done, see *Done / shipped* below. `[size: M]`
4. ~~**Wire the loop closed**~~ — done, see *Done / shipped* below. `[size: L]`
5. ~~**localStorage persistence**~~ — done, see *Done / shipped* below. `[size: M]`
6. ~~**Extend the meta menu**~~ — done, see *Done / shipped* below. `[size: M]`
7. ~~**Deck construction**~~ — done, see *Done / shipped* below. `[size: L]`

## Meta loop (`src/meta/`)

- **Tutorial missions** — the first few meta missions double as tutorials, introducing mechanics progressively `[?]` `[phase: 3]`
- **Card modifiers** — meta may offer ways to attach persistent modifiers to individual cards (long-term idea, details TBD) `[?]` `[phase: 3]`
- **Color-blind themes** — the Theme picker (see *Done / shipped*) landed the CSS-variable palette; adding accessibility palettes is now cheap. Author deuteranopia / protanopia / tritanopia themes, each a pure additive `:root[data-theme='…']` block in `index.css` plus one `THEMES` entry in `meta/settings.ts` — no module edits. Non-color cues already exist (card banners carry WONDER/BUILDING/ACTION/EVENT text + event's red border; Stats win/loss carries 🏛️/💀 + text), so a palette-only first cut is reasonable; revisit non-color cues if testing shows gaps. `[size: M]` `[?]` `[phase: 2]`
- **"Follow system" theme option** — add a `System` choice to the Theme picker that resolves the OS light/dark preference via `matchMedia` + a live `change` listener into a concrete `data-theme`, instead of a fixed Light/Dark pick. `[size: S]` `[?]` `[phase: 2]`
- **Stats screen UI rework** — `Stats.tsx` is currently a plain list of run-result rows (shell-only, shipped with Phase 2 step 6); revisit its look once there's more to show (rewards, trends across runs) `[?]` `[phase: 3]`
- **Decks screen UI rework** — `Decks.tsx` (shipped with Phase 2 step 7) is a first-pass layout: plain stacked deck cards, no search/filter/sort; give it a real visual pass `[?]` `[phase: 2]`
- **Codex menu UI rework** — `Codex.tsx` (shipped populating the codex submenu) is a first-pass layout: one long scrollable page of definition lists inside the fixed 300px submenu window, no topic navigation, no icons on most entries. Give it a real visual pass — likely a topic-list → page view (or tabs), a wider/roomier surface than the shared `.submenuPanel`, and richer per-topic presentation. `[?]` `[phase: 2]`

## Cards & content (`src/content/`)

- **Disasters — expand** — the `event` card mechanic shipped (see *Done / shipped*); grow it out with more disaster types beyond the Barbarian and missions that inject them (details TBD) `[?]` `[phase: 4]`
- New mission type: "Metropolis" `[?]` `[phase: 4]`
- New mission: "Build the Wonder" `[?]` `[phase: 4]`
- Culture-based missions (depend on the Culture resource) `[?]` `[phase: 4]`
- Building that changes hand size (e.g. +1 card drawn per round) `[?]` `[phase: 4]`
- Culture thresholds change hand size by default (no building required) — culture as a passive progression axis `[?]` `[phase: 4]`
- Resources transformation? Like a building that transforms production into science for example `[phase: 4]`
- **Drop the building/card distinction** — playing a building card should keep the
  building's simplified tableau look, but should no longer file the card to the
  `removed` pile on construction; Demolishing a building move the card into the removed pile since it left the plateau; clicking a placed building (outside its worker zone)
  should open the card zoom popup. This runs against CLAUDE.md's current explicit
  building/card split (`content/buildings.ts` entities vs. `content/cards.ts`'s
  `effect.build` constructing them, filed separately by `kind`) — treat as a big
  semantic change needing a full doc + code assessment (not a quick UI tweak) before
  scoping the actual work. `[?]` `[size: L]` `[phase: 2]`

## UI (`src/components/`)

- **Dark-mode contrast bugs** — some text renders black-on-dark in Dark theme: card
  name text in the deck builder and the run loop hand, and the burger-menu/submenu
  headers. Also the run loop's hand bottom banner has a black→white gradient that's
  too bright in Dark. `[phase: 2]`
- **Fading transition between meta and run stages** — `App.tsx`'s meta↔run screen switch is an instant cut; a fade would smooth it out `[?]` `[phase: 2]`
- **Multi-pip staffing UI** — once a building can require 2–3 workers, its box needs one pip per worker slot (not the current single staff-toggle icon), so partial staffing is visible and each pip can be dragged independently. Follow-up to the now-shipped building→building worker drag; blocked on a multi-worker building actually existing (see [[multi-worker-buildings-roadmap]]). `[size: M] [?] [blocked]` `[phase: 4]`
- **Bulk-move modifier for worker transfers** — a modifier (e.g. shift-drag) to move N workers from one building to another in one gesture, instead of one pip-drag per worker. Only pays off once multi-pip staffing (above) exists. `[size: S] [?] [blocked]` `[phase: 4]`

## Game design & balance

- Card that gives a draw when expanding territory `[?]` `[phase: 4]`
- Card effects that trigger on discard / on draw, to enable combos `[?]` `[phase: 4]`



---

## Rejected

> Considered and turned down — kept (not deleted) so we don't re-litigate the same idea
> without new information.

- **Ignore worker assignment in the undo list** — assign/unassign worker moves would skip pushing undo snapshots, so undo only steps through "meaningful" turn actions. Tried it (a `quietMove` action updating `present` without touching `past`), then reverted: having worker reassignment silently bundled into the prior card-play's undo step is confusing to the player, while the alternative — reconciling worker state done in the "present" back onto a restored past snapshot — is deeply error-prone (instance-count and population-total edge cases). For now, worker reassignments stay part of the regular undo list; revisit if a cleaner solution presents itself.
- **UI size via `document.documentElement.style.zoom`** — tried a Config-submenu slider applying CSS `zoom` to the document root, on the theory that a root-level zoom would keep everything (including `Board.tsx`'s pointer-drag math) internally consistent, the way real browser zoom does. It doesn't: CSS `zoom` doesn't rescale the viewport that `clientX`/`clientY`/`getBoundingClientRect()` are reported against, so raw pixel values captured from those and written back into inline styles (drag/slotDrag/workerDrag clone positions, the ghost clone, the drop-zone position, the gamearea/gameover-pill insets) get re-zoomed a second time on render. Patched that specific issue with a `px()` real→local conversion helper at each of those six call sites (confirmed fixed at 130% — drag clones tracked the cursor correctly). But testing then surfaced a second, broader problem: run-screen layout broke anyway — building slots sliding under the resource banner, background color bleeding past the bottom hand bar — because `Board.tsx` also leans heavily on `position: fixed` elements, which a root-level zoom interacts with in ways the `px()` patch doesn't cover. Reverted entirely (settings.ts's `uiScale` field, the `App.tsx` zoom effect, `Board.tsx`'s `px()` helper and its six call sites, the GameMenu slider UI). See *UI size setting* above for what a real attempt would need to account for.

## Done / shipped

> Completed items move here (newest first) so the backlog stays current but nothing
> silently vanishes. Everything through **v0.0.1 (end of Phase 1)** has been moved to
> [`CHANGELOG.md`](../CHANGELOG.md); this section restarts empty for Phase 2 onward.

- **`work` card type** — promoted the "reserved action" mechanic (Corvée, Harvest) into a
  first-class fourth card kind, making an emerging core loop explicit. A `work` card sticks
  onto the board as a *staffable* box (`WorkInstance` in the new `GameState.workZone`) instead
  of the old static locked strip: playing it costs **no** idle population and imposes no
  play-time pop gate, it auto-staffs from the idle pool like a building, produces its
  `effect.gain` **only while staffed** (at upkeep, so `projectedDelta` shows it), and files to
  `discard` at **end of turn** (`rules/upkeep.ts`'s `discardWorkZone`), not on play. Buildings
  and work share **one** staffing layer — a `Staffable` union with `requiredWorkersOf` /
  `isOperating` / `findStaffable`, the four worker moves resolving an instance in either zone,
  and a unified `nextInstanceId` allocator so a building and a work box never collide on an id
  — while keeping two production reducers (`tableauProduction` vs. `workZoneProduction`) since
  the source data differs. Worker count is `CardDef.workers` (default 1, `0` = always
  operating). This **removed** the old `popReserve`/`reservedPop`/`reservedActions`/
  `reservedGains` mechanic wholesale and superseded the *"Delay played-card discard to end of
  turn"* backlog item (which had mis-scoped it as applying to all cards). UI: a teal Work card
  kind, an interactive work-box strip with drag/click staffing and its own out-of-slot-grid
  drop hit-testing (`workBoxAt`/`staffableUnder`), plus Work sections in the Collection and
  deck editor and a Codex entry. `[size: L]` `[phase: 2]`
- **Theme picker** — a Config-submenu segmented control (`meta/settings.ts`'s
  `Settings.theme`, sourced from a `THEMES` list) offering **Light** and **Dark**. As the
  backlog item predicted, the bulk of the work was the CSS retrofit, not the picker: every
  color across the 11 `*.module.css` files (278 occurrences, ~91 distinct hex, all previously
  hardcoded — no color variables existed) was moved onto ~100 semantic CSS custom properties
  defined in `index.css`. `:root` holds the Light palette, where each token's value is the
  *exact* pre-retrofit hex, so Light is pixel-identical to the old look; `:root[data-theme='dark']`
  overrides the same tokens for Dark. `data-theme` sits on `document.documentElement`,
  applied pre-mount in `main.tsx` (no load flash) and kept in sync by an `App.tsx` effect on
  `settings.theme`. Token conventions: same hex + different role → separate aliased tokens
  (so a theme can move one without the other); multi-alpha colors use space-separated channel
  tokens (`--accent-rgb: 59 125 216` → `rgb(var(--accent-rgb) / 12%)`); pure-black shadows and
  white scrims stay literal. The payoff: a new theme is now one `THEMES` entry + one
  `[data-theme]` block, zero module edits — see the *Color-blind themes* and *"Follow system"
  theme option* backlog items that this unblocks. `[size: L]` `[phase: 2]`
- **UI size setting** — a Config-submenu slider (`meta/settings.ts`'s `Settings.uiScale`,
  0.8–1.5, clamped) that scales the whole UI. Second attempt after the `zoom` one was
  reverted (see *Rejected* below); this one uses **`transform: scale()`** on a single
  wrapper around App's entire render (`App.tsx` + new `App.module.css`, `--ui-scale` set
  inline and inherited down). The key reason it works where `zoom` didn't: a transformed
  ancestor becomes the **containing block for its `position: fixed` descendants**, so the
  run loop's hand bar/gamearea, the game-menu burger, the deck-editor banner, and every
  drag clone reparent to the wrapper and scale as one — instead of `zoom`'s inconsistent
  interaction with viewport-relative fixed elements. Three follow-on pieces: (1) the wrapper
  is sized `width/height: calc(100v* / scale)` so its pre-scale box, once scaled, is exactly
  the viewport (fixed children get a full-viewport containing block); `index.css` clips the
  body since nothing scrolls it anymore. (2) The meta shell can't rely on **body scroll** any
  longer — a transform ancestor makes "fixed" children scroll away with body content — so
  `MetaMenu.module.css` moves scrolling into the already-present `.content { overflow-y: auto }`
  by bounding `.shell`'s height (`min-height: 100vh` → `height: 100%`) and adding
  `.content { min-height: 0 }`; the burger and deck-editor banner (containing block = the
  outer wrapper) then stay pinned. (3) `getBoundingClientRect()`/`clientX` report *visual*
  (post-scale) px, so `Board.tsx` and `DeckEditor.tsx` divide their drag/ghost-clone inline
  `left/top/width/height` by the scale (`px(v) = v / uiScale`, threaded as a prop) to convert
  visual→local; `offsetHeight`-derived insets stay in layout space and need no conversion,
  and hit-testing compares visual-to-visual so it's untouched. A rem/font-size scale was
  reconsidered and rejected again on cost — it would need a mechanical px→rem sweep across
  209 `px` occurrences in 11 CSS modules, vs. the transform's ~5 localized coordinate sites.
  Popup viewport-unit caps (`Board.module.css` pile panel, `Codex.module.css`) now divide
  their `vh`/`vw` by `--ui-scale` so they can't exceed the screen at large scale.
- **Collection screen UI rework** — `Collection.tsx` now looks like the deck editor's
  picker area: real `CardFace` tiles (same kind-grouping — Buildings & Wonders /
  Actions — as before) in a grid, no bottom banner since there's nothing to build here.
  Clicking a tile opens an enlarged zoom preview, reusing the run loop's own card-zoom
  rather than a second implementation: the zoom overlay (previously ~15 lines of inline
  JSX + CSS living only in `Board.tsx`) was extracted into a shared
  `src/components/CardZoomOverlay.tsx` + `.module.css`, taking a `cardId` and a
  caller-supplied hint string; `Board.tsx`'s hand/pile-viewer zoom now renders it too,
  unchanged in behavior. Dropped the old bespoke `CardTile`/`describeCost`/`describeCard`
  helpers `Collection.tsx` had grown before `CardFace` existed.
- **Meta screens: disable text selection** — `MetaMenu.module.css`'s `.shell` (the
  shared root for Mission/Collection/Decks/Stats/DeckEditor) now sets
  `user-select: none`, matching `Board.module.css`'s `.app` on the run screen, so
  pointer-drag in the deck editor never triggers native text selection.
- **Deck editor UI rework** — `DeckEditor.tsx` now looks like the game: a main picker
  area (same kind-grouping as before) of real card visuals in a grid, above a bottom
  banner representing the deck itself (name, card count, Save/Cancel, cards grouped
  into ×N stacks like the run loop's pile viewer). Getting there required extracting
  the run loop's card rendering — `CardFace`, previously private to `Board.tsx` — into
  a shared `src/components/CardFace.tsx` + `CardFace.module.css`. The extraction had a
  landmine: the original CSS colored a card by kind via descendant selectors reaching
  from an *outer* wrapper class into *inner* spans (`.permanent .cardTop`, etc.); had
  the inner/outer split across CSS Modules (different files hash class names
  independently), that coloring would've broken silently. Fixed by having `CardFace`
  own its *complete* visual — outer box, kind border/tint, and inner content — in one
  module; `Board.tsx`'s hand-specific extras (overlap margin, hover-lift, drag/deal/
  shake/pending/sacrifice/unaffordable states) layer on top via a `className` prop
  instead. Cards move between the deck editor's picker and banner by click (unchanged
  fast path) or by drag — a new hand-rolled pointer-drag implementation matching
  `Board.tsx`'s existing convention (no drag-and-drop library in this project). The
  banner is `position: fixed` (not `sticky` — `MetaMenu.module.css`'s `.content` never
  actually scrolls internally, so sticky just sat at its normal flow position), spanning
  the full width beside the nav like the run loop's own fixed hand bar. Getting it flush
  against both screen edges surfaced two latent gaps this app never had: `.nav` used the
  default `box-sizing: content-box`, so its `flex: 0 0 220px` rendered 32px wider than
  220px once its own padding was added (now `border-box`, scoped to `.nav`); and there
  was no CSS reset anywhere, so the browser's default 8px `<body>` margin inset the whole
  page from the true viewport edges (new `src/index.css`, just `body { margin: 0 }`,
  imported once from `main.tsx` — the only global CSS in an otherwise all-CSS-Modules app).
- **Drop deck descriptions** — `DeckDef.description` (a free-text blurb set in
  `DeckEditor.tsx`'s textarea, shown on `Decks.tsx`'s tiles and as the `MissionSelect.tsx`
  deck-row subtitle) is gone. It was flavor text with no gameplay role; the deck row in
  `MissionSelect.tsx` now shows card count via `OptionCard`'s existing `detail` prop
  instead (its `description` prop is now optional, so a row with no description just
  omits that line).
- **Populate the codex submenu** — `GameMenu.tsx`'s Codex item now opens the rules
  reference instead of a placeholder. `src/components/Codex.tsx` is a pure, static
  component (no `useGame` — renders identically on the meta menu and mid-run) covering
  five topics: resources (the 5 core with their collapse consequences + the universal
  negative-resource loss rule, plus the 3 strategic gauges), card kinds
  (permanent/recurring/event lifecycle), population & staffing, turn structure, and a
  keyword glossary. It fills the gap `Collection.tsx` leaves — *how the game works*, not
  *what cards exist*. Its list-shaped data (`CODEX_CORE_RESOURCES`/`CODEX_STRATEGIC`/
  `CODEX_GLOSSARY`) lives in `src/content/codex.ts`; the narrative pages are authored in
  the component. Tuned numbers are pulled live from `rules/` (`FOOD_PER_POP`,
  `cultureStep`) rather than transcribed, so they can't drift on a rebalance. Reuses
  `CardFace.tsx`'s `COST_ICON` for the core-resource icons. It's the first
  long submenu, so `Codex.module.css` gives it its own capped-height scroll container.
  The secondary buildings-/missions-almanac and lore ideas were left out of scope.
- **Disasters — `event` card type** — a new `CardKind`, `event` (`content/cards.ts`),
  for mission-injected disaster cards. Events never appear in the collection or deck
  editor and are never player-playable (`unplayableReason` returns `{ kind: 'event' }`,
  which `playCard` already funnels through); `deckBuilder.addCard` also rejects them. An
  event left in hand at end of turn auto-resolves its effect and is destroyed to the
  `removed` pile (never recycled to discard) — `resolveHandEvents` in `rules/upkeep.ts`,
  called from `endTurn` (with a second win/loss check after) and folded into
  `projectedDelta` so the impact shows in the resource bar's projected delta + collapse
  warning while an event sits in hand. New `effect.loss` (`rules/effects.ts`) removes
  resources — the mirror of `gain`, via `subtractResources`, no clamp so a resource can
  go negative into `coreCollapse`. First event: `barbarian`, drains 4 Military. The
  `barbarian_tide` mission was reworked (full replace of the old 3-Wonders/Threat design):
  its `setup` seeds 4 barbarians into the run deck (shuffled deterministically from the
  run RNG; mutates the copied `G.deck`, never the saved meta deck) and it's won by
  beating all 4 with Military ≥ 0 — so a fatal 4th blow is a defeat, not a last-stand win.
  UI (`Board.tsx`): a red "Event" banner/`.event` card variant, a `-4⚔️` effect line, and
  a "resolves at end of round" note in the shared conditions band; event cards are *not*
  dimmed (they're a threat to focus on, not tune out). Further expansion is deferred —
  see *Disasters — expand* above `[phase: 4]`.
- **In-run menu extras (end run / restart run)** — `GameMenu.tsx`'s popup gained an
  optional `runControls` prop, adding Restart Run / End Run items after save/config/codex.
  Supplied only on the run screen, via a new `RunGameMenu` wrapper in `App.tsx` rendered
  inside `GameProvider` so it can read `useGame()`. While the run is still live both
  items are confirm-gated via the same `PendingAction` mechanism as Save's Load/Clear —
  Restart reuses `GameContext.tsx`'s existing `restart` unchanged (it already discards a
  live run without recording anything, since `finishedResult` returns `undefined` when
  the run isn't over); End Run abandons the run and returns to the meta menu with no
  `RunResult` recorded, mirroring `handleImportStore`'s silent-discard precedent for a
  save Load/Clear mid-run. Once the run is over, both act immediately with no confirm
  step — the result is already fixed regardless of which is pressed (Restart records it
  via `restart`, End Run via `endRun`), matching the gameover overlay's own Restart/End
  Run buttons, which have no confirm step either; Restart is also disabled on a won run,
  mirroring the overlay's existing "Disable restart after a won run" rule below.
- **Populate the config submenu (partial)** — `GameMenu.tsx`'s Config item gained a
  "confirm before ending a round" toggle, backed by a new `src/meta/settings.ts`
  (`Settings`, `loadSettings`/`saveSettings`, its own `civcardgame:settings`
  localStorage key). Settings are deliberately kept out of `PlayerStore` — they're
  device preferences, not game progress, so a Save-submenu Load/Clear doesn't touch
  them. The toggle folds into the existing `Board.tsx` end-round warning dialog
  (previously only shown for idle-worker warnings) rather than adding a second
  dialog. A UI-size slider and a theme picker were considered too; both split out as
  their own backlog items above (*UI size setting*, *Theme picker*) — the size
  slider was actually built and reverted (see *Rejected* below), and the theme picker
  later shipped after its CSS custom-property retrofit (see *Theme picker* above).
- **Fix: loading/clearing a save mid-run left the run dangling** — `GameMenu.tsx`'s
  Load/Clear called `App.tsx`'s `persist` (via `onImportStore`) directly, which only
  replaced `store`; it never touched `view`, so confirming either one while
  `view.screen === 'run'` left `GameProvider`/`Board` mounted on top of the
  just-replaced store instead of returning to the menu. `App.tsx` now routes
  `onImportStore` through a new `handleImportStore`, which persists the new store and
  then unconditionally resets `view` to `{ screen: 'menu' }` (a no-op if already there)
  — bypassing the normal `onRunEnd` → `recordResult` path, since the run's `RunConfig`
  no longer corresponds to anything in the new store and shouldn't be scored as a
  `RunResult`.
- **Save export/import/clear** — `GameMenu.tsx`'s Save submenu downloads/loads a
  `.civsave` file and can reset the store outright: `meta/store.ts` gained
  `exportSave`/`importSave`, wrapping `PlayerStore` in a versioned envelope
  (`{ schemaVersion, exportedAt, store }`) so a save sitting on a player's disk across a
  future `PlayerStore` shape change can still be migrated by version rather than by
  guessing from field presence — base64-encoded (unicode-safe, via
  `TextEncoder`/`TextDecoder` rather than raw `btoa`/`atob`, since deck
  names/descriptions are free text) into a single-file blob. `loadStore`'s lenient
  shape-check was factored out into `parsePlayerStore`, shared with `importSave` so a
  save from before the deck-editor feature still seeds default decks the same way the
  live localStorage key does. `emptyStore` (already `loadStore`'s fallback) is now also
  exported for Clear save to reset to directly. Load and Clear both replace the store
  wholesale (`App.tsx`'s `persist`) and stage as a `PendingAction` behind an explicit
  confirm/cancel step in the submenu before applying; export needs no such gate since it
  doesn't touch the live store. The Save submenu opens with a callout that progress
  autosaves and this submenu is only for backups, since its presence could otherwise
  read as "you must save manually."
- **Game menu** — `src/components/GameMenu.tsx` is the shell's global-action surface
  called for by `docs/DESIGN.md`'s Phase 2 description: a top-right burger button,
  mounted by `App.tsx` alongside either `MetaMenu` or the run's `Board`, so it
  overlays both loops. Opens a central popup listing the decided items (save, config,
  codex); each opens its own submenu window stacked on top. Config/codex are still
  empty placeholders; save is now populated (see *Save export/import/clear* above). The
  in-run screen gaining extra items (end run, restart run) is now also shipped — see
  *In-run menu extras (end run / restart run)* above.
- **Deck construction** (Phase 2 build plan step 7) — `src/meta/DeckEditor.tsx` is the
  new deck editor: name/description fields, a card picker (originally reused
  `Collection.tsx`'s bespoke text-tile component, later superseded by the shared
  `CardFace` — see *Deck editor UI rework* and *Collection screen UI rework* below), and
  the in-progress deck as removable chips. `Decks.tsx` is now a single
  editable list (New/Edit/Delete) — the old "premade vs. custom" split is gone
  entirely. `content/decks.ts`'s `DeckId`/`DECKS` (a closed union + registry) became
  `DeckDef`/`DEFAULT_DECKS` (a plain array of seed data): a fresh player's store is
  seeded with these 3 decks via a new `rules/deckBuilder.ts` (`cloneDecks`, so nothing
  shares references with the seed constant), fully editable from that point on — there
  is no separate read-only deck concept anymore. `deckBuilder.ts` also holds
  `addCard`/`removeCard` (returning `string[] | 'invalid'`, mirroring `run/moves.ts`'s
  `'invalid'` signal — `addCard` rejects an unknown cardId as a data-coherence check,
  distinct from the size/copy/rarity constraints still deferred to Phase 4),
  `groupCounts` (promoted out of `Decks.tsx`, now shared + tested), and
  `resolveDeckCards`. `PlayerStore` gained `decks: DeckDef[]`; `App.tsx` now holds one
  `PlayerStore`-shaped state with a single `persist()` writer (previously `saveStore`
  only ever wrote `runHistory` — once decks became a sibling field, that would have
  silently wiped saved decks on every recorded run). `contract.ts`'s `buildRunConfig`
  now takes the player's `decks` as a required third argument instead of reading a
  static registry, and gained `reshuffleRunConfig` (reshuffles `RunConfig.deck`
  directly, no registry lookup) — **this supersedes the restart mechanism described in
  "Restart reshuffles with a fresh seed" below**: `GameContext.tsx`'s `restart` no
  longer calls `buildRunConfig` with a `deckId` lookup (which has no path to the
  player's store), it calls `reshuffleRunConfig` on the live `RunConfig` instead.
- **Extend the meta menu** (Phase 2 build plan step 6) — `src/meta/MetaMenu.tsx` is a
  new shell: a left column of big nav buttons (Mission / Collection / Decks / Stats)
  switches between meta screens, rendered in `src/app/App.tsx` instead of mounting
  `MissionSelect` directly. `MissionSelect.tsx` lost its inline run-history block (now
  its own `Stats.tsx` tab) and otherwise kept its mission/board/deck picker + Start Run
  button unchanged. `Collection.tsx` lists the full `CARDS` catalogue (grouped
  Buildings & Wonders / Actions) and `Decks.tsx` lists `DECKS` with their card
  contents — both read-only, shell-only per the step's scope; deck construction
  (writing to the persisted store) is step 7.

- **localStorage persistence** — `src/meta/store.ts`'s `loadStore`/`saveStore` persist the
  player store to `localStorage` under key `civcardgame:player-store`. Only holds
  `runHistory` today; collection/saved-decks/progress will extend `PlayerStore` as those
  features land. `App.tsx` seeds `runHistory` state from `loadStore()` on mount and calls
  `saveStore` after every recorded run (including restarts). Missing/corrupt data falls
  back to an empty store; `localStorage` failures (quota, private browsing) are swallowed
  so the run continues in-memory-only.
- **Strategic resources on `RunResult`** — `RunResult.stats` gained `strategicResources:
  { population, territory, culture }` alongside the existing `finalResources` (the 5
  core resources). Kept as a separate field rather than folded into `finalResources`
  since population/territory/culture live as top-level `GameState` fields, not inside
  `Resources`. `engine.ts`'s `toRunResult` populates it from `G` at run end.
- **Seeded discard-pile reshuffle** — `drawCard` (`rules/deck.ts`) no longer preserves
  discard order when it recycles into the deck; it now reshuffles via
  `rules/rng.ts`'s new `shuffleFromState`, which resumes a persisted RNG stream instead
  of reseeding from scratch each time. `GameState` gains `rngState` (the generator's
  serializable state, from `pure-rand`'s `getState()`/`xoroshiro128plusFromState`),
  seeded once from `RunConfig.seed` in `setup.ts`'s `createInitialState` and advanced
  each reshuffle — so it rides along for free with `structuredClone`/undo, and a
  restart (which mints a fresh seed) reshuffles both the initial deck and every future
  discard-recycle differently. `blankState` defaults `rngState` from a fixed `'blank'`
  seed for tests that don't care.
- **Disable restart after a won run** — the gameover overlay's Restart button now
  disables itself (with an explanatory tooltip) when `gameover.outcome === 'victory'`;
  restarting a win doesn't make sense — the player should hit End Run to bank the
  result instead. Defeats are unaffected; Restart still works there.
- **Restart reshuffles with a fresh seed** — `GameContext.tsx`'s `restart` was reusing
  the live `RunConfig` unchanged, so it replayed the identical draw order every time.
  `RunConfig` now carries `deckId` alongside the already-shuffled `deck`, so `{ board,
  missionId, deckId, seed }` alone fully determines a run — restarting calls
  `buildRunConfig` again with the same `missionId`/`board`/`deckId` but a fresh
  `crypto.randomUUID()` seed, the same path a menu launch takes. Kept `deckId` on
  `RunConfig` (rather than reshuffling the already-shuffled `deck` array in place) so
  any single run — including a restart — stays reproducible from its own seed alone,
  without needing the seed chain of every restart that came before it.
- **Wire the loop closed** (Phase 2 build plan step 4) — `src/app/App.tsx` is the new
  shell: a meta↔run view switch holding `{ screen: 'menu' } | { screen: 'run'; config }`
  state. `createInitialState`/`createRun` now take a `RunConfig` instead of a bare
  `missionId`; `createInitialState` applies the board's baseline (all 8 starting
  resources) before the mission's `setup` layers its modifiers on top — disaster
  injection stays unimplemented (no mission defines one yet; the seam is the assembled
  `RunConfig.deck`, per `buildRunConfig`). `GameProvider` takes `{ config, onRunEnd }`;
  `restart` now carries `RunConfig` through the reducer action instead of reading
  `missionId` off the live state. The gameover overlay's "End Run" button (previously
  disabled) now calls the new `endRun()` context method, which promotes the finished
  `RunState` into a `RunResult` (`engine.ts`'s `toRunResult`) and hands it to
  `onRunEnd` — `App` stores it and returns to the menu, where `MissionSelect` shows a
  one-line "Last run: …" summary. `main.tsx` now mounts `<App>` instead of
  `<MissionSelect>` directly. `run.test.ts`'s `start()` helper builds a `RunConfig`
  by hand (unshuffled deck) rather than going through `buildRunConfig`, since the
  tests assert on a fixed hand order that a seeded shuffle would disturb; added a
  board-application test (monarchy/republic) since Tribe's values happen to match the
  old hardcoded defaults and wouldn't have caught a broken board wire-up.
- **Define `contract.ts`** (Phase 2 build plan step 3) — `src/contract.ts` formalizes
  `RunConfig` (`deck` / `board` / `missionId` / `seed`) and `RunResult` (`outcome` /
  `missionId` / `stats`; deliberately no `rewards` field — those are looked up from
  the mission or derived from `stats` by the meta loop, not carried on the result),
  plus `buildRunConfig(selection, seed)`, which
  promotes a `RunSelection` into a `RunConfig` by resolving the picked `DeckId` and
  shuffling its cards deterministically from `seed`. New `src/rules/rng.ts` wraps
  `pure-rand` (`xoroshiro128plus` + `uniformInt`) behind `seededRng`/`shuffle` — the
  one seam allowed to produce randomness; `seededRng` is exposed (not just `shuffle`)
  so step 4 can extend the same stream to the discard-pile reshuffle. Not yet wired
  into `createRun`/`setup.ts` — those still take a bare `missionId` and a fixed deck
  until step 4 swaps the pipeline over to consume a `RunConfig`.
- **Mission-select menu** (Phase 2 build plan step 2) — `src/meta/MissionSelect.tsx`,
  the first meta screen, replaces the old direct-to-run mount in `main.tsx`. Picks
  mission (of 3) / board (of 3) / deck (of 3) into a provisional `RunSelection`
  (`{ missionId, boardId, deckId }`) held in local state. "Start Run" is intentionally
  disabled — the Board is unreachable via UI until step 4 wires the loop closed;
  `run.test.ts` still exercises the run loop directly in the meantime.
- **Scaffold meta content** (Phase 2 build plan step 1) — `src/content/boards.ts`
  (`BoardId` + `BOARDS`: Tribe, Monarchy, Republic, each setting all 8 starting
  resources) and `src/content/decks.ts` restructured from a single `DEFAULT_DECK`
  into a `DeckId`/`DECKS` registry (Balanced, Industrious, Scholarly). Not yet wired
  into a run — boards are inert data until step 2 (mission-select menu) and step 4
  (setup assembly) consume them.
