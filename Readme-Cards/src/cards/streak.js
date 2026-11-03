// @ts-check

/**
 * Streak card renderer.
 * Ported from DenverCoder1/github-readme-streak-stats (api/card.php).
 */

import CSS_COLORS from "./streak/colors.js";
import THEMES from "./streak/themes.js";
import TRANSLATIONS from "./streak/translations.js";

/**
 * @typedef {import("../fetchers/streak.js").StreakStats} StreakStats
 * @typedef {Record<string, string | undefined>} StreakParams Request query parameters.
 * @typedef {Record<string, string>} StreakTheme Theme colors.
 */

const ENGLISH_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const ENGLISH_DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
const ENGLISH_MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/**
 * Round a float to 14 significant digits, matching how PHP prints floats.
 *
 * @param {number} value Number.
 * @returns {number} Rounded number.
 */
const phpFloat = (value) => Number(value.toPrecision(14));

/**
 * Escape text like PHP's htmlspecialchars().
 *
 * @param {string} text Text.
 * @returns {string} Escaped text.
 */
const escapeHtml = (text) =>
  text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

/**
 * Convert a normalized locale code (e.g. "zh_Hans") to a BCP 47 tag usable by Intl.
 *
 * @param {string} localeCode Locale code.
 * @returns {string} Supported BCP 47 tag, or "en".
 */
const toIntlLocale = (localeCode) => {
  const tag = localeCode.replace(/_/g, "-");
  try {
    return Intl.DateTimeFormat.supportedLocalesOf([tag]).length ? tag : "en";
  } catch {
    return "en";
  }
};

/**
 * Parse a Y-m-d string as a UTC date.
 *
 * @param {string} date Y-m-d date (empty means today).
 * @returns {Date} Date.
 */
const parseYmd = (date) =>
  new Date(`${date || new Date().toISOString().slice(0, 10)}T00:00:00Z`);

/**
 * Format a date with a PHP date() format string (common characters only).
 *
 * @param {Date} date Date (read in UTC).
 * @param {string} format PHP date format, e.g. "j/n/Y".
 * @returns {string} Formatted date.
 */
const phpDate = (date, format) => {
  const d = date.getUTCDate();
  const m = date.getUTCMonth();
  const y = date.getUTCFullYear();
  const w = date.getUTCDay();
  const pad = (/** @type {number} */ n) => String(n).padStart(2, "0");
  const suffix = () => {
    if (d % 10 === 1 && d !== 11) {
      return "st";
    }
    if (d % 10 === 2 && d !== 12) {
      return "nd";
    }
    if (d % 10 === 3 && d !== 13) {
      return "rd";
    }
    return "th";
  };
  /** @type {Record<string, () => string>} */
  const map = {
    d: () => pad(d),
    D: () => ENGLISH_DAYS[w],
    j: () => String(d),
    l: () => ENGLISH_DAY_NAMES[w],
    N: () => String(w || 7),
    S: suffix,
    w: () => String(w),
    F: () => ENGLISH_MONTHS[m],
    m: () => pad(m + 1),
    M: () => ENGLISH_MONTHS[m].slice(0, 3),
    n: () => String(m + 1),
    Y: () => String(y),
    y: () => pad(y % 100),
  };
  let out = "";
  for (let i = 0; i < format.length; i++) {
    const c = format[i];
    if (c === "\\" && i + 1 < format.length) {
      out += format[++i];
    } else {
      out += map[c] ? map[c]() : c;
    }
  }
  return out;
};

/**
 * Convert a Y-m-d date to a human-readable string.
 * The year is shown only when it differs from the current year.
 *
 * @param {string} dateString Y-m-d date.
 * @param {string|null|undefined} format PHP-style format with optional [bracketed] year part, or null for locale default.
 * @param {string} localeCode Normalized locale code.
 * @returns {string} Escaped, formatted date.
 */
