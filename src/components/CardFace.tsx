import { forwardRef } from 'react';
import type { CardDef } from '../content/cards';
import { STICKERS } from '../content/stickers';
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
  harsh_winter: '❄️',
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

/** Presentation-only summary of a card's extra conditions for play — culture-level gate, discard
 *  cost, and a dynamic card's scaling rule (`dynamicRule`) — shown in their own banded section on
 *  the card face. (Work cards show their worker spaces as a meeple column instead, via the shared
 *  worker-icon rendering.) */
export function describeConditions(c: CardDef): string {
  const parts: string[] = [];
  if (c.kind === 'event') parts.push(c.effect?.remove ? 'resolves at end of round, then removed' : 'resolves at end of round');
  if (c.cultureLevelReq) parts.push(`requires 🎭 level ${c.cultureLevelReq}`);
  if (c.discardCost) parts.push(`discard ${c.discardCost}`);
  if (c.dynamicRule) parts.push(c.dynamicRule);
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

/** Presentation-only summary of what a card does (no game logic here). A `resolve`-driven card
 *  whose behavior the declarative `effect` can't express authors its own `description`, which wins
 *  over the auto-generated text below. */
export function describeCard(c: CardDef): string {
  if (c.description) return c.description;
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
  if (e?.destroy) parts.push('removes a building from the run');
  // A building card *is* the building — show its per-round output (workers shown as meeples).
  if (c.kind === 'building') {
    const stats = describeBuilding(c, false);
    if (stats) parts.push(stats);
  }
  return parts.join(' · ') || 'action';
}

/** The card's type banner — label + colour variant, shown under the name. */
function cardBanner(c: CardDef): { label: string; variant: string } {
  if (c.kind === 'threat') return { label: 'Threat', variant: styles.bannerEvent };
  if (c.kind === 'event') return { label: 'Event', variant: styles.bannerEvent };
  if (c.kind === 'work') return { label: 'Work', variant: styles.bannerWork };
  if (c.tags?.includes('wonder')) return { label: 'Wonder', variant: styles.bannerWonder };
  if (c.kind === 'action') return { label: 'Action', variant: styles.bannerAction };
  return { label: 'Building', variant: styles.bannerBuilding };
}

/** The colour variant a card face uses, by kind (event/threat = danger, work = work, else
 *  building). A threat reuses the event's already-CVD-vetted red identity — same hazard color,
 *  distinguished only by its banner label (see `cardBanner` above), not a new palette. */
export function kindClass(kind: CardDef['kind']): string {
  if (kind === 'event' || kind === 'threat') return styles.event;
  if (kind === 'action') return styles.action;
  if (kind === 'work') return styles.work;
  return styles.building;
}

interface CardFaceCommonProps {
  /** Extra class(es) layered onto the root — context-specific extras (hand overlap/hover-lift,
   *  drag states, grid-tile treatment, etc.) live with the caller, not here. */
  className?: string;
  style?: React.CSSProperties;
  /** Render as a native `<button>` (hand cards — keeps native focus/keyboard semantics) or a
   *  plain `<div>` (every other context, which are non-interactive or have their own click
   *  handling via a parent). Defaults to `'div'`. */
  as?: 'div' | 'button';
  title?: string;
  /** Replaces the auto-generated effect text with a caller-supplied string — used for run-aware
   *  text a static `CardDef` can't produce (e.g. a card's `dynamicText(G, self)` current value,
   *  computed by the caller wherever a real run instance exists: hand, drag/ghost clones, zoom,
   *  pile viewers). Falls back to `describeCard(card)` when absent. */
  overrideText?: string;
  onPointerDown?: (e: React.PointerEvent<HTMLElement>) => void;
  onClick?: (e: React.MouseEvent<HTMLElement>) => void;
}

export type CardFaceProps =
  | (CardFaceCommonProps & {
      card: CardDef;
      faceDown?: false;
      /** Renders a small "×N" pill in the corner when set > 1 (deck editor banner, pile
       *  viewer, Collection / deck editor picker showing copies owned). Suppressed at
       *  exactly 1 unless `alwaysShowBadge` opts in — a lone card in a stack doesn't need
       *  a "×1", but the deck editor picker's *remaining-copies* badge does (1 left to add
       *  is still worth stating), so it sets that flag explicitly. */
      countBadge?: number;
      /** Shows `countBadge` even when it's exactly `1` (or `0`) instead of only `> 1`. See
       *  `countBadge`'s doc for why the deck editor picker needs this and stack-count badges
       *  elsewhere don't. */
      alwaysShowBadge?: boolean;
      /** Extra class(es) layered onto the countBadge span itself — lets a caller override its
       *  default always-visible look (e.g. Decks.tsx's shingled tile hides it until hover). */
      badgeClassName?: string;
      /** A small opposite-corner marker for a *stickered* meta card instance (Phase 3 Step
       *  7.5) — the attached sticker id(s), rendered as each sticker's own icon glyph (Step
       *  7.9) rather than one generic tag; a duplicate id (a stacked sticker) renders its icon
       *  twice, so the badge itself hints at the stack. Sticker name/effect text still lives in
       *  the caller's own row/panel (e.g. `CardInstancePanel`). Absent/empty for a plain copy. */
      stickerBadge?: string[];
    })
  | (CardFaceCommonProps & {
      /** Renders a grey face-down back instead of a real card — the same header/banner/
       *  description band layout as a real face, all blank, plus a "?" glyph — the pre-clear
       *  stand-in for a mission's still-secret unlock (`CampaignMap.tsx`'s `MissionDetailPanel`),
       *  since there's no `CardDef` to show yet. No `card`/badge props apply in this mode. */
      faceDown: true;
    });

/**
 * The visual face of a card — the single shared component behind every card rendering in the
 * game: hand cards, the play-animation ghost, the drag clone, pile-viewer tiles, the zoom
 * preview (all in `Board.tsx`), and the deck editor's picker/banner tiles. Owns its *complete*
 * visual — outer box, kind-coloured border/bands, and inner content — in one CSS module, so
 * kind-coloring (which relies on descendant selectors reaching from the root into inner spans)
 * never depends on some other component supplying the right ancestor class. `faceDown` renders
 * the same outer box grey with a bare "?" instead, for when there's no `CardDef` to show yet
 * (a mission's still-secret unlock).
 */
export const CardFace = forwardRef<HTMLButtonElement | HTMLDivElement, CardFaceProps>(function CardFace(
  props,
  ref,
) {
  const { className, style, as = 'div', title, overrideText, onPointerDown, onClick } = props;

  if (props.faceDown) {
    const rootClassName = `${styles.card} ${styles.faceDown}${className ? ` ${className}` : ''}`;
    // Same band layout as a real face (name/cost header, type banner, description footer) so
    // the silhouette reads as "a card" — just blank grey, since there's no CardDef yet to
    // supply real text for any of them.
    const inner = (
      <>
        <div className={styles.cardTop}>
          <span className={styles.cardName}>&nbsp;</span>
          <span className={styles.cardCost}>&nbsp;</span>
        </div>
        <div className={styles.cardBanner}>&nbsp;</div>
        <div className={styles.cardMid}>
          <span className={styles.faceDownGlyph} aria-hidden="true">?</span>
        </div>
        <div className={styles.cardText}>&nbsp;</div>
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
  }

  const { card, countBadge, alwaysShowBadge, badgeClassName, stickerBadge } = props;
  const text = overrideText ?? describeCard(card);
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
      {countBadge !== undefined && (countBadge > 1 || alwaysShowBadge) && (
        <span className={`${styles.countBadge}${badgeClassName ? ` ${badgeClassName}` : ''}`}>
          ×{countBadge}
        </span>
      )}
      {stickerBadge && stickerBadge.length > 0 && (
        <span className={styles.stickerBadge} aria-hidden="true">
          {stickerBadge.map((id) => STICKERS[id]?.icon ?? '🏷️').join('')}
        </span>
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
