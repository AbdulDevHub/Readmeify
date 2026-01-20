# SVG Proxy

A serverless function that fetches an SVG from GitHub, applies custom color transformations, and serves it at a clean URL. This project can be deployed to both Vercel and Netlify.

## What It Does

This proxy:

1. Fetches the SVG from `https://raw.githubusercontent.com/AbdulDevHub/AbdulDevHub/main/profile-3d-contrib/profile-night-green.svg`
2. Applies a comprehensive color scheme transformation:
   - Changes the background color to match GitHub's dark theme (`#0d1117`)
   - Transforms contribution levels (Level 1-4) to a custom green palette
   - Adjusts tile colors for better contrast
3. Serves the modified SVG at a clean URL you can use in `<img>` tags

## Usage

### Vercel Deployment

```txt
https://your-project.vercel.app/api/svg
```

### Netlify Deployment

```txt
https://your-project.netlify.app/.netlify/functions/svg
```

Use in HTML:

```html
<img src="https://svg-proxy.vercel.app/api/svg" alt="Profile">
```

Or in Markdown:

```markdown
![Profile](https://svg-proxy.netlify.app/.netlify/functions/svg)
```

## Deployment

### Deploy to Vercel

1. Fork or clone this repository
2. Push to GitHub
3. Go to [vercel.com](https://vercel.com)
4. Click "Import Project" and select your repository
5. Deploy with default settings
6. Your SVG will be available at `https://your-project.vercel.app/api/svg`

### Deploy to Netlify

1. Fork or clone this repository
2. Push to GitHub
3. Go to [netlify.com](https://netlify.com)
4. Click "Add new site" → "Import an existing project"
5. Connect your GitHub repository
6. Deploy with auto-detected settings
7. Your SVG will be available at `https://your-project.netlify.app/.netlify/functions/svg`

## Project Structure

```bash
svg-proxy/
├── README.md
├── package.json
├── vercel.json          # Vercel configuration
├── netlify.toml         # Netlify configuration
├── lib/                 # Shared transformation logic
│   └── svg-transformer.js
├── api/                 # Vercel serverless functions
│   └── svg.js
└── netlify/             # Netlify serverless functions
    └── functions/
        └── svg.js
```

## How It Works

### Shared Logic (`lib/svg-transformer.js`)

The core transformation logic is centralized in a shared module that:

- Defines the source SVG URL
- Contains all color replacement mappings organized by category:
  - Background color
  - Contribution levels (1-4)
  - Tile colors
- Provides a `transformSVG()` function that applies all replacements efficiently

### Vercel (`api/svg.js`)

- Uses Vercel's serverless function format with `export default`
- Fetches the SVG using the native `fetch` API
- Responds using `res.setHeader()` and `res.send()`
- Configured via `vercel.json`

### Netlify (`netlify/functions/svg.js`)

- Uses Netlify's serverless function format with `exports.handler`
- Uses Node's built-in `https` module for compatibility
- Returns response object with `statusCode`, `headers`, and `body`
- Configured via `netlify.toml`

Both implementations:

- Import the shared transformation logic
- Fetch the original SVG from GitHub
- Apply all color transformations in a single pass
- Cache the response for 1 hour to reduce API calls
- Serve the modified SVG with proper `Content-Type` headers

## Color Transformations

The following color transformations are applied:

| Category | Original Color | New Color | Purpose |
| ---------- | --------------- | ----------- | --------- |
| Background | `#00000f` | `#0d1117` | Match GitHub dark theme |
| Level 1 | `rgb(27, 125, 40)` | `rgb(216, 232, 135)` | Lightest contribution shade |
| Level 2 | `rgb(36, 167, 54)` | `rgb(140, 197, 105)` | Light-medium contribution |
| Level 3 | `rgb(45, 209, 67)` | `rgb(71, 160, 66)` | Medium-dark contribution |
| Level 4 | `rgb(87, 218, 105)` | `rgb(29, 106, 35)` | Darkest contribution shade |
| Tiles | `rgb(68, 68, 68)` | `rgb(136, 136, 136)` | Enhanced contrast |

## Customization

### Changing the Source SVG

Update the `SVG_URL` constant in `lib/svg-transformer.js`:

```javascript
const SVG_URL = 'https://your-svg-url-here.svg';
```

### Adding or Modifying Colors

Edit the `COLOR_REPLACEMENTS` array in `lib/svg-transformer.js`:

```javascript
const COLOR_REPLACEMENTS = [
  ['original-color', 'new-color'],
  // Add more replacements here
];
```

The format for each entry is `[oldColor, newColor]`. Colors can be in any CSS color format (hex, rgb, etc.).

## Caching

- **Vercel**: `s-maxage=3600, stale-while-revalidate` (1 hour cache, serves stale content while revalidating)
- **Netlify**: `public, max-age=3600, s-maxage=3600` (1 hour cache)

To adjust cache duration, modify the `Cache-Control` header in the respective function files (`api/svg.js` or `netlify/functions/svg.js`).

## Why This Exists

GitHub's 3D contribution profile SVGs come with a specific color scheme that may not match your desired aesthetic. This proxy allows you to:

- Match GitHub's dark theme background perfectly (`#0d1117` instead of `#00000f`)
- Apply a custom color palette to contribution levels
- Enhance tile contrast for better visibility
- Serve the transformed SVG without modifying the original source

This makes the SVG blend seamlessly into GitHub profiles, README files, and personal websites with a consistent visual style.

## License

MIT
