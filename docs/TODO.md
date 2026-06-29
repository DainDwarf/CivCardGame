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

## UI (`src/components/`)

_(empty)_

## Tech debt & infra (build, tests, tooling)

_(empty)_

## Game design & balance

- Add a "Culture" resource; some cards require a Culture threshold to be playable `[?]`
- "Space" resource capping how many buildings you can have; cards to remove buildings to free space; military expands space with exponentially rising thresholds `[?]`
- Recurring buildings? (a permanent/recurring hybrid card type) `[?]`
- Card effects that trigger on discard / on draw, to enable combos `[?]`

---

## Done / shipped

> Completed items move here (newest first) so the backlog stays current but nothing
> silently vanishes.

- Discard-as-cost actions — Forced Labor & Harvest now sacrifice a hand card (waived if you can't cover it).
