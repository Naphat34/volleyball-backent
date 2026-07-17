# Repository Guidelines

## Project Structure & Module Organization

This repository contains a React/Vite client and an Express/MySQL backend.

- `client/`: frontend app source, Vite config, static assets, and build output.
- `client/src/`: React pages, components, context, API helpers, and utilities.
- `client/public/`: public assets served by Vite.
- `backend/`: Express server, route definitions, controllers, middleware, DB config, and migrations.
- `backend/migrations/`: SQL migration files. Add new schema changes here with numbered filenames.
- `backend/config/db.js`: MySQL pool and query wrapper.

There is no dedicated test directory yet. Keep future tests near the code they cover or in a clear `tests/` folder per app.

## Build, Test, and Development Commands

Use `npm.cmd` on Windows PowerShell if `npm` is blocked by Execution Policy.

Client:

```bash
cd client
npm.cmd run dev      # start Vite dev server
npm.cmd run build    # production build
npm.cmd run lint     # ESLint check
npm.cmd run preview  # preview built output
```

Backend:

```bash
cd backend
npm.cmd start        # run Express server
npm.cmd run dev      # run with nodemon
node --check server.js
```

The client expects `VITE_API_URL` in `client/.env`; backend uses `backend/.env` for MySQL and JWT settings.

## Coding Style & Naming Conventions

Frontend uses React functional components, hooks, ES modules, and Tailwind utility classes. Use PascalCase for components, camelCase for variables/functions, and keep API calls in `client/src/api.js`.

Backend uses CommonJS modules. Keep route declarations in `backend/routes/`, request logic in `backend/controllers/`, and database access through `backend/config/db.js`. Prefer parameterized SQL queries over string interpolation.

Run `npm.cmd run lint` before submitting frontend changes.

## Testing Guidelines

No automated test framework is currently configured. For now, verify changes with:

- `client`: `npm.cmd run lint` and `npm.cmd run build`
- `backend`: `node --check` on touched files and manual endpoint checks

When adding tests, document the command in `package.json` and use descriptive names such as `*.test.jsx` or `*.test.js`.

## Commit & Pull Request Guidelines

Recent commits use short, informal summaries. Prefer clearer imperative messages, for example:

- `Add team entry roster management`
- `Fix competition grouping by gender and age group`

Pull requests should include a concise summary, affected areas, verification steps, database migrations applied, and screenshots for UI changes. Link related issues when available.

## Security & Configuration Tips

Do not commit real secrets. Keep local credentials in `.env` files. Review migrations carefully before running them against shared databases, especially changes involving teams, players, matches, and registrations.
