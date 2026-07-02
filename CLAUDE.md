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
(`src/meta/MissionSelect.tsx`) and a run. Collection view, deck construction, and
localStorage persistence are not built yet.

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
  each tableau building's assigned `workers`, the `territory` cap on tableau size, and the
  card zones `deck`/`hand`/`discard`/`removed` — plus `blankState()`); it lives here, not in the shell, because the mission
  evaluators reason over it. Also `resources.ts` (`Resources` + arithmetic), `deck.ts`
  (draw/reshuffle), `effects.ts` (card effects — gain/draw/population/`territory`/`build`),
  `population.ts` (worker staffing — `requiredWorkers` / `isOperating` / `freePopulation`,
  `addBuilding` — plus `foodUpkeep`), `upkeep.ts` (`applyUpkeep`: operating buildings
  produce → mission ticks → population eats food; plus `projectedDelta` for the UI), and
  `production.ts` / `tableau.ts` (derived stats — including `usedTerritory` / `freeTerritory`,
  the territory cap that gates how many buildings can occupy the tableau). Unit tests sit alongside. **When adding
  a rule, put the logic here and test it directly — never bury it in a move or a
  component.**
- `src/content/` — typed game data, separate from logic. **Cards and buildings are
  distinct:** `buildings.ts` (`BUILDINGS` — building entities with `produces`/`defense`/
  `workers`/`tags`) holds what lives in the tableau; `cards.ts` (`CARDS`, each `permanent`
  or `recurring`) holds what lives in the deck. A card *constructs* a building via
  `effect.build` — the building enters `tableau`, the card is then filed by `kind`
  (`permanent` → `removed` pile, `recurring` → `discard`). So the same building can come
  from different cards, and a `BuildingInstance` references a `buildingId`, never a card.
  Also `decks.ts` (`DECKS` — premade run decks, each a `CardId[]` draw order),
  `boards.ts` (`BOARDS` — government boards; each sets all 8 starting resources: the 5
  core plus population/territory/culture), and `missions.ts` (`MISSIONS` — each mission
  supplies its `objective` and `failure` as pure predicates over `GameState`, plus an
  optional `onUpkeep`).

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
  `beginTurn`. `endTurn(state)` runs `applyUpkeep`, checks win/loss, then starts the
  next turn. `applyMove(state, moveFn, ...args)` clones `G` with `structuredClone`,
  runs the move, and checks win/loss. All three return a new `RunState` — the caller
  (React context) owns the mutable reference. `toRunResult(G, gameover)` promotes a
  finished run into the `RunResult` handed back to the meta loop.
- `src/run/moves.ts` — the moves (`playCard`, `assignWorker`, `unassignWorker`,
  `toggleStaffing`) — the **only** place `G` may change: validate, mutate the
  plain-object `G` draft, delegate computation to `src/rules/`, return `'invalid'` to
  reject. `playCard` pays costs (resources, discard cost), resolves the card's `effect`,
  then files the card by `kind` (`permanent` → `removed`,
  `recurring` → `discard`). `assignWorker`/`unassignWorker` move one worker at a time;
  `toggleStaffing` (the UI's building-box control) is all-or-nothing — one move either
  fills a building to its full worker requirement or empties it completely, rejected if
  there aren't enough idle workers to fill it. (Workers are allocated by `buildingId`,
  since same-type buildings are fungible.)
- `src/run/GameContext.tsx` — React context that holds `RunState` and exposes
  `{ G, gameover, moves, endTurn, undo, canUndo, restart, endRun }` via `useGame()`.
  `GameProvider` takes a `RunConfig` (`config` prop) and an `onRunEnd(result: RunResult)`
  callback, called when the player clicks "End Run" on a finished run.
- `src/components/Board.tsx` — the React board. Calls `useGame()` for state and
  actions; calls `moves.playCard` / `moves.toggleStaffing` / `endTurn()`. Display only —
  read derived values from `src/rules/` (e.g. `projectedDelta`, `freePopulation`), never
  recompute game logic.
- `src/app/App.tsx` — the shell that switches between the meta menu
  (`src/meta/MissionSelect.tsx`, which assembles a `RunConfig` via `buildRunConfig` and
  calls `onLaunch`) and `<GameProvider>` + `<Board>`. On `onRunEnd`, it stores the
  `RunResult` and switches back to the menu.
- `src/main.tsx` — mounts `<App>`.

See `src/contract.ts` for the `RunConfig`/`RunResult` types and `buildRunConfig` —
the spine between the two loops (docs/DESIGN.md, "The contract").

## Conventions

- **React 18 is pinned** — check compatibility before bumping.
- All state changes flow through `applyMove` / `endTurn` in `engine.ts` — moves
  receive a `structuredClone` of `G` and mutate it directly; never mutate `G` elsewhere.
- Tests import `{ describe, it, expect }` from `vitest` explicitly (globals are
  not enabled).
- **The UI is mouse-only by design** — no keyboard-activation affordances (e.g.
  `role="button"` + Enter/Space handlers on custom interactive `div`s). Don't add
  keyboard handlers to non-native interactive elements.
