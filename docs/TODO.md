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

- **Tutorial missions** — the first few meta missions double as tutorials, introducing mechanics progressively `[?]`
- **Card modifiers** — meta may offer ways to attach persistent modifiers to individual cards (long-term idea, details TBD) `[?]`
- **Government boards** — alongside deckbuilding, the meta lets the player choose a "board" (themed as government type: monarchy, republic, etc.); the board sets starting resources and scales with the player's progression on the mission tech map (i.e. what the player has already unlocked determines how powerful the starting board is) `[?]`

## Cards & content (`src/content/`)

- **Disasters** — some missions inject disaster/event cards (negative effects) into the player's deck as pressure; Military helps prevent/mitigate them (details TBD) `[?]`
- New mission type: "Metropolis" `[?]`
- New mission: "Build the Wonder" `[?]`
- Culture-based missions (depend on the Culture resource) `[?]`
- Building that changes hand size (e.g. +1 card drawn per round) `[?]`
- Culture thresholds change hand size by default (no building required) — culture as a passive progression axis `[?]`
- Resources transformation? Like a building that transforms production into science for example

## UI (`src/components/`)

- Pass over stat tooltips to strip specifics — they name particular cards/missions (e.g. Barbarian Tide, Settlers); keep them generic about the mechanic
- **Buildings board** — replace the current buildings list with a free-form canvas; buildings render as draggable boxes the player can spatially rearrange; population tokens are drag-and-dropped directly between buildings to assign/unassign workers. Requires moving the resources UI out of that area first. `[size: L] [?]`

## Tech debt & infra (build, tests, tooling)

_(empty)_

## Game design & balance

- Card that gives a draw when expanding territory `[?]`
- Card effects that trigger on discard / on draw, to enable combos `[?]`
- **Population-reserving actions** — some cards (Harvest, Forced Labor / rename to something like "Gather Resource") cost no resources but reserve one population for the current turn instead of paying a traditional price; reserved pop can't be assigned to buildings until next turn `[?]`



---

## Done / shipped

> Completed items move here (newest first) so the backlog stays current but nothing
> silently vanishes.

- **Culture resource** — `G.culture` accumulates but is never spent; two growth paths: Theater building (+2/round while staffed) and Cultural Festival card (+3 immediately); The Philosopher card demonstrates the threshold gate (requires culture ≥ 5). Displayed alongside population and territory in the UI.
- **Money resource** — new 🪙 resource produced by Market and Trading Post buildings; Eureka and Inspiration now cost money instead of production.
- **Remove keyboard shortcuts** — removed the global Escape handler (overlays close on backdrop click) and the Enter/Space onKeyDown on card buttons.
- **Destroy** card — 1🔨 recurring; demolishes a chosen building from the tableau, freeing its territory slot and returning its workers to the idle pool.
- Territory limitation — a building-slot cap (`G.territory`, starts at 6) gates how many buildings the tableau holds; building cards are unplayable when full. Two recurring expansion cards: **Conquest** (3⚔️ → +1 territory) and **Develop** (3🔨 → +1 territory), seeded into the default deck.
- **Collapse warning** — stat chip for any core resource that would go negative at end of round gets a red-tinted background + outline; computed from `projectedDelta`.
- **Core resource floor failure** — any core resource going negative ends the run: Famine (Food), Ruin (Production), Bankruptcy (Money), Dark Age (Science), Revolt (Military). Pure `coreCollapse()` helper in `src/rules/collapse.ts`; defeat screen shows the matching message.
- All 8 code-review bugs fixed: End Round disabled mid-drag/mid-pending; `pending`/`warnEndRound` auto-cleared on round change; `shouldWarn` drives `warnEndRound` cleanup; `hasUnstaffedCapacity` simplified to `!isOperating()`; sacrifice-before-draw ordering fixed in `playCard`; test helpers throw on missing card.
- Recurring buildings — permanent/recurring hybrid card type (village_settlement etc.).
- Discard-as-cost actions — Forced Labor & Harvest now sacrifice a hand card (waived if you can't cover it).
