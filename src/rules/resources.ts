/** The resource currencies a civilization accumulates. */
export interface Resources {
  food: number;
  production: number;
  science: number;
  military: number;
}

export function emptyResources(): Resources {
  return { food: 0, production: 0, science: 0, military: 0 };
}

/** Mutates and returns `target` with `delta` added in. */
export function addResources(target: Resources, delta: Partial<Resources>): Resources {
  target.food += delta.food ?? 0;
  target.production += delta.production ?? 0;
  target.science += delta.science ?? 0;
  target.military += delta.military ?? 0;
  return target;
}

/** Mutates and returns `target` with `delta` subtracted out. */
export function subtractResources(target: Resources, delta: Partial<Resources>): Resources {
  target.food -= delta.food ?? 0;
  target.production -= delta.production ?? 0;
  target.science -= delta.science ?? 0;
  target.military -= delta.military ?? 0;
  return target;
}

/** Can these resources cover the whole cost bundle? Absent keys cost nothing. */
export function canAfford(resources: Resources, cost: Partial<Resources>): boolean {
  return (
    resources.food >= (cost.food ?? 0) &&
    resources.production >= (cost.production ?? 0) &&
    resources.science >= (cost.science ?? 0) &&
    resources.military >= (cost.military ?? 0)
  );
}
