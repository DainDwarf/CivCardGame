import { contentKey, type CardInstance, type GameState, type PendingInteraction, type PlacedCard } from '../rules';

/**
 * The **canonical transposition key** for a run state: the explicit, readable statement of when two states
 * count as the same search node, which is what lets duplicates merge and collapses the action-ordering
 * explosion. `hashOf` below is the fingerprint the searches actually index by; this defines the relation
 * that fingerprint realizes, and the reasoning here is what governs both.
 *
 * The primary claim the oracle makes — *a returned winning line is a real, replayable win* — does **not**
 * depend on this key at all: every line the search returns is a sequence of actions it actually applied
 * through the real engine to an observed `victory` gameover, so determinism guarantees the replay
 * reproduces it. The key only affects **completeness**: a too-*loose* key could falsely merge two states
 * with different futures and thereby *miss* a win (under-report winnability); a too-*tight* key merges
 * less and only costs speed.
 *
 * The key mirrors the player's mental model — **one ordered draw pile, everything else an unordered heap**:
 * - `deck` is **ordered**: its order *is* the future draw sequence (same multiset, different order ⇒ a
 *   different next card), the one irreducibly-ordered field.
 * - `hand`/`discard`/`tableau`/`workZone`/`threats`/`removed` are **sorted multisets** (by `contentKey`,
 *   with a placed card's `workers` folded in). Two of the engine's order-independence guarantees make this
 *   *complete-preserving* (no false merge): the discard reshuffle canonicalizes by content, so discard —
 *   and thus the hand/workZone that file into it — no longer influence the future through *order*
 *   (`deck.ts`); and the zone order-independence invariant makes per-round processing (production, threat
 *   drains, hand-event auto-resolve) commutative (`events.ts`/`upkeep.ts`). Enforced by
 *   `sim/zoneOrderInvariance.test.ts`.
 * - `rngState` is included (it determines the *next* reshuffle's permutation).
 * - The only normalization beyond order is dropping **instance ids** (the engine never branches on an id's
 *   numeric value — a consistent relabeling is isomorphic) and **derived/constant/UI fields**
 *   (`objective`/`missionId` — invariant across a search; `events` — always `[]` at a step boundary;
 *   `pendingVictory`/`pendingDefeat` — re-derived each flush and the goal test is evaluated separately;
 *   `reshuffleCount`/`revealCount` — pure UI/undo cues no rule reads).
 *
 * Multiset keying is what actually collapses the explosion: worker assignment is order-independent, and
 * independent plays now commute (their discard/hand-order footprint no longer matters), so all those
 * reorderings merge to one node.
 */
export function keyOf(G: GameState): string {
  const r = G.resources;
  return [
    G.round,
    r.food,
    r.production,
    r.science,
    r.military,
    r.money,
    G.resources.population,
    G.resources.territory,
    G.resources.culture,
    G.handSize,
    orderedZone(G.deck), // the future draw sequence — the sole ordered field
    multiset(G.discard),
    multiset(G.hand),
    placedMultiset(G.tableau),
    placedMultiset(G.workZone),
    multiset(G.threats),
    multiset(G.removed),
    G.rngState.join(','),
    pendingToken(G.pendingInteraction),
  ].join('|');
}

/** An ordered zone (the deck): array order preserved, each instance reduced to its `contentKey`. */
function orderedZone(list: readonly CardInstance[]): string {
  return list.map(contentKey).join(';');
}

/** An unordered zone: instances reduced to `contentKey` and **sorted**, so array order is erased. */
function multiset(list: readonly CardInstance[]): string {
  return list.map(contentKey).sort().join(';');
}

/** An unordered zone of placed (staffed) instances (tableau/workZone), folding each box's `workers`
 *  into its token before sorting. */
function placedMultiset(list: readonly PlacedCard[]): string {
  return list
    .map((c) => `${contentKey(c)}@${c.workers}`)
    .sort()
    .join(';');
}

/** A parked interaction's token: its card, choice shape, pick count, and revealed options **in order**
 *  (the answer is an index into `options`, so option order is load-bearing). Empty when none is parked. */
function pendingToken(p: PendingInteraction | null): string {
  if (!p) return '';
  return `${p.cardId}#${p.kind}#${p.pick}#${p.options.map(contentKey).join(';')}`;
}

/**
 * A 53-bit **fingerprint** standing in for `keyOf` as the searches' transposition key: it realizes the same
 * equivalence relation, and is what every consumer actually indexes by.
 *
 * The speedup comes from an unordered zone folding **commutatively** (a sum), so its order is erased *by
 * construction* — no sort, no intermediate array, no joined string, where `keyOf` pays all three. The deck
 * keeps a position-dependent fold, its order being the future draw sequence. Additive rather than xor on
 * purpose: xor self-cancels a pair of identical cards, and a duplicate-heavy discard is where that bites.
 *
 * **This is a hash, so a collision merges two distinct states rather than being detected.** That is a
 * deliberate trade, and it is affordable only because of where the risk lands:
 * - It costs **completeness, never soundness**. A merge can only make a search *miss* a line; the oracle's
 *   returned lines are still replayed through the real engine (see `keyOf` above for the full argument).
 * - Population at risk, by structure. The planner's `localSeen` lives for one `expandTurn`; its `leafCache`
 *   for a whole run of re-plans. The oracle's `seen` is the outlier — one set deduping turn-starts across
 *   the *entire* search, so it grows largest (~10⁵: `beamWidth`×`turnConfigLimit`×`maxRounds`, ultimately
 *   capped by `nodeBudget`) for a ~10⁻⁶ birthday-bound chance of *any* collision against 2⁵³; the
 *   smaller/shorter-lived caches sit nearer ~10⁻⁸. A `seen`/`localSeen` collision only prunes a
 *   genuinely-new turn-start (a completeness cost, per the bullet above); a `leafCache` collision merely
 *   mis-values one (a ranking wobble) — either way, never soundness.
 * - Determinism is untouched: the same seed hashes the same way, so a run stays exactly reproducible.
 *
 * Verifying collisions instead was measured and is *slower than not hashing at all* — the check fires on
 * every cache **hit**, not on the rare collision, and hits are the common case.
 */
