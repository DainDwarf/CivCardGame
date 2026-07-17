# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

CivCardGame is a **single-player**, browser-based **roguelite deckbuilder** about building a
civilization solo — there is **no AI or human opponent**. Stack: TypeScript · Vite · React 18 ·
Vitest. See [`docs/DESIGN.md`](docs/DESIGN.md) for the full game design, the *why* behind every
system below, and the roadmap.

Two loops:

- **Run loop** (`src/run/`) — play a *locked* pre-built deck against a mission. Hybrid cards
  (building vs. action), a turn lifecycle, a **population/worker-staffing** layer (buildings must be
  staffed to operate; the population eats food each round), and mission-driven win/lose. A custom
  turn engine (`src/run/engine.ts`) drives the state machine; state lives in React context
  (`src/run/GameContext.tsx`).
- **Meta loop** (`src/meta/`) — the **only** place decks are edited: persistent deck construction,
  the shop, and mission selection. `src/contract.ts` (`RunConfig`/`RunResult`) is the spine between
  the loops; `src/app/App.tsx` switches between the meta menu and a run.

**Progress.** The run loop, meta shell, and economy/progression are all built, and the **Stone Age
content arc is shipped** — the tutorial age, exercising every core mechanic. The content-and-balance
pass continues into the Bronze and Iron ages.

The economy/progression systems that exist (each detailed in the Architecture map below, rationalized
in DESIGN.md):

- **Ownership + Influence currency** — `rules/collection.ts`'s `OwnedCards` + `PlayerStore`.
- **Copy-tier shop** — ×1→×2→×4→×8 (`rules/shop.ts`), bought from the Collection card panel (no
  separate Shop tab).
- **Campaign-map DAG** — prereq-gated missions (`rules/campaign.ts`); each `'standard'` clear grants
  a fixed Influence reward + zero or more unlocks (`rules/rewards.ts`).
- **Infinite missions + threats** — never-winning missions paying Influence = rounds survived;
  persistent board hazards (`rules/threats.ts`).
- **Card + board stickers** — per-copy / per-board permanent modifiers bought with Influence
  (`rules/stickers.ts`, `rules/boardStickers.ts`).
- **Government boards** — starting-resource profiles, unlocked/upgraded via mission rewards
  (`content/boards.ts`).

Every unlockable (card, sticker, board) is **hidden until unlocked** — an unlock is meant to be a
surprise, so nothing shows a locked placeholder or a total count.

## Commands

- `npm run dev` — Vite dev server.
- `npm run build` — type-check (`tsc --noEmit`) then produce a production bundle.
- `npm run typecheck` — type-check only: `src` (`tsconfig.json`) then `scripts`
  (`tsconfig.scripts.json`, the Node-targeted project — dev scripts import `src`, so a contract change
  that breaks one surfaces here).
- `npm test` — run the Vitest suite once. `npm run test:watch` — watch mode.
- Single file: `npx vitest run src/rules/scoring.test.ts` · by name: `npx vitest run -t "victory points"`.
- `npm run seed-save` — dev tool (`scripts/seed-save.ts` via `tsx`): walks the campaign DAG and folds
  one finished run per mission through the real `applyRunResult` to write a populated `.civsave`
  (default `./seed.civsave`, gitignored) for testing the meta screens without grinding. `--upto
  <missionId>` stops at that mission's transitive prereqs + itself; `--influence <n>` overrides the
  spendable balance; `--seed`/`--out` set randomization and output path. The DAG walk and default
  target set derive from `content/missions.ts` — missions are never hard-coded.
- `npm run sim` — balance tool (`scripts/sim.ts` via `tsx`): sweeps the headless simulator over a
  mission × deck × board matrix and prints an aggregated report. `--scenario <ids>` names missions
  (live from `content/missions.ts`), `--deck`/`--board` point at JSON files (examples under
  `scripts/sim/`), with `--seeds`/`--policies`/`--format` (text|json). `--seed <i>` switches to a
  single-run per-turn replay trace. See *Balance tooling*.
