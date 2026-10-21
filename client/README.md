# Volley eScore client

React/Vite frontend for competition administration, team registration, ScorerControl, VIS statistics and public match views.

## Run locally

Set `VITE_API_URL` in `.env`, then run:

```powershell
npm.cmd install
npm.cmd run dev
```

## Source layout

- `src/pages/`: route-level screens grouped by role and purpose.
- `src/components/`: forms, tabs, layouts, controls and document components.
- `src/auth/`: session storage and authentication helpers.
- `src/offline/`: local persistence, PIN access, match gates and synchronization.
- `src/utils/`: helpers grouped by scoring, VIS, reports, navigation and language.
- `src/api.js`: backend API calls.

See the [complete structure](../docs/technical/project-structure.md) and [user guides](../docs/README.md).

## Verify

```powershell
npm.cmd run lint
npm.cmd test
npm.cmd run build
npm.cmd run test:pwa
```

Tests live next to their modules. `src/offline/visEngine.js` is generated from backend rules; use `npm.cmd run generate:vis-engine` to refresh it. The production build is written to `dist/`.
