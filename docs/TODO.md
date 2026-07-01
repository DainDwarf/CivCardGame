# CivCardGame — TODO / Idea Backlog

> A scratch list for ideas caught **in passing** so they aren't lost — *not* a
> committed plan. Anything here is a candidate, not a promise. Decided, designed
> work lives in [`DESIGN.md`](DESIGN.md); this is the inbox that feeds it.

**How we use it:** say *"jot: …"* or *"TODO: …"* (or "note that down") mid-task and
the idea lands here as a one-liner without derailing what we're doing. We triage
later — promote items into `DESIGN.md` / real work, or drop them.

> Tags (optional): `[size: S/M/L]` rough effort · `[?]` needs design discussion ·
> `[blocked]` waiting on something else · `[phase: N]` roadmap phase (1 = run loop · 2 = contract + meta shell · 3 = economy & progression · 4 = content & balance).

## Phase 2 build plan — sequenced `[phase: 2]`

> The agreed task order for closing the loop (contract + meta shell). Numbered = do in
> order; each step is meant to leave something runnable. See *The contract* and
> *Government boards* in [[DESIGN]].

1. ~~**Scaffold meta content**~~ — done, see *Done / shipped* below. `[size: S]`
2. ~~**Mission-select menu**~~ — done, see *Done / shipped* below. `[size: M]`
3. ~~**Define `contract.ts`**~~ — done, see *Done / shipped* below. `[size: M]`
4. ~~**Wire the loop closed**~~ — done, see *Done / shipped* below. `[size: L]`
5. **Extend the meta menu** — add a collection view and deck-construction navigation/screens (shell + routing only, no editing logic yet). `[size: M]`
6. **localStorage persistence** — stand up the persisted player store (collection + saved decks + progress) with localStorage save/load. Comes **before** deck construction so the editor is built on the real store, not retrofitted onto in-memory state. `[size: M]`
7. **Deck construction** — the deck editor: build/edit run decks from the collection, writing directly to the persisted store. Deck-construction *constraints* (size, copy/rarity limits, civ identity) stay deferred to Phase 4. `[size: L] [?]`

## Meta loop (`src/meta/` — not built yet)

- **Tutorial missions** — the first few meta missions double as tutorials, introducing mechanics progressively `[?]` `[phase: 3]`
- **Card modifiers** — meta may offer ways to attach persistent modifiers to individual cards (long-term idea, details TBD) `[?]` `[phase: 3]`
- Add strategic resources (population / territory / culture) to `RunResult.stats` — currently only `finalResources` (the 5 core) `[?]` `[phase: 2]`

## Cards & content (`src/content/`)

- **Disasters** — a **mission modifier**: some missions inject disaster/event cards (negative effects) into the player's *run* deck at mission start, as pressure. Crucially, this only affects the run deck the mission is launched with — it never mutates the saved meta deck. Military helps prevent/mitigate them (details TBD). Contract-relevant: the `RunConfig`'s run deck = the player's meta deck + the mission's injected cards, so injection likely happens as the `RunConfig` is assembled. `[?]` `[phase: 2]`
- New mission type: "Metropolis" `[?]` `[phase: 4]`
- New mission: "Build the Wonder" `[?]` `[phase: 4]`
- Culture-based missions (depend on the Culture resource) `[?]` `[phase: 4]`
- Building that changes hand size (e.g. +1 card drawn per round) `[?]` `[phase: 4]`
- Culture thresholds change hand size by default (no building required) — culture as a passive progression axis `[?]` `[phase: 4]`
- Resources transformation? Like a building that transforms production into science for example `[phase: 4]`

## UI (`src/components/`)

- **Multi-pip staffing UI** — once a building can require 2–3 workers, its box needs one pip per worker slot (not the current single staff-toggle icon), so partial staffing is visible and each pip can be dragged independently. Follow-up to the now-shipped building→building worker drag; blocked on a multi-worker building actually existing (see [[multi-worker-buildings-roadmap]]). `[size: M] [?] [blocked]` `[phase: 4]`
- **Bulk-move modifier for worker transfers** — a modifier (e.g. shift-drag) to move N workers from one building to another in one gesture, instead of one pip-drag per worker. Only pays off once multi-pip staffing (above) exists. `[size: S] [?] [blocked]` `[phase: 4]`

