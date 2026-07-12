import { forwardRef } from 'react';
import { isStaffable, type CardDef } from '../content/cards';
import { STICKERS } from '../content/stickers';
import { coreOf, type CoreResources } from '../rules';
import styles from './CardFace.module.css';

export const COST_ICON: Record<keyof CoreResources, string> = { food: '🌾', production: '🔨', science: '🔬', military: '⚔️', money: '🪙' };

/** Per-kind fallback "art" glyph — the face glyph a card shows when its def sets no `art` of its
 *  own. Every deckable card carries explicit `art` (pinned by `cards.test.ts`), so in practice this
 *  only stands in for mission-only kinds that opt to lean on it — chiefly the objective's 🏆. */
const ART_FALLBACK: Record<CardDef['kind'], string> = {
  building: '🏛️',
  wonder: '🗿',
  action: '⚡',
  work: '🛠️',
  event: '⚠️',
  threat: '💀',
  objective: '🏆',
};

/** The central face glyph for a card: its own colocated `art` (`content/cards.ts`), else the
 *  per-kind default. The single reader every render site goes through (the card face, the
 *  building/work boxes in `Board.tsx`). */
export const artFor = (card: CardDef): string => card.display?.art ?? ART_FALLBACK[card.kind];

/** Bottom-left row of per-sticker badges — `CardFace`'s own `stickerBadge` prop
 *  renders this, and a non-`CardFace` board box that needs the identical treatment (`Board.tsx`'s
 *  `BuildingBox`/`WorkBox`, which own their own custom markup rather than rendering a `CardFace`)
 *  imports the component rather than reaching into this module's CSS classes directly — keeping
 *  the sticker row's one visual definition here, not duplicated at each call site. */
export function StickerRow({
  stickers,
  items,
  openSlots = 0,
}: {
  stickers?: string[];
  items?: { icon: string; name?: string }[];
  /** Empty gold-outlined placeholder slots appended after the attached badges — the buyable-hint
   *  "you have room for a sticker here" affordance (the Board menu passes a board's remaining
   *  capacity). Defaults to 0 so every other caller (a plain card face, the launch-popup BoardMini)
   *  renders no hint slots. */
  openSlots?: number;
}) {
  // Card stickers resolve through the card `STICKERS` catalogue; a caller from a different catalogue
  // (e.g. board stickers, `BoardMini`) passes already-resolved `items` so the one visual definition
  // is shared without this module knowing about every sticker catalogue.
  const chips = items ?? stickers?.map((id) => ({ icon: STICKERS[id]?.icon ?? '🏷️', name: STICKERS[id]?.name })) ?? [];
  const slots = Math.max(0, openSlots);
  if (chips.length === 0 && slots === 0) return null;
  return (
    <span className={styles.stickerRow} aria-hidden="true">
      {chips.map((c, i) => (
        <span key={i} className={styles.sticker} title={c.name}>
          {c.icon}
        </span>
      ))}
      {Array.from({ length: slots }, (_, i) => (
        <span key={`slot-${i}`} className={styles.stickerSlot} />
      ))}
    </span>
  );
}

/** Presentation-only cost label, e.g. "2🌾" · "3🔨" · "" (blank when free). Extra conditions
 *  (culture level, reserved population, discard cost) are shown separately — see
 *  `describeConditions`. */
export function describeCost(c: CardDef): string {
  const parts = (Object.entries(c.cost) as [keyof CoreResources, number][])
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
  // An event: play it (pay its cost) to banish it unresolved — its effect never fires (preventive);
  // leave it and it fires for free at end of round, then recurs from the discard.
  if (c.kind === 'event') parts.push('play to banish resolves at end of round');
  if (c.cultureLevelReq) parts.push(`requires 🎭 level ${c.cultureLevelReq}`);
  if (c.discardCost) parts.push(`discard ${c.discardCost}`);
  if (c.display?.dynamicRule) parts.push(c.display.dynamicRule);
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
        .map(([k, v]) => `+${v}${COST_ICON[k as keyof CoreResources]}`)
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
  if (c.display?.description) return c.display.description;
  const e = c.effect;
  const parts: string[] = [];
  if (e?.resources) {
    // Only the core keys carry a cost icon; the strategic keys (population/territory/culture) get
    // their own labelled lines below. The core delta is signed: split into a gains line then a drains
    // line so the face keeps its green-"+N" / red-"-N" reading (a negative value carries its minus).
    const entries = Object.entries(coreOf(e.resources)).filter(([, v]) => v) as [keyof CoreResources, number][];
    const gains = entries.filter(([, v]) => v > 0);
    const drains = entries.filter(([, v]) => v < 0);
    if (gains.length) parts.push(gains.map(([k, v]) => `+${v}${COST_ICON[k]}`).join(' '));
    if (drains.length) parts.push(drains.map(([k, v]) => `${v}${COST_ICON[k]}`).join(' '));
  }
  if (e?.draw) parts.push(`draw ${e.draw}`);
  const strat = e?.resources;
  if (strat?.population) parts.push(`${strat.population > 0 ? '+' : ''}${strat.population} 🧍`);
  if (strat?.territory) parts.push(`${strat.territory > 0 ? '+' : ''}${strat.territory} territory`);
  if (strat?.culture) parts.push(`${strat.culture > 0 ? '+' : ''}${strat.culture} 🎭`);
  if (e?.destroy) parts.push('removes a building from the run');
  // A staffable card (building/wonder/work) shows its declarative per-round output — `produces` +
  // `cultureOutput` — here (workers are shown as meeples, not text). This is the sole path for a
  // staffable's ongoing output, work cards included; the `effect` branch above is its one-shot only.
  if (isStaffable(c)) {
    const stats = describeBuilding(c, false);
    if (stats) parts.push(stats);
  }
  return parts.join(' · ') || 'action';
}

