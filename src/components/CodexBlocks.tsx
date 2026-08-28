import type { CodexBlock, CodexSpan } from '../content/codex';
import { RESOURCE_ICON } from './CardFace';
import styles from './CodexBlocks.module.css';

/**
 * Draws a `CodexBlock[]` (`content/codex.ts`) — the one renderer behind both surfaces a
 * block-shaped text appears on: its Codex page and its one-time tutorial popup. `variant`
 * only picks the type scale; the blocks themselves are the same data, so the two can't drift.
 */
export function CodexBlocks({ blocks, variant = 'codex' }: { blocks: CodexBlock[]; variant?: 'codex' | 'popup' }) {
  return (
    <div className={variant === 'popup' ? `${styles.blocks} ${styles.popup}` : styles.blocks}>
      {blocks.map((block, i) => {
        if (block.kind === 'para') {
          return (
            <p className={styles.para} key={i}>
              {block.spans.map(renderSpan)}
            </p>
          );
        }
        const List = block.kind === 'steps' ? 'ol' : 'ul';
        return (
          <section key={i}>
            <h5 className={styles.heading}>{block.heading}</h5>
            <List className={styles.list}>
              {block.items.map((item) => (
                <li key={item.name}>
                  <span className={styles.name}>{item.name}</span> — {item.text}
                </li>
              ))}
            </List>
          </section>
        );
      })}
    </div>
  );
}

function renderSpan(span: CodexSpan, i: number) {
  if (typeof span === 'string') return <span key={i}>{span}</span>;
  if ('bold' in span) {
    return (
      <strong className={styles.strong} key={i}>
        {span.bold}
      </strong>
    );
  }
  return (
    <span aria-hidden="true" key={i}>
      {span.icons.map((k) => RESOURCE_ICON[k]).join(' ')}
    </span>
  );
}
