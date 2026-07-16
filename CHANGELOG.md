# Changelog

All notable changes to CivCardGame are documented here. Loosely follows
[Keep a Changelog](https://keepachangelog.com/); versions before 1.0 track
development phases, not stable public releases.

## [0.0.4] — 2026-07-16 — Phase 4 (part 1): The Stone Age Arc

Phase 4 is content and balance. This release wipes the content to a clean slate,
builds the headless balance simulator, and ships the **entire Stone Age arc** —
the tutorial age, a seven-mission branching campaign that introduces every core
mechanic (buildings, territory, worker staffing, conquest, culture, events,
threats, science/foresight, wonders) and reconverges on the age's first wonder.
Under the hood the card/effect/resource model was refactored onto one unified
spine. The **Bronze and Iron ages, and the tutorial onboarding layer, are still
to come** — Phase 4 continues past this release.

- **Deck-construction constraints** — a minimum deck size, a per-card copy cap, and the default hand limit lowered from 5 to 4.
- **Full content reset + test decoupling** — every content catalogue was emptied and the whole rules/run suite rebuilt on shared synthetic fixtures, so game-logic tests no longer depend on shipped content.
- **Paleolithic starting content** — a buildingless hunter-gatherer start: base cards, the 20-card Founding deck, the Tribe board, and a baseline endless sandbox.
- **Headless balance simulator** — a no-browser runner over the pure core that drives the real engine under swappable policies (random fuzzer, greedy, heuristic) for statistical answers no human can play enough games to reach.
- **Goal-directed + oracle policies** — the competent policies steer toward the objective via a sim-local progress gradient, plus a deterministic perfect-information oracle that proves a mission winnable by finding a real winning line.
- **Simulator batch, reporting & CLI** — a seeded mission × deck × board sweep with aggregated win-rate / turns / defeat-cause reports and a single-run replay trace, driven by the `npm run sim` flag-based CLI and a `/sim` skill.
- **Order-independent reshuffle** — unordered zones canonicalize by content before shuffling, pinned by a zone-order-invariance invariant, so the simulator can treat those zones as multisets.
- **Ages map infrastructure** — each age covers its own contiguous slice of the mission DAG, with themed age bands and a colour wash derived from its missions' columns.
- **The Stone Age arc (7 missions)** — a branching tutorial campaign that forks after Growing Numbers and reconverges on a wonder capstone: First Settlement, Growing Numbers, Rites & Rituals, Raiders at the Border, Reading the Seasons, Restless People, and The First Temple.
- **Sticker-unlock reward kinds** — a mission clear can now unlock card stickers and board stickers (Growing Numbers debuts Irrigation plus the Granary/Stockpile board stickers).
- **Board-unlock reward kind** — the fourth symmetric unlock: a mission can unlock a whole government board (Raiders unlocks the military-leaning Chiefdom), teaching board choice at launch.
- **Board upgrades** — a mission can swap one board for a stronger one, carrying its stickers across (Tribe upgrades to Settlement on first clear).
- **Optional unlock on a standard clear** — a standard mission may now grant Influence only, with no card/board unlock.
- **Additional endless missions** — Return of the Ice Age (a scored survival mission) and Sandbox (an endless, rewardless space).
- **Wonders** — a first-class card kind: a wonder plays like a building but is the age's capstone monument, with its own Collection/deck category, no bought copies, no stickers, and a per-deck cap.
- **Per-worker staffing** — a building's worker count became a capacity: it operates at one worker and its output scales per worker, surfaced by a multi-pip staffing UI; Göbekli Tepe is the first multi-worker building.
- **Culture levels** — the culture gauge climbs through levels that each raise hand size, with a culture-level play-gate (Rites & Rituals).
- **Events redesigned** — mission-injected hazards that auto-resolve from hand each round draining a resource, defused for good by paying to play them (the Raider waves).
- **Threats + reshuffle bus event** — a persistent board hazard that drains per population on every deck reshuffle, riding a new first-class reshuffle event (Restless People / Unrest).
- **Science, peek & a look-only interaction** — the science gauge expressed as foresight: the Calendar card peeks at the top of the deck through a new view-only interaction popup, on a pure-read peek primitive.
- **Goals-derived objectives** — a mission objective derives its win check, its player-facing readout, and its simulator gradient from one declarative goals spec.
- **Card-model tech-debt pass** — one combined 8-resource bundle (core + strategic), a unified `CardEffect` composing declarative and closure behaviour across four timing slots, extracted `CardGate`/`CardDisplay` descriptors, fail-fast worker declarations, and the unused destroy verb removed.
- **Run-screen glow-up** — the core resources take the banner's centre stage, the culture thermometer welded into one instrument, the population's food bill shown in the tray, the deck pile openable to view its remaining cards, and the miniboard mirrors the run banner.
- **End-of-round collapse warning** — the End Round button warns and confirms before a round that would drive a core resource negative and end the run.
- **Destroy stickers** — a placed card or board sticker can be destroyed to free its slot (no refund).
- **Meta polish** — identically-stickered copies group into one ×N stack, and Clear/Load now reloads the app so no stale UI state survives.
- **Codex + mission lore rewrite** — the rules reference reworded to read player-facing rather than as a design extract, and every mission's lore rewritten (the capstone renamed to The First Temple).

## [0.0.3] — 2026-07-09 — End of Phase 3: Economy & Progression

Phase 3 builds the economy and progression layer on top of the two loops: card
ownership as identified per-copy instances, an Influence currency, a copy-tier
shop, a branching campaign-map DAG with per-mission rewards and unlocks, infinite
missions, persistent board threats, and per-copy card stickers plus board
stickers. Under the hood a card-effect **resolver spine** and an **event bus** now
carry all real game behaviour behind card-owned hooks. This release captures
everything shipped during that phase.

- **Ownership & Influence currency** — the collection tracks ownership as identified per-copy instances; `PlayerStore` gains Influence, collection, and map progress, seeded from a starting collection.
- **Deck-editor copy caps** — decks cap each card at the copies owned; not-yet-unlocked cards are hidden entirely (an unlock is meant to be a surprise).
- **Copy-tier shop** — spend Influence to buy extra copies of owned cards up the ×1→×2→×4→×8 ladder.
- **Mission model + campaign-map DAG** — missions form a prereq-gated tech tree; each standard mission grants a fixed Influence reward plus one card unlock on first clear.
- **Campaign Map screen** — the mission DAG as a horizontally-scrollable, drag-to-pan branching tech tree with an age band and per-node cleared/available/locked state.
- **Mission detail panel** — a lore + reward-preview panel opens before the board/deck launch popup; it also renders the objective and threat/event card faces a mission is about.
- **Infinite missions** — endless, replayable missions that never win and pay Influence = rounds survived on every attempt.
- **Board threats** — persistent, mission-seeded hazards that escalate and drain resources each upkeep; first threats: Harsh Winter, Stagnation, Creeping Decay.
- **Card-effect resolver spine** — every card resolves through one `resolveCard` path (its own closure or the declarative default); per-copy `CardInstance` identity with per-card `counters` replaces the old effect switch.
- **Dynamic (non-fixed) card effects** — a card can scale its effect off its own per-copy counter (Cornucopia grows +1 per play) and shows the live value at every render site.
- **Interaction layer** — a card effect can suspend into a player choice (Foresight's peek) as plain data that survives undo/clone; card-facing peek/draw/return primitives let a card touch the deck through the spine, not raw state.
- **Event bus / trigger layer** — a card can react to an event whose timing it doesn't own (draw, discard, resource threshold, round pass) via `CardDef.on` handlers run through the same spine.
- **Win/lose is bus-driven** — the objective card and each threat own their own win/defeat predicate; the bus re-derives victory/defeat flags at every step boundary and the engine only reads them.
- **Card stickers** — permanent per-copy buffs bought with Influence, up to 2 per copy, each owning its logic on its `StickerDef`; Reinforced, Efficient, Irrigation.
- **Board stickers** — the board counterpart: permanent modifiers that tweak a board's starting profile, snapshotted into the run config at launch; Fertile Land, Garrison, Frontier.
- **Meta UI rework** — the standalone Shop tab folds into Collection; Collection and the new Board tab share a drag-a-badge-from-the-tray-to-buy+attach gesture, driven by real card faces and reusable mini-boards.
- **Available-upgrade hints** — a gold accent on card faces, board sticker slots, and nav badges marks where Influence can still be usefully spent right now.
- **Stats reworked into a player profile** — lifetime headline tiles, an infinite-mission best-scores board, and a collapsed run-history log, backed by persistent lifetime counters rather than the trimmed history.
- **Stable card ordering** — every card listing orders through one shared comparator, independent of copy count, deck membership, or discard sequence.
- **Run-start, shuffle & staffing animations** — mission-injected cards swipe into place at run start, the deck riffles on shuffle/reshuffle, and workers fly between the population tray and staffing boxes.
- **Removed `MissionDef.setup`/`onUpkeep`** — a mission's only behaviour now flows through the threat/event cards it seeds.
- **Assorted bug fixes** — count-badge clipping in card grids, a white flash between the mission lore panel and the launch popup, and a save-parsing cleanup.

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
