import { forwardRef } from 'react';
import { isStaffable, type CardDef } from '../content/cards';
import { STICKERS } from '../content/stickers';
import { type CoreResources, type Resources } from '../rules';
import { cardWorkerCap } from '../rules/population';
import styles from './CardFace.module.css';

/** The one glyph-per-resource map for all 8 resources — the single source of truth every render site
 *  (card faces, the run board banner, `BoardMini`, the Codex, Stats) reads through, so a resource's
 *  icon is defined once. Costs are core-only, but the map spans core + strategic since effects,
 *  production, and the HUD all display strategic resources too. */
export const RESOURCE_ICON: Record<keyof Resources, string> = {
  food: '🌾',
  production: '🔨',
  science: '🔬',
  military: '⚔️',
  money: '🪙',
  population: '🧍',
  culture: '🎭',
  territory: '🏞️',
};

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
  onRemove,
}: {
  stickers?: string[];
  items?: { icon: string; name?: string }[];
  /** Empty gold-outlined placeholder slots appended after the attached badges — the buyable-hint
   *  "you have room for a sticker here" affordance (the Board menu passes a board's remaining
   *  capacity). Defaults to 0 so every other caller (a plain card face, the launch-popup BoardMini)
   *  renders no hint slots. */
  openSlots?: number;
  /** Opt-in removal affordance: when set, each badge becomes clickable and reveals a ✕ on hover,
   *  reporting the index the player clicked. Only the two buy surfaces pass it — the Board menu (via
   *  `BoardMini`) and Collection's `CardInstancePanel` (via `CardFace`'s `onRemoveSticker`); every
   *  other caller omits it, which is what keeps the read-only previews and in-run faces inert. The
   *  index (not a sticker id) is the handle because one board/copy may carry the same sticker twice;
   *  see `rules/boardStickers.ts` / `rules/stickers.ts`. */
  onRemove?: (index: number) => void;
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
        <span
          key={i}
          className={onRemove ? `${styles.sticker} ${styles.stickerRemovable}` : styles.sticker}
          title={onRemove ? `Remove ${c.name ?? 'this sticker'} — destroys it, no Influence back` : c.name}
          // The row sits inside a clickable card face on the Collection side, whose own click zooms
          // the copy — stop here so asking to destroy a sticker doesn't also open the zoom behind
          // the confirm.
          onClick={
            onRemove &&
            ((e) => {
              e.stopPropagation();
              onRemove(i);
            })
          }
        >
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
    .map(([k, v]) => `${v}${RESOURCE_ICON[k]}`);
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
  if (c.gate?.cultureLevelReq) parts.push(`requires ${RESOURCE_ICON.culture} level ${c.gate.cultureLevelReq}`);
  if (c.gate?.discardCost) parts.push(`discard ${c.gate.discardCost}`);
  if (c.display?.dynamicRule) parts.push(c.display.dynamicRule);
  if (c.display?.note) parts.push(c.display.note);
  return parts.join(' · ');
}

/** Presentation-only summary of a building card's per-round output. `includeWorkers` is false for
 *  the card face, which shows worker capacity as a column of meeples instead of text. */
export function describeBuilding(b: CardDef, includeWorkers = true): string {
  const parts: string[] = [];
  if (b.produces?.resources) {
    // Every produced resource — core or strategic — renders the same way through the shared icon map.
    const stats = (Object.entries(b.produces.resources) as [keyof Resources, number][])
      .filter(([, v]) => v)
      .map(([k, v]) => `${v > 0 ? '+' : ''}${v}${RESOURCE_ICON[k]}`)
      .join(' ');
    if (stats) parts.push(stats);
  }
  if (includeWorkers && b.workers) parts.push(`👷${b.workers}`);
  return parts.join(' · ');
}

/** Presentation-only summary of what a card does (no game logic here). A card whose behavior the
 *  declarative `effect` fields can't express (an `effect.resolve` closure) authors its own
 *  `description`, which wins over the auto-generated text below. */
function describeSignedResources(res: Partial<Resources> | undefined, into: string[]): void {
  if (!res) return;
  // Every resource — core or strategic — renders the same way through the shared icon map. The
  // signed delta is split into a gains line then a drains line so the face keeps its green-"+N" /
  // red-"-N" reading (a negative value carries its own minus).
  const entries = (Object.entries(res) as [keyof Resources, number][]).filter(([, v]) => v);
  const gains = entries.filter(([, v]) => v > 0);
  const drains = entries.filter(([, v]) => v < 0);
  if (gains.length) into.push(gains.map(([k, v]) => `+${v}${RESOURCE_ICON[k]}`).join(' '));
  if (drains.length) into.push(drains.map(([k, v]) => `${v}${RESOURCE_ICON[k]}`).join(' '));
}

export function describeCard(c: CardDef): string {
  if (c.display?.description) return c.display.description;
  const e = c.effect;
  const parts: string[] = [];
  describeSignedResources(e?.resources, parts);
  // Recurring `upkeep` (a hazard's drain or a staffable's maintenance) shows its signed delta the same
  // way, appended after any one-shot `effect` above — a card may carry both (e.g. a threat with an entry
  // `effect` plus a per-round drain), and the two just concatenate.
  describeSignedResources(c.upkeep?.resources, parts);
  // A staffable card (building/wonder/work) shows its declarative per-round output — `produces` —
  // here (workers are shown as meeples, not text). This is the sole path for a
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
  /** A click handler on *just* the art-glyph band (not the whole face). Sole consumer is the zoom's
   *  "pet the dog" easter egg — it stops propagation there so petting doesn't reach the whole-face /
   *  backdrop click. Also lights the band's pointer cursor. */
  onArtClick?: (e: React.MouseEvent<HTMLElement>) => void;
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
  /** Opt-in removal affordance on the `stickerBadge` row: makes each badge clickable (a ✕ on hover),
   *  reporting which one by index. Only `CardInstancePanel`'s grid faces pass it — every other face
   *  (the Collection tiles, the zoom, the deck editor, the hand) omits it and renders inert badges, so
   *  a sticker is destroyed from the one surface that confirms first. See `StickerRow`'s `onRemove`. */
  onRemoveSticker?: (index: number) => void;
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
  const { className, style, as = 'div', title, overrideText, onPointerDown, onClick, onArtClick, card, missionLocked } = props;

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

  const { countBadge, alwaysShowBadge, badgeClassName, stickerBadge, onRemoveSticker, upgradeHint } = props;
  const text = overrideText ?? describeCard(card);
  const conditions = describeConditions(card);
  const banner = cardBanner(card);
  // Worker-space meeples: staffable cards (building/wonder/work) show their `workers` capacity
  // (`0` = self-sufficient/always operating so no meeple shown); other kinds show none.
  const workers = isStaffable(card) ? cardWorkerCap(card.id) : 0;
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
        <div
          className={`${styles.cardArt}${onArtClick ? ` ${styles.cardArtPetable}` : ''}`}
          aria-hidden="true"
          onClick={onArtClick}
        >
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
      <StickerRow stickers={stickerBadge} onRemove={onRemoveSticker} />
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
