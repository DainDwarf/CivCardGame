# Changelog

All notable changes to CivCardGame are documented here. Loosely follows
[Keep a Changelog](https://keepachangelog.com/); versions before 1.0 track
development phases, not stable public releases.

## [0.0.2] — 2026-07-04 — End of Phase 2: Contract + Meta Shell

Phase 2 closes the loop between the run and the meta game: `contract.ts`'s
`RunConfig`/`RunResult`, a full meta shell (mission/board/deck select, collection,
deck construction, stats), a game menu (save, config, codex), and localStorage
persistence. This release captures everything shipped during that phase.

- **Scaffold meta content** — government boards and premade decks as data, not yet wired to a run.
- **Mission-select menu** — first meta screen, replacing the direct-to-run mount.
- **Define `contract.ts`** — `RunConfig`/`RunResult` plus a seeded shuffle (`rules/rng.ts`).
- **Wire the loop closed** — `app/` shell switches meta ↔ run; boards apply their baseline resources at setup.
- **Restart reshuffles with a fresh seed** — a restarted run no longer replays the identical draw order.
- **Disable restart after a won run** — restarting a win doesn't make sense; End Run banks it instead.
- **Seeded discard-pile reshuffle** — the discard recycle draws from the persisted RNG stream instead of reseeding.
- **Strategic resources on `RunResult`** — population/territory/culture recorded alongside the 5 core resources.
- **localStorage persistence** — the player store (run history, later decks) persists across sessions.
- **Extend the meta menu** — a left-nav shell (Mission/Collection/Decks/Stats) replaces the single mission screen.
- **Deck construction** — a full deck editor; every deck is player-editable, with no separate read-only tier.
- **Game menu** — a global burger-menu surface (save/config/codex) overlaying both loops.
- **Save export/import/clear** — download/restore the player store as a versioned `.civsave` file.
- **Fix: loading/clearing a save mid-run left the run dangling** — now always returns to the menu.
- **Populate the config submenu (partial)** — a "confirm before ending a round" toggle, backed by device-local settings kept out of the save file.
- **In-run menu extras (end run / restart run)** — confirm-gated while the run is live, immediate once it's over.
- **Disasters — `event` card type** — mission-injected disaster cards (Barbarian), never player-playable, auto-resolving at end of turn.
- **Populate the codex submenu** — an in-menu rules reference (resources, card kinds, staffing, turn structure, glossary).
- **Drop deck descriptions** — cut in favor of showing card count, since the flavor text had no gameplay role.
- **Deck editor UI rework** — real card visuals via a new shared `CardFace` component, with click *and* drag to move cards.
- **Meta screens: disable text selection** — matches the run screen, since pointer-drag was triggering native text selection.
- **Collection screen UI rework** — real card tiles with click-to-zoom, reusing the run loop's zoom overlay.
- **UI size setting** — a UI-scale slider via a `transform: scale()` wrapper (a `zoom`-based first attempt was reverted — it doesn't rescale the coordinates pointer-drag code reads from).
- **Theme picker** — Light/Dark, backed by a retrofit of every hardcoded color onto semantic CSS variables (which is what made the later theme additions cheap).
- **`work` card type** — a fourth card kind for labour: no play-time population cost, staffed like a building, replacing the old `popReserve` mechanic.
- **Fading transition between meta and run stages** — screen swaps (launch/restart/end run) fade to black instead of cutting instantly.
- **"Follow system" theme option** — tracks the OS light/dark setting live, now the default for a fresh profile.
- **Dark-mode contrast bugs** — fixed unthemed text and background colors the CSS-variable retrofit missed, invisible in Light but broken in Dark.
- **Drop the building/card distinction** — a `building` card *is* the building; merged the separate building catalogue into the card catalogue.
- **Click a placed building to zoom its card** — the deferred piece of the above.
- **Decks screen UI rework** — a shelf of deck tiles with a hover-revealed card-fan preview; made the deck cap (`MAX_DECKS`) a core rule rather than a UI-only limit.
- **Deck copy** — duplicate an existing deck into a new, editable one.
- **Board-tinted run background** — the run's ground backdrop tints per government board.
- **Color-blind themes** — Deuteranopia, Protanopia, and Tritanopia palettes; the theme picker became a dropdown to fit them.
- **Codex menu UI rework** — a topic-nav + content-pane layout; renamed the `recurring` card kind to `action` throughout; clarified that landing in `removed` (vs. `discard`) is always a property of a card's *effect*, never a blanket rule for its *kind*.
- **First-launch accessibility selector** — a one-time modal surfaces the theme and UI-size settings on a brand-new profile instead of silently defaulting to System theme.

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
