// @ts-check

import { Card } from "../common/Card.js";
import { getCardColors } from "../common/color.js";
import { encodeHTML } from "../common/html.js";

/** Claude's brand orange, used for icons and the heatmap unless overridden. */
const CLAUDE_ORANGE = "D97757";

/**
 * Claude Code's pixel mascot on a 16x16 grid: body, side arms, four legs and
 * two dark eyes (explicit fill so they stay dark whatever the icon color).
 */
const CLAUDE_CODE_LOGO = `<g shape-rendering="crispEdges">
  <path class="cc-legs-a" d="M3 9h1v3H3zM10 9h1v3h-1z"/>
  <path class="cc-legs-b" d="M5 9h1v3H5zM12 9h1v3h-1z"/>
  <g class="cc-body">
    <path d="M2 3h12v6H2zM0 5h2v2H0zM14 5h2v2h-2z"/>
    <path class="cc-eyes" fill="#1a1a1a" d="M4 4h1v2H4zM11 4h1v2h-1z"/>
  </g>
</g>`;

/**
 * Makes the mascot feel alive: a pixel-step bob, legs alternating as if it is
 * walking in place, and a blink every few seconds.
 */
const LOGO_CSS = `
  .cc-body { animation: ccBob 0.8s steps(1) infinite; }
  .cc-legs-a { animation: ccStep 0.8s steps(1) infinite; }
  .cc-legs-b { animation: ccStep 0.8s steps(1) infinite -0.4s; }
  .cc-eyes { transform-box: fill-box; transform-origin: center; animation: ccBlink 4s infinite; }
  @keyframes ccBob { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-0.6px); } }
  @keyframes ccStep { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-0.8px); } }
  @keyframes ccBlink { 0%, 90%, 100% { transform: scaleY(1); } 94% { transform: scaleY(0.15); } }
`;

const icons = {
  tokens: `<path d="M9.6.3a.6.6 0 0 1 .3.7L8.4 6.5h4.3a.6.6 0 0 1 .5 1l-6.6 8.2a.6.6 0 0 1-1-.6l1.5-5.6H2.8a.6.6 0 0 1-.5-1L8.9.4a.6.6 0 0 1 .7-.1Z"/>`,
  sessions: `<path fill-rule="evenodd" d="M0 2.75C0 1.78.78 1 1.75 1h12.5c.97 0 1.75.78 1.75 1.75v10.5c0 .97-.78 1.75-1.75 1.75H1.75C.78 15 0 14.22 0 13.25Zm1.75-.25a.25.25 0 0 0-.25.25v10.5c0 .14.11.25.25.25h12.5a.25.25 0 0 0 .25-.25V2.75a.25.25 0 0 0-.25-.25ZM7.25 8a.75.75 0 0 1-.22.53l-2.25 2.25a.75.75 0 0 1-1.06-1.06L5.44 8 3.72 6.28a.75.75 0 0 1 1.06-1.06l2.25 2.25c.14.14.22.33.22.53Zm1.5 1.5h3a.75.75 0 0 1 0 1.5h-3a.75.75 0 0 1 0-1.5Z"/>`,
  prompts: `<path fill-rule="evenodd" d="M1 2.75C1 1.78 1.78 1 2.75 1h10.5c.97 0 1.75.78 1.75 1.75v7.5A1.75 1.75 0 0 1 13.25 12H9.06l-2.57 2.57A1.46 1.46 0 0 1 4 13.54V12H2.75A1.75 1.75 0 0 1 1 10.25Zm1.75-.25a.25.25 0 0 0-.25.25v7.5c0 .14.11.25.25.25h2a.75.75 0 0 1 .75.75v2.19l2.72-2.72a.75.75 0 0 1 .53-.22h4.5a.25.25 0 0 0 .25-.25v-7.5a.25.25 0 0 0-.25-.25Z"/>`,
  tools: `<path d="M4.72 3.22a.75.75 0 0 1 1.06 1.06L2.06 8l3.72 3.72a.75.75 0 1 1-1.06 1.06L.47 8.53a.75.75 0 0 1 0-1.06Zm6.56 0a.75.75 0 1 0-1.06 1.06L13.94 8l-3.72 3.72a.75.75 0 1 0 1.06 1.06l4.25-4.25a.75.75 0 0 0 0-1.06Z"/>`,
  days: `<path fill-rule="evenodd" d="M4.75 0a.75.75 0 0 1 .75.75V2h5V.75a.75.75 0 0 1 1.5 0V2h1.25c.97 0 1.75.78 1.75 1.75v10.5A1.75 1.75 0 0 1 13.25 16H2.75A1.75 1.75 0 0 1 1 14.25V3.75C1 2.78 1.78 2 2.75 2H4V.75A.75.75 0 0 1 4.75 0ZM2.5 7.5v6.75c0 .14.11.25.25.25h10.5a.25.25 0 0 0 .25-.25V7.5Zm10.75-4H2.75a.25.25 0 0 0-.25.25V6h11V3.75a.25.25 0 0 0-.25-.25Z"/>`,
};

/**
 * Short number format: 482378741 -> "482.4M", 4917 -> "4.9k".
 *
 * @param {number} n Number.
 * @returns {string} Formatted.
 */
const compact = (n) => {
  for (const [div, unit] of /** @type {[number, string][]} */ ([
    [1e9, "B"],
    [1e6, "M"],
    [1e3, "k"],
  ])) {
    if (n >= div) {
      return `${parseFloat((n / div).toFixed(1))}${unit}`;
    }
  }
  return String(Math.round(n));
};

const CELL = 9;
const GAP = 2;

/**
 * 12-week activity grid (columns = weeks, rows = Sun..Sat), GitHub style.
 *
 * @param {(number|null)[]} heatmap Daily activity counts, oldest first.
 * @returns {string} SVG markup.
 */
