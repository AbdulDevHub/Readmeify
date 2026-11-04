# Architecture

How a card request flows through the code, where each layer lives, and how it's deployed.
Use it to put new code in the right layer. Update it when you add a layer, endpoint type,
environment variable, or deployment change.

## Request flow

```txt
GET /api/<card>?...  (Vercel function, or express.js locally)
  └─ api/<card>.js            parse query, guardAccess (WHITELIST/blacklist), pick cache TTL
       ├─ src/fetchers/<card>.js   build GraphQL query → retryer → src/common/http.js (axios POST)
       │     retryer rotates PAT_1..n on rate limit / bad credentials
       └─ src/cards/<card>.js      pure function: data + options → SVG string
  └─ setCacheHeaders / setErrorCacheHeaders → res.send(svg | json)
```

`/profile.svg` is rewritten (in `vercel.json`) to `api/profile-3d.js`. That endpoint skips GitHub's API: it fetches a pre-generated SVG from raw.githubusercontent.com and string-replaces colors (`src/cards/profile-3d.js`).

`api/claude.js` also skips GraphQL: it reads `claude-stats/stats.json` from the private Claude-Routines repo via the REST contents API (still through `retryer` for the PAT). A local monthly SessionStart hook writes that file.

## Folders

- `api/` – endpoints; `api/status/` holds the upstream health/PAT-info endpoints.
- `src/fetchers/` – data fetching only, no SVG.
- `src/cards/` – rendering only, no network. Upstream cards build on `src/common/Card.js`. The streak card (`streak.js`) is standalone with its own themes, colors and translations in `src/cards/streak/`.
- `src/common/` – shared helpers: `cache.js`, `retryer.js`, `error.js` (`CustomError` types → secondary messages), `access.js`, `render.js` (`renderError` card), `envs.js`.
- `themes/` – themes for upstream cards (separate from the streak themes).
- `tests/` – Jest; `tests/fixtures/streak/` holds the PHP-rendered reference SVGs.

## Streak card specifics

- `getContributionGraphs` fetches the current year first (to learn `createdAt` and `contributionYears`), then every earlier year in parallel. Any failed year throws instead of returning partial stats.
- Dates are handled as UTC `Y-m-d` strings. "Today" with 0 contributions doesn't break the streak, and tomorrow counts if it already has contributions (time-zone slack).
- `date_format` uses PHP `date()` letters (ported subset in `phpDate`). The default format uses `Intl.DateTimeFormat`.

## Deployment

- One Vercel project, `readmeify-stats`, root directory = repo root. `vercel.json` gives `api/*.js` 128 MB and 30 s.
- Env vars: `PAT_1..n` (required), optional `CLAUDE_STATS_SOURCE`, `WHITELIST`, `GIST_WHITELIST`, `EXCLUDE_REPO`, `CACHE_SECONDS`, `FETCH_MULTI_PAGE_STARS`.
- `.vercelignore` keeps tests, docs and dev config out of the deploy.