const formatDate = (dateString, format, localeCode) => {
  const date = parseYmd(dateString);
  const isCurrentYear = date.getUTCFullYear() === new Date().getUTCFullYear();
  let formatted;
  if (format) {
    formatted = isCurrentYear
      ? phpDate(date, format.replace(/\[.*?\]/g, ""))
      : phpDate(date, format.replace(/[[\]]/g, ""));
  } else {
    formatted = new Intl.DateTimeFormat(toIntlLocale(localeCode), {
      timeZone: "UTC",
      month: "short",
      day: "numeric",
      ...(isCurrentYear ? {} : { year: "numeric" }),
    }).format(date);
  }
  return escapeHtml(formatted);
};

/**
 * Translate short English day names to the locale's short day names.
 *
 * @param {string[]} days Day names like "Sun".
 * @param {string} localeCode Normalized locale code.
 * @returns {string[]} Translated day names.
 */
const translateDays = (days, localeCode) => {
  if (localeCode === "en") {
    return days;
  }
  const formatter = new Intl.DateTimeFormat(toIntlLocale(localeCode), {
    timeZone: "UTC",
    weekday: "short",
  });
  // 2023-01-01 was a Sunday
  return days.map((day) =>
    formatter.format(
      new Date(Date.UTC(2023, 0, 1 + ENGLISH_DAYS.indexOf(day))),
    ),
  );
};

/**
 * Text for the "excluding days" note.
 *
 * @param {string[]} excludedDays Day names.
 * @param {Record<string, any>} translations Locale translations.
 * @param {string} localeCode Normalized locale code.
 * @returns {string} Note text.
 */
const getExcludingDaysText = (excludedDays, translations, localeCode) => {
  const separator = translations.comma_separator ?? ", ";
  const days = translateDays(excludedDays, localeCode).join(separator);
  return translations["Excluding {days}"].replace("{days}", days);
};

/**
 * Resolve theme colors from the theme name and per-color overrides.
 *
 * @param {StreakParams} params Request parameters.
 * @returns {StreakTheme} Theme colors, plus `backgroundGradient` markup.
 */
const getRequestedTheme = (params) => {
  const name = (params.theme ?? "default").replace(/_/g, "-").toLowerCase();
  /** @type {Record<string, StreakTheme>} */
  const themes = THEMES;
  const theme = {
    ...(Object.hasOwn(themes, name) ? themes[name] : themes.default),
  };

  for (const prop of Object.keys(theme)) {
    const raw = params[prop];
    if (raw === undefined) {
      continue;
    }
    const param = String(raw).toLowerCase();
    if (/^([a-f0-9]{3}|[a-f0-9]{4}|[a-f0-9]{6}|[a-f0-9]{8})$/.test(param)) {
      theme[prop] = `#${param}`;
    } else if (CSS_COLORS.includes(param)) {
      theme[prop] = param;
    } else if (
      prop === "background" &&
      /^-?[0-9]+,[a-f0-9]{3,8}(,[a-f0-9]{3,8})+$/.test(param)
    ) {
      theme[prop] = param;
    }
  }

  if (params.hide_border === "true") {
    theme.border = "#0000";
  }

  let gradient = "";
  const parts = (theme.background ?? "").split(",");
  if (parts.length >= 3) {
    theme.background = "url(#gradient)";
    const colors = parts.slice(1);
    gradient = `<linearGradient id='gradient' gradientTransform='rotate(${parts[0]})' gradientUnits='userSpaceOnUse'>`;
    colors.forEach((color, i) => {
      const offset = phpFloat((i * 100) / (colors.length - 1));
      gradient += `<stop offset='${offset}%' stop-color='#${color}' />`;
    });
    gradient += "</linearGradient>";
  }
  theme.backgroundGradient = gradient;
  return theme;
};

/**
 * Wrap text at a width, like PHP's wordwrap() but counting code points.
 *
 * @param {string} text Text.
 * @param {number} width Max characters per line.
 * @param {boolean} cutLongWords Split words longer than width.
 * @returns {string} Wrapped text.
 */
