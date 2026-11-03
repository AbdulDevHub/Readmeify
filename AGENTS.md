# Readmeify

GitHub profile README cards (stats, top languages, streak, pins, WakaTime, recolored 3D graph) served from one Vercel deployment. Node 22, ESM.

Verify: npm test && npm run lint

## Layout
- `api/*.js` – one Vercel function per card (`/api`, `/api/top-langs`, `/api/streak`, `/api/profile-3d`, ...). Register new ones in `express.js` for local dev.
- `src/fetchers/` – GitHub GraphQL fetchers; always go through `retryer` (`src/common/retryer.js`) so `PAT_1..n` rotate on rate limits.
- `src/cards/` – SVG renderers. `streak.js` is a port of DenverCoder1's PHP streak card (data in `src/cards/streak/`); `profile-3d.js` recolors the 3D contribution SVG.
- `src/common/cache.js` – `CACHE_TTL.*` and cache header helpers.
- `vercel.json` – functions config (30s max), `/profile.svg` rewrite, `/` redirect.

More detail: `context/` (start with `context/PROGRESS_TRACKER.md`).