/** The card's type banner — label + colour variant, shown under the name. */
function cardBanner(c: CardDef): { label: string; variant: string } {
  if (c.kind === 'threat') return { label: 'Threat', variant: styles.bannerEvent };
  if (c.kind === 'event') return { label: 'Event', variant: styles.bannerEvent };
  if (c.kind === 'objective') return { label: 'Objective', variant: styles.bannerObjective };
  if (c.kind === 'work') return { label: 'Work', variant: styles.bannerWork };
  if (c.kind === 'wonder') return { label: 'Wonder', variant: styles.bannerWonder };
  if (c.kind === 'action') return { label: 'Action', variant: styles.bannerAction };
  return { label: 'Building', variant: styles.bannerBuilding };
}

/** The colour variant a card face uses, by kind (event/threat = danger, objective = violet goal,
 *  work = work, else building). A threat reuses the event's already-CVD-vetted red identity — same
 *  hazard color, distinguished only by its banner label (see `cardBanner` above), not a new palette. */
export function kindClass(kind: CardDef['kind']): string {
  if (kind === 'event' || kind === 'threat') return styles.event;
  if (kind === 'objective') return styles.objective;
  if (kind === 'action') return styles.action;
  if (kind === 'work') return styles.work;
  // A wonder reuses the building face colour — it's distinguished by its gold "Wonder" banner
  // (see `cardBanner`), not a separate palette.
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

export interface CardFaceProps extends CardFaceCommonProps {
  card: CardDef;
  /** Renders the same header/banner/description band layout as a real face, but blank except
   *  the name — the pre-clear stand-in for a mission's still-secret unlock
   *  (`CampaignMap.tsx`'s `MissionFlowPopup`). The card is real (`card.name` is the actual
   *  unlock), so this is a display mode, not a missing-data placeholder: a deliberate sliver
   *  of information (the name), everything else (cost/kind/effect) genuinely withheld. Badge/
   *  sticker props are ignored in this mode. */
  missionLocked?: boolean;
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
  /** A bottom-left row of small circular badges for a *stickered* meta card instance —
   *  the attached sticker id(s), one circle per entry, each showing
   *  that sticker's own icon glyph and its name as a hover title; a duplicate id
   *  (a stacked sticker) renders as two circles, so the row itself hints at the stack.
   *  Sticker name/effect text still lives in the caller's own row/panel (e.g.
   *  `CardInstancePanel`) for anything beyond this hover title. Absent/empty for a plain
   *  copy. */
  stickerBadge?: string[];
  /** Tints the whole face's border/ring gold to mark that this card has an affordable upgrade
   *  available (a buyable copy tier or an applicable, affordable sticker with room) — the Collection
   *  grid's at-a-glance hint so the player needn't open each card. Pure display; the predicate
   *  lives in `rules/upgrades.ts`. See `.upgradeAvailable`. */
  upgradeHint?: boolean;
}

/**
 * The visual face of a card — the single shared component behind every card rendering in the
 * game: hand cards, the play-animation ghost, the drag clone, pile-viewer tiles, the zoom
 * preview (all in `Board.tsx`), and the deck editor's picker/banner tiles. Owns its *complete*
 * visual — outer box, kind-coloured border/bands, and inner content — in one CSS module, so
 * kind-coloring (which relies on descendant selectors reaching from the root into inner spans)
 * never depends on some other component supplying the right ancestor class. `missionLocked`
 * renders the same outer box grey with a bare "?" instead, showing only the real card's name
 * (a mission's still-secret unlock).
 */
export const CardFace = forwardRef<HTMLButtonElement | HTMLDivElement, CardFaceProps>(function CardFace(
  props,
  ref,
) {
  const { className, style, as = 'div', title, overrideText, onPointerDown, onClick, card, missionLocked } = props;

  if (missionLocked) {
    const rootClassName = `${styles.card} ${styles.faceDown}${className ? ` ${className}` : ''}`;
    // Same band layout as a real face (name/cost header, type banner, description footer) so
    // the silhouette reads as "a card" — just blank grey but for the real name, everything else
    // (cost/kind/effect) genuinely withheld.
    const inner = (
      <>
        <div className={styles.cardTop}>
          <span className={styles.cardName}>{card.name}</span>
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

  const { countBadge, alwaysShowBadge, badgeClassName, stickerBadge, upgradeHint } = props;
  const text = overrideText ?? describeCard(card);
  const conditions = describeConditions(card);
  const banner = cardBanner(card);
  // Worker-space meeples: staffable cards (building/wonder/work) show their `workers` capacity
  // (default 1, `0` = self-sufficient/always operating so no meeple shown); other kinds show none.
  const workers = isStaffable(card) ? card.workers ?? 1 : 0;
  // An available upgrade tints the whole face's border/ring gold (the buyable-hint accent) rather
  // than dropping a corner dot — see `.upgradeAvailable`.
  const rootClassName = `${styles.card} ${kindClass(card.kind)}${upgradeHint ? ` ${styles.upgradeAvailable}` : ''}${
    className ? ` ${className}` : ''
  }`;

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
          {artFor(card)}
        </div>
      </div>
      {conditions && <div className={styles.cardConditions}>{conditions}</div>}
      {text && <div className={styles.cardText}>{text}</div>}
      {countBadge !== undefined && (countBadge > 1 || alwaysShowBadge) && (
        <span className={`${styles.countBadge}${badgeClassName ? ` ${badgeClassName}` : ''}`}>
          ×{countBadge}
        </span>
      )}
      <StickerRow stickers={stickerBadge} />
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
