# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

CivCardGame is a **single-player** civilization-building card game that runs in the
browser. The player builds up a civilization solo — there is **no AI or human
opponent**. The run loop uses a lightweight custom engine (`src/run/engine.ts`) for
the turn/phase state machine; state is held in React context (`src/run/GameContext.tsx`).

Stack: TypeScript · Vite · React 18 · Vitest.

It is a **roguelite deckbuilder** with two loops: a **run loop** (the boardgame.io
card game — play a *locked* pre-built deck against a mission) and a **meta loop**
(persistent deck construction, shop, mission selection — the *only* place decks are
edited). See [`docs/DESIGN.md`](docs/DESIGN.md) for the full game design and roadmap.
**Phase 1** (the run loop, under `src/run/`) is done: hybrid cards (building vs.
action), the turn lifecycle, a **population/worker-staffing** layer (buildings must
be staffed to operate; the population eats food each round), and mission-driven
win/lose conditions. **Phase 2** (contract + meta shell) is done: `src/contract.ts`
defines `RunConfig`/`RunResult`; `src/app/App.tsx` switches between the meta menu
(`src/meta/MetaMenu.tsx` — a left-nav shell over the Mission/Collection/Decks/Stats
screens) and a run. `src/meta/store.ts` persists run history and the player's decks to
`localStorage`. Deck construction is built: `src/meta/DeckEditor.tsx` lets the player
build/edit any deck (`Decks.tsx`). **Phase 3** (economy & progression) is in progress:
`rules/collection.ts` (`OwnedCards`) tracks per-card ownership and `PlayerStore` now
carries `collection`/`influence`/`mapProgress` alongside `runHistory`/`decks`, seeded
from a deliberately narrow `content/collection.ts`'s `STARTING_COLLECTION` and a single
starting deck (`content/decks.ts`); `Collection.tsx` and `DeckEditor.tsx`'s picker now read
`collection` and omit any not-yet-unlocked card entirely (Phase 3 Step 2's visibility half —
an unlock is meant to be a surprise, so nothing hints at what's still out there, including a
total count). Step 2's other half, the deck-editor copy cap, is also done: `rules/deckBuilder.ts`'s
`addCard` rejects an add past the copies owned (`'unlimited'` never caps), and `DeckEditor.tsx`'s
picker dims/disables a tile once every owned copy is already in the deck rather than letting
the click/drag silently no-op. Its count badge shows *remaining* copies (owned minus however
many are already in this deck), not total owned — `CardFace`'s `alwaysShowBadge` prop lets
that badge surface even at ×1/×0, unlike every other `countBadge` use (deck banner, pile
viewer, `Collection.tsx`), which stay hidden at 1 since those show a stack count, not a
remaining-to-add count. A card owned only once never gets a picker badge at all. **Phase 3
Step 3** (mission model + campaign-map data) is also done: `content/missions.ts`'s
`MissionDef` gained `prereqs` (mission ids that must be completed first — empty = a DAG
root) and `kind: 'standard' | 'infinite'` (all three current missions are `'standard'`;
`'infinite'` is Step 6's). `rules/campaign.ts` (`isCompleted`/`isAvailable`/
`availableMissions`) is the prereq-gating logic, pure and unit-tested: a mission is
available once every one of its `prereqs` is in `mapProgress`, and — a deliberate choice,
pinned by a test — stays available once completed (replayable, not hidden again). The test
DAG reuses the existing three missions: The Long Winter is the root (`prereqs: []`); The
Enlightenment and Barbarian Tide both gate on it (`prereqs: ['long_winter']`).
The campaign map (`CampaignMap.tsx`, **Step 5.1** below) is the UI consumer of this gating.
`App.tsx`'s
`recordResult` marks `mapProgress[missionId] = true` on a victory outcome (both the normal
end-run path and restarting an already-finished run) — just the completion flag, so the
unlock chain is real and playable now. **Phase 3 Step 4** (reward computation) is also done:
each `MissionDef` carries a required `reward: { influence, unlockCardId }` (a mission always
grants exactly one unlock, per the design doc); `rules/rewards.ts`'s `computeRewards` is the
one pure function that turns a mission + "was it already completed" + the current collection
into an Influence/collection delta — a no-op on a replay (checked against `mapProgress` as it
stood *before* this run's result, never the post-update value, or every clear would look like
a first clear) and a no-op unlock if the card is somehow already owned. `App.tsx`'s
`recordResult` applies that delta to `store.influence`/`store.collection` right alongside the
`mapProgress` write; `Board.tsx`'s gameover overlay previews the identical payout off the same
function and the pre-run `mapProgress`/`collection` App hands down (a preview, not a second
source of truth), showing "+N ⭐ Influence · Unlocked X" on a first clear or "Already cleared —
no reward for a replay." otherwise. **Phase 3 Step 5.1** (campaign map screen) is
also done: `CampaignMap.tsx` replaces the old flat `MissionSelect` list with humanity's history
as a horizontally-scrollable branching tech tree (docs/DESIGN.md). Each `MissionDef` now carries
an authored `map: { col, row }` grid position (`content/missions.ts`); nodes are placed from it,
edges drawn from `prereqs`, and per-node state comes from `rules/campaign.ts` — `isCompleted` →
cleared (✓, replayable), `isAvailable` → available (▶), else locked. Locked nodes render as
**silhouettes** — position + lock glyph shown so the player can orient in history, but
name/objective/reward hidden and the node inert — a deliberate divergence from the "unlock is a
surprise" *hide-everything* precedent (the node's existence is shown, its identity isn't).
Ages (`content/ages.ts`) label the timeline as right-arrow bands across the top; only a single
"Testing" placeholder ships now (no age→column-range mapping yet). Clicking a cleared/available
node opens a launch popup (board picker left, deck picker right, nothing pre-selected, "Start
Mission" disabled until both chosen) that assembles the `RunConfig` and calls `onLaunch`; the
reward preview shows the Influence amount and that *a* card unlocks but not which (the specific
unlock is still revealed only on the gameover overlay). The deck picker reuses the Decks screen's
tile-fan + list-view display via `components/DeckDisplay.tsx` (`DeckTile`/`DeckListOverlay`,
extracted from `Decks.tsx` so both render identically) minus the edit/copy/delete buttons — in
the popup, clicking an unselected deck selects it, clicking the selected one opens its list-view.
**Phase 3 Step 5.2** (shop) is also done: `rules/shop.ts` is the one pure place the copy-tier
economy lives — a `TIER_LADDER` (×1→×2→×4→unlimited at 1/2/5 Influence; the numbers are
balance-tunable, the ladder a core rule like `MAX_DECKS`), `nextTier` (the next rung + cost, or
null for a maxed/not-owned/off-ladder count — one predicate that means "owned *and* still
upgradeable"), and `buyTier` (the immutable `{ influence, collection }` purchase, returning null
for an unaffordable/maxed/not-owned card, mirroring `computeRewards`). `Shop.tsx` (the new
`🛒 Shop` nav tab) lists only upgradeable owned cards (the `nextTier !== null` filter hides both
the ∞ basics and anything not unlocked), grouped like `Collection.tsx`, each tile a `CardFace`
(current tier badge) over a one-click buy button (`⭐cost → ×N`, disabled when unaffordable — no
confirm step, since a purchase only ever *adds* copies). The `⭐ <count>` balance itself lives
on the `Shop` nav button (`MetaMenu.tsx`) rather than as a separate standalone pill, since Shop
is the only place Influence is spent. `App.tsx`'s `buyCardTier` is the write
path: it runs `buyTier` and `persist`s the reduced Influence + bumped collection, so that badge
and the shop list update live (a card bought to unlimited drops out). **Phase 3 Step 5.3**
(mission detail panel) is also done: `MissionDef` gained a `lore` field — narrative flavour
text, kept distinct from the existing `description` (which states the mechanical objective) —
authored for all three missions. Clicking a cleared/available map node now opens
`MissionDetailPanel` first, a same-size modal inserted before the existing board/deck picker:
a left column of lore + description + victory/failure hints, and a right column with the
reward — an Influence line (struck through once already cleared) under a subtitle reading
"1 new card" or, post-clear, "Cards already unlocked" — showing either a grey face-down
`MysteryCard` (pre-clear, since which card a mission unlocks stays a surprise until it's
actually cleared) or the real unlocked card via `CardFace` (post-clear) beneath it. Its
"Continue" hands off to `LaunchPopup` (the board/deck picker, unchanged apart from dropping
the lore/reward text its header used to carry, now that Step 5.3 owns that). Still to come:
tutorial missions (Step 8), `RunResult.score`/reward for
`'infinite'` missions (Step 6 — no infinite
mission exists yet to produce one), and `Stats` surfacing a per-run reward (deferred since
`RunResult` deliberately excludes rewards, and there's no per-run record of whether that run
was a first clear).

## Commands

- `npm run dev` — Vite dev server.
- `npm run build` — type-check (`tsc --noEmit`) then produce a production bundle.
- `npm run typecheck` — type-check only (no emit).
- `npm test` — run the Vitest suite once.
- `npm run test:watch` — Vitest in watch mode.
- Single test file: `npx vitest run src/rules/scoring.test.ts`
- Tests matching a name: `npx vitest run -t "victory points"`

## Architecture

The codebase is split into a **pure core** and a thin **React shell**. The one rule
that matters: the shell depends on the core; **the core never imports the shell.**
Keeping that boundary is what keeps game logic unit-testable without spinning up a client.

**Core (framework-free — no boardgame.io, no React, no I/O):**

- `src/rules/` — all real game logic *and* the core state type. `state.ts` defines
  `GameState` (boardgame.io's `G` — the serializable run state, including `population`,
  each tableau building's assigned `workers`, the `territory` cap on tableau size, the
  transient `workZone` of played `work` cards awaiting staffing, and the
  card zones `deck`/`hand`/`discard`/`removed` — plus `blankState()`); it lives here, not in the shell, because the mission
  evaluators reason over it. Also `resources.ts` (`Resources` + arithmetic), `deck.ts`
  (draw/reshuffle), `effects.ts` (card effects — gain/loss/draw/population/`territory`/`culture`),
  `population.ts` (worker staffing over both buildings and work cards via the `Staffable`
  layer — `requiredWorkersOf` / `isOperating` / `freePopulation` /
  `findStaffable`, `addBuilding`/`addWork` with a shared `nextInstanceId` allocator — plus
  `foodUpkeep`), `upkeep.ts` (`applyUpkeep`: operating buildings *and* staffed work
  produce → mission ticks → population eats food; plus `discardWorkZone` (end-of-turn work
  filing) and `projectedDelta` for the UI), and
  `production.ts` / `tableau.ts` (derived stats — including `usedTerritory` / `freeTerritory`,
  the territory cap that gates how many buildings can occupy the tableau), and
  `deckBuilder.ts` (deck *construction* — `addCard`/`removeCard` on a plain `string[]`,
  returning `'invalid'` on an unresolvable cardId, mirroring `moves.ts`'s `'invalid'`
  signal; `groupCounts`, `resolveDeckCards`, `cloneDecks`, and `MAX_DECKS` — the committed
  cap on how many decks a player may own (the number is balance-tunable, the limit itself is
  a core rule), enforced at the deck writer in `App.tsx`'s `saveDeck` with `Decks.tsx`'s
  disabled "+ New Deck" button as its UI reflection — distinct from `deck.ts`,
  which owns the *in-run* draw pile, not deck editing), `collection.ts` (`OwnedCards`
  — `Record<cardId, number | 'unlimited'>`, an absent entry meaning not yet unlocked —
  plus `copiesOwned`/`isOwned` read helpers; `rules/rewards.ts` (mission unlock) and
  `rules/shop.ts` (shop purchase) are its writers), and `shop.ts` (the copy-tier economy —
  `TIER_LADDER`, `nextTier`, and the immutable `buyTier` purchase; see Phase 3 Step 5.2 above).
  Unit tests sit alongside. **When adding
  a rule, put the logic here and test it directly — never bury it in a move or a
  component.**
- `src/content/` — typed game data, separate from logic. **A building card *is* the building**
  (there's no separate building catalogue): `cards.ts` (`CARDS`, each `building`, `action`,
  `work`, or `event`) is the single card catalogue, and a `building` card carries its own
  building stats (`produces`/`cultureOutput`/`workers`/`tags`) right on the `CardDef`. Playing a
  `building` card places it in the `tableau` (one territory slot, auto-staffed) as a
  `BuildingInstance` that references the card by `cardId`; the card is **not** filed to a pile —
  it lives on as that tableau instance, filed nowhere, for as long as it stays in play.
  `discard` is where a card lands by default once it's done being useful; a demolished
  building's card going to `removed` instead (`moves.ts`'s `playCard` destroy branch) isn't
  an inherent trait of the `building` kind — it's a property of whatever effect took it out
  of the tableau, and today the only such effect is the Destroy action card's
  `effect.destroy`. A future card could just as well reclaim territory by *discarding* a
  building instead of destroying it, filing that card to `discard` like anything else.
  An `event` resolving to `removed` (rather than `discard`) is the same story as building
  demolition — a property of its own `effect.remove` flag (see `rules/effects.ts`'s
  `CardEffect`), not an inherent trait of the `event` kind either. An `action` card resolves
  its `effect` and files to `discard`.
  A `work` card is **labour**: playing it costs no idle population and sticks it onto the board
  as a *staffable* `WorkInstance` in `GameState.workZone` (`rules/population.ts`'s `addWork`,
  auto-staffed like a building) — it produces its `effect.gain` only while staffed, at upkeep,
  and files to `discard` only at *end of turn* (`rules/upkeep.ts`'s `discardWorkZone`), not on
  play. Its worker spaces (`CardDef.workers`, default 1, `0` = always operating) share the
  staffing machinery with buildings (see the shared `Staffable` layer in `population.ts`).
  Corvée and Harvest are the current work cards. A fourth kind, `event`, is a **disaster** card (docs/TODO.md): mission-injected only —
  never shown in the collection or deck editor and never player-playable (`unplayableReason`
  rejects it, so `playCard` does too). An event left in hand at end of turn auto-resolves
  its `effect`, then files to `discard` like any other resolved card *unless* that effect sets
  `remove: true`, in which case it's destroyed to `removed` instead (see `rules/upkeep.ts`'s
  `resolveHandEvents`). Barbarian, the one event so far, sets `remove: true` (`effect.loss`
  removes resources — the mirror of `gain`).
  Also `decks.ts` (`DeckDef` + `DEFAULT_DECKS` — seed data for a new player's deck list;
  a fresh player starts with exactly one deck, `'starter'`, deliberately narrow enough to
  be built from `collection.ts`'s `STARTING_COLLECTION` alone; every deck (seed or
  player-made) is equally player-editable, there's no separate read-only "built-in"
  registry — see `meta/store.ts`), `collection.ts` (`STARTING_COLLECTION`, an
  `OwnedCards` — see `rules/collection.ts` below — seeding a fresh player's card
  ownership), `boards.ts` (`BOARDS` — government boards; each sets all 8 starting
  resources: the 5 core plus population/territory/culture), and `missions.ts`
  (`MISSIONS` — each mission supplies its `objective` and `failure` as pure predicates
  over `GameState`, plus an optional `onUpkeep`).

