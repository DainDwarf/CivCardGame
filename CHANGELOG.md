# Changelog

All notable changes to CivCardGame are documented here. Loosely follows
[Keep a Changelog](https://keepachangelog.com/); versions before 1.0 track
development phases, not stable public releases.

## [0.0.1] — 2026-07-01 — End of Phase 1: Real Run Loop

Phase 1 closes out the run loop: hybrid cards (permanent vs. recurring), the
turn lifecycle, a population/worker-staffing layer, territory limits, and
mission-driven win/lose conditions. This release captures everything shipped
during that phase.

- **Removed `popCost` and the Village Settlement card** — `popCost` was only
  ever consumed by Village Settlement; dropping the card retired the last use
  of the mechanic, so both went together.
- **Icon-based card/building text** — resource costs and effects render as
  icons instead of text shorthand; building worker capacity shows as meeple
  icons; population uses a meeple icon; card descriptions sit in a colored
  footer band; territory no longer links to an on-board map icon it never
  had; Destroy's card text shortened.
- **Move playability logic to core** — `unplayableReason`
  (`src/rules/playability.ts`) is the single source of truth for the gates a
  card play must clear (cost, pop cost/reserve, culture level, territory,
  destroy target), returned as a structured reason rather than a string.
  `playCard` gates on it directly; the board's `whyUnplayable` just formats
  the reason into UI text.
- **`projectedDelta` return shape** — returns
  `{ resources: Resources; culture: number }` instead of a merged object, so
  the core/strategic split is explicit in the type.
- **Buildings board: worker drag** — replaced +/- staffing buttons with a
  click-toggle, a visible idle dock (draggable population tray tokens), and
  building→building drag as the headline gesture (`transferWorker`, one
  atomic move so undo doesn't split it in two).
- **Undo feature** — an Undo button steps back through the turn's actions.
  A move that touches the draw pile is a hard boundary that clears the
  stack; round changes and gameover also clear it.
- **Zoomable cards in list views** — clicking a card in the discard/removed
  pile viewer opens the same zoom overlay as a hand card.
- **Unplayable card feedback** — dragging an unplayable card onto the board
  shows a brief red toast explaining why, alongside the shake.
- **End of run screen** — victory/defeat shows an in-place overlay (Restart,
  Inspect, End Run) instead of navigating away; Inspect mode lets the player
  browse the final board.
- **Buildings board (canvas)** — the tableau is a free-form canvas; each
  building type is a draggable box the player can spatially rearrange.
- **Stat tooltips** — glanceable one-liners with no card/mission names or
  mechanic explanations (deferred to a future codex).
- **Culture resource** — `G.culture` accumulates via the Theater building
  and Cultural Festival card; The Philosopher card gates on a culture
  threshold. Displayed alongside population and territory.
- **Money resource** — 🪙 produced by Market and Trading Post; Eureka and
  Inspiration cost money instead of production.
- **Removed keyboard shortcuts** — the UI is mouse-only by design; dropped
  the global Escape handler and Enter/Space card-button handlers.
- **Destroy card** — 1🔨 recurring; demolishes a chosen building, freeing
  its territory slot and returning its workers to the idle pool.
- **Territory limitation** — `G.territory` (starts at 6) caps how many
  buildings the tableau holds. Conquest and Develop (3⚔️/3🔨 → +1 territory)
  seeded into the default deck.
- **Collapse warning** — any core resource projected to go negative at
  round end gets a red-tinted stat chip.
- **Core resource floor failure** — any core resource going negative ends
  the run (Famine, Ruin, Bankruptcy, Dark Age, Revolt); `coreCollapse()` in
  `src/rules/collapse.ts`.
- **Recurring buildings** — permanent/recurring hybrid card type
  (`village_settlement` etc.).
- **Population-reserving actions (Corvée & Harvest)** — Forced Labor renamed
  to Corvée; both cost `popReserve: 1` (locks 1 idle worker for the turn)
  instead of a discard.
- **Discard-as-cost actions** — Forced Labor & Harvest sacrifice a hand card
  as a cost, waived if the player can't cover it.
- Assorted bugfixes from a code-review pass: End Round disabled mid-drag/
  mid-pending; `pending`/`warnEndRound` cleanup on round change; sacrifice-
  before-draw ordering fixed in `playCard`; test helpers throw on missing
  card.
