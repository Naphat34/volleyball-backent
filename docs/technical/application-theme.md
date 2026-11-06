# Application appearance

The provider in `client/src/components/vis/VisTheme.jsx` now wraps the entire app
in `main.jsx`. Existing VIS and Admin controls share this provider; Scorer Console
also exposes a navbar toggle. Other routes have a small floating appearance control.

The saved preference is `volley-theme`. Existing VIS, Admin and VIMS preferences
are read when the shared preference has not been saved. With no saved preference,
the app follows `prefers-color-scheme`, including device changes. Storage events
keep open tabs in sync. Storage being unavailable does not prevent rendering.
The bootstrap in `index.html` applies appearance before React loads.

Use `--app-page`, `--app-surface`, `--app-surface-alt`, `--app-text`, `--app-muted`,
`--app-border` and the status color pairs in `styles/AppTheme.css` for new CSS.
Tailwind `dark:` variants use the shared `data-app-theme` attribute.
`data-vis-theme` and Admin theme props remain compatibility aliases.

`scripts/generateAppTheme.mjs` generates compatibility rules for existing utility
classes across the frontend. It runs before builds; `npm.cmd run generate:theme`
regenerates the file during development. Semantic colors are preferred for new UI.

Sports court lines, shirt swatches and PDF drawing colors have domain meaning.
Do not invert them. A UI sample that must retain fixed colors can use
`data-theme-fixed`. Report paper uses `data-theme-paper` to stay white while its
toolbar and surrounding page follow the selected theme. Print output remains light.

Verification:

```sh
npm.cmd run lint
npm.cmd run build
node --test src/utils/theme.test.js src/styles/AppTheme.test.js
```

The theme tests check preference migration, device fallback, disabled storage,
CSS parsing, and at least 4.5:1 contrast for the shared text/status palettes.