**Shell — the run loop (`src/run/`) + React:**

- `src/run/setup.ts` — `createInitialState(config: RunConfig)`: the starting state for
  a run. The board (`config.board`) sets the baseline for all 8 starting resources;
  the mission's `setup` then layers its own modifiers on top. **Never use `Math.random`
  in game logic** — `config.deck` is already shuffled deterministically from
  `config.seed` (see `src/contract.ts`/`src/rules/rng.ts`); the discard-pile reshuffle
  also draws from the seeded RNG (`GameState.rngState`, advanced by `src/rules/deck.ts`'s
  `drawCard` via `rng.ts`'s `shuffleFromState`), not preserved deck order.
- `src/run/engine.ts` — the turn state machine. `RunState = { G, gameover }`.
  `createRun(config: RunConfig)` builds the initial state and runs the first
  `beginTurn`. `endTurn(state)` runs `applyUpkeep`, checks win/loss, resolves any `event`
  cards still in hand (`resolveHandEvents` — apply effect, exile to `removed`), recycles the
  hand and files the turn's played `work` cards to `discard` (`discardWorkZone`), re-checks
  win/loss, then starts the next turn. `applyMove(state, moveFn, ...args)` clones `G` with `structuredClone`,
  runs the move, and checks win/loss. All three return a new `RunState` — the caller
  (React context) owns the mutable reference. `toRunResult(G, gameover)` promotes a
  finished run into the `RunResult` handed back to the meta loop.
- `src/run/moves.ts` — the moves (`playCard`, `assignWorker`, `unassignWorker`,
  `toggleStaffing`) — the **only** place `G` may change: validate, mutate the
  plain-object `G` draft, delegate computation to `src/rules/`, return `'invalid'` to
  reject. `playCard` pays costs (resources, discard cost), then routes by `kind`: a `building`
  card is placed in the `tableau` via `addBuilding` (staying in play, *not* filed to a pile) and a
  `work` card sticks onto the board via `addWork` (resolving *no* effect on play, filing to
  `discard` only at end of turn); every other card resolves its `effect` and, if `action`,
  files to `discard`. A card with `effect.destroy` demolishes a chosen tableau building and sends
  *that* building's card to `removed`.
  `assignWorker`/`unassignWorker`/`transferWorker`/`toggleStaffing` all target a `Staffable`
  by its instance `id` via `findStaffable`, so they operate on a building *or* a work box
  interchangeably. `toggleStaffing` (the UI's box control) is all-or-nothing — one move either
  fills a box to its full worker requirement or empties it completely, rejected if
  there aren't enough idle workers to fill it. (Building workers are allocated by instance id,
  drawn from the same `nextInstanceId` space as work boxes so the two never collide.)
- `src/run/GameContext.tsx` — React context that holds `RunState` and exposes
  `{ G, gameover, board, moves, endTurn, undo, canUndo, restart, endRun }` via `useGame()`
  (`board` is the `RunConfig.board` this run was launched with, along for presentation —
  e.g. `Board.tsx`'s board-tinted ground backdrop — not gameplay logic, which never
  branches on the board id past `setup.ts`). `GameProvider` takes a `RunConfig`
  (`config` prop) and an `onRunEnd(result: RunResult)` callback, called when the player
  clicks "End Run" on a finished run.
- `src/components/Board.tsx` — the React board. Calls `useGame()` for state and
  actions; calls `moves.playCard` / `moves.toggleStaffing` / `endTurn()`. Display only —
  read derived values from `src/rules/` (e.g. `projectedDelta`, `freePopulation`), never
  recompute game logic. The card visual itself — `CardFace` (name/cost/kind banner/art/
  worker icons/effect text, plus the outer box and its kind coloring, all in one CSS
  module so the kind-coloring rules always resolve against their own ancestor) — lives
  in `src/components/CardFace.tsx`, shared with the deck editor's picker/banner tiles
  and the Collection screen's picker grid; Board layers hand-specific extras (overlap,
  hover-lift, drag/deal/shake states) on top via a `className` prop rather than owning
  any card styling itself. Clicking a hand or pile-viewer card opens
  `src/components/CardZoomOverlay.tsx` — a full-screen dismissable enlargement of a
  single `CardFace` (click anywhere to close) — which the Collection screen also
  reuses for its own click-to-zoom. The full-viewport `.groundBackdrop` behind the
  board is tinted per the run's government board — Board.tsx stamps a `data-board`
  attribute that `Board.module.css` matches against one `--board-<id>-ground` token per
  board (see the theming convention below), so adding a board's own tint is a
  CSS-only edit, no component change.
