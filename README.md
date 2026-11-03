# READMEIFY

A collection of customized GitHub profile cards deployed as serverless functions, with personalized modifications and color schemes.

## What's Inside

### 1. **Readme-Cards**

All GitHub README cards, served from one Vercel deployment.

- **Deployed at:** [readmeify-github-readme-stats.vercel.app](https://readmeify-github-readme-stats.vercel.app)
- **Platform:** Vercel
- Based on [anuraghazra/github-readme-stats](https://github.com/anuraghazra/github-readme-stats), plus a JavaScript port of [DenverCoder1/github-readme-streak-stats](https://github.com/DenverCoder1/github-readme-streak-stats)
- Endpoints:
  - `/api` – stats card
  - `/api/top-langs` – top languages card
  - `/api/streak` – contribution streak card
  - `/api/pin`, `/api/gist`, `/api/wakatime` – repo, gist and WakaTime cards
- New cards go here too: a fetcher in `src/fetchers/`, a renderer in `src/cards/`, and an endpoint in `api/`

### 2. **Edit-SVG-Proxy**

A serverless proxy that fetches and transforms GitHub 3D contribution profile SVGs with custom color schemes.

- **Deployed at:** [readmeify-edit-svg-proxy.netlify.app/profile.svg](https://readmeify-edit-svg-proxy.netlify.app/profile.svg)
- **Platform:** Netlify
- Transforms the original green contribution graph into a custom color palette and matches GitHub's dark theme background

### Legacy: **Github-Streak-Stat**

The original PHP streak card ([readmeify-github-streak-stat.vercel.app](https://readmeify-github-streak-stat.vercel.app)). Replaced by `/api/streak` in Readme-Cards and kept only until profile READMEs point at the new endpoint.

## Repository Structure

```txt
Readmeify/
├── Readme-Cards/          # All README cards (Vercel)
├── Edit-Svg-Proxy/        # Custom SVG transformation proxy (Netlify)
└── Github-Streak-Stat/    # Legacy PHP streak card, to be removed
```

## Deployment Architecture

- **Vercel:** project `readmeify-github-readme-stats`, root directory `Readme-Cards/`, env vars `PAT_1`, `PAT_2`, ... (GitHub tokens)
- **Netlify:** base directory `Edit-Svg-Proxy/`

## Usage

Each project has its own README with usage instructions and options. Example profile snippet:

```html
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://readmeify-github-readme-stats.vercel.app/api/streak?user=abduldevhub&theme=dark">
  <img src="https://readmeify-github-readme-stats.vercel.app/api/streak?user=abduldevhub&theme=light" alt="GitHub Streak" />
</picture>
```

## License

Each project retains its original license. See individual project folders for details.
