# CivCardGame — TODO / Idea Backlog

> A scratch list for ideas caught **in passing** so they aren't lost — *not* a
> committed plan. Anything here is a candidate, not a promise. Decided, designed
> work lives in [`DESIGN.md`](DESIGN.md); this is the inbox that feeds it.

**How we use it:** say *"jot: …"* or *"TODO: …"* (or "note that down") mid-task and
the idea lands here as a one-liner without derailing what we're doing. We triage
later — promote items into `DESIGN.md` / real work, or drop them.

> Tags (optional): `[size: S/M/L]` rough effort · `[?]` needs design discussion ·
> `[blocked]` waiting on something else.

## Run loop (`src/run/`, `src/rules/`)

- Undo feature — but disallow undoing past a move that revealed new info (e.g. a draw) `[?]`

## Meta loop (`src/meta/` — not built yet)

_(empty)_

## Cards & content (`src/content/`)

- New mission type: "Metropolis" `[?]`
- New mission: "Build the Wonder" `[?]`
- Culture-based missions (depend on the Culture resource) `[?]`
- Building that changes hand size (e.g. +1 card drawn per round) `[?]`
- Resources transformation? Like a building that transforms production into science for example

## UI (`src/components/`)

- Top banner: merge the header (mission name, round, objective progress) and the sticky resources bar into one fixed top strip so key info is always visible at a glance `[size: S]`
- Pass over stat tooltips to strip specifics — they name particular cards/missions (e.g. Barbarian Tide, Settlers); keep them generic about the mechanic
- A more pleasant interface for buildings. Maybe a draggable map? And draggable workers? Or is it too much busywork?

## Tech debt & infra (build, tests, tooling)

_(empty)_

## Game design & balance

- Add a "Culture" resource; some cards require a Culture threshold to be playable `[?]`
- Exponentially rising expansion cost (each territory card costs more than the last) `[?]`
- Card that gives a draw when expanding territory `[?]`
- Card effects that trigger on discard / on draw, to enable combos `[?]`


---

## Done / shipped

> Completed items move here (newest first) so the backlog stays current but nothing
> silently vanishes.

- **Money resource** — new 🪙 resource produced by Market and Trading Post buildings; Eureka and Inspiration now cost money instead of production.
- **Remove keyboard shortcuts** — removed the global Escape handler (overlays close on backdrop click) and the Enter/Space onKeyDown on card buttons.
- **Destroy** card — 1🔨 recurring; demolishes a chosen building from the tableau, freeing its territory slot and returning its workers to the idle pool.
- Territory limitation — a building-slot cap (`G.territory`, starts at 6) gates how many buildings the tableau holds; building cards are unplayable when full. Two recurring expansion cards: **Conquest** (3⚔️ → +1 territory) and **Develop** (3🔨 → +1 territory), seeded into the default deck.
- All 8 code-review bugs fixed: End Round disabled mid-drag/mid-pending; `pending`/`warnEndRound` auto-cleared on round change; `shouldWarn` drives `warnEndRound` cleanup; `hasUnstaffedCapacity` simplified to `!isOperating()`; sacrifice-before-draw ordering fixed in `playCard`; test helpers throw on missing card.
- Recurring buildings — permanent/recurring hybrid card type (village_settlement etc.).
- Discard-as-cost actions — Forced Labor & Harvest now sacrifice a hand card (waived if you can't cover it).
