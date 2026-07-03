import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './app/App';
import { resolveTheme, loadSettings } from './meta/settings';
import './index.css';

// Apply the saved color theme before the first paint so there's no light-then-dark flash on
// load. index.css keys its `[data-theme]` palette overrides off this attribute. Only a static
// resolve — App.tsx's effect is what owns the live `applyTheme` listener for 'system' plus
// keeping documentElement in sync when the player changes the theme from the Config submenu;
// wiring a second listener here would leak (never torn down) and could fight App's.
document.documentElement.dataset.theme = resolveTheme(loadSettings().theme);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
