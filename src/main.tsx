import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './app/App';
import { loadSettings } from './meta/settings';
import './index.css';

// Apply the saved color theme before the first paint so there's no light-then-dark flash on
// load. index.css keys its `[data-theme]` palette overrides off this attribute; App.tsx keeps
// it in sync when the player changes the theme from the Config submenu.
document.documentElement.dataset.theme = loadSettings().theme;

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
