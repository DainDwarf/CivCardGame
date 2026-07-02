import { CARDS, type CardDef } from '../content/cards';
import { BUILDINGS } from '../content/buildings';
import type { Resources } from '../rules/resources';
import styles from './Collection.module.css';

const RESOURCE_ICON: Record<keyof Resources, string> = {
  food: '🌾',
  production: '🔨',
  science: '🔬',
  military: '⚔️',
  money: '🪙',
};

/** Presentation-only cost label, e.g. "2🔨" — blank when free. */
function describeCost(c: CardDef): string {
  const parts = (Object.entries(c.cost) as [keyof Resources, number][])
    .filter(([, v]) => v)
    .map(([k, v]) => `${v}${RESOURCE_ICON[k]}`);
  return parts.join(' · ') || 'free';
}

/** Presentation-only one-line summary of what a card does. */
function describeCard(c: CardDef): string {
  if (c.effect?.build) {
    const bld = BUILDINGS[c.effect.build];
    const parts = Object.entries(bld.produces ?? {})
      .filter(([, v]) => v)
      .map(([k, v]) => `+${v}${RESOURCE_ICON[k as keyof Resources]}`);
    if (bld.cultureOutput) parts.push(`+${bld.cultureOutput}🎭`);
    return parts.join(' ') || 'constructs a building';
  }
  const e = c.effect;
  const parts: string[] = [];
  if (e?.gain) {
    parts.push(
      Object.entries(e.gain)
        .filter(([, v]) => v)
        .map(([k, v]) => `+${v}${RESOURCE_ICON[k as keyof Resources]}`)
        .join(' '),
    );
  }
  if (e?.draw) parts.push(`draw ${e.draw}`);
  if (e?.population) parts.push(`+${e.population} 🧍`);
  if (e?.territory) parts.push(`+${e.territory} territory`);
  if (e?.culture) parts.push(`+${e.culture} 🎭`);
  if (e?.destroy) parts.push('demolish a building');
  return parts.filter(Boolean).join(' · ') || 'action';
}

function CardTile({ card }: { card: CardDef }) {
  return (
    <div className={styles.tile}>
      <span className={styles.tileName}>{card.name}</span>
      <span className={styles.tileCost}>{describeCost(card)}</span>
      <span className={styles.tileEffect}>{describeCard(card)}</span>
    </div>
  );
}

/**
 * The Collection screen (Phase 2 build plan step 6) — every card in the game, shown
 * read-only. There's no unlock/ownership tracking yet, so this simply lists the full
 * `CARDS` catalogue; deck construction (writing to a persisted collection) is step 7.
 */
export function Collection() {
  const cards = Object.values(CARDS);
  const buildings = cards.filter((c) => c.kind === 'permanent');
  const actions = cards.filter((c) => c.kind === 'recurring');

  return (
    <div className={styles.collection}>
      <h1 className={styles.title}>Collection</h1>
      <p className={styles.subtitle}>Every card in the game — {cards.length} total.</p>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Buildings &amp; Wonders ({buildings.length})</h2>
        <div className={styles.grid}>
          {buildings.map((c) => (
            <CardTile key={c.id} card={c} />
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Actions ({actions.length})</h2>
        <div className={styles.grid}>
          {actions.map((c) => (
            <CardTile key={c.id} card={c} />
          ))}
        </div>
      </section>
    </div>
  );
}