## Tech debt & infra (build, tests, tooling)

- Use the seeded RNG (`rules/rng.ts`) to reshuffle the discard pile when it becomes the new deck, instead of preserving discard order `[phase: 2]`
- Restart should reshuffle the deck — `GameContext.tsx`'s `restart` currently reuses the same `RunConfig` (same seed), so it replays the identical draw order every time `[phase: 2]`

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
> silently vanishes. Everything through **v0.0.1 (end of Phase 1)** has been moved to
> [`CHANGELOG.md`](../CHANGELOG.md); this section restarts empty for Phase 2 onward.

- **Wire the loop closed** (Phase 2 build plan step 4) — `src/app/App.tsx` is the new
  shell: a meta↔run view switch holding `{ screen: 'menu' } | { screen: 'run'; config }`
  state. `createInitialState`/`createRun` now take a `RunConfig` instead of a bare
  `missionId`; `createInitialState` applies the board's baseline (all 8 starting
  resources) before the mission's `setup` layers its modifiers on top — disaster
  injection stays unimplemented (no mission defines one yet; the seam is the assembled
  `RunConfig.deck`, per `buildRunConfig`). `GameProvider` takes `{ config, onRunEnd }`;
  `restart` now carries `RunConfig` through the reducer action instead of reading
  `missionId` off the live state. The gameover overlay's "End Run" button (previously
  disabled) now calls the new `endRun()` context method, which promotes the finished
  `RunState` into a `RunResult` (`engine.ts`'s `toRunResult`) and hands it to
  `onRunEnd` — `App` stores it and returns to the menu, where `MissionSelect` shows a
  one-line "Last run: …" summary. `main.tsx` now mounts `<App>` instead of
  `<MissionSelect>` directly. `run.test.ts`'s `start()` helper builds a `RunConfig`
  by hand (unshuffled deck) rather than going through `buildRunConfig`, since the
  tests assert on a fixed hand order that a seeded shuffle would disturb; added a
  board-application test (monarchy/republic) since Tribe's values happen to match the
  old hardcoded defaults and wouldn't have caught a broken board wire-up.
- **Define `contract.ts`** (Phase 2 build plan step 3) — `src/contract.ts` formalizes
  `RunConfig` (`deck` / `board` / `missionId` / `seed`) and `RunResult` (`outcome` /
  `missionId` / `stats`; deliberately no `rewards` field — those are looked up from
  the mission or derived from `stats` by the meta loop, not carried on the result),
  plus `buildRunConfig(selection, seed)`, which
  promotes a `RunSelection` into a `RunConfig` by resolving the picked `DeckId` and
  shuffling its cards deterministically from `seed`. New `src/rules/rng.ts` wraps
  `pure-rand` (`xoroshiro128plus` + `uniformInt`) behind `seededRng`/`shuffle` — the
  one seam allowed to produce randomness; `seededRng` is exposed (not just `shuffle`)
  so step 4 can extend the same stream to the discard-pile reshuffle. Not yet wired
  into `createRun`/`setup.ts` — those still take a bare `missionId` and a fixed deck
  until step 4 swaps the pipeline over to consume a `RunConfig`.
- **Mission-select menu** (Phase 2 build plan step 2) — `src/meta/MissionSelect.tsx`,
  the first meta screen, replaces the old direct-to-run mount in `main.tsx`. Picks
  mission (of 3) / board (of 3) / deck (of 3) into a provisional `RunSelection`
  (`{ missionId, boardId, deckId }`) held in local state. "Start Run" is intentionally
  disabled — the Board is unreachable via UI until step 4 wires the loop closed;
  `run.test.ts` still exercises the run loop directly in the meantime.
- **Scaffold meta content** (Phase 2 build plan step 1) — `src/content/boards.ts`
  (`BoardId` + `BOARDS`: Tribe, Monarchy, Republic, each setting all 8 starting
  resources) and `src/content/decks.ts` restructured from a single `DEFAULT_DECK`
  into a `DeckId`/`DECKS` registry (Balanced, Industrious, Scholarly). Not yet wired
  into a run — boards are inert data until step 2 (mission-select menu) and step 4
  (setup assembly) consume them.
