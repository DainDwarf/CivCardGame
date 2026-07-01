# CivCardGame — TODO / Idea Backlog

> A scratch list for ideas caught **in passing** so they aren't lost — *not* a
> committed plan. Anything here is a candidate, not a promise. Decided, designed
> work lives in [`DESIGN.md`](DESIGN.md); this is the inbox that feeds it.

**How we use it:** say *"jot: …"* or *"TODO: …"* (or "note that down") mid-task and
the idea lands here as a one-liner without derailing what we're doing. We triage
later — promote items into `DESIGN.md` / real work, or drop them.

> Tags (optional): `[size: S/M/L]` rough effort · `[?]` needs design discussion ·
> `[blocked]` waiting on something else · `[phase: N]` roadmap phase (1 = run loop · 2 = contract + meta shell · 3 = economy & progression · 4 = content & balance).

## Meta loop (`src/meta/` — not built yet)

- **Tutorial missions** — the first few meta missions double as tutorials, introducing mechanics progressively `[?]` `[phase: 3]`
- **Card modifiers** — meta may offer ways to attach persistent modifiers to individual cards (long-term idea, details TBD) `[?]` `[phase: 3]`
- **Government boards** — alongside deckbuilding, the meta lets the player choose a "board" (themed as government type: monarchy, republic, etc.); the board sets starting resources and scales with the player's progression on the mission tech map (i.e. what the player has already unlocked determines how powerful the starting board is) `[?]` `[phase: 3]`

## Cards & content (`src/content/`)

- **Disasters** — some missions inject disaster/event cards (negative effects) into the player's deck as pressure; Military helps prevent/mitigate them (details TBD) `[?]` `[phase: 4]`
- New mission type: "Metropolis" `[?]` `[phase: 4]`
- New mission: "Build the Wonder" `[?]` `[phase: 4]`
- Culture-based missions (depend on the Culture resource) `[?]` `[phase: 4]`
- Building that changes hand size (e.g. +1 card drawn per round) `[?]` `[phase: 4]`
- Culture thresholds change hand size by default (no building required) — culture as a passive progression axis `[?]` `[phase: 4]`
- Resources transformation? Like a building that transforms production into science for example `[phase: 4]`

## UI (`src/components/`)

- **Game menu** — save, config, codex, and other global actions; the codex is where in-depth mechanic explanations live (not tooltips) `[?]` `[phase: 2]`
- **Multi-pip staffing UI** — once a building can require 2–3 workers, its box needs one pip per worker slot (not the current single staff-toggle icon), so partial staffing is visible and each pip can be dragged independently. Follow-up to the now-shipped building→building worker drag; blocked on a multi-worker building actually existing (see [[multi-worker-buildings-roadmap]]). `[size: M] [?] [blocked]` `[phase: 4]`
- **Bulk-move modifier for worker transfers** — a modifier (e.g. shift-drag) to move N workers from one building to another in one gesture, instead of one pip-drag per worker. Only pays off once multi-pip staffing (above) exists. `[size: S] [?] [blocked]` `[phase: 4]`

## Tech debt & infra (build, tests, tooling)

- `projectedDelta` returns `Resources & { culture: number }` — folds one strategic resource (culture) into a core-resource delta shape while excluding population/territory. Slightly muddies the core/strategic split; consider modelling the strategic deltas separately `[size: S] [?]` `[phase: 2]`
- **Move playability logic to core** — `whyUnplayable` in `Board.tsx` is a shell helper for display, but strictly the CLAUDE.md rule says game logic belongs in `src/rules/`. A purer model would expose a core-side function (or enum of reasons) with unit tests, and let the shell format the message from it `[size: S] [?]` `[phase: 2]`

## Game design & balance

- Card that gives a draw when expanding territory `[?]` `[phase: 4]`
- Card effects that trigger on discard / on draw, to enable combos `[?]` `[phase: 4]`



---

## Rejected

> Considered and turned down — kept (not deleted) so we don't re-litigate the same idea
> without new information.

- **Ignore worker assignment in the undo list** — assign/unassign worker moves would skip pushing undo snapshots, so undo only steps through "meaningful" turn actions. Tried it (a `quietMove` action updating `present` without touching `past`), then reverted: having worker reassignment silently bundled into the prior card-play's undo step is confusing to the player, while the alternative — reconciling worker state done in the "present" back onto a restored past snapshot — is deeply error-prone (instance-count and population-total edge cases). For now, worker reassignments stay part of the regular undo list; revisit if a cleaner solution presents itself.

