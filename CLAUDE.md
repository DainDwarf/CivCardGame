# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

CivCardGame is a **single-player** civilization-building card game that runs in the
browser. The player builds up a civilization solo — there is **no AI or human
opponent**. It is built on [boardgame.io](https://boardgame.io) (`numPlayers: 1`),
which is used purely for its turn/phase state machine, undo/redo, save/load, and
deterministic seeded RNG. Its multiplayer/networking and bot features are
intentionally unused.

Stack: TypeScript · Vite · React 18 · boardgame.io · Vitest.

It is a **roguelite deckbuilder** with two loops: a **run loop** (the boardgame.io
card game — play a *locked* pre-built deck against a mission) and a **meta loop**
(persistent deck construction, shop, mission selection — the *only* place decks are
edited). See [`docs/DESIGN.md`](docs/DESIGN.md) for the full game design and roadmap.
The code currently implements **Phase 1** — the run loop, under `src/run/`: hybrid
cards (permanent vs. recurring), the turn lifecycle, a **population/worker-staffing**
layer (buildings must be staffed to operate; the population eats food each round), and
mission-driven win/lose conditions. The meta loop (`src/meta/`) is not built yet.

## Commands

- `npm run dev` — Vite dev server. The boardgame.io **Debug panel** is enabled
  (`debug: true` in `src/client.ts`): inspect `G`/`ctx`, fire moves, and
  time-travel without building UI first.
- `npm run build` — type-check (`tsc --noEmit`) then produce a production bundle.
- `npm run typecheck` — type-check only (no emit).
- `npm test` — run the Vitest suite once.
- `npm run test:watch` — Vitest in watch mode.
- Single test file: `npx vitest run src/rules/scoring.test.ts`
- Tests matching a name: `npx vitest run -t "victory points"`

## Architecture

The codebase is split into a **pure core** and a thin **boardgame.io + React
shell**. The one rule that matters: the shell depends on the core; **the core
never imports the shell.** Keeping that boundary is what keeps game logic
unit-testable without spinning up a client.

**Core (framework-free — no boardgame.io, no React, no I/O):**

- `src/rules/` — all real game logic *and* the core state type. `state.ts` defines
  `GameState` (boardgame.io's `G` — the serializable run state, including `population`
  and each tableau building's assigned `workers` — plus `blankState()`); it lives here,
  not in the shell, because the mission evaluators reason over it. Also `resources.ts`
  (`Resources` + arithmetic), `deck.ts` (draw/reshuffle), `effects.ts` (recurring-card
  effects), `population.ts` (worker staffing — `requiredWorkers` / `isOperating` /
  `freePopulation` — plus `foodUpkeep`), `upkeep.ts` (`applyUpkeep`: operating buildings
  produce → mission ticks → population eats food; plus `projectedDelta` for the UI), and
  `production.ts` / `scoring.ts` / `tableau.ts` (derived stats). Unit tests sit
  alongside. **When adding a rule, put the logic here and test it directly — never bury
  it in a move or a component.**
- `src/content/` — typed game data, separate from logic: `cards.ts` (`CARDS`, each
  `permanent` or `recurring`), `decks.ts` (the Phase 1 `DEFAULT_DECK`), and
  `missions.ts` (`MISSIONS` — each mission supplies its `objective` and `failure` as
  pure predicates over `GameState`, plus an optional `onUpkeep`).

**Shell — the run loop (`src/run/`, boardgame.io) + React:**

- `src/run/setup.ts` — `createInitialState(missionId)`: the starting state for a run
  (seeds resources/deck, applies the mission's `setup`). Shuffling/randomness must go
  through boardgame.io's `random` plugin so runs stay reproducible — **never
  `Math.random` in game logic.** (Phase 1 deck order is deterministic; seeded shuffle
  arrives with the meta/sim seed wiring.)
- `src/run/moves.ts` — the moves (`playCard`, `assignWorker`, `unassignWorker`) — the
  **only** place `G` may change: validate, mutate the immer draft, delegate computation
  to `src/rules/`, return `INVALID_MOVE` (from `boardgame.io/core`) to reject. (Workers
  are allocated by `cardId`, since same-type buildings are fungible.)
- `src/run/index.ts` — `createCivGame(missionId)` builds the `Game<GameState>`. The
  round is driven by the turn lifecycle: `onBegin` advances the round and draws; `onEnd`
  resolves upkeep (`applyUpkeep` — only staffed buildings produce, then the mission's
  `onUpkeep`, then the population eats food) and discards the leftover hand. **`endIf`
  checks the mission's `objective` (win) first, then the universal famine loss
  (`food < 0`), then the mission's own `failure`.** The browser picks the mission from
  `?mission=`; the factory lets tests and the future simulator drive any mission
  headlessly (see `src/run/run.test.ts`).
- `src/components/Board.tsx` — the React board. Receives `G`, `ctx`, `moves`,
  `events` as `BoardProps<GameState>`; calls `moves.playCard` / `moves.assignWorker` /
  `moves.unassignWorker` / `events.endTurn()`. Display only — read derived values from
  `src/rules/` (e.g. `projectedDelta`, `freePopulation`), never recompute game logic.
- `src/client.ts` — wires `CivGame` + board into a boardgame.io `Client`
  (`numPlayers: 1`, local, debug on). `src/main.tsx` mounts it.

The meta loop (`src/meta/`) and the loop contract (`src/contract.ts`) are not built
yet — see the roadmap in `docs/DESIGN.md`.

## Conventions

- **React 18 is pinned** for boardgame.io compatibility (React 19 may trip its
  peer ranges). Check before bumping.
- All state changes flow through boardgame.io moves operating on immer drafts —
  mutate the `G` draft directly inside a move; never mutate `G` elsewhere.
- Tests import `{ describe, it, expect }` from `vitest` explicitly (globals are
  not enabled).
