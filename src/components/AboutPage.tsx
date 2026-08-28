import { version } from '../../package.json';
import { aboutNote, type AboutSurface } from '../content/about';
import { LINKS } from '../content/links';
import { CodexBlocks } from './CodexBlocks';
import styles from './AboutPage.module.css';

/**
 * The author's note, the outbound links and the build version — the ☰ menu's About page, and the
 * body of the one-time end-of-campaign popup `App.tsx` mounts. One component so the two surfaces
 * can't drift; `surface` picks the note's framing (`content/about.ts`), and the popup's panel title
 * is the note's opening line, so it isn't drawn here.
 *
 * It scrolls inside its own bounded height: the game renders under a `transform: scale()` wrapper,
 * where a taller-than-viewport panel has no document scroll to fall back on.
 */
export function AboutPage({ surface }: { surface: AboutSurface }) {
  return (
    <div className={styles.page}>
      <CodexBlocks blocks={aboutNote(surface)} variant="popup" />
      <div className={styles.links}>
        {LINKS.map((link) => (
          // The published build runs in an itch.io iframe — a same-tab navigation would replace the game.
          <a key={link.id} className={styles.link} href={link.url} target="_blank" rel="noopener noreferrer">
            <span className={styles.linkIcon} aria-hidden="true">
              {link.icon}
            </span>
            <span>{link.label}</span>
          </a>
        ))}
      </div>
      <p className={styles.version}>CivCardGame v{version}</p>
    </div>
  );
}
