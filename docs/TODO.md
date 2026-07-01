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

1. **Scaffold meta content** — author 2–3 **government boards** (`src/content/boards.ts` + a `BoardId` type; each board sets starting values for all 8 resources — 5 core + 3 strategic) and 2–3 **premade decks** (`decks.ts` currently has only `DEFAULT_DECK`). Prerequisite for the mission-select menu. `[size: S]`
2. **Mission-select menu** — the first meta screen; replaces the current direct-to-run mount in `main.tsx`. Player picks mission (of 3), board, and deck, held as a provisional selection shape `{ missionId, boardId, deckId }`. Does not launch a run yet. `[size: M]`
3. **Define `contract.ts`** — formalize `RunConfig`/`RunResult`, promoting the menu's selection shape into the real type. Includes the run **`seed`**: wire a seeded RNG/shuffle to replace today's deterministic draw, so the seed is meaningful from the start rather than a stub. `[size: M]`
4. **Wire the loop closed** — introduce the `app/` shell + a meta↔run **view switch**; refactor the `missionId`-keyed pipeline (`createRun` / `createInitialState` / `GameProvider` / restart) to consume a `RunConfig`; apply board baseline-resources + disaster injection during setup assembly; end-of-run returns to the menu with a **minimal `RunResult`** (no reward application yet — that needs collection + Phase-3 currency). `[size: L]`
5. **Extend the meta menu** — add a collection view and deck-construction navigation/screens (shell + routing only, no editing logic yet). `[size: M]`
6. **localStorage persistence** — stand up the persisted player store (collection + saved decks + progress) with localStorage save/load. Comes **before** deck construction so the editor is built on the real store, not retrofitted onto in-memory state. `[size: M]`
7. **Deck construction** — the deck editor: build/edit run decks from the collection, writing directly to the persisted store. Deck-construction *constraints* (size, copy/rarity limits, civ identity) stay deferred to Phase 4. `[size: L] [?]`

## Meta loop (`src/meta/` — not built yet)

- **Tutorial missions** — the first few meta missions double as tutorials, introducing mechanics progressively `[?]` `[phase: 3]`
- **Card modifiers** — meta may offer ways to attach persistent modifiers to individual cards (long-term idea, details TBD) `[?]` `[phase: 3]`

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
