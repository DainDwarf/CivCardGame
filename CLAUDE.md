# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

CivCardGame is a **single-player** civilization-building card game that runs in the
browser. The player builds up a civilization solo — there is **no AI or human
opponent**. The run loop uses a lightweight custom engine (`src/run/engine.ts`) for
the turn/phase state machine; state is held in React context (`src/run/GameContext.tsx`).

Stack: TypeScript · Vite · React 18 · Vitest.

It is a **roguelite deckbuilder** with two loops: a **run loop** (play a *locked*
pre-built deck against a mission) and a **meta loop** (persistent deck construction,
shop, mission selection — the *only* place decks are edited). See
[`docs/DESIGN.md`](docs/DESIGN.md) for the full game design and roadmap.

**Progress.** The run loop, the meta shell, and the economy/progression systems are all
built; the game is now in its content-and-balance pass — see
[`docs/DESIGN.md`](docs/DESIGN.md) for the roadmap. The systems that exist:

- **Run loop** (`src/run/`): hybrid cards (building vs. action), the turn
  lifecycle, a **population/worker-staffing** layer (buildings must be staffed to
  operate; the population eats food each round), and mission-driven win/lose conditions.
- **Contract + meta shell**: `src/contract.ts` (`RunConfig`/`RunResult`) is
  the spine between the loops; `src/app/App.tsx` switches between the meta menu
  (`src/meta/MetaMenu.tsx`, a left-nav shell over the Mission/Collection/Board/Decks/Stats
  screens) and a run. Deck construction (`src/meta/DeckEditor.tsx`) and `localStorage`
  persistence (`src/meta/store.ts`'s `PlayerStore`).
- **Economy & progression**:
  - **Ownership + Influence currency** — `rules/collection.ts`'s `OwnedCards` tracks
    ownership as identified per-copy meta instances; `PlayerStore` carries
    `collection`/`influence`/`mapProgress`, seeded from `content/collection.ts`'s
    `STARTING_COLLECTION` and `content/decks.ts`. Not-yet-unlocked cards are hidden
    entirely (an unlock is meant to be a surprise); the deck editor caps each card at
    the copies owned.
  - **Copy-tier shop** — `rules/shop.ts` (`TIER_LADDER` ×1→×2→×4→×8; `buyTier`): spend
    Influence to buy extra copies of owned cards. Bought in place from the Collection
    screen's per-card detail panel (`meta/CardInstancePanel.tsx`) — there's no separate
    Shop tab.
  - **Campaign-map DAG** — `content/missions.ts` missions form a prereq-gated DAG
    (`rules/campaign.ts`), rendered as a horizontally-scrollable branching tech tree
    (`meta/CampaignMap.tsx`); each `'standard'` mission grants a fixed Influence reward
    plus **zero or more** **unlocks** on first clear (`rules/rewards.ts`) — four symmetric, all-optional
    kinds: card unlocks (`unlockCardIds`), card-sticker unlocks (`unlockStickerIds`), board-sticker
    unlocks (`unlockBoardStickerIds`), and board unlocks (`unlockBoardIds`), all hidden-until-unlocked
    (a mission may grant none — an Influence-only reward). The four unlock sets `computeRewards` grows
    (`collection` + the three id-sets) travel through it as one `UnlockProgress` bundle mirroring the
    `PlayerStore` fields — in unchanged, out with this mission's unlocks folded in — rather than a run of
    transposable positional args. Previewed on the `MissionDetailPanel` (a sticker shows a generic locked
    chip pre-clear then its real face; a board shows a greyed `locked` `BoardMini` silhouette pre-clear —
    `CardFace`'s `missionLocked` counterpart — then its real `BoardMini`) and paid out in `App.tsx`'s `recordResult`.
  - **Infinite missions + threats** — `'infinite'`-kind missions never win and pay
    Influence = rounds survived on every attempt. `GameState.threats`
    (`rules/threats.ts`) are persistent, mission-seeded board hazards that escalate and
    drain resources each upkeep (each resolving through the shared resolver spine).
  - **Card stickers** — permanent per-copy buffs bought with Influence
    (`content/stickers.ts`, `rules/stickers.ts`); up to 2 per owned instance, stacking.
    A sticker owns its own logic on its `StickerDef` (`appliesTo`/`applyGain`/`applyCost`
    hooks); `effectiveGain`/`effectiveCost`/`effectiveCard` are the only places a sticker
    touches run *or* display values, so resolution and every render site (run + meta)
    agree. A sticker is **hidden until unlocked** by a mission reward (`PlayerStore.unlockedStickers`,
    fed by `unlockStickerIds`) — `rules/stickers.ts`'s `unlockedStickerDefs` is the single filter seam
    every catalogue *enumeration* (the Collection tray, the upgrade hints) reads through, and
    `buySticker` re-checks the unlock as its authoritative backstop. The catalogue holds one sticker so
    far — **Irrigation** (+1 🌾 on a food-producing building), unlocked by the "Growing Numbers" mission.
  - **Board stickers** — the *board* counterpart to card stickers: permanent modifiers bought
    with Influence that tweak a board's *starting* profile (`content/boardStickers.ts`,
    `rules/boardStickers.ts`), attached per board on `PlayerStore.boardStickers` (a board is
    singular — no per-copy identity). A separate catalogue from card stickers, not an extension:
    a `BoardStickerDef` owns its logic via one `applyToBoard(board)` hook applied *once at setup*,
    may touch any of the 8 starting values, and `effectiveBoard` is the single fold that applies
    them — `run/setup.ts` seeds off it and the board pickers display it. The applied stickers are
    **snapshotted into `RunConfig.boardStickers` at launch** (never re-looked-up in the core
    `setup.ts`), so buying one mid-campaign can't retroactively change an in-progress/restarted
    run. Provisional cap of 2 per board (balance is ongoing). Board stickers have their own **Board**
    nav tab (`meta/BoardMenu.tsx`): each board renders as a `BoardMini` in a
    grid beside a right-side **tray** (pinned via `position: sticky`, not `fixed` — UI-scaling
    invariant) of sticker boxes, each a draggable sticker badge (styled like the on-board one via the
    shared `StickerRow` tokens, just larger) + name over its effect + price. Dragging a badge onto a
    board buys+attaches it in one gesture (the board counterpart to the card sticker tray), a
    hand-rolled pointer-drag like `DeckEditor.tsx` (no DnD library). During a drag only the *valid*
    target boards for that sticker highlight (`applies · under the cap · affordable`, the single
    `isValidTarget` predicate gating both the highlight and the drop); an invalid/missed drop no-ops.
    Like card stickers, a board sticker is **hidden until unlocked** (`PlayerStore.unlockedBoardStickers`,
    fed by a mission's `unlockBoardStickerIds`) — `unlockedBoardStickerDefs` gates the tray + hint, and
    `buyBoardSticker` re-checks. The catalogue holds one so far — **Territory** (+1 starting territory),
    unlocked by the "Growing Numbers" mission.

## Commands

- `npm run dev` — Vite dev server.
- `npm run build` — type-check (`tsc --noEmit`) then produce a production bundle.
- `npm run typecheck` — type-check only (no emit).
- `npm test` — run the Vitest suite once.
- `npm run test:watch` — Vitest in watch mode.
- Single test file: `npx vitest run src/rules/scoring.test.ts`
- Tests matching a name: `npx vitest run -t "victory points"`
- `npm run seed-save` — dev tool (`scripts/seed-save.ts`, run via `tsx`): folds a list of finished
  runs through the real `applyRunResult` to write a populated `.civsave` (default `./seed.civsave`,
  gitignored) for testing the meta screens without grinding. Edit `SEED_RUNS` to change its contents;
  import it in-game via the Save menu.
- `npm run sim` — balance tool (`scripts/sim.ts`, run via `tsx`): sweeps the headless simulator over a
  mission × deck × board matrix and prints an aggregated report (win rate, turns/defeat-cause/card-play
  stats). The three axes are decoupled: `--scenario <ids>` names mission(s) (looked up live from
  `content/missions.ts`), `--deck`/`--board` point at JSON files (examples under `scripts/sim/`), with
  `--seeds`/`--policies`/`--format` (text|json). `--seed <i>` switches to a single-run per-turn replay
  trace. See *Balance tooling*.

## Architecture

The codebase is split into a **pure core** and a thin **React shell**. The one rule
that matters: the shell depends on the core; **the core never imports the shell.**
Keeping that boundary is what keeps game logic unit-testable without spinning up a client.

**Core (framework-free — no React, no I/O, no game-engine library):**

- `src/rules/` — all real game logic *and* the core state type; one module per concern.
  Unit tests sit alongside. **When adding a rule, put the logic here and test it directly
  — never bury it in a move or a component.**
  - `state.ts` — `GameState` (the serializable run state `G`): the resource pools (one combined
    `resources: Resources` bundle — all 8, core + strategic) plus the
    card zones `deck`/`hand`/`discard`/`removed`, each a `CardInstance[]`
    (`{ id, cardId, counters? }`) so every card has a stable per-run **instance id** and
    carries its own per-copy state in its own `counters` map (via `getCounter`/`bumpCounter`)
    — cards own their own numbers, so playing one copy never touches another's. Also the
    tableau (`PlacedCard` = `CardInstance` + `workers`), `workZone` (played `work` awaiting
    staffing), `threats` (persistent hazards, each a `CardInstance`), `objective` (the mission's
    win/lose card, seeded once — see `objective.ts`), and
    `pendingInteraction` (a card effect suspended awaiting a player choice; while set,
    `endTurn` no-ops and undo is blocked). `instancesFromCardIds` is the shared mint path;
    `blankState()` builds an empty one. Instance ids are unique across *all* zones.
  - `resources.ts` — the three resource types and their arithmetic: `CoreResources` (the 5 spendable
    pools — food/production/science/military/money), `StrategicResources`
    (population/culture/territory), and combined `Resources` = both (all 8). `GameState.resources`
    holds one combined `Resources`; a card's *cost* is a `Partial<CoreResources>` (only core is spent),
    while both a `CardEffect`'s delta and a structure's per-round `produces` are `Partial<Resources>`
    (may touch any of the 8 — e.g. a culture-producing wonder puts `culture` in `produces`). Helpers: `add`/`subtract`
    (generic over present keys), `scaleResources`, `canAfford` (core-only), `coreOf` (the core slice,
    e.g. `CardFace`'s `describeCard` splitting an effect's core delta for the card face), and the
    `CORE_KEYS` source of truth.
  - `deck.ts` — draw + discard-pile reshuffle (the shared `reshuffleIntoDeck`, used by both
    `drawCard` and `peekTop`), both off the seeded RNG stream (`G.rngState`). Each reshuffle bumps
    `GameState.reshuffleCount`, a pure UI cue no rule reads — `components/Board.tsx` diffs it to
    fire the deck pile's shuffle animation (a length-diff can't tell a reshuffle apart from a card
    effect that only grows/shrinks the deck, e.g. `returnToDeck`/`peekTop`).
    Also the **card-facing deck primitives** a peek/draw-manipulation card resolves *through* instead
    of touching `G.deck`/`G.hand`/`G.rngState` itself (the deck counterpart to `gainResources`):
    `peekTop` (lift up to N off the top, reshuffling the discard in as the deck empties, emitting no
    `draw`), `drawInstance` (draw one *specific* card — the verb `drawCard`'s top-of-deck-only can't
    express — emitting the `draw` event), and `returnToDeck` (shuffle cards back). Each takes the
    `EffectContext` so the family reads uniformly. The peek family is currently unused; the one
    card-facing deck primitive in use today is `recoverFromDiscard` (the discard→hand counterpart,
    used by Storytelling).
  - `effects.ts` — the **resolver spine**: `resolveCard(ctx)` is the single path a card's
    effect runs through (its own `CardDef.resolve`, else the declarative default from the
    `CardEffect` bag). The `EffectContext` (`{ G, self, target?, answer? }`) tells an effect
    which copy is resolving and what it targets (a Destroy demolition is just `ctx.target`).
    `resolveProduction(ctx)` is production's narrower counterpart — recurring per-round, so
    it deliberately omits the one-shot play fields.
    An interactive effect suspends into `pendingInteraction` — via `suspendChoice(ctx, …)`, the one
    place a resolver opens one (built from `ctx.self`) — and re-enters via `moves.resolveInteraction`;
    all plain data, so undo/clone survive. Together with the `deck.ts` primitives this makes the spine
    a **two-way street**: it dispatches a card *and* lends it the vocabulary to affect `G`, so no
    resolver hand-rolls raw state surgery (the boundary Foresight used to break).
  - `events.ts` — the **event bus**: the general trigger layer letting a card react to an event
    whose *timing it doesn't own* (a draw, a discard elsewhere, a resource crossing a threshold, the
    draw pile reshuffling, or a round passing) via a `CardDef.on?: { draw?/discard?/resourceChange?/reshuffle?/endTurn? }` handler — run
    through the *same* `resolveCard`/`EffectContext` spine (extended with `ctx.event`), so a handler
    is authored like any bespoke `resolve` and its gains still fold through stickers. Two verbs,
    split so the bus never dispatches mid-mutation: **emit** (`emitEvent` → push to `G.events`, done
    at a semantic site as a step runs — a `draw` in `deck.ts`, a `discard` with its *reason* at each
    discard site) and **flush** (`flushEvents(G, before)` at a *step boundary* — `applyMove`/
    `beginTurn`/`endTurn`/`applyUpkeep` — which synthesizes a `resourceChange` from a before-snapshot,
    then drains `G.events` to `dispatchEvent`, cascade-capped by `MAX_EVENT_CASCADE`). `dispatchEvent`
    runs `on[type]` on the event's *subject* (self-triggered) plus every operating tableau building,
    operating Work card, and threat (observer, reusing production's `isOperating` gate), in fixed
    order for determinism. A `building`/`work` subject is itself staffable, so it carries the same
    "while staffed" contract as the observer walk and is resolved to its live zone instance and gated
    by `isOperating` too (a card only just drawn into hand is not an operating copy and must not
    self-trigger); a subject of any other kind (never staffable) fires unconditionally. Two
    **broadcast** events name no subject and reach every operating in-play subscriber instead. The
    **`endTurn`** broadcast runs `resolveEndTurn` on each (its `on.endTurn`, else the default
    production/threat-drain) — it's *what drives per-round production and threat drains*, dispatched
    directly at the upkeep boundary by `applyUpkeep` (not queued), so it runs at the exact slot
    production always did, before the `resourceChange` synthesis. The **`reshuffle`** broadcast
    (emitted by `deck.ts`'s `reshuffleIntoDeck` when the discard folds back into the deck, drained at
    the next flush like any leaf-emitted event) has *no* default behaviour — only a card declaring
    `on.reshuffle` reacts (e.g. the Unrest threat draining 🪙 per population point per recycle). **`G.events` is always drained to
    `[]` in any committed/undo-visible state** (see `state.ts`), so structuredClone/undo/determinism
    are untouched. Handlers must be pure over `G` (the projection clone re-runs upkeep every render)
    and must not open a `pendingInteraction`. Win and driven-loss are both pull, not push: `flushEvents`
    re-derives `G.pendingVictory` from the objective card's `objective` predicate (`objective.ts`'s
    `evaluateObjective`) *and* `G.pendingDefeat` from every seeded threat's own `defeat` predicate
    (`threats.ts`'s `evaluateDefeat`) at every step boundary, and `checkEndIf` (`engine.ts`) reads both
    flags — so win/lose is entirely bus-driven flag-reads, never a poll of card logic, and never a
    handler mutating `G.pendingDefeat` directly (a stale push could outlive the condition that set it;
    see `threats.ts`).
  - `population.ts` — worker staffing over buildings *and* work cards through one `Staffable`
    layer (`workerCapOf`/`isOperating`/`producingUnits`/`freePopulation`/`findStaffable`,
    `addBuilding`/`addWork`, the shared `nextInstanceId` allocator, `foodUpkeep`). `workers` on a
    card is a worker **capacity** (max assignable; `0` = self-sufficient, always operating): a
    staffable operates at **≥1 worker** and its declarative output scales **per worker**
    (`producingUnits` × the per-worker unit `produces`, folded in `effects.ts`'s
    `defaultProduce`). A capacity-1 building is the common case (scales ×1 = a flat output); the first
    multi-worker card is the Göbekli Tepe wonder. `autoStaffCount` partial-fills toward capacity.
  - `threats.ts` — persistent board hazards: `addThreat` seeds one at mission setup. A seeded threat
    ticks every round through the `endTurn` broadcast (`events.ts`'s `dispatchEvent` → `effects.ts`'s
    `resolveEndTurn` → the threat's own `resolveCard` drain), so the threat card computes its own
    behaviour — the engine never reads or scales its data. A threat's *driven* defeat (a deadline, not
    a resource drain) is a separate pure-read `defeat` hook, the loss counterpart to `objective.ts`'s
    `objective`; `defeatMet`/`evaluateDefeat` re-derive it into `G.pendingDefeat` at every `flushEvents`
    boundary, set-or-clear like the win flag — never a handler mutating `G.pendingDefeat` mid-dispatch,
    which could leave a stale flag if the condition recovers later in the same broadcast.
  - `objective.ts` — the win counterpart to `threats.ts`: `seedObjective` seeds the mission's
    objective card into `G.objective` at setup; `objectiveMet` reads that card's own pure
    `objective` predicate. It's bus-driven, not polled: `evaluateObjective` re-derives the verdict into
    `G.pendingVictory` at every `flushEvents` boundary (`events.ts`), the way `threats.ts`'s
    `evaluateDefeat` re-derives `G.pendingDefeat`, and `engine.ts`'s `checkEndIf` reads both flags —
    never a card predicate or a mission predicate. A mission-specific *defeat* is a threat's job
    (its own `defeat` hook), not the objective's; neither hook ever mutates `G`.
  - (`resolveProduction` lives in `effects.ts`: per *operating* (staffed) tableau/workZone instance,
    the engine asks each instance to produce and never reads its `produces` itself. Production is
    driven by the `endTurn` broadcast; there is no standalone production module.)
  - `upkeep.ts` — `applyUpkeep` (the `endTurn` broadcast — production + threat drains — → mission
    tick → food eaten → flush), plus `resolveHandEvents` (auto-resolves any *unplayed* `event` cards
    left in hand → discard, so they recur) and `discardWorkZone` (end-of-turn work filing). `settleEndOfTurn` is the single choke
    point that chains resolve-hand-events → recycle-hand → file-work-zone → flush, called by both
    `run/engine.ts`'s `endTurn` and this file's `projectedDelta` (the UI preview) so the two can
    never drift the way open-coded copies once did.
  - `tableau.ts` — derived stats, including the `territory` cap gating tableau size.
  - `deckBuilder.ts` — deck *construction*: a `DeckDef.cards` entry is a meta instance id,
    so `addCard`/`removeCard` resolve through the player's `OwnedCards` (returning
    `'invalid'` on an unresolvable/capped id); `groupCounts`/`resolveDeckCards` translate
    instance ids back to cardIds; `buildSeedDecks` turns content `DeckSeed`s into real
    `DeckDef`s; `MAX_DECKS` is the committed deck-count cap (enforced at `App.saveDeck`).
  - `collection.ts` — `OwnedCards` = `{ instances: MetaCardInstance[], nextId }` (each
    `MetaCardInstance` is `{ id, cardId, stickers? }`). `nextId` is append-only, so
    `grantCopies` never renumbers and a deck's instance-id references never go stale;
    `copiesOwned`/`isOwned` filter instances (an absent cardId = not yet unlocked).
  - `shop.ts` — the copy-tier economy: `TIER_LADDER`, `nextTier`, the immutable `buyTier`,
    and `canBuyTier` (mirrors `buyTier`'s reject — the leaf the upgrade hints fold over).
  - `stickers.ts` — sticker logic: `buySticker` (meta purchase) and
    `effectiveGain`/`effectiveCost`/`effectiveCard`, the only places a sticker touches run
    or display values (each a generic fold over the `StickerDef` hooks; see the convention).
  - `boardStickers.ts` — the board counterpart: `buyBoardSticker` (meta purchase),
    `boardStickerAppliesTo`, `canAttachBoardSticker` (applies · under cap · affordable — the leaf
    both `BoardMenu`'s drag `isValidTarget` and the upgrade hints share), and `effectiveBoard` — the
    single fold that applies a board's stickers to its starting profile (`run/setup.ts` seeds off it;
    the board pickers display it). `MAX_BOARD_STICKERS` is the provisional per-board cap.
  - `upgrades.ts` — the **available-upgrade hints**: `cardUpgradeAvailable`/`boardUpgradeAvailable`
    (per-tile) + `anyCardUpgradeAvailable`/`anyBoardUpgradeAvailable` (nav-badge roll-ups), each
    **on ⟺ some real purchase would succeed right now** (affordable · applicable · under the caps).
    Composes the authoritative buy-reject leaves (`canBuyTier`, `stickerableInstancesOf` +
    `stickerAppliesTo`, `canAttachBoardSticker`) so a hint can never disagree with a drop — the
    invariant `upgrades.test.ts` pins against the real `buy*` functions. All the hints render in one
    **gold buyable-hint accent** (`--hint-gold`, echoing the ⭐ Influence glyph): consumed by
    `Collection.tsx` (a gold border/ring on the card face), `BoardMenu.tsx` (gold open-slot markers in
    the board's sticker row — a board's remaining capacity, via `BoardMini`/`StickerRow`'s `openSlots`),
    and `MetaMenu.tsx` (Collection/Board nav badges). The tray buy controls share the same accent (a
    gold border on an available copy-tier button / sticker badge).
- `src/content/` — the typed game catalogues (cards, decks, boards, missions, stickers).
  A card or sticker def carries its own behaviour (a card's `resolve` closure, a sticker's
  hooks — see the *own their own logic* convention), so these are data *and* the per-entry
  logic that rides on it, not pure data tables. **A building card *is* the building** —
  there's no separate building catalogue. One file per catalogue:
  - `cards.ts` — `CARDS`, the single card catalogue (`CardKind` =
    building/wonder/action/work/event/threat/objective; see DESIGN.md → *Card kinds* for what each
    kind does and how it leaves play). A `building`/`wonder` carries its own stats
    (`produces`/`workers`) right on the `CardDef`. A `wonder` plays exactly like a
    `building` (occupies a tableau slot, staffed, produces each round) — the two share the
    `isStructure` (occupies a slot) and `isStaffable` (produces/staffed at upkeep) choke-point
    predicates, so no call site open-codes a `kind === 'building'` union. A wonder is set apart only
    in the meta loop: its own Collection/deck category, no bought copies (`shop.ts`), no stickers
    (`stickerAppliesTo`), at most `MAX_WONDERS_PER_DECK` per deck (`deckBuilder.ts`). Filing to a
    pile defaults to `discard`, with two named exceptions routed at the play/upkeep choke points, not
    by a static kind rule: Destroy's `effect.destroy` exiles its *target* building to `removed`, and
    the `event` kind splits by *path* — a **played** event is exiled to `removed` **unresolved** (paying
    its cost pre-empts the disaster: its effect never fires), while one **left unplayed** auto-resolves
    its effect at end of turn and files to `discard`, so it recurs (`moves.playCard` /
    `upkeep.ts`'s `resolveHandEvents` own the two sides). An `objective` card owns
    its mission's win logic via a single pure-read `objective` predicate, the way a
    `threat` owns its drain — see `rules/objective.ts`. `isDeckable(card)` is the single predicate
    for "a card the player builds decks with" (excludes event/threat/objective), used by the
    deck-add reject and the Collection/DeckEditor pickers. The catalogue holds the **Paleolithic
    starting set** (hunter-gatherer actions + work cards) plus the first **Stone Age** structures
    unlocked via missions — the Farm/Toolmaker/Hut buildings and the Göbekli Tepe wonder — and the
    sandbox mission's own `objective`/`threat` cards.
  - `decks.ts` — `DeckDef` (a player deck; `cards` is meta instance ids) plus `DeckSeed`/
    `DEFAULT_DECKS` (content authored in plain cardIds, resolved by `buildSeedDecks`). A
    fresh player is meant to start with one editable deck; there's no read-only "built-in" tier.
    The one seed deck is the buildingless **Founding deck**.
  - `collection.ts` — `STARTING_COLLECTION` (a plain `Record<cardId, count>`, turned into a
    real instance-bearing `OwnedCards` by `collectionFromCounts` at seed time). Counts are
    **copy-tier-attainable** (the shop's ×1→×2→×4→×8 ladder — so 1/2/4/8, never 3), and a
    `rules/collection.test.ts` coherence check pins that the starting collection covers the
    Founding deck.
  - `stickers.ts` — `STICKERS`; each `StickerDef` carries its own
    `appliesTo`/`applyGain`/`applyCost` logic and an `icon`.
  - `boardStickers.ts` — `BOARD_STICKERS`; each `BoardStickerDef` carries its own
    `appliesTo`/`applyToBoard` logic and an `icon` (a separate catalogue from card `stickers.ts`).
  - `boards.ts` — `BOARDS` (government boards; each sets all 8 starting resources: the 5
    core plus population/territory/culture; `BoardId` is a plain `string`). A board's `starting`
    flag marks it always-launchable; every other board is **hidden until unlocked** by a mission's
    `unlockBoardIds` reward, exactly like a card or sticker. The board pickers read availability through
    `meta/boardDisplay.ts`'s `availableBoardIds` (`starting || unlocked`), so the baseline never depends
    on the mutable `PlayerStore.unlockedBoards` set — a player can never be locked out of playing. Two
    boards so far: **Tribe** (the sole `starting` board — the Paleolithic start: a small food store and a
    couple of workers, no territory yet) and **Chiefdom** (the first military-leaning government,
    unlocked by the "Raiders at the Border" mission — provisional stats).
  - `missions.ts` — `MISSIONS`; each names an `objectiveCardId` (its win condition, made into
    an `objective` card that owns the win predicate — `run/setup.ts` seeds it into
    `GameState.objective`, the bus re-derives `G.pendingVictory` from it, and `run/engine.ts`'s
    `checkEndIf` reads that flag; see `rules/objective.ts`), plus optional declarative
    `threats`/`events` card-id lists (a threat seeded via `addThreat`, an event minted and shuffled
    into the deck — via this file's `seedMissionCards`, the single place the injection happens, called
    once by `run/setup.ts`) and `kind`/`prereqs`/`map`/`age`/`reward`/`lore` (`age` names the
    `content/ages.ts` band a `'standard'` mission sits under). There is no bespoke per-mission
    setup/upkeep hook — a mission's only per-round or one-time behaviour is whatever its seeded
    threat/event *cards* do through the normal resolver spine. The mission-detail panel
    (`meta/CampaignMap.tsx`'s `MissionFlowPopup`) reads the same `threats`/`events` lists to show the
    card faces a mission is about, so the display can't drift from what a run actually seeds.
  - `ages.ts` — `AGES` (the historical bands of the campaign map — Stone Age → Bronze → Iron) plus
    `ageColSpans`, which derives each age's contiguous DAG **column slice** from its missions'
    `map.col` (a mission declares its age via `MissionDef.age`). `meta/CampaignMap.tsx` positions
    each age's arrow band + gradient wash over that slice, so *each age covers exactly its stretch of
    the DAG*. The Stone Age band is live — it covers the placed standard missions across cols 0–3
    (First Settlement col 0, Growing Numbers col 1, Rites & Rituals col 2, then Rites & Rituals fans
    to Raiders at the Border and Restless People, both col 3 → slice `[0,4)`); Bronze/Iron stay
    dormant until their missions land.

**Shell — the run loop (`src/run/`) + React:**

- `src/run/setup.ts` — `createInitialState(config: RunConfig)`: **constructs the initial
  `GameState`** — the pre-play snapshot, before any turn or draw (`engine.ts` then drives
  the turns). The board (`config.board`) sets the baseline for all 8 starting resources; the
  mission's declarative `threats`/`events` are then seeded on top via `content/missions.ts`'s
  `seedMissionCards`. `config.deck` arrives
  already shuffled (deterministically from `config.seed` — see the determinism convention).
- `src/run/engine.ts` — the turn state machine. `RunState = { G, gameover }`.
  `createRun(config: RunConfig)` bootstraps a run by calling `setup.ts`'s
  `createInitialState`, then running the first `beginTurn`. `endTurn(state)` runs `applyUpkeep`, checks
  win/loss, then hands off to `upkeep.ts`'s `settleEndOfTurn` — resolves any *unplayed* `event` cards still in
  hand (apply effect, file to `discard` so they recur), recycles the hand and files the turn's played `work` cards
  to `discard` — re-checks win/loss, then starts the next turn. `applyMove(state, moveFn, ...args)` clones `G` with `structuredClone`,
  runs the move, and checks win/loss. All three return a new `RunState` — the caller
  (React context) owns the mutable reference. `toRunResult(G, gameover)` promotes a
  finished run into the `RunResult` handed back to the meta loop.
- `src/run/moves.ts` — the moves (`playCard`, `assignWorker`, `unassignWorker`,
  `toggleStaffing`) — the **only** place `G` may change: validate, mutate the
  plain-object `G` draft, delegate computation to `src/rules/`, return `'invalid'` to
  reject. `playCard` pays costs (resources, discard cost), then routes by `kind`: a `building`
  card is placed in the `tableau` via `addBuilding` (staying in play, *not* filed to a pile) and a
  `work` card sticks onto the board via `addWork` (resolving *no* effect on play, filing to
  `discard` only at end of turn); every other card resolves its `effect` and, if `action`,
  files to `discard`. A card with `effect.destroy` demolishes a chosen tableau building and sends
  *that* building's card to `removed`.
  `assignWorker`/`unassignWorker`/`transferWorker`/`toggleStaffing` all target a `Staffable`
  by its instance `id` via `findStaffable`, so they operate on a building *or* a work box
  interchangeably. `toggleStaffing` (a box-level control) empties a staffed box, or fills an empty
  one *toward its capacity* from the idle pool (partial-filling when fewer than its capacity are
  free — a box operates at ≥1 worker). Individual workers are added/removed a pip at a time by
  `assignWorker`/`unassignWorker` (the per-pip clicks + drags).
- `src/run/GameContext.tsx` — React context that holds `RunState` and exposes
  `{ G, gameover, board, moves, endTurn, undo, canUndo, restart, endRun }` via `useGame()`
  (`board` is the `RunConfig.board` this run was launched with, along for presentation —
  e.g. `Board.tsx`'s board-tinted ground backdrop — not gameplay logic, which never
  branches on the board id past `setup.ts`). `GameProvider` takes a `RunConfig`
  (`config` prop) and an `onRunEnd(result: RunResult)` callback, called when the player
  clicks "End Run" on a finished run.
- `src/components/Board.tsx` — the React board. Calls `useGame()` for state and the moves;
  display only — read derived values from `src/rules/` (`projectedDelta`,
  `freePopulation`), never recompute game logic. Supporting pieces:
  - `CardFace.tsx` — the one card visual (name/cost/kind banner/art/workers/effect text +
    kind coloring, all in one CSS module). Shared by the hand, the deck editor, and
    Collection; Board layers hand-only extras (overlap, hover-lift, drag/deal states) on via
    a `className` prop. A stickered card shows a bottom-left `stickerBadge` (the shared
    `StickerRow`) and its `effectiveCard` (sticker-adjusted) numbers.
  - `CardZoomOverlay.tsx` — a full-screen click-to-close enlargement of one `CardFace`,
    reused by Collection.
  - `BoardMini.tsx` — a read-only, board-agnostic miniature of the run board (tinted ground ·
    a top banner of starting counters · the territory slot grid), driven off `effectiveBoard` so
    its numbers match a launched run. Purely presentational (a board id + attached sticker ids, no
    `GameContext`, no logic), so it's reused across meta screens (the Board menu, the mission-select
    launch popup's board picker) — the board counterpart to Collection's real `CardFace`s.
  - `BoardLeftColumn` renders the board's left strip — the mission's `G.objective` card (the goal,
    an "Objective" violet-banner `CardFace`) pinned as its own distinct plaque flush in the top-left
    **corner** (`.objectiveCorner`, a violet-framed nook — always exactly one card), above a separate
    scrolling **threat zone** (`.threatZone`) of its `G.threats` hazards — all `CardFace`s, reading
    only `GameState`, never the mission (it replaced the old fixed top-left `MissionWidget`; the
    objective card now carries the mission name + live progress, its zoom the win-condition text).
    The `.groundBackdrop` is tinted per government board via a `data-board`
    attribute matched in `Board.module.css` — a CSS-only edit per board, no component change.
- `src/meta/` — the meta menu. `MetaMenu.tsx` is the shell: a left nav switches five screens:
  - `CampaignMap.tsx` (Mission tab) — the mission DAG as a horizontally-scrollable tech
    tree (drag-to-pan) under themed age bands (`content/ages.ts`, each band + wash covering its
    own DAG column slice via `ageColSpans`); a node opens `MissionDetailPanel` (lore + reward
    preview) whose "Continue" hands off to a board/deck launch popup that assembles a `RunConfig`
    via `buildRunConfig`. `'infinite'` missions render in a bottom banner, not as nodes.
  - `Collection.tsx` — catalogue of owned cards (omits not-yet-unlocked ones); a tile opens
    `CardInstancePanel.tsx`, a per-owned-instance drill-down that is *also* the card shop
    (there's no separate Shop tab). Mirroring the Board tab's
    model: each owned copy renders as a real `CardFace` (`effectiveCard` numbers + sticker badge)
    with a caption naming the deck(s) it sits in (the anti-surprise info), in a grid
    beside a right-side sticky **tray**. The tray's pinned top holds the Influence balance + the
    buy-next-copy-tier button; below it, one draggable sticker badge per sticker that applies to
    the card. Dragging a badge onto a copy buys+attaches it in one gesture (a hand-rolled
    pointer-drag like `BoardMenu.tsx`, no DnD library — only *valid* targets, `under the cap ·
    affordable`, highlight mid-drag via the single `isValidTarget` predicate; an invalid/missed
    drop no-ops). Clicking a copy (not dragging
    onto it) zooms it. Calls back into `App.tsx` (`onBuyTier`/`onAttachSticker`).
  - `BoardMenu.tsx` (Board tab) — the board-sticker buy surface: a grid of every *available* board (via
    `availableBoardIds`, so a locked board is hidden) as a `BoardMini`
    beside a right-side sticky tray of sticker boxes (each a draggable sticker
    badge over its name/effect/price); dragging a badge onto a board calls `onBuyBoardSticker` to
    buy+attach in one gesture (only *valid* targets highlight mid-drag). `RESOURCE_ICON`/`availableBoardIds`
    live in the shared `meta/boardDisplay.ts`.
  - `Decks.tsx` — every deck as a tile (a hover-revealed card fan grouped ×N via
    `groupCounts`); the tile + its list-view overlay are the shared `DeckTile`/
    `DeckListOverlay` (`components/DeckDisplay.tsx`, also used by the launch popup), with
    Edit/Copy/Delete in its `actions` slots. "New Deck" is the grid's own next slot,
    disabled once `MAX_DECKS` is hit.
  - `Stats.tsx` — the player-profile screen: a hero row of lifetime headline tiles (missions
    cleared `X/Y` · cards unlocked `X/N` · Influence earned · win rate), the infinite-mission
    best-scores board, and the run-history log collapsed below. `missions X/Y` and `cards X/N`
    both show a denominator deliberately (the catalogue *size* is a collectathon hook, not a
    hidden-card leak). Its lifetime numbers come from persistent `PlayerStore` counters
    (`lifetime`, `bestInfinite`), folded in `store.ts`'s `applyRunResult` — **never** derived from
    `runHistory`, which is capped at `HISTORY_LIMIT` and would undercount/decay once trimmed.

  `DeckEditor.tsx` (opened from `Decks.tsx`, not a nav tab) edits one `DeckDef` in place — a
  picker grid (grouped by kind) above a deck banner; cards move by click or the same
  hand-rolled pointer-drag `Board.tsx` uses (no DnD library), through `rules/deckBuilder.ts`.
  A stickered instance breaks out of its fungible ×N stack into its own addressable tile.
  `store.ts` persists `PlayerStore` to `localStorage` (`loadStore`/`saveStore`; seeded from
  `content/`'s `DEFAULT_DECKS`/`STARTING_COLLECTION` on a fresh profile); `applyRunResult`
  is the pure fold that records a finished run. Pre-alpha: an unrecognized store shape resets
  to `emptyStore()`, no migration.
- `src/components/GameMenu.tsx` — the global-action surface: a top-right burger button
  opening stacked submenus.
  - **Save** — export/import/clear the whole `PlayerStore` as a base64 `.civsave` file
    (`meta/store.ts`'s `exportSave`/`importSave`); the destructive ones (Load, Clear) stage
    as a `PendingAction` behind a confirm step. Progress autosaves; this is only for backups.
  - **Config** — device-local `Settings` (`meta/settings.ts`), persisted under their own
    `localStorage` key (kept out of `PlayerStore` since they're not game progress): the
    theme picker, a "confirm before ending a round" toggle, and the UI-size slider (see the
    theming and UI-scaling conventions below for how those two are applied).
  - **Codex** — a static in-menu rules reference (`Codex.tsx`, data in `content/codex.ts`),
    reading no run state so it's identical on both screens.
  - On the run screen only, a `runControls` prop adds **Restart Run / End Run** —
    `PendingAction`-gated while the run is live, immediate once it's over (Restart disabled
    on a won run, mirroring the gameover overlay).
- `src/app/App.tsx` — the shell that switches between `<MetaMenu>` (which calls
  `onLaunch` with an assembled `RunConfig`) and `<GameProvider>` + `<Board>`. On the
  meta screen it mounts `<GameMenu>` directly; on the run screen a small `RunGameMenu`
  wrapper renders inside `<GameProvider>` so it can pull `runControls` off `useGame()`.
  On `onRunEnd`, it stores the `RunResult` and switches back to the menu. It also owns the
  meta write paths — `recordResult` (via `applyRunResult`), `buyCardTier`, `attachSticker`,
  `saveDeck` — each `persist`ing the updated `PlayerStore`.
- `src/main.tsx` — mounts `<App>` in `<StrictMode>` and imports `src/index.css`, the one
  global stylesheet (everything else is CSS Modules). It sets `data-theme` on
  `documentElement` from the saved setting before first paint (no theme flash on load).
  `index.css` holds the color-theme palette (see the theming convention below) plus the few
  `body` resets that can't live in a module. The rationale for each — the pre-paint resolve,
  the `body` margin/background/overflow resets — lives in those files' own comments.

See `src/contract.ts` for the `RunConfig`/`RunResult` types, `buildRunConfig` (takes the
player's `decks`, `collection`, and `boardStickers` as required arguments — there's no static deck
registry to fall back on, a deck's cards are meta instance ids that need the
collection to resolve to cardIds, and the chosen board's stickers are snapshotted onto
`RunConfig.boardStickers`), and `reshuffleRunConfig` (re-shuffles an existing
`RunConfig.deck` directly, used by `GameContext.tsx`'s restart) — the spine between the two loops
(docs/DESIGN.md, "The contract").

**Balance tooling — the headless simulator (`src/sim/`):** a code-driven, no-browser/no-React runner
over the pure core + turn engine, for statistical balance answers no human can play enough games to
reach. It re-implements **no** game logic — `simulateRun(config, policy)` (`sim/simulate.ts`) just
drives the real engine (`createRun` → dispatch actions via `applyAction` → `toRunResult`) under a
`Policy` that returns one `SimAction` per step (a serializable mirror of the moves + `endTurn`).
All policies build on one shared legality enumeration — `enumerateActions(G)` (`sim/actions.ts`), reusing
the prod gate `rules/playability.ts`'s `unplayableReason` (never a re-derived copy) and returning canonical
(deterministic) extra args; when a `pendingInteraction` is parked it returns *only* the answer actions, so
no policy can deadlock on a no-op `endTurn`. `createRandomPolicy(seed)` (`sim/randomPolicy.ts`) is the
**random-legal-move policy** — it picks one enumerated action from its own seeded stream (distinct from the
run's shuffle seed), re-randomizing a play's discard/destroy extras for fuzz coverage. It doubles as a
**crash / illegal-state fuzzer**: `assertRunInvariants` (`sim/invariants.ts`) runs after every action
(bus drained · unique instance ids · staffing/population bounds — deliberately **not** resource
non-negativity, since a collapse ending legitimately leaves a negative pool), throwing with both seeds
as the reproduction key. `simConfig(...)` is a content-agnostic `RunConfig` builder from a cardId/`DeckCard`
deck (the sim counterpart to `buildRunConfig`, no meta collection needed — a `DeckCard` entry threads
per-copy stickers straight through). All randomness routes through
`rules/rng.ts`'s `randInt` — the one seam. `SimOutcome` also carries a per-run `cardPlays` map (accepted
`playCard`s per cardId, counted in the drive loop by reference-inequality acceptance detection) — the
"is a card ever played / dead in the deck?" signal, unrecoverable from the final state.
**Batch + reporting** sit on top: `runBatch(scenarios, { seeds })` (`sim/batch.ts`) sweeps a flat
`Scenario[]` (deck/board/mission; a deck entry is a bare cardId **or** a `DeckCard` carrying per-copy
stickers) ×N seeds — two independent deterministic seed streams
per run (`…-cfg-i` shuffle, `…-pol-i` moves), so a whole batch is reproducible — collecting whole
`SimOutcome`s; `summarize`/`formatReport` (`sim/report.ts`) fold those into a per-scenario
`ScenarioSummary` (win rate · turns min/median/mean/max · mean end resources · **defeat-cause histogram
off the authoritative `gameover.reason`**, never re-derived from resources · summed `cardPlays` +
unplayed-cards list). **Competent policies** bracket the random floor: `createGreedyPolicy(seed)`
(`sim/greedyPolicy.ts`) is a **two-phase one-ply optimizer** — it takes the best strictly-improving
non-`endTurn` action (argmax of `sim/value.ts`'s pure, survival-first `scoreState` over the resulting
state), ending the turn only when nothing improves (splitting off the `endTurn` decision so an infinite
mission's rounds-survived reward can't make advancing always look best); `createHeuristicPolicy(seed?)`
(`sim/heuristicPolicy.ts`) is a cheaper hand-written priority ladder (it clones only for its one
objective rung, not for the whole action set); `createGreedy2Policy(seed)` (`sim/greedy2Policy.ts`) is
`greedy` plus a **bounded 2-ply staffing lookahead** — it values a `work`/`building` play by the best
worker it could then relocate into the new box, so it sees the play→staff combo one-ply greedy misses when
population is saturated. It's kept as a deliberate diagnostic *pair* with `greedy`: the `greedy`↔`greedy2`
win-rate gap measures how much **worker reassignment** is a skill lever in a scenario (decisive on Growing
Numbers — ~41% greedy → ~93% greedy2). These policies are **goal-directed**: they steer toward the
*mission's* objective via `sim/objective.ts`'s `objectiveProgress` — a sim-local `[0,1]` progress
gradient the run engine doesn't expose (an objective is only a win/lose boolean). It lives strictly in
`sim/` (never a hook on a card/mission — see DESIGN.md's *`sim/` is a consumer*), keyed by objective card
id in one registry so the policies stay mission-agnostic; the greedy folds it into `scoreState`
(capability-tier, kept under the starvation cliff so it never chases progress into famine), the heuristic
adds a rung that plays the most progress-advancing card and filters progress-*regressing* plays out of its
fallback. Without it a survival-first policy would drift at an equilibrium and never accumulate to a
threshold win (and, with no deadline, never terminate — why a `'standard'` mission can now be swept).
`runPolicies(scenarios, names, { seeds })` sweeps a scenario under several named policies (`POLICY_FACTORIES`)
with *paired* seeds. Above the greedies sits the **`oracle`** (`sim/oracle.ts` + `sim/oracleKey.ts`) — the
*true ceiling* and a **winnability prover**: a bounded, heuristic-guided, deterministic **graph search** for
a line of play that *wins* the mission on a seed. It rests on the determinism finding — `structuredClone(G)`
already reveals the whole future draw order — so it searches directly instead of rolling out. Four structural
bounds keep it tractable: it **collapses each turn** into one search edge (a bounded within-turn sub-search over
non-`endTurn` actions, then one `endTurn`), a **transposition table** (`keyOf`: `deck` ordered — it *is* the future
draw sequence — every other zone an unordered **multiset** by `rules/state.ts`'s `contentKey`, ids + derived/UI
fields dropped) dedups the action-ordering explosion, the **deadline + territory caps** bound depth/branching, and
a **beam** over `scoreState` keeps the top-`W` states per round-depth. The multiset key is *complete-preserving*
because of two engine order-independence guarantees it relies on: the discard reshuffle **canonicalizes by
content** (`deck.ts`, so hand/discard/workZone order never leaks into the future) and the **zone
order-independence invariant** makes per-round processing commutative (`events.ts`/`upkeep.ts`, enforced by
`sim/zoneOrderInvariance.test.ts`). Soundness rests on *determinism, not the key*: every line it returns is real
actions it applied through the real engine to an observed `victory`, so it replays exactly — a found line is a
**sound proof** of winnability, and a looser key can only *miss* wins (incompleteness), never manufacture a false
one. `searchWinningLine(root)` / `proveWinnable(config)` are the direct search APIs; `createOraclePolicy` wraps a
found line as a scripted `Policy` (dispense one action per step, **greedy2 fallback** when no line is found — so
`oracle`-wins ⊇ `greedy2`-wins, the ceiling-dominates invariant), folding into the same batch/report machinery
unchanged, with a `foundLine` flag distinguishing a search-proven win from a fallback one. The
`npm run sim` CLI (`scripts/sim.ts`, mirroring `seed-save.ts`) sweeps a **mission × deck × board** matrix
with the three axes decoupled: `--scenario <ids>` names mission(s) looked up live from `MISSIONS` (no
copied deck lists), `--deck`/`--board` load hand-editable JSON files (a deck of `{cardId,count,stickers?}`
entries — per-card stickers flow through `simConfig`'s widened `(string|DeckCard)[]` deck — and a board of
`{board,stickers?}`; examples committed under `scripts/sim/decks|boards/`), swept under `--policies` (a
*script-local* `random,heuristic,greedy` default, **not** the exported `DEFAULT_POLICY_NAMES` — name
`greedy2`/`oracle` explicitly, both slow, with a small seed count) and rendered as `--format text|json`.
`--seed <i>` switches to a single-run **replay**: it rebuilds the exact `(cfg,pol)` seed pair the batch
cell `i` used and drives `simulateRun` under an `onStep` observer (fired per action with the states either
side) to print a per-turn economy/actions trace — the observer keeps the drive loop single-sourced (the
batch passes none). A synthetic-fixture move-surface fuzz test (building/destroy/`discardCost`) is deferred until building
content exists.

## Conventions

- **React version** — on React 18; nothing external pins it (boardgame.io, the
  original reason, was never actually a dependency), so a bump to 19 is a deliberate
  choice, not a blocker. Whatever the version, keep `setState` updaters **pure** — the
  run loop relies on StrictMode's intentional dev double-invoke to catch impurity.
- **Cards and stickers own their own logic.** A card's effect runs only through
  `resolveCard(ctx)` (its own `CardDef.resolve`, else the declarative default) — never
  read or scale `CardDef.effect` from a move, upkeep, threat tick, or component. A
  sticker likewise carries its behaviour on its `StickerDef`
  (`appliesTo`/`applyGain`/`applyCost`), dispatched generically by `rules/stickers.ts` —
  no sticker-specific branches at call sites. Adding a mechanic means adding a
  closure/hook on the data, not a branch in the engine.
- All state changes flow through `applyMove` / `endTurn` in `engine.ts` — moves
  receive a `structuredClone` of `G` and mutate it directly; never mutate `G` elsewhere.
- **Game logic is deterministic — never `Math.random`.** Runs are seeded so they're
  reproducible (replays + headless simulation, see DESIGN.md); all randomness goes through
  the seeded RNG (`src/rules/rng.ts`), threaded as `GameState.rngState` and advanced by
  `deck.ts`'s draw/reshuffle. `config.deck` reaches the run already shuffled from
  `config.seed` (`contract.ts`).
- **Zones are unordered except the deck (order-independence invariant).** The draw pile is
  the *only* ordered zone — its order is the future draw sequence. Every other zone (hand,
  discard, tableau, workZone, threats) is conceptually an unordered heap, and the engine
  upholds that two ways: the discard reshuffle **canonicalizes by content** before shuffling
  (`deck.ts`'s `reshuffleIntoDeck`, via `rules/state.ts`'s `contentKey`), so the discard —
  and the hand/workZone that file into it — never influence the future through *order*; and
  no card's effect may make the **committed** end-of-round outcome depend on the resolution
  order of its siblings in a batch (production, threat drains, hand-event auto-resolve). The
  engine's *dispatch* order stays fixed for replay determinism, but the *outcome* must be
  commutative under it. This is what lets the simulator's transposition key treat those zones
  as multisets (`sim/oracleKey.ts`); `sim/zoneOrderInvariance.test.ts` checks it by permuting
  the zones — but over one *fixed fixture*, so it only catches order-dependence among the cards
  it happens to include. **When adding a card whose effect reads across its batch siblings, add
  it to that fixture** (or the regression is silent — a too-loose oracle key that *misses* wins,
  never a false one, since a returned line always replays through the real engine).
- Tests import `{ describe, it, expect }` from `vitest` explicitly (globals are
  not enabled).
- **The UI is mouse-only by design** — no keyboard-activation affordances (e.g.
  `role="button"` + Enter/Space handlers on custom interactive `div`s). Don't add
  keyboard handlers to non-native interactive elements.
- **The whole app renders inside a `transform: scale()` wrapper** (`App.tsx` /
  `App.module.css`, the UI-size setting) — this constrains all UI work, so three rules
  hold everywhere:
  1. **Never rely on document/body scroll.** A transformed ancestor makes its
     `position: fixed` descendants scroll with body content instead of pinning, so a
     new full-screen surface must scroll *inside its own bounded container*
     (`height` + `overflow`), the way the meta shell scrolls in `.content`
     (`MetaMenu.module.css`) — never `min-height: 100vh` growing the body. `index.css`
     keeps the body itself un-scrollable.
  2. **Convert visual→local px for any new pointer-drag/ghost clone.** `clientX/Y` and
     `getBoundingClientRect()` report *visual* (post-scale) px; writing them into an
     inline `left/top/width/height` on a clone inside the wrapper double-scales them, so
     divide by the scale (`px(v) = v / uiScale`, threaded as a prop — see `Board.tsx` /
     `DeckEditor.tsx`). But **do not** convert `offsetHeight`/`offsetWidth`-derived
     values (they're already in layout space — e.g. `Board.tsx`'s gamearea/pill insets),
     and leave hit-testing alone (it compares `clientX` to `getBoundingClientRect()`,
     visual-to-visual, already consistent).
  3. **Divide viewport units that must track the real screen by `var(--ui-scale)`.**
     A raw `vh`/`vw` measures the true viewport and then gets re-scaled; new full-bleed
     sizes or popup caps should use `calc(… / var(--ui-scale, 1))` (the var inherits from
     the wrapper to every descendant) — see the pile panel / Codex caps.
- **All color goes through the theme palette — never write a raw color in a module.**
  Every color is a semantic CSS custom property defined in `src/index.css`: `:root` holds
  the default **Light** palette (each token's value is the exact hex the module used before
  the theme retrofit, so Light is pixel-identical to the pre-theme look), and
  `:root[data-theme='dark']` overrides the same tokens for **Dark**. `data-theme` lives on
  `document.documentElement` (set pre-mount in `main.tsx`, kept in sync by an `App.tsx`
  effect from `settings.theme`). CSS Modules only ever reference `var(--token)`. Rules:
  same hex + same role → one token; same hex + different roles → separate tokens sharing the
  Light value (`--accent` vs `--card-building-banner`, `--badge-bg` vs `--text-strong`), so
  a theme can move one without the other. Colors used at several alphas are stored as
  space-separated channel tokens (`--accent-rgb: 59 125 216`) composed with
  `rgb(var(--accent-rgb) / 12%)`. The only literals left in modules are pure-black
  drop-shadows (`rgba(0,0,0,…)`) and white scrims (`rgba(255,255,255,…)`) — not
  color-identity, they read fine in either theme. **Adding a theme (e.g. a color-blind
  palette) is one `THEMES` entry in `meta/settings.ts` plus one `:root[data-theme='…']`
  block in `index.css` — zero module edits.**