export function hashOf(G: GameState): number {
  const r = G.resources;
  laneA = OFFSET_A;
  laneB = OFFSET_B;
  mixScalar(G.round);
  mixScalar(r.food);
  mixScalar(r.production);
  mixScalar(r.science);
  mixScalar(r.military);
  mixScalar(r.money);
  mixScalar(r.population);
  mixScalar(r.territory);
  mixScalar(r.culture);
  mixScalar(G.handSize);
  foldOrdered(G.deck);
  foldMultiset(G.discard);
  foldMultiset(G.hand);
  foldPlaced(G.tableau);
  foldPlaced(G.workZone);
  foldMultiset(G.threats);
  foldMultiset(G.removed);
  for (const n of G.rngState) mixScalar(n);
  foldPending(G.pendingInteraction);
  // 32 high bits from one lane, 21 from the other: the widest exact integer JS carries, so consumers stay
  // plain number-keyed Maps instead of nesting or re-stringifying a pair.
  return (laneA >>> 0) * 0x200000 + (laneB >>> 11);
}

const OFFSET_A = 0x811c9dc5;
const OFFSET_B = 0x9e3779b1;
const PRIME_A = 0x01000193;
const PRIME_B = 0x85ebca6b;
const MIX_A = 0x7feb352d;
const MIX_B = 0x846ca68b;

/** The two lanes live at module scope rather than being returned as a pair because `hashOf` is the sim's
 *  hottest leaf, and a per-zone tuple allocation there is precisely the cost this fingerprint exists to
 *  avoid. Safe because the fold is synchronous and non-reentrant. */
let laneA = 0;
let laneB = 0;

/** Distinct content tokens are few and endlessly repeated across states, so each is walked once. */
const TOKEN_HASH = new Map<string, number>();

function mixScalar(n: number): void {
  laneA = Math.imul(laneA ^ n, PRIME_A) | 0;
  laneB = Math.imul(laneB ^ ((n << 13) | (n >>> 19)), PRIME_B) | 0;
}

/** Fold one already-combined zone summary into the lanes, positionally — so two zones holding the same
 *  cards stay distinguishable. */
function mixPair(a: number, b: number): void {
  laneA = Math.imul(laneA ^ a, PRIME_A) | 0;
  laneB = Math.imul(laneB ^ b, PRIME_B) | 0;
}

function hashString(s: string): number {
  let h = OFFSET_A;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), PRIME_A);
  return h | 0;
}

/** An instance's content token, hashed. Mirrors `keyOf`'s tokenization — a bare instance keys on its raw
 *  `cardId`, so the common path builds no string at all. */
function tokenHash(inst: CardInstance): number {
  const decorated =
    (inst.stickers !== undefined && inst.stickers.length > 0) ||
    (inst.counters !== undefined && Object.keys(inst.counters).length > 0);
  const token = decorated ? contentKey(inst) : inst.cardId;
  let h = TOKEN_HASH.get(token);
  if (h === undefined) TOKEN_HASH.set(token, (h = hashString(token)));
  return h;
}

function foldOrdered(list: readonly CardInstance[]): void {
  let a = OFFSET_A;
  let b = OFFSET_B;
  for (const inst of list) {
    const t = tokenHash(inst);
    a = Math.imul(a ^ t, PRIME_A) | 0;
    b = Math.imul(b ^ t, PRIME_B) | 0;
  }
  mixPair(a, b);
}

/**
 * An element's contribution to a **summed** (commutative) fold. The two lanes must not be linearly related:
 * a sum distributes over multiplication, so a lane built as `Σ imul(tᵢ, K)` is exactly `imul(Σtᵢ, K)` — it
 * would carry no information the other lane lacks, silently halving the fingerprint's real width. An
 * avalanche is non-linear over addition, so the two sums stay genuinely independent.
 */
function avalanche(x: number, k: number): number {
  let v = Math.imul(x ^ (x >>> 16), k);
  v = Math.imul(v ^ (v >>> 13), 0xc2b2ae35);
  return (v ^ (v >>> 16)) | 0;
}

function foldMultiset(list: readonly CardInstance[]): void {
  let a = 0;
  let b = 0;
  for (const inst of list) {
    const t = tokenHash(inst);
    a = (a + avalanche(t, MIX_A)) | 0;
    b = (b + avalanche(t, MIX_B)) | 0;
  }
  mixPair(a, b);
}

function foldPlaced(list: readonly PlacedCard[]): void {
  let a = 0;
  let b = 0;
  for (const c of list) {
    const t = tokenHash(c) ^ Math.imul(c.workers + 1, PRIME_A);
    a = (a + avalanche(t, MIX_A)) | 0;
    b = (b + avalanche(t, MIX_B)) | 0;
  }
  mixPair(a, b);
}

function foldPending(p: PendingInteraction | null): void {
  if (!p) {
    mixScalar(0);
    return;
  }
  mixScalar(hashString(p.cardId));
  mixScalar(hashString(p.kind));
  mixScalar(p.pick);
  for (const opt of p.options) mixScalar(tokenHash(opt));
}