const renderHeatmap = (heatmap) => {
  const active = heatmap.filter((v) => typeof v === "number" && v > 0);
  const sorted = [...active].sort((a, b) => a - b);
  const q = (p) => sorted[Math.floor((sorted.length - 1) * p)] ?? 0;
  const cuts = [q(0.25), q(0.5), q(0.75)];
  const level = (v) =>
    v <= 0 ? 0 : v <= cuts[0] ? 1 : v <= cuts[1] ? 2 : v <= cuts[2] ? 3 : 4;
  const opacity = [0.13, 0.35, 0.55, 0.78, 1];

  return heatmap
    .map((v, i) => {
      if (v === null) {
        return "";
      }
      const x = Math.floor(i / 7) * (CELL + GAP);
      const y = (i % 7) * (CELL + GAP);
      return `<rect class="cell" x="${x}" y="${y}" width="${CELL}" height="${CELL}" rx="2" fill-opacity="${opacity[level(v)]}"/>`;
    })
    .join("");
};

/**
 * Renders the Claude Code stats card.
 *
 * @param {import("../fetchers/claude.js").ClaudeStats} stats Stats.
 * @param {Partial<{
 *   title_color: string, icon_color: string, text_color: string,
 *   bg_color: string, border_color: string, theme: string,
 *   hide_border: boolean, hide_title: boolean, custom_title: string,
 *   border_radius: number, disable_animations: boolean
 * }>} options Card options.
 * @returns {string} SVG.
 */
const renderClaudeCard = (stats, options = {}) => {
  const {
    title_color,
    icon_color,
    text_color,
    bg_color,
    border_color,
    theme = "default",
    hide_border = false,
    hide_title = false,
    custom_title,
    border_radius,
    disable_animations = false,
  } = options;

  const { titleColor, iconColor, textColor, bgColor, borderColor } =
    getCardColors({
      title_color,
      icon_color: icon_color || CLAUDE_ORANGE,
      text_color,
      bg_color,
      border_color,
      theme,
    });

  const rows = [
    { icon: icons.tokens, label: "Tokens Used", value: compact(stats.tokens) },
    { icon: icons.sessions, label: "Sessions", value: compact(stats.sessions) },
    {
      icon: icons.prompts,
      label: "Prompts Sent",
      value: compact(stats.prompts),
    },
    { icon: icons.tools, label: "Tool Calls", value: compact(stats.toolCalls) },
    {
      icon: icons.days,
      label: "Active Days",
      value: compact(stats.activeDays),
    },
  ];

  const rowsSvg = rows
    .map(
      (row, i) => `
    <g class="stagger" style="animation-delay: ${(i + 3) * 150}ms" transform="translate(25, ${i * 25})">
      <svg class="icon" viewBox="0 0 16 16" width="16" height="16">${row.icon}</svg>
      <text class="stat bold" x="25" y="12.5">${row.label}:</text>
      <text class="stat bold" x="140" y="12.5" data-testid="${row.label}">${encodeHTML(row.value)}</text>
    </g>`,
    )
    .join("");

  const width = 400;
  const gridWidth = 12 * (CELL + GAP) - GAP;
  const gridX = width - 25 - gridWidth;
  const caption = [
    stats.topModel ? `Top model: ${encodeHTML(stats.topModel)}` : "",
    `Best streak: ${stats.longestStreak}d`,
  ].filter(Boolean);

  // The mascot is wider than tall, so Card's fixed 16x16 title icon renders it
  // tiny. Reserve that slot with an empty icon and draw a larger logo in its place
  // (body coordinates are offset 55px down from the card top).
  const logo = hide_title
    ? ""
    : `<svg class="icon" data-testid="logo" x="23" y="-33" width="20" height="14" viewBox="0 2.5 16 11" overflow="visible">${CLAUDE_CODE_LOGO}</svg>`;

  const body = `
    ${logo}
    ${rowsSvg}
    <g class="stagger" style="animation-delay: 900ms" transform="translate(${gridX}, 0)" data-testid="heatmap">
      ${renderHeatmap(stats.heatmap)}
      ${caption
        .map(
          (line, i) =>
            `<text class="caption" x="${gridWidth / 2}" y="${92 + i * 17}" text-anchor="middle">${line}</text>`,
        )
        .join("")}
    </g>`;

  const card = new Card({
    width,
    height: 195,
    border_radius,
    customTitle: custom_title,
    defaultTitle: "Claude Code Stats",
    titlePrefixIcon: "<g/>",
    colors: { titleColor, textColor, iconColor, bgColor, borderColor },
  });

  card.setHideBorder(hide_border);
  card.setHideTitle(hide_title);
  if (disable_animations) {
    card.disableAnimations();
  }
  card.setCSS(`
    .stat { font: 600 14px 'Segoe UI', Ubuntu, "Helvetica Neue", Sans-Serif; fill: ${textColor}; }
    .bold { font-weight: 700 }
    .caption { font: 400 12px 'Segoe UI', Ubuntu, "Helvetica Neue", Sans-Serif; fill: ${textColor}; }
    .icon { fill: ${iconColor}; }
    .cell { fill: ${iconColor}; }
    ${LOGO_CSS}
    .stagger { opacity: 0; animation: fadeInAnimation 0.3s ease-in-out forwards; }
    @supports(-moz-appearance: auto) { .stat { font-size: 12px; } }
  `);
  card.setAccessibilityLabel({
    title: "Claude Code Stats",
    desc: rows.map((r) => `${r.label}: ${r.value}`).join(", "),
  });

  return card.render(body);
};

export { renderClaudeCard, compact };
export default renderClaudeCard;
