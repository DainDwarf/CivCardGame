import type { CSSProperties, PointerEvent } from 'react';
import styles from './StickerSeal.module.css';

/**
 * The one visual of a single sticker — `CardFace`'s counterpart for the two sticker catalogues
 * (`content/stickers.ts` and `content/boardStickers.ts`), which share no type but do share this
 * shape: an icon, a name, and a bargain. It holds no catalogue knowledge and takes every string from
 * its caller, so a card sticker and a board sticker reach it the same way — and the one gesture it
 * offers, the seal as a drag handle, it only forwards.
 */

/** One drawing at three sizes — `panel` reading size, `inline` for a list, `hero` enlarged. The
 *  arrangement is identical at each: the seal beside the name, the ledger under both. */
export type StickerSealScale = 'panel' | 'inline' | 'hero';

type StickerSealProps = {
  scale?: StickerSealScale;
  className?: string;
  /** Plays the widget's arrival: the seal presses down like a stamp, a shine sweeps the wax open, and
   *  the plaque and its ledger rise under it. Owned here rather than by the caller because the press
   *  is a movement of the *drawing* — its parts are this module's, and no other module can name them.
   *  A one-shot on mount; there is nothing to turn back off. */
  entering?: boolean;
} & (
  | { locked: true }
  | {
      locked?: false;
      icon: string;
      name: string;
      gives: string;
      charges?: string;
      /** The readable form of the sticker's attach condition — `StickerDef.appliesToLabel` for a
       *  card sticker, `BOARD_STICKER_SCOPE` for a board one. */
      appliesToLabel: string;
      /** ⭐ Influence to attach, struck on the seal's corner. Omitted where the sticker isn't for
       *  sale in that context (a mission reward preview shows no price). */
      price?: number;
      /** Dimmed — a buy surface offering a sticker that couldn't land anywhere right now. Purely
       *  visual: the caller withholds `onSealPointerDown` to make it inert. */
      disabled?: boolean;
      /** Makes the wax seal the drag handle of a buy-and-attach gesture, so what the cursor lifts
       *  is the thing that lands. Absent → display only. */
      onSealPointerDown?: (e: PointerEvent<HTMLElement>) => void;
      /** Only what the drawing can't show — why a drag is refused, what a drop would do. The
       *  bargain itself is already on the plaque, so a tooltip restating it is noise. */
      title?: string;
    }
);

/**
 * The seal alone, for the clone that follows the cursor mid-drag: what it carries is the very thing
 * it grabbed. `size` is that seal's diameter in **local** px — the caller measures the grabbed
 * element and divides by the UI scale, like every other coordinate it writes into an inline style.
 */
export function StickerSealMark({
  icon,
  size,
  className,
  style,
}: {
  icon: string;
  size: number;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      className={`${styles.lifted}${className ? ` ${className}` : ''}`}
      style={{ ...style, '--seal': `${size}px` } as CSSProperties}
    >
      <div className={styles.seal}>
        <div className={styles.face} aria-hidden="true">
          {icon}
        </div>
      </div>
    </div>
  );
}

export function StickerSeal(props: StickerSealProps) {
  const scaleClass = props.scale === 'inline' ? styles.inline : props.scale === 'hero' ? styles.hero : '';
  const root = `${styles.sticker}${scaleClass ? ` ${scaleClass}` : ''}${props.entering ? ` ${styles.entering}` : ''}${
    props.className ? ` ${props.className}` : ''
  }`;

  if (props.locked) {
    return (
      <div className={`${root} ${styles.locked}`}>
        <div className={`${styles.seal} ${styles.sealBlank}`}>
          <div className={styles.face} />
        </div>
        <div className={styles.plaque}>
          <div className={styles.name}>Sealed</div>
        </div>
        <div className={styles.ledger}>
          <div className={`${styles.row} ${styles.rowNone}`}>
            <span className={styles.mark} aria-hidden="true">
              ?
            </span>
            <span>Revealed on first clear</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`${root}${props.disabled ? ` ${styles.disabled}` : ''}`} title={props.title}>
      <div
        className={`${styles.seal}${props.onSealPointerDown ? ` ${styles.grabbable}` : ''}`}
        onPointerDown={props.onSealPointerDown}
      >
        <div className={styles.face} aria-hidden="true">
          {props.icon}
        </div>
        {props.price !== undefined && <span className={styles.price}>⭐{props.price}</span>}
      </div>
      <div className={styles.plaque}>
        <div className={styles.name}>{props.name}</div>
        <div className={styles.rule}>{props.appliesToLabel}</div>
      </div>
      <div className={styles.ledger}>
        <div className={`${styles.row} ${styles.rowGive}`}>
          <span className={styles.mark} aria-hidden="true">
            ▲
          </span>
          <span>{props.gives}</span>
        </div>
        {props.charges ? (
          <div className={`${styles.row} ${styles.rowTake}`}>
            <span className={styles.mark} aria-hidden="true">
              ▼
            </span>
            <span>{props.charges}</span>
          </div>
        ) : (
          <div className={`${styles.row} ${styles.rowNone}`}>
            <span className={styles.mark} aria-hidden="true">
              –
            </span>
            <span>Takes nothing back</span>
          </div>
        )}
      </div>
    </div>
  );
}
