import { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { CARDS } from '../content/cards';
import { STICKERS } from '../content/stickers';
import { BOARD_STICKERS, BOARD_STICKER_SCOPE } from '../content/boardStickers';
import { BOARDS } from '../content/boards';
import type { PendingUnlock } from '../rules/rewards';
import { CardFace } from '../components/CardFace';
import { BoardMini } from '../components/BoardMini';
import { StickerSeal } from '../components/StickerSeal';
import styles from './UnlockReveal.module.css';

/**
 * What a finished run has to show for itself, handed over by `App.tsx`'s `recordResult` at the moment
 * it folds the result in — the Influence it paid and the unlocks it opened, read off the store as it
 * stood *before* the fold. Transient by design: nothing here is persisted, so a refresh loses a
 * reveal the player walked away from mid-way, which costs them nothing they can't see on the
 * Collection and Board screens a click later.
 */
export interface RunReveal {
  missionName: string;
  outcome: 'victory' | 'defeat';
  /** Colours the payout's label: an infinite mission *banks a score*, it doesn't earn a first-clear
   *  reward — and it never carries unlocks, so its reveal is the count-up alone. */
  infinite: boolean;
  /** Influence this run paid. The count-up's distance. */
  influence: number;
  /** The balance before it landed. The count-up's start — and what the nav badge is walked up from,
   *  since the store already holds the final number by the time this renders. */
  influenceBefore: number;
  unlocks: PendingUnlock[];
}

/** The count-up's travel. */
const COUNT_MS = 1100;
/** Beat between the count landing and the first unlock — long enough that the two read as separate
 *  moments rather than one crowded one. */
const FIRST_ITEM_MS = 500;
/** Beat between one unlock and the next. A board upgrade holds longer: its own animation runs the
 *  old board out before the new one arrives, so it is still moving when a card would have settled. */
const ITEM_MS = 950;
const UPGRADE_ITEM_MS = 1350;
/** Beat between the last unlock and the Continue button, so the button doesn't arrive on top of it. */
const CONTINUE_MS = 600;

const CAPTION: Record<PendingUnlock['kind'], string> = {
  card: 'New card',
  sticker: 'New sticker',
  boardSticker: 'New board sticker',
  board: 'New board',
  boardUpgrade: 'Your board changes',
};

const dwell = (unlock: PendingUnlock) => (unlock.kind === 'boardUpgrade' ? UPGRADE_ITEM_MS : ITEM_MS);

/** The unlock itself, at reveal scale — the real widget in every case, never a bespoke drawing: a
 *  `CardFace` for a card, a hero `StickerSeal` for either sticker catalogue (flattened to its props
 *  the way `CampaignMap`'s reward preview flattens them), a `BoardMini` for a board. A board upgrade
 *  is the one composite: both boards side by side, since the reward *is* the difference between them. */
function UnlockBody({ unlock }: { unlock: PendingUnlock }) {
  switch (unlock.kind) {
    case 'card':
      return <CardFace card={CARDS[unlock.id]} className={styles.face} />;
    case 'sticker': {
      const { icon, name, gives, charges, appliesToLabel } = STICKERS[unlock.id];
      return (
        <StickerSeal scale="hero" entering icon={icon} name={name} gives={gives} charges={charges} appliesToLabel={appliesToLabel} />
      );
    }
    case 'boardSticker': {
      const { icon, name, gives } = BOARD_STICKERS[unlock.id];
      return <StickerSeal scale="hero" entering icon={icon} name={name} gives={gives} appliesToLabel={BOARD_STICKER_SCOPE} />;
    }
    case 'board':
      return <BoardMini boardId={unlock.id} className={styles.mini} />;
    case 'boardUpgrade':
      return (
        <div className={styles.upgrade}>
          <div className={styles.upgradePair}>
            <BoardMini boardId={unlock.from} className={`${styles.mini} ${styles.retiring}`} />
            <span className={styles.arrow} aria-hidden="true">⟶</span>
            <BoardMini boardId={unlock.id} className={`${styles.mini} ${styles.arriving}`} />
          </div>
          <p className={styles.upgradeCaption}>
            {BOARDS[unlock.from].name} becomes {BOARDS[unlock.id].name}
          </p>
        </div>
      );
  }
}

/**
 * The reveal — the celebratory half of a finished run, shown once on the meta menu when the player
 * comes back from one that actually opened something. The run screen's own end panel keeps the
 * outcome and the payout and names *nothing*; everything won is shown here instead, one unlock at a
 * time, because a name in a list is not a reward the player can recognize later.
 *
 * It is an event, not a ritual: `App.tsx` mounts it only when there is something to show, so a repeat
 * clear that opens nothing hands the menu straight back with no overlay at all.
 *
 * Mouse-only, like the rest of the game (CLAUDE.md): the sequence advances itself on a timer, a click
 * anywhere hurries the next beat along, and Skip lays the remainder out at once — which never closes
 * the overlay, since the whole point is seeing what you won.
 */
export function UnlockReveal({
  reveal,
  onInfluenceTick,
  onDismiss,
}: {
  reveal: RunReveal;
  /** The count-up's running total, frame by frame — the meta nav's own ⭐ badge follows it, so the
   *  number visibly lands where it will be spent. */
  onInfluenceTick: (influence: number) => void;
  onDismiss: () => void;
}) {
  const paying = reveal.influence > 0;
  const total = reveal.unlocks.length;
  const [phase, setPhase] = useState<'count' | 'items' | 'done'>(paying ? 'count' : 'items');
  const [count, setCount] = useState(paying ? 0 : reveal.influence);
  const [shown, setShown] = useState(0);

  const land = useCallback(() => {
    setCount(reveal.influence);
    onInfluenceTick(reveal.influenceBefore + reveal.influence);
  }, [reveal, onInfluenceTick]);

  // The store already holds the final balance by the time this mounts, so walk the badge back to
  // where the count starts *before* the browser paints — an rAF callback would land a frame late and
  // flash the final number first.
  useLayoutEffect(() => {
    if (paying) onInfluenceTick(reveal.influenceBefore);
  }, [paying, reveal.influenceBefore, onInfluenceTick]);

  useEffect(() => {
    if (phase !== 'count') return;
    // Reduced motion lands it outright: the number is the information, its travel is the decoration.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      land();
      setPhase('items');
      return;
    }
    let raf = 0;
    const start = performance.now();
    const step = (now: number) => {
      const k = Math.min(1, (now - start) / COUNT_MS);
      const value = Math.round(reveal.influence * (1 - (1 - k) ** 3));
      setCount(value);
      onInfluenceTick(reveal.influenceBefore + value);
      if (k < 1) raf = requestAnimationFrame(step);
      else setPhase('items');
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [phase, reveal, onInfluenceTick, land]);

  useEffect(() => {
    if (phase !== 'items') return;
    const finished = shown >= total;
    // The wait *before* the next unlock is set by the one already standing, so a slower beat is a
    // property of what's on screen rather than of what's coming.
    const delay = finished ? CONTINUE_MS : shown === 0 ? FIRST_ITEM_MS : dwell(reveal.unlocks[shown - 1]);
    const timer = window.setTimeout(() => (finished ? setPhase('done') : setShown((n) => n + 1)), delay);
    return () => window.clearTimeout(timer);
  }, [phase, shown, total, reveal]);

  function hurry() {
    if (phase === 'count') {
      land();
      setPhase('items');
    } else if (shown < total) {
      setShown(shown + 1);
    } else {
      setPhase('done');
    }
  }

  function skip() {
    land();
    setShown(total);
    setPhase('done');
  }

  return (
    <div className={styles.backdrop} onClick={hurry}>
      <div className={styles.scroller}>
        <div className={styles.inner}>
          <p className={styles.kicker}>
            {reveal.missionName} — {reveal.outcome === 'victory' ? 'cleared' : 'ended'}
          </p>
          <h2 className={styles.title}>{total > 0 ? 'Your civilization advances' : 'Run scored'}</h2>

          {paying && (
            <div className={styles.payout}>
              <div className={styles.counter}>
                <span className={styles.star} aria-hidden="true">⭐</span>+{count}
              </div>
              <div className={styles.counterLabel}>{reveal.infinite ? 'Influence banked' : 'Influence earned'}</div>
            </div>
          )}

          {total > 0 && (
            <div className={styles.items}>
              {reveal.unlocks.slice(0, shown).map((unlock) => (
                <figure
                  key={`${unlock.kind}:${unlock.id}`}
                  className={`${styles.item} ${unlock.kind === 'sticker' || unlock.kind === 'boardSticker' ? styles.itemFade : styles.itemPop}`}
                >
                  <figcaption className={styles.caption}>{CAPTION[unlock.kind]}</figcaption>
                  <UnlockBody unlock={unlock} />
                </figure>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className={styles.foot}>
        {phase !== 'done' && total > 0 && (
          <>
            <span className={styles.hint}>Click anywhere to continue</span>
            <button
              type="button"
              className={styles.skipBtn}
              onClick={(e) => {
                e.stopPropagation();
                skip();
              }}
            >
              Skip
            </button>
          </>
        )}
        <button
          type="button"
          className={`${styles.continueBtn}${phase === 'done' ? ` ${styles.continueReady}` : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            onDismiss();
          }}
        >
          Continue
        </button>
      </div>
    </div>
  );
}