const wordWrap = (text, width, cutLongWords) => {
  let out = text.replace(new RegExp(`(.{1,${width}})(?:\\s|$)`, "gu"), "$1\n");
  if (cutLongWords) {
    out = out.replace(new RegExp(`(\\S{${width}})(?=\\S)`, "gu"), "$1\n");
  }
  return out.replace(/\n+$/, "");
};

/**
 * Escape text and split it into two <tspan> lines if it has a newline or is too long.
 *
 * @param {string} text Text.
 * @param {number} maxChars Max characters per line (0 = no limit).
 * @param {number} line1Offset dy of the first line.
 * @returns {string} SVG text content.
 */
const splitLines = (text, maxChars, line1Offset) => {
  let value = text;
  if (maxChars > 0 && [...value].length > maxChars && !value.includes("\n")) {
    value = value.includes(" - ")
      ? value.replace(/ - /g, "\n- ")
      : wordWrap(value, maxChars, true);
  }
  return escapeHtml(value).replace(
    /^(.*)\n(.*)/,
    `<tspan x='0' dy='${line1Offset}'>$1</tspan><tspan x='0' dy='16'>$2</tspan>`,
  );
};

/**
 * Normalize a locale code, e.g. "zh-hans-cn" -> "zh_Hans_CN".
 *
 * @param {string} localeCode Locale code.
 * @returns {string} Normalized code, or "en" if invalid.
 */
const normalizeLocaleCode = (localeCode) => {
  const match =
    /^([a-z]{2,3})(?:[_-]([a-z]{4}))?(?:[_-]([0-9]{3}|[a-z]{2}))?$/i.exec(
      localeCode,
    );
  if (!match) {
    return "en";
  }
  const [, language, script = "", region = ""] = match;
  const scriptTitle = script
    ? script[0].toUpperCase() + script.slice(1).toLowerCase()
    : "";
  return [language.toLowerCase(), scriptTitle, region.toUpperCase()]
    .filter(Boolean)
    .join("_");
};

/**
 * Translations for a locale, with missing keys filled from English.
 *
 * @param {string} localeCode Locale code (any casing/separator).
 * @returns {Record<string, any>} Translations.
 */
const getTranslations = (localeCode) => {
  /** @type {Record<string, any>} */
  const all = TRANSLATIONS;
  let code = normalizeLocaleCode(localeCode);
  if (!(code in all)) {
    code = code.split("_")[0];
  }
  let locale = all[code] ?? {};
  if (typeof locale === "string") {
    locale = all[locale];
  }
  return { ...all.en, ...locale };
};

/**
 * @param {StreakParams} params Request parameters.
 * @param {number} numColumns Visible columns.
 * @returns {number} Card width.
 */
const getCardWidth = (params, numColumns = 3) =>
  Math.max(100 * numColumns, parseInt(params.card_width ?? "495", 10) || 0);

/**
 * @param {StreakParams} params Request parameters.
 * @returns {number} Card height.
 */
const getCardHeight = (params) =>
  Math.max(170, parseInt(params.card_height ?? "195", 10) || 0);

/**
 * @param {StreakParams} params Request parameters.
 * @returns {number} Border radius.
 */
const getBorderRadius = (params) => {
  const radius = parseFloat(params.border_radius ?? "");
  return Number.isFinite(radius) ? radius : 4.5;
};

/**
 * Format a number for the locale, optionally shortened (e.g. 2.1K).
 *
 * @param {number} num Number.
 * @param {string} localeCode Normalized locale code.
 * @param {boolean} useShortNumbers Shorten with K/M/B/T suffixes.
 * @returns {string} Formatted number.
 */
const formatNumber = (num, localeCode, useShortNumbers) => {
  let value = num;
  let suffix = "";
  if (useShortNumbers) {
    const units = ["", "K", "M", "B", "T"];
    let i = 0;
    for (; value >= 1000; i++) {
      value /= 1000;
    }
    suffix = units[i];
    value = Math.round(value * 10) / 10;
  }
  return new Intl.NumberFormat(toIntlLocale(localeCode)).format(value) + suffix;
};

/**
 * Render the streak card SVG.
 *
 * @param {StreakStats} stats Streak stats.
 * @param {StreakParams} params Request parameters.
 * @returns {string} SVG.
 */
