/**
 * The outbound link bouquet — one list, so every surface that offers a way to reach the project
 * (the About page, the end-of-campaign note) draws the same set.
 *
 * The published build runs inside an itch.io iframe, so every renderer must open these in a new tab
 * (`target="_blank" rel="noopener noreferrer"`) — a same-tab navigation would replace the game.
 */
export interface LinkDef {
  id: string;
  label: string;
  url: string;
  /** Glyph shown before the label. */
  icon: string;
}

export const LINKS: LinkDef[] = [
  { id: 'discord', label: 'Discord', url: 'https://discord.gg/W2PnqbGgkv', icon: '💬' },
  { id: 'github', label: 'GitHub', url: 'https://github.com/DainDwarf/CivCardGame', icon: '🐙' },
];
