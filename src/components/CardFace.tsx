import { forwardRef } from 'react';
import type { CardDef } from '../content/cards';
import type { Resources } from '../rules';
import styles from './CardFace.module.css';

export const COST_ICON: Record<keyof Resources, string> = { food: '🌾', production: '🔨', science: '🔬', military: '⚔️', money: '🪙' };

/** Presentation-only "art" glyph shown on each card face and building box. */
const CARD_ART: Record<string, string> = {
  farm: '🌾',
  granary: '🌽',
  workshop: '⚒️',
  library: '📚',
  university: '🎓',
  theater: '🎭',
  market: '🏪',
  trading_post: '⛵',
  walls: '🧱',
  barracks: '⚔️',
  pyramids: '🔺',
  great_library: '📜',
  colossus: '🗿',
  settlers: '⛺',
  corvee: '⛓️',
  eureka: '💡',
  harvest: '🧺',
  inspiration: '✨',
  cultural_festival: '🎉',
  philosopher: '🏛️',
  conquest: '🗡️',
  develop: '🏗️',
  destroy: '💥',
  barbarian: '🪓',
};
export const artFor = (id: string) => CARD_ART[id] ?? '🏛️';

/** Presentation-only cost label, e.g. "2🌾" · "3🔨" · "" (blank when free). Extra conditions
 *  (culture level, reserved population, discard cost) are shown separately — see
 *  `describeConditions`. */
export function describeCost(c: CardDef): string {
  const parts = (Object.entries(c.cost) as [keyof Resources, number][])
    .filter(([, v]) => v)
    .map(([k, v]) => `${v}${COST_ICON[k]}`);
  return parts.join(' · ');
}

/** Presentation-only summary of a card's extra conditions for play — culture-level gate and
 *  discard cost — shown in their own banded section on the card face. (Work cards show their
 *  worker spaces as a meeple column instead, via the shared worker-icon rendering.) */
export function describeConditions(c: CardDef): string {
  const parts: string[] = [];
  if (c.kind === 'event') parts.push('resolves at end of round');
  if (c.cultureLevelReq) parts.push(`requires 🎭 level ${c.cultureLevelReq}`);
  if (c.discardCost) parts.push(`discard ${c.discardCost}`);
  return parts.join(' · ');
}

/** Presentation-only summary of a building card's per-round output. `includeWorkers` is false for
 *  the card face, which shows worker capacity as a column of meeples instead of text. */
export function describeBuilding(b: CardDef, includeWorkers = true): string {
  const parts: string[] = [];
  if (b.produces) {
    parts.push(
      Object.entries(b.produces)
        .filter(([, v]) => v)
        .map(([k, v]) => `+${v}${COST_ICON[k as keyof Resources]}`)
        .join(' '),
    );
  }
  if (b.cultureOutput) parts.push(`+${b.cultureOutput}🎭`);
  if (includeWorkers && b.workers) parts.push(`👷${b.workers}`);
  return parts.join(' · ');
}

/** Presentation-only summary of what a card does (no game logic here). */
export function describeCard(c: CardDef): string {
  const e = c.effect;
  const parts: string[] = [];
  if (e?.gain) {
    parts.push(
      Object.entries(e.gain)
        .filter(([, v]) => v)
        .map(([k, v]) => `+${v}${COST_ICON[k as keyof Resources]}`)
        .join(' '),
    );
  }
  if (e?.loss) {
    parts.push(
      Object.entries(e.loss)
        .filter(([, v]) => v)
        .map(([k, v]) => `-${v}${COST_ICON[k as keyof Resources]}`)
        .join(' '),
    );
  }
  if (e?.draw) parts.push(`draw ${e.draw}`);
  if (e?.population) parts.push(`+${e.population} 🧍`);
  if (e?.territory) parts.push(`+${e.territory} territory`);
  if (e?.culture) parts.push(`+${e.culture} 🎭`);
  if (e?.destroy) parts.push('Demolish a building');
  // A building card *is* the building — show its per-round output (workers shown as meeples).
  if (c.kind === 'building') {
    const stats = describeBuilding(c, false);
    if (stats) parts.push(stats);
  }
  return parts.join(' · ') || 'action';
}

/** The card's type banner — label + colour variant, shown under the name. */
function cardBanner(c: CardDef): { label: string; variant: string } {
  if (c.kind === 'event') return { label: 'Event', variant: styles.bannerEvent };
  if (c.kind === 'work') return { label: 'Work', variant: styles.bannerWork };
  if (c.tags?.includes('wonder')) return { label: 'Wonder', variant: styles.bannerWonder };
  if (c.kind === 'recurring') return { label: 'Action', variant: styles.bannerAction };
  return { label: 'Building', variant: styles.bannerBuilding };
}

