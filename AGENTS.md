# Readmeify

Monorepo of GitHub profile README cards.

Verify: cd Readme-Cards && npm test && npm run lint

## Layout
- `Readme-Cards/` – Node (ESM) Vercel functions; one deployment serves every card. Vercel root directory = `Readme-Cards`.
  - `api/*.js` – one endpoint per card (`/api`, `/api/top-langs`, `/api/streak`, ...). Register new ones in `express.js` for local dev.
  - `src/fetchers/` – GitHub GraphQL fetchers; use `retryer` (`src/common/retryer.js`) so `PAT_1..n` tokens rotate on rate limits.
  - `src/cards/` – SVG renderers. `src/cards/streak.js` is a port of DenverCoder1's PHP streak card; its data lives in `src/cards/streak/`.
  - Cache headers via `src/common/cache.js` (`CACHE_TTL.*`).
- `Edit-Svg-Proxy/` – Netlify proxy; leave alone unless asked.
- `Github-Streak-Stat/` – legacy PHP streak card, replaced by `/api/streak`; delete once the profile README uses the new URL.

## Rules
- Streak card output must stay byte-identical to the PHP fixtures in `Readme-Cards/tests/fixtures/streak/`.
- Local run: `cd Readme-Cards && PAT_1=<token> PORT=9000 node express.js`, then open `/api/streak?user=abduldevhub`.