## Done / shipped

> Completed items move here (newest first) so the backlog stays current but nothing
> silently vanishes.

- **Buildings board: worker drag** — replaced the +/- staffing buttons with a click-toggle (plain click on a building's staff icon fully staffs/unstaffs it), a visible idle dock (population tray tokens, draggable), and building→building drag as the headline gesture (`transferWorker`, one atomic move so undo doesn't split it in two). Pip-per-instance rendering and a bulk-move modifier are deferred to follow-up items since every building is still `workers: 0` or `1`.
- **Undo feature** — `↶ Undo` button above the deck pile steps back through the turn's actions. Undo history lives in the shell (`GameContext`, `useReducer` over `{ present, past }`); each undoable move pushes the prior `RunState` snapshot. A move that touches the draw pile (drew cards / reshuffled, detected by diffing `G.deck`) is a hard boundary that clears the whole stack; ending a round and restarting also clear it; undo is disabled at gameover and mid-pending/drag. Known gap: a future *peek top-N* reveals info without changing the deck, so deck-diff won't catch it — that move will need an explicit "revealed" flag.
- **Zoomable cards in list views** — clicking a card in the discard/removed pile viewer opens the same zoom overlay as clicking a hand card; hint text updated accordingly.
- **Unplayable card feedback** — dragging an unplayable card onto the board shows a brief red toast explaining why (e.g. "need 2🌾", "territory full", "need 5 🎭 culture") in addition to the shake; `whyUnplayable` helper consolidates the three previous copies of playability checks into one.
- **End of run screen** — victory/defeat no longer navigates away; an overlay appears in place with Restart, Inspect (minimizes to a pill so the player can browse the final board), and End Run. Inspect mode blocks game actions but keeps tooltips, card zoom, and pile viewers fully functional.
- **Buildings board (canvas)** — the tableau list is now a free-form canvas; each building type is a draggable box the player can spatially rearrange (positions are pure UI state in `Board`, keyed by `buildingId`; new buildings auto-place into a grid slot). Worker staffing kept as +/- buttons for now.
- Stat tooltips are glanceable one-liners — no card/mission names, no mechanic explanations (those belong in the future codex).
- **Culture resource** — `G.culture` accumulates but is never spent; two growth paths: Theater building (+2/round while staffed) and Cultural Festival card (+3 immediately); The Philosopher card demonstrates the threshold gate (requires culture ≥ 5). Displayed alongside population and territory in the UI.
- **Money resource** — new 🪙 resource produced by Market and Trading Post buildings; Eureka and Inspiration now cost money instead of production.
- **Remove keyboard shortcuts** — removed the global Escape handler (overlays close on backdrop click) and the Enter/Space onKeyDown on card buttons.
- **Destroy** card — 1🔨 recurring; demolishes a chosen building from the tableau, freeing its territory slot and returning its workers to the idle pool.
- Territory limitation — a building-slot cap (`G.territory`, starts at 6) gates how many buildings the tableau holds; building cards are unplayable when full. Two recurring expansion cards: **Conquest** (3⚔️ → +1 territory) and **Develop** (3🔨 → +1 territory), seeded into the default deck.
- **Collapse warning** — stat chip for any core resource that would go negative at end of round gets a red-tinted background + outline; computed from `projectedDelta`.
- **Core resource floor failure** — any core resource going negative ends the run: Famine (Food), Ruin (Production), Bankruptcy (Money), Dark Age (Science), Revolt (Military). Pure `coreCollapse()` helper in `src/rules/collapse.ts`; defeat screen shows the matching message.
- All 8 code-review bugs fixed: End Round disabled mid-drag/mid-pending; `pending`/`warnEndRound` auto-cleared on round change; `shouldWarn` drives `warnEndRound` cleanup; `hasUnstaffedCapacity` simplified to `!isOperating()`; sacrifice-before-draw ordering fixed in `playCard`; test helpers throw on missing card.
- Recurring buildings — permanent/recurring hybrid card type (village_settlement etc.).
- **Population-reserving actions (Corvée & Harvest)** — Forced Labor renamed to Corvée; both cards now cost `popReserve: 1` instead of a discard. Playing either locks 1 idle worker for the rest of the turn (hard gate: unplayable with 0 idle); `G.reservedPop` resets to 0 at `beginTurn`.
- Discard-as-cost actions — Forced Labor & Harvest now sacrifice a hand card (waived if you can't cover it).
