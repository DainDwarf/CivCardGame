/** The five core resource currencies a civilization spends and accumulates each round. */
export interface CoreResources {
  food: number;
  production: number;
  science: number;
  military: number;
  money: number;
}

/** The three slower "strategic" resources — they gate the tableau and hand rather than being spent. */
export interface StrategicResources {
  population: number;
  culture: number;
  territory: number;
}

/** The whole resource picture: core + strategic. `GameState.resources` holds one of these, and a
 *  `CardEffect`'s signed delta is a `Partial<Resources>` (it may touch any of the eight). A card's
 *  *cost*, by contrast, is a `Partial<CoreResources>` — only core resources are ever spent. */
export type Resources = CoreResources & StrategicResources;

/** The core keys, in canonical order — the single source of truth for "which keys are core",
 *  reused by `coreOf`, the `RESOURCE_ICON` map, `collapse.ts`'s core-negatives check, and `codex.ts`. */
export const CORE_KEYS: (keyof CoreResources)[] = ['food', 'production', 'science', 'military', 'money'];

/** The strategic keys, in canonical order — the strategic counterpart to `CORE_KEYS`, used by the
 *  codex coherence check to pin that the strategic reference table covers every strategic resource. */
export const STRATEGIC_KEYS: (keyof StrategicResources)[] = ['population', 'culture', 'territory'];

/** An all-eight-zero bundle — the seed for `GameState.resources`. */
export function emptyResources(): Resources {
  return { food: 0, production: 0, science: 0, military: 0, money: 0, population: 0, culture: 0, territory: 0 };
}

/** The core slice of a signed delta (drops any strategic keys) — used where only core resources may
 *  flow, e.g. `defaultProduce`'s per-round production scaling. */
export function coreOf(r: Partial<Resources>): Partial<CoreResources> {
  const out: Partial<CoreResources> = {};
  for (const k of CORE_KEYS) if (r[k] !== undefined) out[k] = r[k];
  return out;
}

/** Mutates and returns `target` with `delta` added in. Only the keys present in `delta` are touched,
 *  so it works over a core-only, strategic-only, or combined bundle interchangeably. */
export function addResources(target: Resources, delta: Partial<Resources>): Resources {
  for (const [k, v] of Object.entries(delta) as [keyof Resources, number][]) target[k] += v;
  return target;
}

/** Mutates and returns `target` with `delta` subtracted out (present keys only — see `addResources`). */
export function subtractResources(target: Resources, delta: Partial<Resources>): Resources {
  for (const [k, v] of Object.entries(delta) as [keyof Resources, number][]) target[k] -= v;
  return target;
}

/**
 * Scale a resource bundle by an integer factor — the reusable "scale an effect's magnitude by a
 * counter" primitive. A card whose output grows with a run-scoped counter (e.g. `factor =
 * plays + 1`) or a per-turn escalation (a future threat's drain: `factor = level`) both build their
 * effective bundle this way. Returns a fresh `Partial<Resources>` (does not mutate its input),
 * carrying only the keys present in `r`.
 */
export function scaleResources(r: Partial<Resources>, factor: number): Partial<Resources> {
  const out: Partial<Resources> = {};
  for (const [k, v] of Object.entries(r) as [keyof Resources, number][]) out[k] = v * factor;
  return out;
}

/** Can these resources cover the whole cost bundle? Costs are core-only, so only the core pools are
 *  checked; absent keys cost nothing. */
export function canAfford(resources: Resources, cost: Partial<CoreResources>): boolean {
  return CORE_KEYS.every((k) => resources[k] >= (cost[k] ?? 0));
}