const renderStreakCard = (stats, params = {}) => {
  const theme = getRequestedTheme(params);
  const localeCode = normalizeLocaleCode(params.locale ?? "en");
  const translations = getTranslations(localeCode);
  const direction = translations.rtl ? "rtl" : "ltr";
  const dateFormat = params.date_format ?? translations.date_format ?? null;
  const borderRadius = getBorderRadius(params);

  const showTotalContributions = params.hide_total_contributions !== "true";
  const showCurrentStreak = params.hide_current_streak !== "true";
  const showLongestStreak = params.hide_longest_streak !== "true";
  const numColumns =
    Number(showTotalContributions) +
    Number(showCurrentStreak) +
    Number(showLongestStreak);

  const cardWidth = getCardWidth(params, numColumns);
  const rectWidth = cardWidth - 1;
  const columnWidth = numColumns > 0 ? cardWidth / numColumns : 0;

  const cardHeight = getCardHeight(params);
  const rectHeight = cardHeight - 1;
  const heightOffset = (cardHeight - 195) / 2;

  // X offsets for the bars between columns
  const barOffsets = [-999, -999];
  for (let i = 0; i < numColumns - 1; i++) {
    barOffsets[i] = columnWidth * (i + 1);
  }
  // X offsets for the text in each column
  let columnOffsets = [];
  for (let i = 0; i < numColumns; i++) {
    columnOffsets.push(columnWidth / 2 + columnWidth * i);
  }
  if (direction === "rtl") {
    columnOffsets = columnOffsets.reverse();
  }
  let nextColumn = 0;
  const totalContributionsOffset = showTotalContributions
    ? columnOffsets[nextColumn++]
    : -999;
  const currentStreakOffset = showCurrentStreak
    ? columnOffsets[nextColumn++]
    : -999;
  const longestStreakOffset = showLongestStreak
    ? columnOffsets[nextColumn++]
    : -999;

  // Y offsets
  const barHeightOffsets = [28 + heightOffset / 2, 170 + heightOffset];
  const totalContributionsHeightOffset = [
    48 + heightOffset,
    84 + heightOffset,
    114 + heightOffset,
  ];
  const longestStreakHeightOffset = totalContributionsHeightOffset;
  const currentStreakHeightOffset = [
    48 + heightOffset,
    108 + heightOffset,
    145 + heightOffset,
    71 + heightOffset,
    19.5 + heightOffset,
  ];

  const useShortNumbers = params.short_numbers === "true";
  /**
   * Format a streak's date range, collapsing it when start and end match.
   *
   * @param {{ start: string, end: string }} streak Streak dates.
   * @returns {string} Formatted range.
   */
  const range = (streak) => {
    const start = formatDate(streak.start, dateFormat, localeCode);
    const end = formatDate(streak.end, dateFormat, localeCode);
    return start === end ? start : `${start} - ${end}`;
  };

  const totalContributions = formatNumber(
    stats.totalContributions,
    localeCode,
    useShortNumbers,
  );
  const currentStreak = formatNumber(
    stats.currentStreak.length,
    localeCode,
    useShortNumbers,
  );
  const longestStreak = formatNumber(
    stats.longestStreak.length,
    localeCode,
    useShortNumbers,
  );

  // labels: split into two lines when too long
  const maxCharsLabels =
    numColumns > 0 ? Math.floor(cardWidth / numColumns / 7.5) : 0;
  const weekly = stats.mode === "weekly";
  const totalContributionsText = splitLines(
    translations["Total Contributions"],
    maxCharsLabels,
    -9,
  );
  const currentStreakText = splitLines(
    translations[weekly ? "Week Streak" : "Current Streak"],
    maxCharsLabels,
    -9,
  );
  const longestStreakText = splitLines(
    translations[weekly ? "Longest Week Streak" : "Longest Streak"],
    maxCharsLabels,
    -9,
  );

  // date ranges: split into two lines when too long
  const maxCharsDates =
    numColumns > 0 ? Math.floor(cardWidth / numColumns / 6) : 0;
  const firstContribution = formatDate(
    stats.firstContribution,
    dateFormat,
    localeCode,
  );
  const totalContributionsRange = splitLines(
    `${firstContribution} - ${translations.Present}`,
    maxCharsDates,
    0,
  );
  const currentStreakRange = splitLines(
    range(stats.currentStreak),
    maxCharsDates,
    0,
  );
  const longestStreakRange = splitLines(
    range(stats.longestStreak),
    maxCharsDates,
    0,
  );

  // note in the corner when days are excluded
  let excludedDays = "";
  if (stats.excludedDays?.length) {
    const offset = direction === "rtl" ? cardWidth - 5 : 5;
    const excludingDaysText = getExcludingDaysText(
      stats.excludedDays,
      translations,
      localeCode,
    );
    excludedDays = `<g style='isolation: isolate'>
                <!-- Excluded Days -->
                <g transform='translate(${offset},187)'>
                    <text stroke-width='0' text-anchor='right' fill='${theme.excludeDaysLabel}' stroke='none' font-family='"Segoe UI", Ubuntu, sans-serif' font-weight='400' font-size='10px' font-style='normal' style='opacity: 0; animation: fadein 0.5s linear forwards 0.9s'>
                        * ${excludingDaysText}
                    </text>
                </g>
            </g>`;
  }

  return `<svg xmlns='http://www.w3.org/2000/svg' xmlns:xlink='http://www.w3.org/1999/xlink'
                style='isolation: isolate' viewBox='0 0 ${cardWidth} ${cardHeight}' width='${cardWidth}px' height='${cardHeight}px' direction='${direction}'>
        <style>
            @keyframes currstreak {
                0% { font-size: 3px; opacity: 0.2; }
                80% { font-size: 34px; opacity: 1; }
                100% { font-size: 28px; opacity: 1; }
            }
            @keyframes fadein {
                0% { opacity: 0; }
                100% { opacity: 1; }
            }
        </style>
        <defs>
            <clipPath id='outer_rectangle'>
                <rect width='${cardWidth}' height='${cardHeight}' rx='${borderRadius}'/>
            </clipPath>
            <mask id='mask_out_ring_behind_fire'>
                <rect width='${cardWidth}' height='${cardHeight}' fill='white'/>
                <ellipse id='mask-ellipse' cx='${currentStreakOffset}' cy='32' rx='13' ry='18' fill='black'/>
            </mask>
            ${theme.backgroundGradient}
        </defs>
        <g clip-path='url(#outer_rectangle)'>
            <g style='isolation: isolate'>
                <rect stroke='${theme.border}' fill='${theme.background}' rx='${borderRadius}' x='0.5' y='0.5' width='${rectWidth}' height='${rectHeight}'/>
            </g>
            <g style='isolation: isolate'>
                <line x1='${barOffsets[0]}' y1='${barHeightOffsets[0]}' x2='${barOffsets[0]}' y2='${barHeightOffsets[1]}' vector-effect='non-scaling-stroke' stroke-width='1' stroke='${theme.stroke}' stroke-linejoin='miter' stroke-linecap='square' stroke-miterlimit='3'/>
                <line x1='${barOffsets[1]}' y1='${barHeightOffsets[0]}' x2='${barOffsets[1]}' y2='${barHeightOffsets[1]}' vector-effect='non-scaling-stroke' stroke-width='1' stroke='${theme.stroke}' stroke-linejoin='miter' stroke-linecap='square' stroke-miterlimit='3'/>
            </g>
            <g style='isolation: isolate'>
                <!-- Total Contributions big number -->
                <g transform='translate(${totalContributionsOffset}, ${totalContributionsHeightOffset[0]})'>
                    <text x='0' y='32' stroke-width='0' text-anchor='middle' fill='${theme.sideNums}' stroke='none' font-family='"Segoe UI", Ubuntu, sans-serif' font-weight='700' font-size='28px' font-style='normal' style='opacity: 0; animation: fadein 0.5s linear forwards 0.6s'>
                        ${totalContributions}
                    </text>
                </g>

                <!-- Total Contributions label -->
                <g transform='translate(${totalContributionsOffset}, ${totalContributionsHeightOffset[1]})'>
                    <text x='0' y='32' stroke-width='0' text-anchor='middle' fill='${theme.sideLabels}' stroke='none' font-family='"Segoe UI", Ubuntu, sans-serif' font-weight='400' font-size='14px' font-style='normal' style='opacity: 0; animation: fadein 0.5s linear forwards 0.7s'>
                        ${totalContributionsText}
                    </text>
                </g>

                <!-- Total Contributions range -->
                <g transform='translate(${totalContributionsOffset}, ${totalContributionsHeightOffset[2]})'>
                    <text x='0' y='32' stroke-width='0' text-anchor='middle' fill='${theme.dates}' stroke='none' font-family='"Segoe UI", Ubuntu, sans-serif' font-weight='400' font-size='12px' font-style='normal' style='opacity: 0; animation: fadein 0.5s linear forwards 0.8s'>
                        ${totalContributionsRange}
                    </text>
                </g>
            </g>
            <g style='isolation: isolate'>
                <!-- Current Streak label -->
                <g transform='translate(${currentStreakOffset}, ${currentStreakHeightOffset[1]})'>
                    <text x='0' y='32' stroke-width='0' text-anchor='middle' fill='${theme.currStreakLabel}' stroke='none' font-family='"Segoe UI", Ubuntu, sans-serif' font-weight='700' font-size='14px' font-style='normal' style='opacity: 0; animation: fadein 0.5s linear forwards 0.9s'>
                        ${currentStreakText}
                    </text>
                </g>

                <!-- Current Streak range -->
                <g transform='translate(${currentStreakOffset}, ${currentStreakHeightOffset[2]})'>
                    <text x='0' y='21' stroke-width='0' text-anchor='middle' fill='${theme.dates}' stroke='none' font-family='"Segoe UI", Ubuntu, sans-serif' font-weight='400' font-size='12px' font-style='normal' style='opacity: 0; animation: fadein 0.5s linear forwards 0.9s'>
                        ${currentStreakRange}
                    </text>
                </g>

                <!-- Ring around number -->
                <g mask='url(#mask_out_ring_behind_fire)'>
                    <circle cx='${currentStreakOffset}' cy='${currentStreakHeightOffset[3]}' r='40' fill='none' stroke='${theme.ring}' stroke-width='5' style='opacity: 0; animation: fadein 0.5s linear forwards 0.4s'></circle>
                </g>
                <!-- Fire icon -->
                <g transform='translate(${currentStreakOffset}, ${currentStreakHeightOffset[4]})' stroke-opacity='0' style='opacity: 0; animation: fadein 0.5s linear forwards 0.6s'>
                    <path d='M -12 -0.5 L 15 -0.5 L 15 23.5 L -12 23.5 L -12 -0.5 Z' fill='none'/>
                    <path d='M 1.5 0.67 C 1.5 0.67 2.24 3.32 2.24 5.47 C 2.24 7.53 0.89 9.2 -1.17 9.2 C -3.23 9.2 -4.79 7.53 -4.79 5.47 L -4.76 5.11 C -6.78 7.51 -8 10.62 -8 13.99 C -8 18.41 -4.42 22 0 22 C 4.42 22 8 18.41 8 13.99 C 8 8.6 5.41 3.79 1.5 0.67 Z M -0.29 19 C -2.07 19 -3.51 17.6 -3.51 15.86 C -3.51 14.24 -2.46 13.1 -0.7 12.74 C 1.07 12.38 2.9 11.53 3.92 10.16 C 4.31 11.45 4.51 12.81 4.51 14.2 C 4.51 16.85 2.36 19 -0.29 19 Z' fill='${theme.fire}' stroke-opacity='0'/>
                </g>

                <!-- Current Streak big number -->
                <g transform='translate(${currentStreakOffset}, ${currentStreakHeightOffset[0]})'>
                    <text x='0' y='32' stroke-width='0' text-anchor='middle' fill='${theme.currStreakNum}' stroke='none' font-family='"Segoe UI", Ubuntu, sans-serif' font-weight='700' font-size='28px' font-style='normal' style='animation: currstreak 0.6s linear forwards'>
                        ${currentStreak}
                    </text>
                </g>

            </g>
            <g style='isolation: isolate'>
                <!-- Longest Streak big number -->
                <g transform='translate(${longestStreakOffset}, ${longestStreakHeightOffset[0]})'>
                    <text x='0' y='32' stroke-width='0' text-anchor='middle' fill='${theme.sideNums}' stroke='none' font-family='"Segoe UI", Ubuntu, sans-serif' font-weight='700' font-size='28px' font-style='normal' style='opacity: 0; animation: fadein 0.5s linear forwards 1.2s'>
                        ${longestStreak}
                    </text>
                </g>

                <!-- Longest Streak label -->
                <g transform='translate(${longestStreakOffset}, ${longestStreakHeightOffset[1]})'>
                    <text x='0' y='32' stroke-width='0' text-anchor='middle' fill='${theme.sideLabels}' stroke='none' font-family='"Segoe UI", Ubuntu, sans-serif' font-weight='400' font-size='14px' font-style='normal' style='opacity: 0; animation: fadein 0.5s linear forwards 1.3s'>
                        ${longestStreakText}
                    </text>
                </g>

                <!-- Longest Streak range -->
                <g transform='translate(${longestStreakOffset}, ${longestStreakHeightOffset[2]})'>
                    <text x='0' y='32' stroke-width='0' text-anchor='middle' fill='${theme.dates}' stroke='none' font-family='"Segoe UI", Ubuntu, sans-serif' font-weight='400' font-size='12px' font-style='normal' style='opacity: 0; animation: fadein 0.5s linear forwards 1.4s'>
                        ${longestStreakRange}
                    </text>
                </g>
            </g>
            ${excludedDays}
        </g>
    </svg>
`;
};