- `npm run economy` — economy tool (`scripts/economy.ts` via `tsx`): pure computation over content (no
  simulation). Prints the **faucet ledger** (guaranteed Influence granted per standard mission + the
  cumulative amount arriving at each, via `campaign.ts`'s `cumulativeInfluenceInto`) and the **price
  list** (copy tiers from `shop.ts`, card/board stickers), in raw Influence. `--format text|json`. The
  *income* half of a planned meta-progression economy explorer (`docs/ECONOMY-EXPLORER.md`); the
  *demand* half (what a mission forces you to buy) and a grind-normalized yardstick both need the
  simulator and would be later phases.

## Architecture

The codebase is split into a **pure core** and a thin **React shell**. The one rule that matters: the
shell depends on the core; **the core never imports the shell.** That boundary is what keeps game
logic unit-testable without spinning up a client. The core is framework-free — no React, no I/O, no
game-engine library.

### Core — rules (`src/rules/`)

All real game logic *and* the core state type; one module per concern, unit tests alongside. **When
adding a rule, put the logic here and test it directly — never bury it in a move or a component.**

- **`state.ts`** — `GameState` (the serializable run state `G`): the combined `resources: Resources`
  (all 8), the card zones `deck`/`hand`/`discard`/`removed` (each a `CardInstance[]` — `{ id, cardId,
  counters? }`, so every copy has a stable per-run **instance id** and its own per-copy `counters` via
  `getCounter`/`bumpCounter`), the tableau (`PlacedCard` = `CardInstance` + `workers`), `workZone`
  (played `work` awaiting staffing), `threats`, `objective`, and `pendingInteraction` (a suspended
  card effect; while set, `endTurn` no-ops and undo is blocked). `instancesFromCardIds` mints;
  `blankState()` builds an empty one. Instance ids are unique across *all* zones. `G.events` is always
  drained to `[]` in any committed/undo-visible state — undo, clone, and determinism depend on it.
- **`resources.ts`** — the three resource types and their arithmetic: `CoreResources` (5 spendable —
  food/production/science/military/money), `StrategicResources` (population/culture/territory), and
  combined `Resources` (all 8). A card *cost* is `Partial<CoreResources>` (only core is spent); a
  `CardEffect`'s `resources` delta is `Partial<Resources>` (may touch any of the 8). Helpers:
  `add`/`subtract`, `scaleResources`, `canAfford` (core-only), `coreOf`, and `CORE_KEYS`.
- **`deck.ts`** — draw + discard reshuffle (`reshuffleIntoDeck`, seeded off `G.rngState`; bumps
  `reshuffleCount`, a UI-only shuffle-animation cue `Board.tsx` diffs). Also the card-facing deck
  primitives a peek/draw card resolves *through* instead of touching zones directly (the deck
  counterpart to `gainResources`, each taking `EffectContext`): `peekTop` (a **pure read** of the top
  N — never reshuffles; bumps `revealCount` so undo treats the peek as a boundary; drives the
  **Calendar** action), `drawInstance` (draw one *specific* card, emits `draw`), `returnToDeck`, and
  `recoverFromDiscard`. The last three are wired but have no shipping consumer yet.
- **`effects.ts`** — the **resolver spine**. A `CardEffect` is the one "what happens" descriptor,
  carried in four `CardDef` timing slots: play-time `effect`, per-round `produces`, upkeep-boundary
  `upkeep` (a threat drain / unplayed-event disaster / staffable maintenance), and each `on.*` handler.
  `runEffect(ctx, effect)` applies the declarative `resources` field (folded through stickers) then
  runs any `resolve` closure — the two *compose*. `resolveCard` runs a card's play `effect`;
  `resolveUpkeep` its recurring `upkeep`; `resolveProduction` is a separate path that scales
  `produces.resources` per staffed worker. `EffectContext` = `{ G, self, answer? }`. An interactive
  effect suspends via `suspendChoice` into `pendingInteraction` and re-enters via
  `moves.resolveInteraction` — all plain data, so undo/clone survive.
- **`events.ts`** — the **event bus**: lets a card react to an event whose *timing it doesn't own* via
  `CardDef.on?: { draw/discard/resourceChange/reshuffle/endTurn }`, each a `CardEffect` run through the
  same `runEffect` spine (`ctx.event` set). Two verbs, split so the bus never dispatches mid-mutation:
  **emit** (`emitEvent` → `G.events`, at a semantic site) and **flush** (`flushEvents(G, before)` at a
  step boundary — synthesizes a `resourceChange`, then drains `G.events` to `dispatchEvent`, capped by
  `MAX_EVENT_CASCADE`). `dispatchEvent` runs `on[type]` on the event's subject plus every operating
  tableau building / Work card / threat, in fixed order for determinism. Two **broadcast** events name
  no subject: `endTurn` (runs `resolveEndTurn` on each — its `on.endTurn` handler, `produces`
  production, and `upkeep` drain all compose; this is what drives per-round production and threat
  drains, dispatched directly by `applyUpkeep`) and `reshuffle` (no default behaviour; only a card's
  `on.reshuffle` reacts). Win/loss is **pull, not push**: `flushEvents` re-derives `G.pendingVictory`
  (from the objective's `goals`) and `G.pendingDefeat` (from each threat's `defeat`) every boundary,
  and `engine.ts`'s `checkEndIf` reads the flags — never a handler mutating `G.pendingDefeat` directly
  (a stale push could outlive its condition). Handlers must be pure over `G` and must not open a
  `pendingInteraction`.
- **`population.ts`** — worker staffing over buildings *and* work cards through one `Staffable` layer
  (`workerCapOf`/`isOperating`/`producingUnits`/`freePopulation`/`findStaffable`, `addBuilding`/
  `addWork`, `nextInstanceId`, `foodUpkeep`). `workers` is a worker **capacity** (max assignable; `0`
  = self-sufficient, always operating): a staffable operates at **≥1 worker** and its output scales
  **per worker**. `autoStaffCount` partial-fills toward capacity.
- **`threats.ts`** — persistent board hazards: `addThreat` seeds one at setup (resolving its one-time
  entry `effect` once), then it ticks each round via the `endTurn` broadcast → its own `resolveUpkeep`
  drain, so the card computes its own behaviour. A threat's *driven* defeat (a deadline, not a drain)
  is a separate pure-read `defeat` hook; `defeatMet`/`evaluateDefeat` re-derive it into
  `G.pendingDefeat` set-or-clear each flush — never mutated mid-dispatch.
- **`objective.ts`** — the win counterpart to `threats.ts`: `seedObjective` seeds the mission's
  objective card into `G.objective`; `objectiveMet` folds its declarative `goals` (`goalMet`/
  `goalProgress`/`goalsReadout`; a non-threshold goal carries its own bespoke `met`). Bus-driven:
  `evaluateObjective` re-derives `G.pendingVictory` each flush. Mission-specific *defeat* is a threat's
  job, not the objective's; neither hook mutates `G`.
- **`upkeep.ts`** — `applyUpkeep` (`endTurn` broadcast → mission tick → food eaten → flush),
  `resolveHandEvents` (auto-resolves any *unplayed* `event` cards left in hand → discard, so they
  recur), and `discardWorkZone`. `settleEndOfTurn` is the single choke point chaining
  resolve-hand-events → recycle-hand → file-work-zone → flush, shared by `engine.ts`'s `endTurn` and
  the UI preview `projectedDelta` so the two can't drift.
- **`tableau.ts`** — derived stats, including the `territory` cap gating tableau size.
- **`deckBuilder.ts`** — deck *construction* in terms of the **`DeckCard`** variant (a cardId + the
  stickers a copy carries — also `RunConfig.deck`'s element shape, so it's one identity on both sides
  of the contract). A `DeckDef.cards` entry is a meta instance id; `addCard`/`removeCard` take a
  variant and resolve it through the player's `OwnedCards` (returning `'invalid'` on an
  unresolvable/capped one), drawing LIFO from `collection.ts`'s `variantInstancesOf` (copies matching
  in cardId *and* stickers). `groupCounts`/`resolveDeckCards`/`variantKey`/`ownedVariantsOf`
  translate and group; `buildSeedDecks` turns content `DeckSeed`s into `DeckDef`s; `MAX_DECKS` is the
  committed deck-count cap (enforced at `App.saveDeck`).
