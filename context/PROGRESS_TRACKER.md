# Progress Tracker

The running record of where this project stands, so a new session can pick up without rediscovery.
Update it after every meaningful change: adjust Current state / In progress / Next steps, and add a
dated Session log entry (newest first). When old log entries stop being useful, fold them into the
"Earlier history" paragraph instead of deleting them.

## Current state

- One codebase at the repo root serves every card from one Vercel project: stats, top languages, streak, pins, gist, WakaTime, 3D graph.
- `/api/streak` is a JavaScript port of the PHP streak card. Its output is byte-identical to the old PHP deployment (checked against the live card on 2026-11-03).
- `/api/profile-3d` (also `/profile.svg`) replaces the Netlify Edit-Svg-Proxy. Its output is identical to the live Netlify version.
- 283 Jest tests pass, lint and format are clean, and CI runs `test.yml` on `main`.

- Deployed: Vercel project renamed to `readmeify-stats` (https://readmeify-stats.vercel.app), root directory = repo root.
- The profile README (AbdulDevHub/AbdulDevHub) points at readmeify-stats for every card. The streak card uses the old PHP-style URL `/?user=...`, which `vercel.json` now rewrites to `/api/streak`. `/` without `user` still redirects to the repo.

## In progress

- The `/?user=` rewrite needs to be pushed and checked live.

## Next steps

1. Delete the Netlify site `readmeify-edit-svg-proxy` (id `4c180c32-a607-4fe4-a046-8d2d3c5e4113`): `netlify sites:delete 4c180c32-a607-4fe4-a046-8d2d3c5e4113`. The profile no longer uses it.
2. Delete the old Vercel project `readmeify-github-streak-stat`.
3. Optional: switch the profile streak URLs to `/api/streak?user=...` (the canonical form).
4. Delete the leftover empty `Readme-Cards/` folder on disk. It's untracked and was locked by another process during the move.
5. Future: the user's own custom cards. Follow the fetcher → card → api → express pattern.

## Session log

### 2026-11-03
- Ported the streak card from PHP (`Github-Streak-Stat/api/*.php`) to JS: `src/fetchers/streak.js`, `src/cards/streak.js`, and data in `src/cards/streak/`. Dropped `type=png` (needed Inkscape, which Vercel doesn't have) and the demo builder page. The streak card now uses the shared `PAT_*` tokens instead of `TOKEN*`.
- Decision: a failed past-year fetch throws instead of silently dropping the year, so wrong stats don't sit in the cache for 3 hours.
- Raised the Vercel `maxDuration` from 10 s to 30 s for parallel multi-year fetches.
- Moved Edit-Svg-Proxy into `api/profile-3d.js` and `src/cards/profile-3d.js`.
- Flattened `Readme-Cards/` into the repo root and deleted the `Github-Streak-Stat/` and `Edit-Svg-Proxy/` folders. Merged the READMEs. Kept only the test CI workflow (the upstream maintainer workflows would have started running). Renamed the package to `readmeify`.

### Earlier history
Before this session the repo held three separately deployed projects: Github-Readme-Stats (Vercel), Github-Streak-Stat (PHP on the `vercel-php` runtime) and Edit-Svg-Proxy (Netlify, originally PHP). Each was customized with the user's color scheme.
