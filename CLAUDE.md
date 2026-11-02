# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

`api/` and `web/` are separate npm packages with no root package; run commands inside each one.

```powershell
# api/ (needs DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME set, including for tests)
npm start                                    # port 3000, or PORT
npm test                                     # node:test against a real PostgreSQL
node --test --test-name-pattern="<name>"     # single test

# web/
npm run dev                                  # http://localhost:5173
npm run build
```

There is no linter. There are no web tests.

## Architecture

`web/` (React + Vite) → `api/` (Express 5) → PostgreSQL.

- The web app calls the relative path `/api/todos`. The Vite dev and preview servers proxy `/api` to a hardcoded `http://localhost:3000` in `web/vite.config.js`, so changing the API's `PORT` means changing this too.
- `api/app.js` holds the pool, routes and `init()` (`CREATE TABLE IF NOT EXISTS todos`), and throws at import if any `DB_*` variable is missing. `api/server.js` only runs `init()` and listens. Tests import `app.js` directly and listen on a random port.
- There is no migration tool: `init()` is the whole schema, so it will not alter an existing table.

## Conventions

- Never write DB passwords or other connection details in code. Read them only from the `DB_*` environment variables, with no defaults.
- Keep `.env` files listed in `.gitignore` and never commit them.
- Keep the code split into `web/` and `api/`.
- Tests run against whatever database `DB_*` points to and do not wipe it: they only delete rows they create. Keep it that way.
- The API has no authentication.