/** The colour variant a card face uses, by kind (event = danger, recurring = action, work = work,
 *  else building). */
export function kindClass(kind: CardDef['kind']): string {
  if (kind === 'event') return styles.event;
  if (kind === 'recurring') return styles.action;
  if (kind === 'work') return styles.work;
  return styles.building;
}

export interface CardFaceProps {
  card: CardDef;
  /** Extra class(es) layered onto the root — context-specific extras (hand overlap/hover-lift,
   *  drag states, grid-tile treatment, etc.) live with the caller, not here. */
  className?: string;
  style?: React.CSSProperties;
  /** Renders a small "×N" pill in the corner when set > 1 (deck editor banner, pile viewer). */
  countBadge?: number;
  /** Extra class(es) layered onto the countBadge span itself — lets a caller override its
   *  default always-visible look (e.g. Decks.tsx's shingled tile hides it until hover). */
  badgeClassName?: string;
  /** Render as a native `<button>` (hand cards — keeps native focus/keyboard semantics) or a
   *  plain `<div>` (every other context, which are non-interactive or have their own click
   *  handling via a parent). Defaults to `'div'`. */
  as?: 'div' | 'button';
  title?: string;
  onPointerDown?: (e: React.PointerEvent<HTMLElement>) => void;
  onClick?: (e: React.MouseEvent<HTMLElement>) => void;
}

/**
 * The visual face of a card — the single shared component behind every card rendering in the
 * game: hand cards, the play-animation ghost, the drag clone, pile-viewer tiles, the zoom
 * preview (all in `Board.tsx`), and the deck editor's picker/banner tiles. Owns its *complete*
 * visual — outer box, kind-coloured border/bands, and inner content — in one CSS module, so
 * kind-coloring (which relies on descendant selectors reaching from the root into inner spans)
 * never depends on some other component supplying the right ancestor class.
 */
export const CardFace = forwardRef<HTMLButtonElement | HTMLDivElement, CardFaceProps>(function CardFace(
  { card, className, style, countBadge, badgeClassName, as = 'div', title, onPointerDown, onClick },
  ref,
) {
  const text = describeCard(card);
  const conditions = describeConditions(card);
  const banner = cardBanner(card);
  // Worker-space meeples: building and work cards show their `workers` capacity (default 1,
  // `0` = self-sufficient/always operating so no meeple shown); other kinds show none.
  const workers = card.kind === 'building' || card.kind === 'work' ? card.workers ?? 1 : 0;
  const rootClassName = `${styles.card} ${kindClass(card.kind)}${className ? ` ${className}` : ''}`;

  const inner = (
    <>
      <div className={styles.cardTop}>
        <span className={styles.cardName}>{card.name}</span>
        <span className={styles.cardCost}>{describeCost(card)}</span>
      </div>
      <div className={`${styles.cardBanner} ${banner.variant}`}>{banner.label}</div>
      <div className={styles.cardMid}>
        {workers > 0 && (
          <span className={styles.cardWorkers} aria-hidden="true">
            {Array.from({ length: workers }, (_, i) => (
              <span key={i} className={styles.cardWorkerIcon}>🧍</span>
            ))}
          </span>
        )}
        <div className={styles.cardArt} aria-hidden="true">
          {artFor(card.id)}
        </div>
      </div>
      {conditions && <div className={styles.cardConditions}>{conditions}</div>}
      {text && <div className={styles.cardText}>{text}</div>}
      {countBadge !== undefined && countBadge > 1 && (
        <span className={`${styles.countBadge}${badgeClassName ? ` ${badgeClassName}` : ''}`}>×{countBadge}</span>
      )}
    </>
  );

  if (as === 'button') {
    return (
      <button
        type="button"
        ref={ref as React.Ref<HTMLButtonElement>}
        className={rootClassName}
        style={style}
        title={title}
        onPointerDown={onPointerDown}
        onClick={onClick}
      >
        {inner}
      </button>
    );
  }
  return (
    <div
      ref={ref as React.Ref<HTMLDivElement>}
      className={rootClassName}
      style={style}
      title={title}
      onPointerDown={onPointerDown}
      onClick={onClick}
    >
      {inner}
    </div>
  );
});
