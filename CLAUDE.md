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
**Phase 1** (the run loop, under `src/run/`) is done: hybrid cards (permanent vs.
recurring), the turn lifecycle, a **population/worker-staffing** layer (buildings must
be staffed to operate; the population eats food each round), and mission-driven
win/lose conditions. **Phase 2** (contract + meta shell) is in progress: `src/contract.ts`
defines `RunConfig`/`RunResult`; `src/app/App.tsx` switches between the meta menu
(`src/meta/MetaMenu.tsx` — a left-nav shell over the Mission/Collection/Decks/Stats
screens) and a run. `src/meta/store.ts` persists run history and the player's decks to
`localStorage`. Deck construction is built: `src/meta/DeckEditor.tsx` lets the player
build/edit any deck (`Decks.tsx`); `Collection.tsx` is still a read-only catalogue —
there's no per-player card ownership/unlock tracking yet.

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
  (draw/reshuffle), `effects.ts` (card effects — gain/draw/population/`territory`/`build`),
  `population.ts` (worker staffing over both buildings and work cards via the `Staffable`
  layer — `requiredWorkers`/`requiredWorkersOf` / `isOperating` / `freePopulation` /
  `findStaffable`, `addBuilding`/`addWork` with a shared `nextInstanceId` allocator — plus
  `foodUpkeep`), `upkeep.ts` (`applyUpkeep`: operating buildings *and* staffed work
  produce → mission ticks → population eats food; plus `discardWorkZone` (end-of-turn work
  filing) and `projectedDelta` for the UI), and
  `production.ts` / `tableau.ts` (derived stats — including `usedTerritory` / `freeTerritory`,
  the territory cap that gates how many buildings can occupy the tableau), and
  `deckBuilder.ts` (deck *construction* — `addCard`/`removeCard` on a plain `string[]`,
  returning `'invalid'` on an unresolvable cardId, mirroring `moves.ts`'s `'invalid'`
  signal; `groupCounts`, `resolveDeckCards`, `cloneDecks` — distinct from `deck.ts`,
  which owns the *in-run* draw pile, not deck editing). Unit tests sit alongside. **When adding
  a rule, put the logic here and test it directly — never bury it in a move or a
  component.**
- `src/content/` — typed game data, separate from logic. **Cards and buildings are
  distinct:** `buildings.ts` (`BUILDINGS` — building entities with `produces`/`defense`/
  `workers`/`tags`) holds what lives in the tableau; `cards.ts` (`CARDS`, each `permanent`,
  `recurring`, `work`, or `event`) holds what lives in the deck. A card *constructs* a building via
  `effect.build` — the building enters `tableau`, the card is then filed by `kind`
  (`permanent` → `removed` pile, `recurring` → `discard`). So the same building can come
  from different cards, and a `BuildingInstance` references a `buildingId`, never a card.
  A `work` card is **labour**: playing it costs no idle population and sticks it onto the board
  as a *staffable* `WorkInstance` in `GameState.workZone` (`rules/population.ts`'s `addWork`,
  auto-staffed like a building) — it produces its `effect.gain` only while staffed, at upkeep,
  and files to `discard` only at *end of turn* (`rules/upkeep.ts`'s `discardWorkZone`), not on
  play. Its worker spaces (`CardDef.workers`, default 1, `0` = always operating) share the
  staffing machinery with buildings (see the shared `Staffable` layer in `population.ts`).
  Corvée and Harvest are the current work cards. A fourth kind, `event`, is a **disaster** card (docs/TODO.md): mission-injected only —
  never shown in the collection or deck editor and never player-playable (`unplayableReason`
  rejects it, so `playCard` does too). An event left in hand at end of turn auto-resolves
  its `effect` and is destroyed to `removed` (see `rules/upkeep.ts`'s `resolveHandEvents`);
  `effect.loss` removes resources (the mirror of `gain`).
  Also `decks.ts` (`DeckDef` + `DEFAULT_DECKS` — seed data for a new player's deck list,
  each a `CardId[]` draw order; every deck is player-editable, there's no separate
  read-only "built-in" registry — see `meta/store.ts`), `boards.ts` (`BOARDS` —
  government boards; each sets all 8 starting resources: the 5 core plus
  population/territory/culture), and `missions.ts` (`MISSIONS` — each mission supplies
  its `objective` and `failure` as pure predicates over `GameState`, plus an optional
  `onUpkeep`).

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
  reject. `playCard` pays costs (resources, discard cost), resolves the card's `effect`,
  then files the card by `kind` (`permanent` → `removed`,
  `recurring` → `discard`) — except a `work` card, which resolves *no* effect on play,
  sticks onto the board via `addWork`, and files to `discard` only at end of turn.
  `assignWorker`/`unassignWorker`/`transferWorker`/`toggleStaffing` all target a `Staffable`
  by its instance `id` via `findStaffable`, so they operate on a building *or* a work box
  interchangeably. `toggleStaffing` (the UI's box control) is all-or-nothing — one move either
  fills a box to its full worker requirement or empties it completely, rejected if
  there aren't enough idle workers to fill it. (Building workers are allocated by instance id,
  drawn from the same `nextInstanceId` space as work boxes so the two never collide.)
- `src/run/GameContext.tsx` — React context that holds `RunState` and exposes
  `{ G, gameover, moves, endTurn, undo, canUndo, restart, endRun }` via `useGame()`.
  `GameProvider` takes a `RunConfig` (`config` prop) and an `onRunEnd(result: RunResult)`
  callback, called when the player clicks "End Run" on a finished run.
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
  reuses for its own click-to-zoom.
- `src/meta/` — the meta menu. `MetaMenu.tsx` is the shell: a left column of big nav
  buttons switches between four screens — `MissionSelect.tsx` (mission/board/deck
  picker, deck list sourced from the player's own `decks`; assembles a `RunConfig` via
  `buildRunConfig` and calls `onLaunch`), `Collection.tsx` (read-only catalogue over
  `content/cards.ts` — no per-player ownership tracking yet), `Decks.tsx` (every deck
  in the player's store, New/Edit/Delete), and `Stats.tsx` (the run history list).
  `DeckEditor.tsx` (opened from `Decks.tsx`, not a nav tab) edits a single `DeckDef` in
  place — a main picker area (grouped by kind, same groups as `Collection.tsx`) of
  `CardFace` tiles above a bottom banner representing the deck itself (name, card count,
  Save/Cancel, and its cards grouped into ×N stacks like the run loop's pile viewer).
  Cards move between the two by click (the fast path) or drag, via the same hand-rolled
  pointer-drag convention `Board.tsx` uses elsewhere (no drag-and-drop library in this
  project); add/remove go through `rules/deckBuilder.ts`. `store.ts`'s
  `loadStore`/`saveStore` persist
  `PlayerStore` (`runHistory` + `decks`, the latter seeded from `content/decks.ts`'s
  `DEFAULT_DECKS` on a fresh profile) to `localStorage`.
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
  Light value (`--accent` vs `--card-permanent-banner`, `--badge-bg` vs `--text-strong`), so
  a theme can move one without the other. Colors used at several alphas are stored as
  space-separated channel tokens (`--accent-rgb: 59 125 216`) composed with
  `rgb(var(--accent-rgb) / 12%)`. The only literals left in modules are pure-black
  drop-shadows (`rgba(0,0,0,…)`) and white scrims (`rgba(255,255,255,…)`) — not
  color-identity, they read fine in either theme. **Adding a theme (e.g. a color-blind
  palette) is one `THEMES` entry in `meta/settings.ts` plus one `:root[data-theme='…']`
  block in `index.css` — zero module edits.**