/**
 * Render an error card SVG.
 *
 * @param {string} rawMessage Error message (plain text).
 * @param {StreakParams} params Request parameters.
 * @returns {string} SVG.
 */
const renderStreakError = (rawMessage, params = {}) => {
  const theme = getRequestedTheme(params);
  const message = escapeHtml(rawMessage);
  const borderRadius = getBorderRadius(params);
  const cardWidth = getCardWidth(params);
  const rectWidth = cardWidth - 1;
  const centerOffset = cardWidth / 2;
  const cardHeight = getCardHeight(params);
  const rectHeight = cardHeight - 1;
  const heightOffset = (cardHeight - 195) / 2;
  const errorLabelOffset = cardHeight / 2 + 10.5;

  return `<svg xmlns='http://www.w3.org/2000/svg' xmlns:xlink='http://www.w3.org/1999/xlink' style='isolation: isolate' viewBox='0 0 ${cardWidth} ${cardHeight}' width='${cardWidth}px' height='${cardHeight}px'>
        <style>
            a {
                fill: ${theme.dates};
            }
        </style>
        <defs>
            <clipPath id='outer_rectangle'>
                <rect width='${cardWidth}' height='${cardHeight}' rx='${borderRadius}'/>
            </clipPath>
            ${theme.backgroundGradient}
        </defs>
        <g clip-path='url(#outer_rectangle)'>
            <g style='isolation: isolate'>
                <rect stroke='${theme.border}' fill='${theme.background}' rx='${borderRadius}' x='0.5' y='0.5' width='${rectWidth}' height='${rectHeight}'/>
            </g>
            <g style='isolation: isolate'>
                <!-- Error lable -->
                <g transform='translate(${centerOffset}, ${errorLabelOffset})'>
                    <text x='0' y='50' dy='0.25em' stroke-width='0' text-anchor='middle' fill='${theme.sideLabels}' stroke='none' font-family='"Segoe UI", Ubuntu, sans-serif' font-weight='400' font-size='14px' font-style='normal'>
                        ${message}
                    </text>
                </g>

                <!-- Mask for background behind face -->
                <defs>
                    <mask id='cut-off-area'>
                        <rect x='0' y='0' width='500' height='500' fill='white' />
                        <ellipse cx='${centerOffset}' cy='31' rx='13' ry='18'/>
                    </mask>
                </defs>
                <!-- Sad face -->
                <g transform='translate(${centerOffset}, ${heightOffset})'>
                    <path fill='${theme.fire}' d='M0,35.8c-25.2,0-45.7,20.5-45.7,45.7s20.5,45.8,45.7,45.8s45.7-20.5,45.7-45.7S25.2,35.8,0,35.8z M0,122.3c-11.2,0-21.4-4.5-28.8-11.9c-2.9-2.9-5.4-6.3-7.4-10c-3-5.7-4.6-12.1-4.6-18.9c0-22.5,18.3-40.8,40.8-40.8 c10.7,0,20.4,4.1,27.7,10.9c3.8,3.5,6.9,7.7,9.1,12.4c2.6,5.3,4,11.3,4,17.6C40.8,104.1,22.5,122.3,0,122.3z'/>
                    <path fill='${theme.fire}' d='M4.8,93.8c5.4,1.1,10.3,4.2,13.7,8.6l3.9-3c-4.1-5.3-10-9-16.6-10.4c-10.6-2.2-21.7,1.9-28.3,10.4l3.9,3 C-13.1,95.3-3.9,91.9,4.8,93.8z'/>
                    <circle fill='${theme.fire}' cx='-15' cy='71' r='4.9'/>
                    <circle fill='${theme.fire}' cx='15' cy='71' r='4.9'/>
                </g>
            </g>
        </g>
    </svg>
`;
};

