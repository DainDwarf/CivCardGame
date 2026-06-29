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

_(empty)_

## Cards & content (`src/content/`)

- New mission type: "Metropolis" `[?]`
- New mission: "Build the Wonder" `[?]`
- Culture-based missions (depend on the Culture resource) `[?]`
- Building that changes hand size (e.g. +1 card drawn per round) `[?]`

## UI (`src/components/`)

- **Bug:** End Round not disabled during pending discard-pick — firing it mid-pick sends stale `handIdx`/`discards` to `playCard`, silently playing/sacrificing wrong cards (`Board.tsx:432`) `[size: S]`
- **Bug:** End Round not disabled during active drag — a second tap fires `endTurn` while `drag.handIdx` is stale, causing the wrong card to play on pointer-up (`Board.tsx:348`) `[size: S]`
- **Bug:** `pending` state not cleared on `G.hand` change — after `endTurn` fires mid-pending, `isPending`/`isSacrifice` highlights and cancel-click attach to the wrong cards in the new hand (`Board.tsx:584`) `[size: S]`
- **Bug:** `warnEndRound` never reset when `shouldWarn` goes false — warning dialog ghost-triggers if player assigns then unassigns a worker without dismissing it (`Board.tsx:298`) `[size: S]`
- Cleanup: `hasUnstaffedCapacity` re-implements `!isOperating()` which is already imported; replace with `G.tableau.some(b => !isOperating(b))` (`Board.tsx:467`) `[size: S]`

## Tech debt & infra (build, tests, tooling)

- **Bug (latent):** Sacrificed cards pushed to `G.discard` before `applyEffect` — a future card with both `discardCost` and `effect.draw` could trigger a reshuffle that returns the sacrifice to hand, nullifying the cost (`moves.ts:40`) `[size: S]`
- **Bug (test reliability):** `playByName` / `play` helpers pass `-1` silently when a card name isn't in hand — rejection tests can pass vacuously after a rename (`run.test.ts:14`, `moves.test.ts:7`) `[size: S]`
- Cleanup: JSDoc on `playCard` still says "discardIds" and "duplicates allowed" — both wrong after the index-based refactor (`moves.ts:12`) `[size: S]`

## Game design & balance

- Add a "Culture" resource; some cards require a Culture threshold to be playable `[?]`
- "Space" resource capping how many buildings you can have; cards to remove buildings to free space; military expands space with exponentially rising thresholds `[?]`
- Card effects that trigger on discard / on draw, to enable combos `[?]`

---

## Done / shipped

> Completed items move here (newest first) so the backlog stays current but nothing
> silently vanishes.

- Recurring buildings — permanent/recurring hybrid card type (village_settlement etc.).
- Discard-as-cost actions — Forced Labor & Harvest now sacrifice a hand card (waived if you can't cover it).
