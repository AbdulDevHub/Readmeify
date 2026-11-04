# Progress Tracker

The running record of where this project stands, so a new session can pick up without rediscovery.
Update it after every meaningful change: adjust Current state / In progress / Next steps, and add a
dated Session log entry (newest first). When old log entries stop being useful, fold them into the
"Earlier history" paragraph instead of deleting them.

## Current state

- One codebase at the repo root serves every card from one Vercel project: stats, top languages, streak, pins, gist, WakaTime, 3D graph.
- `/api/streak` is a JavaScript port of the PHP streak card. Its output is byte-identical to the old PHP deployment (checked against the live card on 2026-11-03).
- `/api/profile-3d` (also `/profile.svg`) replaces the Netlify Edit-Svg-Proxy. Its output is identical to the live Netlify version.
- `/api/claude` is a Claude Code stats card (tokens, sessions, prompts, tool calls, active days, 12-week heatmap, top model). Data: `stats.json` in private AbdulDevHub/Claude-Code-Hub, pushed by a local SessionStart hook once per calendar month.
- 292 Jest tests pass, lint and format are clean, and CI runs `test.yml` on `main`.

- Deployed: Vercel project renamed to `readmeify-stats` (https://readmeify-stats.vercel.app), root directory = repo root.
- The profile README (AbdulDevHub/AbdulDevHub) points at readmeify-stats for every card. The streak card uses the old PHP-style URL `/?user=...`, which `vercel.json` now rewrites to `/api/streak`. `/` without `user` still redirects to the repo.

- Old deployments are all removed: the Netlify `readmeify-edit-svg-proxy` site and the Vercel `readmeify-github-streak-stat` project.

## In progress

- Nothing.

## Next steps

1. Optional: switch the profile streak URLs to `/api/streak?user=...` (the canonical form).
2. Future: the user's own custom cards. Follow the fetcher → card → api → express pattern.

## Session log

### 2026-11-03 (Claude card)
- Profile layout: two rows of 820px, every card 195px tall. Top-langs got a `card_height` option (shown with `langs_count=8&card_width=333&card_height=195`, floated left), streak uses `card_width=400` (floated left), the Claude card is 400 wide. GitHub adds 20px right padding to `align="left"` images, so each row is 820px of the 831px README column. GitHub caches images (camo) for the card's cache TTL; add a `&v=N` param to the profile URL to force a refresh. Animated the Claude Code mascot. Commits now use the gitmoji-commit skill.
- Card is live and on the profile README next to the streak card (dark/light). Title logo is now the Claude Code pixel mascot (drawn larger in the body, since Card's title icon is a fixed 16x16). Added `Images/ClaudeCode.svg` to the profile's Languages and Tools list. Vercel PAT_1 can read the private Claude-Code-Hub repo.
- Added the Claude Code stats card: `src/fetchers/claude.js`, `src/cards/claude.js`, `api/claude.js`, `CACHE_TTL.CLAUDE_CARD`, tests. Styled to match the stats card (467×195), Claude-orange icons and heatmap.
- Publisher lives outside this repo: `~/.claude/claude-code-hub/claude-stats/compute.mjs` + `~/.claude/hooks/claude-stats-monthly.ps1` (registered as an async SessionStart hook). Decision: monthly refresh on first session of the month, per the user, not a scheduled task.
- Fixed a production bug: `theme=light` (used by the profile for light mode) crashed the stats and top-langs cards because `light` isn't a theme; `getCardColors` now falls back to the default theme.

### 2026-11-03
- Deleted the Netlify site `readmeify-edit-svg-proxy` (the user ran it; verified it is gone and its URL returns 404). Added the `/?user=` → `/api/streak` rewrite for the profile's old streak URL format.
- Ported the streak card from PHP (`Github-Streak-Stat/api/*.php`) to JS: `src/fetchers/streak.js`, `src/cards/streak.js`, and data in `src/cards/streak/`. Dropped `type=png` (needed Inkscape, which Vercel doesn't have) and the demo builder page. The streak card now uses the shared `PAT_*` tokens instead of `TOKEN*`.
- Decision: a failed past-year fetch throws instead of silently dropping the year, so wrong stats don't sit in the cache for 3 hours.
- Raised the Vercel `maxDuration` from 10 s to 30 s for parallel multi-year fetches.
- Moved Edit-Svg-Proxy into `api/profile-3d.js` and `src/cards/profile-3d.js`.
- Flattened `Readme-Cards/` into the repo root and deleted the `Github-Streak-Stat/` and `Edit-Svg-Proxy/` folders. Merged the READMEs. Kept only the test CI workflow (the upstream maintainer workflows would have started running). Renamed the package to `readmeify`.

### Earlier history
Before this session the repo held three separately deployed projects: Github-Readme-Stats (Vercel), Github-Streak-Stat (PHP on the `vercel-php` runtime) and Edit-Svg-Proxy (Netlify, originally PHP). Each was customized with the user's color scheme.