- **`collection.ts`** — `OwnedCards` = `{ instances: MetaCardInstance[], nextId }` (each `{ id,
  cardId, stickers? }`). `nextId` is append-only, so `grantCopies` never renumbers and deck instance-id
  references never go stale; `copiesOwned`/`isOwned` filter instances (an absent cardId = not yet
  unlocked). Two copies are **fungible** when they share a cardId *and* a `stickerSignature` (stickers
  normalized order-independently) — what `variantInstancesOf` pools and every ×N view counts.
- **`shop.ts`** — the copy-tier economy: `TIER_LADDER`, `nextTier`, the immutable `buyTier`, and
  `canBuyTier` (mirrors `buyTier`'s reject — the leaf the upgrade hints fold over).
- **`stickers.ts`** — sticker logic: `buySticker`, `removeSticker` (destroy the sticker at an *index*
  on one copy — positional because a copy may carry the same sticker twice, so an id would destroy both
  of a stack; drops the `stickers` key when the last one goes, returning the copy to the fungible pool;
  **refunds nothing**), and `effectiveGain`/`effectiveCost`/`effectiveCard` — the only places a sticker
  touches run or display values (each a generic fold over the `StickerDef` hooks). See DESIGN.md →
  *Economy & progression* for the destroy / no-refund rationale.
- **`boardStickers.ts`** — the board counterpart: `buyBoardSticker`, `removeBoardSticker` (destroy at
  an *index* — positional for the same reason; deletes the board key at zero; returns a bare
  `BoardStickers`, **refunds nothing** — the missing `influence` field is the rule, not an oversight),
  `boardStickerAppliesTo`, `canAttachBoardSticker` (applies · under cap · affordable — the shared
  leaf), and `effectiveBoard` (the single fold applying a board's stickers to its starting profile).
  The applied stickers are **snapshotted into `RunConfig.boardStickers` at launch** (never re-looked-up
  in core `setup.ts`), so buying one mid-campaign can't retroactively change an in-progress run.
  `MAX_BOARD_STICKERS` is the provisional per-board cap.
- **`boardUpgrade.ts`** — `applyBoardUpgrade`: the pure fold behind a `boardUpgrade` reward — retire
  the `from` board, unlock `to`, and carry `from`'s stickers across (filtered by
  `boardStickerAppliesTo`, capped). Called once on first clear by `store.ts`'s `applyRunResult`; kept
  out of `rewards.ts` (which is append-only and doesn't touch `boardStickers`).
- **`rewards.ts`** — `computeRewards`: on first `'standard'` clear, grant a fixed Influence reward +
  **zero or more** unlocks — four symmetric, all-optional kinds: `unlockCardIds`, `unlockStickerIds`,
  `unlockBoardStickerIds`, `unlockBoardIds`. The four sets travel through it as one `UnlockProgress`
  bundle (mirroring the `PlayerStore` fields — in unchanged, out with this mission's unlocks folded in)
  rather than a run of transposable positional args. Append-only; a `boardUpgrade` is a *replacement*,
  handled separately (`boardUpgrade.ts`).
- **`campaign.ts`** — the prereq-gated mission DAG: availability derived from each mission's `prereqs`.
  Also the DAG-walk primitives shared by the dev scripts — `prereqClosure` (a target's transitive
  prereqs), `foldOrder` (topological sort so prereqs fold first), and `cumulativeInfluenceInto` (the
  guaranteed Influence arriving at a mission); `seed-save.ts` and `economy.ts` both consume these.
- **`upgrades.ts`** — the **available-upgrade hints**: per-tile `cardUpgradeAvailable`/
  `boardUpgradeAvailable` + nav-badge roll-ups `anyCardUpgradeAvailable`/`anyBoardUpgradeAvailable`,
  each **on ⟺ some real purchase would succeed right now**. They compose the authoritative buy-reject
  leaves (`canBuyTier`, `stickerableInstancesOf`, `canAttachBoardSticker`) so a hint can never disagree
  with a drop (`upgrades.test.ts` pins this against the real `buy*` functions). All hints render in one
  gold accent (`--hint-gold`, echoing the ⭐ Influence glyph).

### Core — content (`src/content/`)

The typed game catalogues. A def carries its own behaviour (a card's `CardEffect.resolve` closure, a
sticker's hooks — see *Cards and stickers own their own logic*), so these are data *and* the per-entry
logic that rides on it. **A building card *is* the building** — there's no separate building catalogue.

- **`cards.ts`** — `CARDS`, the single card catalogue. `CardKind` =
  building/wonder/action/work/event/threat/objective (see DESIGN.md → *Card kinds* for what each does
  and how it leaves play). A `building`/`wonder` carries its own `produces`/`workers`; a wonder plays
  exactly like a building (both share the `isStructure`/`isStaffable` choke-point predicates, so no
  call site open-codes `kind === 'building'`) and differs only in the meta loop (own Collection/deck
  category, no bought copies, no stickers, ≤ `MAX_WONDERS_PER_DECK` per deck). Filing defaults to
  `discard`; the one exception is routed by *path*, not a kind rule — a **played** `event` resolves its
  one-shot `effect` and is exiled to `removed` with its `upkeep` disaster pre-empted, while one **left
  unplayed** fires `upkeep` at end of turn and files to `discard` so it recurs (`moves.playCard` /
  `upkeep.ts`'s `resolveHandEvents`). `isDeckable(card)` is the single "a card the player builds decks
  with" predicate (excludes event/threat/objective). Holds the Paleolithic starting set + the first
  Stone Age structures (Farm/Hut/Burial, the Göbekli Tepe wonder) + the endless missions' own cards.
- **`decks.ts`** — `DeckDef` (`cards` = meta instance ids) plus `DeckSeed`/`DEFAULT_DECKS` (authored in
  plain cardIds, resolved by `buildSeedDecks`). A fresh player starts with one editable deck — the
  buildingless **Founding deck**; there's no read-only "built-in" tier.
- **`collection.ts`** — `STARTING_COLLECTION` (a plain `Record<cardId, count>` → real `OwnedCards` via
  `collectionFromCounts`). Counts must be **copy-tier-attainable** (the ×1→×2→×4→×8 ladder — so 1/2/4/8,
  never 3); `rules/collection.test.ts` pins that the starting collection covers the Founding deck.
- **`stickers.ts`** — `STICKERS`; each `StickerDef` carries its own `appliesTo`/`applyGain`/`applyCost`
  logic and an `icon`.
- **`boardStickers.ts`** — `BOARD_STICKERS`; each `BoardStickerDef` carries its own
  `appliesTo`/`applyToBoard` logic and an `icon` (a separate catalogue from card `stickers.ts`).
- **`boards.ts`** — `BOARDS` (each sets all 8 starting resources) + `ORIGIN_BOARD_ID`. There is no
  `starting` flag: availability is purely membership in `PlayerStore.unlockedBoards`, read through
  `meta/boardDisplay.ts`'s `availableBoardIds` (which falls back to the origin board if the set is ever
  empty, so a player can never be locked out). `unlockBoardIds` **adds**; a `boardUpgrade` **swaps** one
  for another. Four so far: **Tribe** (the origin), **Settlement** (Tribe's upgrade), **Chiefdom**,
  **City** (Settlement's upgrade).
- **`missions.ts`** — `MISSIONS`; each names an `objectiveCardId` (its win card, seeded into
  `G.objective`) plus optional `threats`/`events` card-id lists (seeded via `seedMissionCards`, the
  single injection site, called once by `run/setup.ts`) and `kind`/`prereqs`/`map`/`age`/`reward`/
  `lore`. There is no bespoke per-mission setup/upkeep hook — a mission's behaviour is whatever its
  seeded threat/event *cards* do through the normal spine. `CampaignMap`'s `MissionFlowPopup` reads the
  same lists, so the display can't drift from what a run seeds.
- **`ages.ts`** — `AGES` (Stone → Bronze → Iron) plus `ageColSpans`, which derives each age's
  contiguous DAG **column slice** from its missions' `map.col`. `CampaignMap` positions each age's band
  + wash over its slice. Stone Age is live (cols 0–3); Bronze/Iron stay dormant until their missions
  land.

### Shell — run loop (`src/run/`)

- **`setup.ts`** — `createInitialState(config)`: constructs the pre-play `GameState`. The board sets
  all 8 starting resources; the mission's `threats`/`events` then seed on top via `seedMissionCards`.
  `config.deck` arrives already shuffled (deterministically from `config.seed`).
- **`engine.ts`** — the turn state machine. `RunState = { G, gameover }`. `createRun` bootstraps
  (`createInitialState` → first `beginTurn`). `endTurn` runs `applyUpkeep`, checks win/loss, hands off
  to `settleEndOfTurn`, re-checks, then starts the next turn. `applyMove(state, moveFn, ...)` clones `G`
  with `structuredClone`, runs the move, checks win/loss. `toRunResult(G, gameover)` promotes a
  finished run into the `RunResult`.
- **`moves.ts`** — the moves, the **only** place `G` may change: validate, mutate the plain-object `G`
  draft, delegate computation to `src/rules/`, return `'invalid'` to reject. `playCard` pays costs then
  routes by kind: a `building` → `addBuilding` into the tableau (staying in play, not filed); a `work`
  → `addWork` onto the board (resolving *no* effect on play, filing to `discard` only at end of turn);
  everything else resolves its `effect` and, if `action`, files to `discard`.
  `assignWorker`/`unassignWorker`/`transferWorker`/`toggleStaffing` target a `Staffable` by id via
  `findStaffable`, so they hit a building or a work box interchangeably.
- **`GameContext.tsx`** — React context holding `RunState`, exposing `{ G, gameover, board, moves,
  endTurn, undo, canUndo, restart, endRun }` via `useGame()` (`board` is presentation-only — game logic
  never branches on the board id past `setup.ts`). `GameProvider` takes a `RunConfig` + an
  `onRunEnd(result)` callback.

### Shell — React UI (`src/components`, `src/meta`, `src/app`)

- **`components/Board.tsx`** — the React board; display only (reads `projectedDelta`/`freePopulation`
  from `rules/`, never recomputes logic). Supporting pieces: `CardFace.tsx` (the one card visual —
  name/cost/kind banner/art/workers/effect, shared by hand/deck-editor/Collection; shows `effectiveCard`
  numbers + a `StickerRow` badge; also owns the `RESOURCE_ICON` map for all 8 resources),
  `CardZoomOverlay.tsx`, `BoardMini.tsx` (a read-only board miniature driven off `effectiveBoard`,
  reused across meta screens), and `BoardLeftColumn` (the mission's `G.objective` card pinned in
  `.objectiveCorner` above a scrolling `.threatZone` of `G.threats` — all `CardFace`s reading only
  `GameState`, never the mission). `.groundBackdrop` tints per board via a `data-board` attribute
  (CSS-only).
- **`meta/MetaMenu.tsx`** — the shell; a left nav switches five screens:
  - `CampaignMap.tsx` (Mission) — the mission DAG as a drag-to-pan tech tree under themed age bands; a
    node opens `MissionDetailPanel` (lore + reward preview), whose "Continue" hands off to a board/deck
    launch popup that assembles a `RunConfig` via `buildRunConfig`. Infinite missions render in a bottom
    banner, not as nodes.
  - `Collection.tsx` — owned cards (omits locked ones); a tile opens `CardInstancePanel.tsx`, the
    per-copy drill-down that is *also* the card shop. Each copy is a real `CardFace` beside a sticky
    tray (Influence balance + buy-next-copy-tier button + one draggable sticker badge per applicable
    sticker). Dragging a badge onto a copy buys+attaches in one gesture (a hand-rolled pointer-drag, no
    DnD library; only *valid* targets highlight via `isValidTarget`); clicking a placed badge destroys
    it behind a confirm (refunds nothing); clicking a copy zooms it. Calls `App.tsx`'s
    `onBuyTier`/`onAttachSticker`/`onRemoveSticker`.
  - `BoardMenu.tsx` (Board) — the board-sticker buy surface: available boards (`availableBoardIds`) as
    `BoardMini`s beside a sticky sticker tray; dragging a badge onto a board buys+attaches via
    `onBuyBoardSticker` (only *valid* targets highlight); the same click-to-destroy-behind-confirm.
  - `Decks.tsx` — every deck as a tile (a hover-revealed ×N card fan), the shared
    `DeckTile`/`DeckListOverlay` (`components/DeckDisplay.tsx`) with Edit/Copy/Delete; "New Deck"
    disabled once `MAX_DECKS` is hit.
  - `Stats.tsx` — lifetime headline tiles (missions cleared `X/Y`, cards unlocked `X/N` — the
    denominator is a deliberate collectathon hook), the infinite best-scores board, and a run-history
    log. Lifetime numbers come from persistent `PlayerStore` counters (`lifetime`/`bestInfinite`,
    folded in `applyRunResult`) — **never** from `runHistory`, which is capped at `HISTORY_LIMIT` and
    would undercount once trimmed.
  - `DeckEditor.tsx` (opened from `Decks.tsx`, not a nav tab) — edits one `DeckDef` in place: a picker
    grid over a deck banner, cards moved by click or the hand-rolled pointer-drag through
    `rules/deckBuilder.ts`. Both grids are one ×N tile per **variant** (`ownedVariantsOf`), each tile
    carrying a `DeckCard`, never an instance id.
  - `store.ts` — persists `PlayerStore` to `localStorage` (`loadStore`/`saveStore`, seeded from
    `content/` on a fresh profile); `applyRunResult` is the pure fold that records a finished run.
    Pre-alpha: an unrecognized store shape resets to `emptyStore()`, no migration.
- **`components/GameMenu.tsx`** — the global-action surface (a top-right burger): **Save**
  (export/import/clear the whole `PlayerStore` as a base64 `.civsave`; destructive actions behind a
  confirm), **Config** (device-local `Settings` in `meta/settings.ts` — theme, a confirm-before-ending
  toggle, the UI-size slider), and **Codex** (a static rules reference, data in `content/codex.ts`). On
  the run screen a `runControls` prop adds **Restart / End Run**.
- **`app/App.tsx`** — switches between `<MetaMenu>` (calls `onLaunch` with an assembled `RunConfig`) and
  `<GameProvider>` + `<Board>`. Owns the meta write paths — `recordResult` (via `applyRunResult`),
  `buyCardTier`, `attachSticker`, `saveDeck` — each persisting the updated `PlayerStore`.
- **`main.tsx`** — mounts `<App>` in `<StrictMode>` and imports `src/index.css` (the one global
  stylesheet: the theme palette + the few `body` resets that can't live in a module). Sets `data-theme`
  on `documentElement` before first paint (no theme flash).
- **`contract.ts`** — `RunConfig`/`RunResult`; `buildRunConfig` (takes the player's `decks`,
  `collection`, and `boardStickers` — a deck's cards are meta instance ids needing the collection to
  resolve to cardIds, and the chosen board's stickers are snapshotted onto `RunConfig.boardStickers`)
  and `reshuffleRunConfig` (re-shuffles an existing `RunConfig.deck`, used by restart). See DESIGN.md →
  *The contract*.

### Balance tooling — the headless simulator (`src/sim/`)

A code-driven, no-browser/no-React runner over the pure core + turn engine, for statistical balance
answers no human can play enough games to reach. It re-implements **no** game logic:
`simulateRun(config, policy)` (`simulate.ts`) drives the real engine (`createRun` → `applyAction` →
`toRunResult`) under a `Policy` returning one `SimAction` per step. All randomness routes through
`rules/rng.ts`'s `randInt` — the one seam.

- **`actions.ts`** — `enumerateActions(G)`, the shared legality enumeration, reusing the prod gate
  `rules/playability.ts`'s `unplayableReason` (never a re-derived copy) and returning canonical extra
  args; with a `pendingInteraction` parked it returns *only* the answer actions, so no policy deadlocks.
- **`invariants.ts`** — `assertRunInvariants` (bus drained · unique instance ids · staffing/population
  bounds — deliberately **not** resource non-negativity, since a collapse ending legitimately leaves a
  negative pool), run after every action. The random policy doubles as a crash/illegal-state fuzzer,
  throwing with both seeds as the repro key.
- **Policies** — `randomPolicy` (random legal move), `greedyPolicy` (a two-phase one-ply optimizer over
  `value.ts`'s survival-first `scoreState`, splitting off the `endTurn` decision), `heuristicPolicy` (a
  cheaper hand-written priority ladder), `greedy2Policy` (greedy + a bounded 2-ply staffing lookahead —
  the `greedy`↔`greedy2` win-rate gap measures how much worker reassignment is a skill lever), the
  **`planner`** (`plannerPolicy.ts`) — the **fair competent** policy, a bounded determinized
  expectimax + beam that clears the multi-turn conversion chains the one-ply greedies *plateau* on (e.g.
  Masonry), and the **`oracle`** (`oracle.ts` + `oracleKey.ts`) — a bounded, deterministic **graph
  search** that *proves winnability* by finding a real winning line. The competent policies are
  **goal-directed** via `sim/objective.ts`'s `objectiveProgress` (a sim-local `[0,1]` gradient the run
  engine doesn't expose), kept strictly in `sim/` — never a hook on a card/mission. See DESIGN.md →
  *Code architecture* for the `sim/`-is-a-consumer rule and the oracle's soundness/completeness argument.
- **`planner` internals** — the honest middle between the greedies (too shallow to plan a setup chain)
  and the oracle (cheats by reading the real shuffle off `structuredClone(G)`). `determinize.ts` samples
  **fair** worlds — the deck as an unordered multiset (never the real order; v1 shuffles the whole deck,
  as `revealCount` isn't yet a reliable known-prefix length), from the policy's own seed stream — and the
  planner averages a shallow beam over them (Perfect-Information Monte Carlo), re-planning per turn.
  `enablers.ts` is the leaf accelerator that keeps the beam shallow: `enablerPotential`, derived
  **mechanically from card `cost`→`produces`/`effect`** (reusable by the ECONOMY-EXPLORER demand phase),
  credits a banked resource for the objective progress it *converts into*, turning the greedies' flat
  plateau into a slope. `turnSearch.ts` is the within-turn search skeleton (`expandTurn`) the planner
  and oracle share, parameterized by the ranking heuristic.
- **Batch + reporting** — `runBatch(scenarios, { seeds })` (`batch.ts`) sweeps a flat `Scenario[]` ×N
  seeds (two deterministic streams per run — `…-cfg-i` shuffle, `…-pol-i` moves — so a batch is
  reproducible); `summarize`/`formatReport` (`report.ts`) fold the `SimOutcome`s (including a per-run
  `cardPlays` map — the dead-card signal) into a per-scenario win rate · turns · mean end resources · a
  defeat-cause histogram off the authoritative `gameover.reason`. `runPolicies` sweeps one scenario
  under several named policies with *paired* seeds. `simConfig(...)` builds a content-agnostic
  `RunConfig` from a cardId/`DeckCard` deck (the sim counterpart to `buildRunConfig`).
- **CLI** (`scripts/sim.ts`) — sweeps a **mission × deck × board** matrix, three axes decoupled:
  `--scenario` names missions (live from `MISSIONS`), `--deck`/`--board` load hand-editable JSON
  (examples under `scripts/sim/`), swept under `--policies`/`--seeds`/`--format`. `--seed <i>` switches
  to a single-run replay: it rebuilds the exact `(cfg,pol)` seed pair for batch cell `i` and drives
  `simulateRun` under an `onStep` observer to print a per-turn trace.

## Conventions

- **React version** — on React 18; nothing external pins it, so a bump to 19 is a deliberate choice.
  Whatever the version, keep `setState` updaters **pure** — the run loop relies on StrictMode's
  intentional dev double-invoke to catch impurity.
- **Cards and stickers own their own logic.** A card's effect runs only through
  `resolveCard(ctx)`/`runEffect` (its `CardEffect.resolve` closure, else the declarative default) —
  never read or scale `CardDef.effect` from a move, upkeep, threat tick, or component. A sticker
  likewise carries its behaviour on its `StickerDef` (`appliesTo`/`applyGain`/`applyCost`), dispatched
  generically by `rules/stickers.ts` — no sticker-specific branches at call sites. Adding a mechanic
  means adding a closure/hook on the data, not a branch in the engine.
- **Comments state non-obvious intent about the code they sit on — nothing else.** A comment earns its
  place only by expressing a rationale/constraint the adjacent code can't, and you **re-shave a comment
  when you edit near it** rather than appending. Reject three failure modes: **paraphrase** (restating
  what the code plainly says — it just drifts stale), **history** ("used to…", "Phase N" — that's
  git/CHANGELOG's job), and **semantic bleeding** (a comment explaining *unrelated* code — the worst,
  since it's usually a sign the logic landed in the wrong place; keep a mechanism's explanation where
  the mechanism lives, and from elsewhere use a bare pointer).
- **All state changes flow through `applyMove` / `endTurn` in `engine.ts`** — moves receive a
  `structuredClone` of `G` and mutate it directly; never mutate `G` elsewhere.
- **Game logic is deterministic — never `Math.random`.** Runs are seeded so they're reproducible
  (replays + headless simulation); all randomness goes through the seeded RNG (`src/rules/rng.ts`),
  threaded as `GameState.rngState` and advanced by `deck.ts`'s draw/reshuffle. `config.deck` reaches
  the run already shuffled from `config.seed` (`contract.ts`).
- **Zones are unordered except the deck.** The draw pile is the *only* ordered zone — its order is the
  future draw sequence. Every other zone (hand, discard, tableau, workZone, threats) is an unordered
  heap: the discard reshuffle canonicalizes by content before shuffling (`deck.ts`'s
  `reshuffleIntoDeck`, via `state.ts`'s `contentKey`), and no card's effect may make the **committed**
  end-of-round outcome depend on the resolution order of its batch siblings. This is what lets the
  simulator's transposition key treat those zones as multisets. **When adding a card whose effect reads
  across its batch siblings, add it to `sim/zoneOrderInvariance.test.ts`'s fixture** (or the regression
  is silent). See DESIGN.md → *Determinism & order-independence* for the full framing.
- **Tests import `{ describe, it, expect }` from `vitest` explicitly** (globals are not enabled).
- **The UI is mouse-only by design** — no keyboard-activation affordances (e.g. `role="button"` +
  Enter/Space handlers on custom interactive `div`s).
- **The whole app renders inside a `transform: scale()` wrapper** (`App.tsx` / `App.module.css`, the
  UI-size setting) — so three rules hold everywhere:
  1. **Never rely on document/body scroll.** A transformed ancestor makes `position: fixed`
     descendants scroll with body content instead of pinning, so a new full-screen surface must scroll
     *inside its own bounded container* (`height` + `overflow`), the way the meta shell scrolls in
     `.content` (`MetaMenu.module.css`) — never `min-height: 100vh` growing the body.
  2. **Convert visual→local px for any new pointer-drag/ghost clone.** `clientX/Y` and
     `getBoundingClientRect()` report *visual* (post-scale) px; writing them into an inline
     `left/top/width/height` on a clone inside the wrapper double-scales them, so divide by the scale
     (`px(v) = v / uiScale`, threaded as a prop — see `Board.tsx`/`DeckEditor.tsx`). But **do not**
     convert `offsetHeight`/`offsetWidth`-derived values (already in layout space), and leave
     hit-testing alone (it compares `clientX` to `getBoundingClientRect()`, already consistent).
  3. **Divide viewport units that must track the real screen by `var(--ui-scale)`.** A raw `vh`/`vw`
     measures the true viewport and then gets re-scaled; new full-bleed sizes or popup caps should use
     `calc(… / var(--ui-scale, 1))` (the var inherits from the wrapper to every descendant).
- **All color goes through the theme palette — never write a raw color in a module.** Every color is a
  semantic CSS custom property in `src/index.css`: `:root` holds the default **Light** palette,
  `:root[data-theme='dark']` overrides the same tokens for **Dark**, and `data-theme` lives on
  `document.documentElement` (set pre-mount in `main.tsx`, kept in sync by an `App.tsx` effect). CSS
  Modules only reference `var(--token)`. Same hex + same role → one token; same hex + different roles →
  separate tokens sharing the Light value, so a theme can move one without the other. Colors used at
  several alphas are stored as space-separated channel tokens (`--accent-rgb: 59 125 216`) composed with
  `rgb(var(--accent-rgb) / 12%)`. The only literals left in modules are pure-black drop-shadows and
  white scrims (not color-identity). **Adding a theme is one `THEMES` entry in `meta/settings.ts` plus
  one `:root[data-theme='…']` block in `index.css` — zero module edits.**