/**
 * Remove animations so the card renders statically.
 *
 * @param {string} svg SVG.
 * @returns {string} SVG without animations.
 */
const removeAnimations = (svg) =>
  svg
    .replace(/<style>[\s\S]*?<\/style>/g, "")
    .replace(/opacity: 0;/g, "opacity: 1;")
    .replace(/animation: fadein[^;'"]+/g, "opacity: 1;")
    .replace(/animation: currstreak[^;'"]+/g, "font-size: 28px;")
    .replace(/<a [\s\S]*?>([\s\S]*?)<\/a>/g, "$1");

/**
 * Convert 4/8-digit hex colors (and "transparent") to 6-digit hex + opacity
 * attributes, since some renderers don't support alpha hex colors.
 *
 * @param {string} svg SVG.
 * @returns {string} SVG with converted colors.
 */
const convertHexColors = (svg) =>
  svg
    .replace(/(fill|stroke)=['"]transparent['"]/g, '$1="#0000"')
    .replace(
      /(fill|stroke|stop-color)=['"]#([0-9a-fA-F]{4}|[0-9a-fA-F]{8})['"]/g,
      (_, attribute, hex) => {
        const full =
          hex.length === 4
            ? hex
                .split("")
                .map((/** @type {string} */ c) => c + c)
                .join("")
            : hex;
        const opacityAttribute =
          attribute === "stop-color" ? "stop-opacity" : `${attribute}-opacity`;
        const opacity = phpFloat(parseInt(full.slice(6, 8), 16) / 255);
        return `${attribute}='#${full.slice(0, 6)}' ${opacityAttribute}='${opacity}'`;
      },
    );

/**
 * Final SVG output: convert alpha colors and optionally strip animations.
 *
 * @param {string} svg SVG.
 * @param {StreakParams} params Request parameters.
 * @returns {string} SVG.
 */
const finalizeSvg = (svg, params = {}) => {
  const converted = convertHexColors(svg);
  return params.disable_animations === "true"
    ? removeAnimations(converted)
    : converted;
};

export {
  renderStreakCard,
  renderStreakError,
  finalizeSvg,
  formatDate,
  formatNumber,
  getRequestedTheme,
  getTranslations,
  normalizeLocaleCode,
  removeAnimations,
  convertHexColors,
  splitLines,
  translateDays,
};