- `src/meta/` — the meta menu. `MetaMenu.tsx` is the shell: a left column of big nav
  buttons switches between five screens — `CampaignMap.tsx` (the Mission tab — the DAG
  of missions as a horizontally-scrollable tech tree, each node opening `MissionDetailPanel`
  (lore/explanation/reward preview, Phase 3 Step 5.3 above) whose "Continue" hands off to a
  board/deck launch popup that assembles a `RunConfig` via `buildRunConfig` and calls
  `onLaunch`; see Phase 3 Step 5.1 above), `Collection.tsx` (read-only catalogue of the cards the
  player owns, reading `collection` to omit not-yet-unlocked cards), `Shop.tsx` (the
  copy-tier shop — spend Influence to deepen owned cards, Phase 3 Step 5.2 above; lists
  only upgradeable cards, each tile a `CardFace` over a one-click buy button calling
  `onBuyTier` → `App.tsx`'s `buyCardTier`), `Decks.tsx` (every deck
  in the player's store as a grid of tiles, each a hover-revealed shingled fan of the
  deck's cards grouped ×N via `groupCounts` — the ×N badge itself only shows on hovering
  that card, via `CardFace`'s `badgeClassName`. The tile and its list-view overlay are the
  shared `DeckTile`/`DeckListOverlay` from `components/DeckDisplay.tsx` (also used by
  `CampaignMap.tsx`'s launch popup); Decks passes its Edit/Copy/Delete buttons through their
  `actions` slots. Clicking a tile opens a list-view overlay
  of the deck mirroring the run loop's pile viewer, click-to-zoom via the shared
  `CardZoomOverlay`; its header (name/count/Edit) is `position: sticky` so it stays
  pinned and opaque over the cards while scrolling, and centers a click-to-zoom/
  click-outside-to-close hint over that same row. Edit lives on both the tile and the
  overlay in the accent color; Delete (tile-only) is a two-click confirm in
  `--danger-strong`, flipping to "Confirm?" and reverting on mouse-out/navigating away.
  "New Deck" is the grid's own next slot — a hollow dashed tile after the last deck,
  rather than a button above the grid — and stays put (rather than disappearing) once
  `MAX_DECKS` is hit (a core rule, see `deckBuilder.ts` below): it disables itself and its
  label swaps to the limit-reached message, so the cap is explained right where the
  next deck would have gone. And `Stats.tsx` (the run history list).
  `DeckEditor.tsx` (opened from `Decks.tsx`, not a nav tab) edits a single `DeckDef` in
  place — a main picker area (grouped by kind, same groups as `Collection.tsx`) of
  `CardFace` tiles above a bottom banner representing the deck itself (name, card count,
  Save/Cancel, and its cards grouped into ×N stacks like the run loop's pile viewer).
  Cards move between the two by click (the fast path) or drag, via the same hand-rolled
  pointer-drag convention `Board.tsx` uses elsewhere (no drag-and-drop library in this
  project); add/remove go through `rules/deckBuilder.ts`. `store.ts`'s
  `loadStore`/`saveStore` persist
  `PlayerStore` (`runHistory` + `decks`, the latter seeded from `content/decks.ts`'s
  `DEFAULT_DECKS`; plus `influence`/`collection`/`mapProgress`, seeded from
  `content/collection.ts`'s `STARTING_COLLECTION` on a fresh profile) to `localStorage`.
  `parsePlayerStore`'s lenient decks-fallback (a store predating the deck editor gets
  reseeded rather than rejected) doesn't extend to these three newer fields — pre-alpha,
  there's no save worth migrating, so a store missing any of them is just unrecognized.
- `src/components/GameMenu.tsx` — the global-action surface (docs/DESIGN.md's Phase 2
  "game menu (save, config, codex)"): a top-right burger button. Opens a central popup
  listing the items; each opens its own submenu window stacked on top. The Save
  submenu opens with a callout that progress autosaves and this submenu is only for
  backups, then export downloads the `PlayerStore` as a base64 `.civsave` file (`meta/store.ts`'s
  `exportSave`); Load reads one back (`importSave`) and Clear resets to `emptyStore()`.
  Both Load and Clear replace `runHistory`/`decks` wholesale via `App.tsx`'s `persist`,
  so both stage as a `PendingAction` behind an explicit confirm/cancel step before
  applying — export needs no such gate, since it doesn't touch the live store. The
  Config submenu holds device-local preferences (`meta/settings.ts`'s `Settings`,
  persisted under their own `localStorage` key — kept out of `PlayerStore` since
  they're not game progress, so Save's Load/Clear never touches them): a segmented
  **theme picker** (`settings.theme`, built from `meta/settings.ts`'s `THEMES` list —
  System/Light/Dark, System being the default for a fresh profile — resolved to the
  concrete palette actually applied as `data-theme` on documentElement via
  `resolveTheme`/`applyTheme`, since `'system'` isn't itself a valid `data-theme` value;
  `applyTheme` also attaches a live `matchMedia` `change` listener when the choice is
  `'system'`, so an OS light/dark flip is reflected without a reload — see the
  color-palette convention below), a "confirm before ending a round" toggle that folds into `Board.tsx`'s existing
  end-round warning dialog, and a UI-size slider (`settings.uiScale`) that `App.tsx` applies by wrapping the whole
  app in a `transform: scale()` container (`App.module.css`) — chosen over CSS `zoom`,
  which was tried and reverted, because a transformed ancestor becomes the containing block
  for its `position: fixed` descendants, so the run loop's fixed layout and drag clones
  scale together and stay anchored (see docs/TODO.md). Because that wrapper makes `fixed`
  children scroll with content on a body-scrolling screen, the meta shell scrolls inside
  `.content` instead of the body (`MetaMenu.module.css`), and `Board.tsx`/`DeckEditor.tsx`
  divide their drag-clone pointer coordinates by the scale (visual→local). The Codex
  submenu renders `Codex.tsx` — a pure,
  static in-menu rules reference (resources, card kinds, population/staffing, turn
  structure, keyword glossary; list-shaped data in `content/codex.ts`, narrative pages
  authored in the component) that reads no run state, so it's identical on both screens.
  On the run screen only, an optional `runControls` prop adds Restart Run / End Run items. While
  the run is still live these are `PendingAction`-gated like Save's Load/Clear: Restart
  discards the run and starts a fresh one (`GameContext.tsx`'s `restart`, which already
  no-ops the recording half since the run was never finished); End Run abandons it and
  returns to the meta menu without recording a `RunResult`, mirroring
  `handleImportStore`'s silent-discard precedent. Once the run is over, both act
  immediately with no confirm step (the result is already fixed either way — Restart
  records it via `restart`, End Run via `endRun`, same as the gameover overlay's own
  buttons), and Restart is disabled on a won run, mirroring the overlay's own rule.
- `src/app/App.tsx` — the shell that switches between `<MetaMenu>` (which calls
  `onLaunch` with an assembled `RunConfig`) and `<GameProvider>` + `<Board>`. On the
  meta screen it mounts `<GameMenu>` directly; on the run screen a small `RunGameMenu`
  wrapper renders inside `<GameProvider>` so it can pull `runControls` off `useGame()`.
  On `onRunEnd`, it stores the `RunResult` and switches back to the menu.
- `src/main.tsx` — mounts `<App>`. Also imports `src/index.css`, the one bit of global CSS
  in an otherwise all-CSS-Modules codebase; and, before the first render, sets
  `document.documentElement.dataset.theme` from `resolveTheme(loadSettings().theme)` so the
  saved color theme is applied with no light-then-dark flash on load — a plain resolve, not
  `applyTheme`, since a live `'system'` listener needs an owner to tear it down and `App.tsx`
  (not yet mounted at this point) is that owner. `index.css` holds the color-theme palette
  (see the theming convention below) plus two `body` resets: `margin: 0`, since the
  browser's default 8px body margin would otherwise inset every full-bleed/fixed-position
  element (the run loop's hand bar, the deck editor's banner) from the true viewport edges;
  and `background: var(--surface-sunken)`, a themed fallback for any stray gap in the UI
  that would otherwise show through to browser-default white — see the *Dark-mode contrast
  bugs* fix in docs/TODO.md's Done/shipped, where an unthemed `body` was exactly such a
  gap (revealed through the run loop's hand bar's transparent top edge).

See `src/contract.ts` for the `RunConfig`/`RunResult` types, `buildRunConfig` (now
takes the player's `decks` as a required argument — there's no static deck registry to
fall back on), and `reshuffleRunConfig` (re-shuffles an existing `RunConfig.deck`
directly, used by `GameContext.tsx`'s restart) — the spine between the two loops
(docs/DESIGN.md, "The contract").

## Conventions

- **React 18 is pinned** — check compatibility before bumping.
- All state changes flow through `applyMove` / `endTurn` in `engine.ts` — moves
  receive a `structuredClone` of `G` and mutate it directly; never mutate `G` elsewhere.
- Tests import `{ describe, it, expect }` from `vitest` explicitly (globals are
  not enabled).
- **The UI is mouse-only by design** — no keyboard-activation affordances (e.g.
  `role="button"` + Enter/Space handlers on custom interactive `div`s). Don't add
  keyboard handlers to non-native interactive elements.
- **The whole app renders inside a `transform: scale()` wrapper** (`App.tsx` /
  `App.module.css`, the UI-size setting) — this constrains all UI work, so three rules
  hold everywhere:
  1. **Never rely on document/body scroll.** A transformed ancestor makes its
     `position: fixed` descendants scroll with body content instead of pinning, so a
     new full-screen surface must scroll *inside its own bounded container*
     (`height` + `overflow`), the way the meta shell scrolls in `.content`
     (`MetaMenu.module.css`) — never `min-height: 100vh` growing the body. `index.css`
     keeps the body itself un-scrollable.
  2. **Convert visual→local px for any new pointer-drag/ghost clone.** `clientX/Y` and
     `getBoundingClientRect()` report *visual* (post-scale) px; writing them into an
     inline `left/top/width/height` on a clone inside the wrapper double-scales them, so
     divide by the scale (`px(v) = v / uiScale`, threaded as a prop — see `Board.tsx` /
     `DeckEditor.tsx`). But **do not** convert `offsetHeight`/`offsetWidth`-derived
     values (they're already in layout space — e.g. `Board.tsx`'s gamearea/pill insets),
     and leave hit-testing alone (it compares `clientX` to `getBoundingClientRect()`,
     visual-to-visual, already consistent).
  3. **Divide viewport units that must track the real screen by `var(--ui-scale)`.**
     A raw `vh`/`vw` measures the true viewport and then gets re-scaled; new full-bleed
     sizes or popup caps should use `calc(… / var(--ui-scale, 1))` (the var inherits from
     the wrapper to every descendant) — see the pile panel / Codex caps.
- **All color goes through the theme palette — never write a raw color in a module.**
  Every color is a semantic CSS custom property defined in `src/index.css`: `:root` holds
  the default **Light** palette (each token's value is the exact hex the module used before
  the theme retrofit, so Light is pixel-identical to the pre-theme look), and
  `:root[data-theme='dark']` overrides the same tokens for **Dark**. `data-theme` lives on
  `document.documentElement` (set pre-mount in `main.tsx`, kept in sync by an `App.tsx`
  effect from `settings.theme`). CSS Modules only ever reference `var(--token)`. Rules:
  same hex + same role → one token; same hex + different roles → separate tokens sharing the
  Light value (`--accent` vs `--card-building-banner`, `--badge-bg` vs `--text-strong`), so
  a theme can move one without the other. Colors used at several alphas are stored as
  space-separated channel tokens (`--accent-rgb: 59 125 216`) composed with
  `rgb(var(--accent-rgb) / 12%)`. The only literals left in modules are pure-black
  drop-shadows (`rgba(0,0,0,…)`) and white scrims (`rgba(255,255,255,…)`) — not
  color-identity, they read fine in either theme. **Adding a theme (e.g. a color-blind
  palette) is one `THEMES` entry in `meta/settings.ts` plus one `:root[data-theme='…']`
  block in `index.css` — zero module edits.**
