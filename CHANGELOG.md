# Changelog

All notable changes to CivCardGame are documented here. Loosely follows
[Keep a Changelog](https://keepachangelog.com/); versions before 1.0 track
development phases, not stable public releases.

## [0.0.1] — 2026-07-01 — End of Phase 1: Real Run Loop

Phase 1 closes out the run loop: hybrid cards (permanent vs. recurring), the
turn lifecycle, a population/worker-staffing layer, territory limits, and
mission-driven win/lose conditions. This release captures everything shipped
during that phase.

- **Removed `popCost` and the Village Settlement card** — dropped together
  since Village Settlement was `popCost`'s only consumer.
- **Icon-based card/building text** — costs, effects, worker capacity, and
  population render as icons instead of text shorthand.
- **Move playability logic to core** — `unplayableReason`
  (`src/rules/playability.ts`) is the single source of truth for whether a
  card can be played.
- **`projectedDelta` return shape** — returns `{ resources, culture }`
  instead of a merged object.
- **Buildings board: worker drag** — click-toggle staffing, an idle dock,
  and building→building drag replace the old +/- staffing buttons.
- **Undo feature** — steps back through a turn's actions; draw-pile moves,
  round changes, and gameover clear the stack.
- **Zoomable cards in list views** — discard/removed pile cards open the
  same zoom overlay as a hand card.
- **Unplayable card feedback** — dragging an unplayable card shows a red
  toast explaining why.
- **End of run screen** — in-place victory/defeat overlay (Restart, Inspect,
  End Run) instead of navigating away.
- **Buildings board (canvas)** — the tableau is a free-form, spatially
  rearrangeable canvas instead of a fixed layout.
- **Stat tooltips** — glanceable one-liners, no card/mission names or
  mechanic explanations.
- **Culture resource** — accumulates via Theater/Cultural Festival; gates
  The Philosopher card.
- **Money resource** — 🪙 produced by Market and Trading Post; spent on
  Eureka and Inspiration.
- **Removed keyboard shortcuts** — the UI is mouse-only by design.
- **Destroy card** — demolishes a building, freeing its territory slot and
  returning its workers to the idle pool.
- **Territory limitation** — `G.territory` caps tableau size; Conquest and
  Develop raise it.
- **Collapse warning** — a resource projected to go negative at round end
  gets a red-tinted stat chip.
- **Core resource floor failure** — any core resource going negative ends
  the run (Famine, Ruin, Bankruptcy, Dark Age, Revolt).
- **Recurring buildings** — permanent/recurring hybrid card type.
- **Population-reserving actions (Corvée & Harvest)** — cost `popReserve: 1`
  instead of a discard; Forced Labor renamed to Corvée.
- **Discard-as-cost actions** — Forced Labor & Harvest sacrifice a hand card
  as a cost.
- Assorted bugfixes from a code-review pass.
