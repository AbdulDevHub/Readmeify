# Readmeify – Agent Notes

Instructions for AI coding agents working in this repo. Read this first.
After any meaningful change to this project, update this file, `context/PROGRESS_TRACKER.md`, and the "Project Overview" section of `README.md` to reflect the current state — do this proactively, without being asked.

Verify: npm test && npm run lint

## Overview
Fork of anuraghazra/github-readme-stats that also serves a JS port of DenverCoder1's streak card and a recolored 3D contribution graph, all from one Vercel project (`readmeify-stats`, root directory = repo root). Also a Claude Code stats card (`/api/claude`) whose data is pushed monthly to the private Claude-Routines repo by a local SessionStart hook (`~/.claude/hooks/claude-stats-monthly.ps1` → `~/.claude/claude-routines/claude-stats/compute.mjs`).

## Tech stack
Node 22, ESM, Vercel serverless functions (`api/*.js`), axios for GitHub GraphQL, Jest (jsdom) + axios-mock-adapter, ESLint 9 + Prettier, Express for local dev only.

## Commands
- Install: `npm ci`
- Test: `npm test` (all) or `node --experimental-vm-modules node_modules/jest/bin/jest.js tests/streak`
- Lint / format: `npm run lint`, `npm run format:check`
- Local server: `PAT_1=<token> node express.js` → `http://localhost:9000/api/streak?user=abduldevhub`, `/profile.svg`
  (a token can come from `gh auth token`; don't write it to disk)

## Conventions & constraints
- New card = fetcher in `src/fetchers/` + renderer in `src/cards/` + endpoint in `api/` + route in `express.js` + tests.
- GitHub calls go through `retryer` (`src/common/retryer.js`), which rotates `PAT_1..n`. Never read tokens directly.
- Cache via `src/common/cache.js` (`CACHE_TTL.*`, `setCacheHeaders`, `setErrorCacheHeaders`). Errors get short caches.
- Streak card output must stay byte-identical to `tests/fixtures/streak/*.svg` (the original PHP output). Keep PHP-style float printing (`phpFloat`) and the template whitespace.
- Streak theme/color/translation data in `src/cards/streak/` was mechanically converted from PHP; edit it as data.
- Validate/escape every query param that reaches SVG markup (colors by regex, numbers parsed, text via `escapeHtml`).
- `.md` files are in `.prettierignore`; keep GitHub alert syntax (`> [!NOTE]` on its own line).
- Commit titles in Title Case.

## Boundaries
- `.env` is denied to agents; don't try to read it.
- Upstream-only CI workflows were removed on purpose; only `.github/workflows/test.yml` (branch `main`) remains.
- `vercel.json` changes affect production immediately on push.
- Unknown `theme` values (the profile uses `theme=light`) fall back to the default theme in `getCardColors`; don't reintroduce a crash there.

## More
- `README.md` – plain-language overview, endpoints, and full card options.
- `context/PROGRESS_TRACKER.md` – current state, next steps, session log.
- `context/ARCHITECTURE.md` – request flow, folders, deployment.
