# Readmeify: Custom Stat Cards for Your GitHub Profile README

Live SVG cards for a GitHub profile README (stats, top languages, contribution streak, 3D contribution graph and Claude Code usage), served from one Vercel deployment.

[![Tests](https://github.com/AbdulDevHub/Readmeify/actions/workflows/test.yml/badge.svg)](https://github.com/AbdulDevHub/Readmeify/actions/workflows/test.yml)
[![Deployed on Vercel](https://img.shields.io/badge/deployed-readmeify--stats.vercel.app-000?logo=vercel)](https://readmeify-stats.vercel.app)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

<p>
  <img src="https://readmeify-stats.vercel.app/api/top-langs?username=abduldevhub&layout=compact&theme=dark&langs_count=8&card_width=363&card_height=195" alt="Most used languages card" height="160" />
  <img src="https://readmeify-stats.vercel.app/api?username=abduldevhub&show_icons=true&theme=dark&card_width=437" alt="GitHub stats card" height="160" />
  <img src="https://readmeify-stats.vercel.app/api/streak?user=abduldevhub&theme=dark&card_width=420" alt="GitHub contribution streak card" height="160" />
  <img src="https://readmeify-stats.vercel.app/api/claude?theme=dark" alt="Claude Code usage stats card" height="160" />
</p>

## Project Overview

A GitHub profile README can only show images, so "live" stats on a profile are really images generated on demand. Readmeify is a small server that does that: when GitHub loads a URL like `/api/streak?user=abduldevhub`, it asks GitHub's API for that user's activity, draws the result as an SVG card, and caches it so the API isn't hit on every page view.

It started as three separate projects that I customized: a stats card, a contribution-streak card written in PHP, and a proxy that recolors a 3D contribution graph. They are now one JavaScript codebase on one deployment, plus a Claude Code stats card of my own. The streak card was rewritten from PHP and is tested to produce exactly the same image as the original. Every card shares the same token handling, caching and error cards, and new cards follow one pattern: fetch the data, render the SVG, expose an endpoint.

- **Live at:** [readmeify-stats.vercel.app](https://readmeify-stats.vercel.app), used on [my GitHub profile](https://github.com/AbdulDevHub)
- **Built on:** [anuraghazra/github-readme-stats](https://github.com/anuraghazra/github-readme-stats), a JavaScript port of [DenverCoder1/github-readme-streak-stats](https://github.com/DenverCoder1/github-readme-streak-stats), and a recolor of [yoshi389111/github-profile-3d-contrib](https://github.com/yoshi389111/github-profile-3d-contrib)

## Cards

| Card | Example URL | Highlights |
| :-- | :-- | :-- |
| GitHub stats | `/api?username=abduldevhub&show_icons=true` | Stars, commits, PRs, issues, rank |
| Top languages | `/api/top-langs?username=abduldevhub&layout=compact` | Compact, donut and pie layouts; `card_height` to match neighbours |
| Contribution streak | `/api/streak?user=abduldevhub` | Total contributions, current and longest streak |
| Claude Code usage | `/api/claude?theme=dark` | Tokens, sessions, prompts, tool calls, 12-week heatmap, animated mascot |
| 3D contribution graph | `/profile.svg` | Recolored 3D contribution calendar |
| Repo pin | `/api/pin?username=abduldevhub&repo=AbdulDevHub` | Extra pinned repositories |
| Gist pin | `/api/gist?id=...` | Pinned gists |
| WakaTime | `/api/wakatime?username=...` | Coding time by language |

Every card supports `theme=dark` / `theme=light`, custom colors (`title_color`, `text_color`, `bg_color`, `border_color`), `hide_border` and `cache_seconds`. **[Full options for every card →](docs/CARD_OPTIONS.md)**

Use `<picture>` to switch cards with GitHub's light and dark mode:

```html
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://readmeify-stats.vercel.app/api/streak?user=abduldevhub&theme=dark">
  <img src="https://readmeify-stats.vercel.app/api/streak?user=abduldevhub&theme=light" alt="GitHub streak" />
</picture>
```

## Claude Code Usage Card

The Claude Code card shows my usage of [Claude Code](https://claude.com/product/claude-code). That data only exists in local session logs, so a Claude Code SessionStart hook recomputes it the first time I open Claude Code each month and pushes a small `stats.json` to a private repo. The card reads that file through the GitHub API. Details are in [the options reference](docs/CARD_OPTIONS.md#claude-code-stats-card).

## Deploy Your Own

1. Fork this repo and import it into [Vercel](https://vercel.com/new) (root directory = repo root).
2. Add GitHub personal access tokens as `PAT_1`, `PAT_2`, ... (rotated when one hits a rate limit).
3. Optional: `WHITELIST` (allowed usernames), `CLAUDE_STATS_SOURCE` (`owner/repo/path.json` for the Claude card).

Run locally with `npm ci`, then `PAT_1=<token> node express.js` and open `http://localhost:9000/api/streak?user=<you>`. Tests: `npm test && npm run lint`.

## Project Structure

```txt
Readmeify/
├── api/            # One serverless endpoint per card
├── src/
│   ├── fetchers/   # Data fetching (GitHub GraphQL/REST)
│   ├── cards/      # SVG renderers (streak data in cards/streak/)
│   └── common/     # Shared helpers: cache, retry/token rotation, errors
├── themes/         # Card themes
├── docs/           # Full card options reference
├── tests/          # Jest tests
├── express.js      # Local dev server
└── vercel.json     # Vercel functions, rewrites, redirects
```

Adding a card: a fetcher in `src/fetchers/`, a renderer in `src/cards/`, an endpoint in `api/`, and a route in `express.js`.

## License

[MIT](LICENSE). Includes code from github-readme-stats (Anurag Hazra) and github-readme-streak-stats (Jonah Lawrence), both MIT.
