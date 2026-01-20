# READMEIFY

A collection of customized GitHub profile stat generators deployed as serverless functions. This repository contains two popular and one custom GitHub README tools with personalized modifications and color schemes.

## What's Inside

This monorepo contains three independent projects, each deployed separately:

### 1. **Edit-SVG-Proxy**

A serverless proxy that fetches and transforms GitHub 3D contribution profile SVGs with custom color schemes.

- **Deployed at:** [readmeify-edit-svg-proxy.netlify.app/profile.svg](https://readmeify-edit-svg-proxy.netlify.app/profile.svg)
- **Platform:** Netlify
- Transforms the original green contribution graph into a custom color palette and matches GitHub's dark theme background

### 2. **Github-Readme-Stats**

Dynamically generated GitHub stats cards for your README.

- **Deployed at:** [readmeify-github-readme-stats.vercel.app](https://readmeify-github-readme-stats.vercel.app)
- **Platform:** Vercel
- Based on [anuraghazra/github-readme-stats](https://github.com/anuraghazra/github-readme-stats)
- Generates personalized stat cards showing GitHub activity, languages, and contributions

### 3. **Github-Streak-Stat**

Displays your GitHub contribution streak statistics.

- **Deployed at:** [readmeify-github-streak-stat.vercel.app](https://readmeify-github-streak-stat.vercel.app)
- **Platform:** Vercel
- Based on [DenverCoder1/github-readme-streak-stats](https://github.com/DenverCoder1/github-readme-streak-stats)
- Shows current streak, longest streak, and total contributions

## Repository Structure

```txt
Readmeify/
├── Edit-Svg-Proxy/           # Custom SVG transformation proxy (Netlify)
├── Github-Readme-Stats/      # GitHub stats generator (Vercel)
└── Github-Streak-Stat/       # Contribution streak tracker (Vercel)
```

## Deployment Architecture

Each project is deployed independently using separate Vercel/Netlify instances:

- **Netlify Instance:** Configured with base directory `Edit-Svg-Proxy/`
- **Vercel Instance #1:** Configured with base directory `Github-Readme-Stats/`
- **Vercel Instance #2:** Configured with base directory `Github-Streak-Stat/`

This setup allows each project to have its own deployment pipeline, environment variables, and configuration while being maintained in a single repository.

## Usage

Each project has its own detailed README with usage instructions, customization options, and API documentation. Refer to the individual project folders for specific details.

## Why This Exists

This monorepo consolidates customized versions of popular GitHub README tools into a single repository for easier maintenance and version control. Each tool has been personalized with custom color schemes and configurations to create a cohesive visual style for GitHub profiles.

## License

Each project retains its original license. See individual project folders for details.
