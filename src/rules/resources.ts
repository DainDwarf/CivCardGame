/** The resource currencies a civilization accumulates. */
export interface Resources {
  food: number;
  production: number;
  science: number;
  military: number;
  money: number;
}

export function emptyResources(): Resources {
  return { food: 0, production: 0, science: 0, military: 0, money: 0 };
}

/** Mutates and returns `target` with `delta` added in. */
export function addResources(target: Resources, delta: Partial<Resources>): Resources {
  target.food += delta.food ?? 0;
  target.production += delta.production ?? 0;
  target.science += delta.science ?? 0;
  target.military += delta.military ?? 0;
  target.money += delta.money ?? 0;
  return target;
}

/** Mutates and returns `target` with `delta` subtracted out. */
export function subtractResources(target: Resources, delta: Partial<Resources>): Resources {
  target.food -= delta.food ?? 0;
  target.production -= delta.production ?? 0;
  target.science -= delta.science ?? 0;
  target.military -= delta.military ?? 0;
  target.money -= delta.money ?? 0;
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

/** Can these resources cover the whole cost bundle? Absent keys cost nothing. */
export function canAfford(resources: Resources, cost: Partial<Resources>): boolean {
  return (
    resources.food >= (cost.food ?? 0) &&
    resources.production >= (cost.production ?? 0) &&
    resources.science >= (cost.science ?? 0) &&
    resources.military >= (cost.military ?? 0) &&
    resources.money >= (cost.money ?? 0)
  );
}
