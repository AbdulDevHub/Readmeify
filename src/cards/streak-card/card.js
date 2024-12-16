import { themes } from './themes.js';
import { colors } from './colors.js';
import { DateTime } from 'luxon';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Convert date from Y-M-D to more human-readable format
 * @param {string} dateString - String in Y-M-D format
 * @param {string|null} format - Date format to use, or null to use locale default
 * @param {string} locale - Locale code
 * @returns {string} Formatted Date string
 */
function formatDate(dateString, format, locale) {
    const date = DateTime.fromISO(dateString);
    const currentYear = DateTime.now().year;
    
    if (date.year === currentYear) {
        if (format) {
            // Remove brackets and all text within them
            return date.toFormat(format.replace(/\[.*?\]/g, ''));
        }
        return date.setLocale(locale).toLocaleString({ month: 'short', day: 'numeric' });
    }
    
    if (format) {
        // Remove brackets but leave text within them
        return date.toFormat(format.replace(/[\[\]]/g, ''));
    }
    return date.setLocale(locale).toLocaleString({ year: 'numeric', month: 'short', day: 'numeric' });
}

/**
 * Translate days of the week
 *
 * Takes a list of days (eg. ["Sun", "Mon", "Sat"]) and returns the short abbreviation of the days of the week in another locale
 * e.g. ["Sun", "Mon", "Sat"] -> ["dim", "lun", "sam"]
 *
 * @param {string[]} days - List of days to translate
 * @param {string} locale - Locale code
 * @returns {string[]} List of normalized days of the week
 */
function translateDays(days, locale) {
    if (locale === "en") return days;
    
    return days.map(day => {
        const date = DateTime.fromFormat(day, 'EEE').setLocale(locale);
        return date.toFormat('EEE');
    });
}

/**
 * Get the excluding days text
 * @param {string[]} excludedDays - List of excluded days
 * @param {Object} localeTranslations - Translations for the locale
 * @param {string} localeCode - Locale code
 * @returns {string} Excluding days text
 */
function getExcludingDaysText(excludedDays, localeTranslations, localeCode) {
    const separator = localeTranslations.comma_separator || ", ";
    const daysCommaSeparated = translateDays(excludedDays, localeCode).join(separator);
    return localeTranslations["Excluding {days}"].replace("{days}", daysCommaSeparated);
}

/**
 * Normalize a theme name
 * @param {string} theme - Theme name
 * @returns {string} Normalized theme name
 */
function normalizeThemeName(theme) {
    return (theme || "").toLowerCase().replace(/_/g, "-");
}

/**
 * Check theme and color customization parameters to generate a theme mapping
 * @param {Object} params - Request parameters
 * @returns {Object} The chosen theme or default
 */
function getRequestedTheme(params = {}) {
    const selectedTheme = normalizeThemeName(params.theme || "default");
    const theme = themes[selectedTheme] || themes.default;
    const result = { ...theme };

    // Personal theme customizations
    Object.keys(theme).forEach(prop => {
        if (params[prop]) {
            const param = params[prop].toLowerCase();
            if (/^([a-f0-9]{3}|[a-f0-9]{4}|[a-f0-9]{6}|[a-f0-9]{8})$/.test(param)) {
                result[prop] = "#" + param;
            } else if (colors.includes(param)) {
                result[prop] = param;
            } else if (prop === "background" && 
                      /^-?[0-9]+,[a-f0-9]{3,8}(,[a-f0-9]{3,8})+$/.test(param)) {
                result[prop] = param;
            }
        }
    });

    // Hide borders
    if (params.hide_border === "true") {
        result.border = "#0000";
    }

    // Set background gradient
    let gradient = "";
    const backgroundParts = (result.background || "").split(",");
    if (backgroundParts.length >= 3) {
        result.background = "url(#gradient)";
        gradient = `<linearGradient id='gradient' gradientTransform='rotate(${backgroundParts[0]})' gradientUnits='userSpaceOnUse'>`;
        const backgroundColors = backgroundParts.slice(1);
        const colorCount = backgroundColors.length;
        backgroundColors.forEach((color, index) => {
            const offset = (index * 100) / (colorCount - 1);
            gradient += `<stop offset='${offset}%' stop-color='#${color}' />`;
        });
        gradient += "</linearGradient>";
    }
    result.backgroundGradient = gradient;

    return result;
}

/**
 * Wraps a string to a given number of characters
 *
 * Similar to `wordwrap()`, but uses regex and does not break with certain non-ascii characters
 *
 * @param {string} string - The input string
 * @param {number} width - The number of characters at which the string will be wrapped
 * @param {boolean} cutLongWords - The line is broken using the optional `break` parameter
 * @param bool $cut_long_words If the `cut_long_words` parameter is set to true, the string is
 *              the string is always wrapped at or before the specified width. So if you have
 *              a word that is larger than the given width, it is broken apart.
 *              When false the function does not split the word even if the width is smaller
 *              than the word width.
 * @returns {string} The given string wrapped at the specified length
 */
function utf8WordWrap(string, width = 75, break_ = "\n", cutLongWords = false) {
    // Match anything 1 to width chars long followed by whitespace or EOS
    let result = string.replace(
        new RegExp(`(.{1,${width}})(?:\\s|$)`, 'gu'),
        `$1${break_}`
    );

    // Split words that are too long after being broken up
    if (cutLongWords) {
        result = result.replace(
            new RegExp(`(\\S{${width}})(?=\\S)`, 'gu'),
            `$1${break_}`
        );
    }

    // Trim any trailing line breaks
    return result.replace(new RegExp(`${break_}$`), '');
}

/**
 * Get the length of a string with utf8 characters
 * @param {string} string - The input string
 * @returns {number} The length of the string
 */
function utf8Strlen(string) {
    return [...string].length;
}

/**
 * Split lines of text using <tspan> elements
 * @param {string} text - Text to split
 * @param {number} maxChars - Maximum number of characters per line
 * @param {number} line1Offset - Offset for the first line
 * @returns {string} Original text if one line, or split text with <tspan> elements
 */
function splitLines(text, maxChars, line1Offset) {
    // If too many characters, insert \n before a " " or "-" if possible
    if (maxChars > 0 && utf8Strlen(text) > maxChars && !text.includes("\n")) {
        if (text.includes(" - ")) {
            text = text.replace(" - ", "\n- ");
        } else {
            text = utf8WordWrap(text, maxChars, "\n", true);
        }
    }
    text = text.replace(/[&<>"']/g, char => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    }[char]));

    return text.replace(
        /^(.*)\n(.*)/,
        `<tspan x='0' dy='${line1Offset}'>$1</tspan><tspan x='0' dy='16'>$2</tspan>`
    );
}

/**
 * Normalize a locale code
 * @param {string} localeCode - Locale code
 * @returns {string} Normalized locale code
 */
function normalizeLocaleCode(localeCode) {
    const matches = localeCode.match(/^([a-z]{2,3})(?:[_-]([a-z]{4}))?(?:[_-]([0-9]{3}|[a-z]{2}))?$/i);
    
    if (!matches) {
        return "en";
    }

    const language = matches[1].toLowerCase();
    const script = matches[2] ? 
                  matches[2].charAt(0).toUpperCase() + matches[2].slice(1).toLowerCase() : 
                  "";
    const region = matches[3] ? matches[3].toUpperCase() : "";

    return [language, script, region].filter(Boolean).join("_");
}

/**
 * Get the translations for a locale code
 * @param {string} localeCode - Locale code
 * @returns {Object} Translations for the locale code
 */
function getTranslations(localeCode) {
    localeCode = normalizeLocaleCode(localeCode);
    
    // Get translations from imported translations file
    const translations = require('./translations.js');
    
    // If locale doesn't exist, try without script and region
    if (!translations[localeCode]) {
        localeCode = localeCode.split("_")[0];
    }

    let localeTranslations = translations[localeCode] || {};

    // Handle aliases
    if (typeof localeTranslations === "string") {
        localeTranslations = translations[localeTranslations];
    }

    // Fill in missing translations with English
    return { ...translations.en, ...localeTranslations };
}

/**
 * Get the card width from params taking into account minimum and default values
 * @param {Object} params - Request parameters
 * @param {number} numColumns - Number of columns in the card
 * @returns {number} Card width
 */
function getCardWidth(params = {}, numColumns = 3) {
    const defaultWidth = 495;
    const minimumWidth = 100 * numColumns;
    return Math.max(minimumWidth, parseInt(params.card_width || defaultWidth));
}

/**
 * Get the card height from params taking into account minimum and default values
 * @param {Object} params - Request parameters
 * @returns {number} Card height
 */
function getCardHeight(params = {}) {
    const defaultHeight = 195;
    const minimumHeight = 170;
    return Math.max(minimumHeight, parseInt(params.card_height || defaultHeight));
}

/**
 * Generate SVG output for a stats array
 * @param {Object} stats - Streak stats
 * @param {Object} params - Request parameters
 * @returns {string} The generated SVG Streak Stats card
 */
function generateCard(stats, params = {}) {
    // Get requested theme
    const theme = getRequestedTheme(params);

    // Get requested locale, default to English
    const localeCode = params.locale || "en";
    const localeTranslations = getTranslations(localeCode);

    // Whether the locale is right-to-left
    const direction = localeTranslations.rtl ? "rtl" : "ltr";

    // Get date format
    const dateFormat = params.date_format || localeTranslations.date_format || null;

    // Number formatter
    const numFormatter = new Intl.NumberFormat(localeCode);

    // Read border_radius parameter, default to 4.5 if not set
    const borderRadius = params.border_radius || 4.5;

    // Display settings
    const showTotalContributions = (params.hide_total_contributions || "") !== "true";
    const showCurrentStreak = (params.hide_current_streak || "") !== "true";
    const showLongestStreak = (params.hide_longest_streak || "") !== "true";
    const numColumns = Number(showTotalContributions) + Number(showCurrentStreak) + Number(showLongestStreak);

    // Calculate dimensions
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

    // Offsets for the text in each column
    let columnOffsets = [];
    for (let i = 0; i < numColumns; i++) {
        columnOffsets.push(columnWidth / 2 + columnWidth * i);
    }

    // Reverse the column offsets if the locale is right-to-left
    if (direction === "rtl") {
        columnOffsets = columnOffsets.reverse();
    }

    let nextColumnIndex = 0;
    const totalContributionsOffset = showTotalContributions ? columnOffsets[nextColumnIndex++] : -999;
    const currentStreakOffset = showCurrentStreak ? columnOffsets[nextColumnIndex++] : -999;
    const longestStreakOffset = showLongestStreak ? columnOffsets[nextColumnIndex++] : -999;

    // Y offsets for the bars
    const barHeightOffsets = [28 + heightOffset / 2, 170 + heightOffset];

    // Y offsets for the numbers and dates
    const totalContributionsHeightOffset = [
        48 + heightOffset,
        84 + heightOffset,
        114 + heightOffset,
    ];
    const longestStreakHeightOffset = [...totalContributionsHeightOffset];
    const currentStreakHeightOffset = [
        48 + heightOffset,
        108 + heightOffset,
        145 + heightOffset,
        71 + heightOffset,
        19.5 + heightOffset,
    ];

    // Format total contributions
    const totalContributions = numFormatter.format(stats.totalContributions);
    const firstContribution = formatDate(stats.firstContribution, dateFormat, localeCode);
    const totalContributionsRange = `${firstContribution} - ${localeTranslations.Present}`;

    // Format current streak
    const currentStreak = numFormatter.format(stats.currentStreak.length);
    const currentStreakStart = formatDate(stats.currentStreak.start, dateFormat, localeCode);
    const currentStreakEnd = formatDate(stats.currentStreak.end, dateFormat, localeCode);
    let currentStreakRange = currentStreakStart;
    if (currentStreakStart !== currentStreakEnd) {
        currentStreakRange += ` - ${currentStreakEnd}`;
    }

    // Format longest streak
    const longestStreak = numFormatter.format(stats.longestStreak.length);
    const longestStreakStart = formatDate(stats.longestStreak.start, dateFormat, localeCode);
    const longestStreakEnd = formatDate(stats.longestStreak.end, dateFormat, localeCode);
    let longestStreakRange = longestStreakStart;
    if (longestStreakStart !== longestStreakEnd) {
        longestStreakRange += ` - ${longestStreakEnd}`;
    }

    // Calculate max characters per line and split text if needed
    const maxCharsPerLineLabels = numColumns > 0 ? Math.floor(cardWidth / numColumns / 7.5) : 0;
    const totalContributionsText = splitLines(localeTranslations["Total Contributions"], maxCharsPerLineLabels, -9);
    
    const currentStreakText = splitLines(
        stats.mode === "weekly" ? localeTranslations["Week Streak"] : localeTranslations["Current Streak"],
        maxCharsPerLineLabels,
        -9
    );
    
    const longestStreakText = splitLines(
        stats.mode === "weekly" ? localeTranslations["Longest Week Streak"] : localeTranslations["Longest Streak"],
        maxCharsPerLineLabels,
        -9
    );

    // Split date ranges if needed
    const maxCharsPerLineDates = numColumns > 0 ? Math.floor(cardWidth / numColumns / 6) : 0;
    totalContributionsRange = splitLines(totalContributionsRange, maxCharsPerLineDates, 0);
    currentStreakRange = splitLines(currentStreakRange, maxCharsPerLineDates, 0);
    longestStreakRange = splitLines(longestStreakRange, maxCharsPerLineDates, 0);

    // Handle excluded days
    let excludedDays = "";
    if (stats.excludedDays && stats.excludedDays.length > 0) {
        const offset = direction === "rtl" ? cardWidth - 5 : 5;
        const excludingDaysText = getExcludingDaysText(stats.excludedDays, localeTranslations, localeCode);
        excludedDays = `<g style='isolation: isolate'>
            <!-- Excluded Days -->
            <g transform='translate(${offset},187)'>
                <text stroke-width='0' text-anchor='right' fill='${theme.excludeDaysLabel}' stroke='none' 
                      font-family='"Segoe UI", Ubuntu, sans-serif' font-weight='400' font-size='10px' 
                      font-style='normal' style='opacity: 0; animation: fadein 0.5s linear forwards 0.9s'>
                    * ${excludingDaysText}
                </text>
            </g>
        </g>`;
    }

    // Generate the final SVG
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
            ${theme["backgroundGradient"]}
        </defs>
        <g clip-path='url(#outer_rectangle)'>
            <g style='isolation: isolate'>
                <rect stroke='${theme["border"]}' fill='${theme["background"]}' rx='${borderRadius}' x='0.5' y='0.5' width='${rectWidth}' height='${rectHeight}'/>
            </g>
            <g style='isolation: isolate'>
                <line x1='${barOffsets[0]}' y1='${barHeightOffsets[0]}' x2='${barOffsets[0]}' y2='${barHeightOffsets[1]}' vector-effect='non-scaling-stroke' stroke-width='1' stroke='${theme["stroke"]}' stroke-linejoin='miter' stroke-linecap='square' stroke-miterlimit='3'/>
                <line x1='${barOffsets[1]}' y1='$barHeightOffsets[0]' x2='${barOffsets[1]}' y2='$barHeightOffsets[1]' vector-effect='non-scaling-stroke' stroke-width='1' stroke='${theme["stroke"]}' stroke-linejoin='miter' stroke-linecap='square' stroke-miterlimit='3'/>
            </g>
            <g style='isolation: isolate'>
                <!-- Total Contributions big number -->
                <g transform='translate(${totalContributionsOffset}, ${totalContributionsHeightOffset[0]})'>
                    <text x='0' y='32' stroke-width='0' text-anchor='middle' fill='${theme["sideNums"]}' stroke='none' font-family='\"Segoe UI\", Ubuntu, sans-serif' font-weight='700' font-size='28px' font-style='normal' style='opacity: 0; animation: fadein 0.5s linear forwards 0.6s'>
                        ${totalContributions}
                    </text>
                </g>

                <!-- Total Contributions label -->
                <g transform='translate(${totalContributionsOffset}, ${totalContributionsHeightOffset[1]})'>
                    <text x='0' y='32' stroke-width='0' text-anchor='middle' fill='${theme["sideLabels"]}' stroke='none' font-family='\"Segoe UI\", Ubuntu, sans-serif' font-weight='400' font-size='14px' font-style='normal' style='opacity: 0; animation: fadein 0.5s linear forwards 0.7s'>
                        ${totalContributionsText}
                    </text>
                </g>

                <!-- Total Contributions range -->
                <g transform='translate(${totalContributionsOffset}, ${totalContributionsHeightOffset[2]})'>
                    <text x='0' y='32' stroke-width='0' text-anchor='middle' fill='${theme["dates"]}' stroke='none' font-family='\"Segoe UI\", Ubuntu, sans-serif' font-weight='400' font-size='12px' font-style='normal' style='opacity: 0; animation: fadein 0.5s linear forwards 0.8s'>
                        ${totalContributionsRange}
                    </text>
                </g>
            </g>
            <g style='isolation: isolate'>
                <!-- Current Streak big number -->
                <g transform='translate(${currentStreakOffset}, ${currentStreakHeightOffset[0]})'>
                    <text x='0' y='32' stroke-width='0' text-anchor='middle' fill='${theme["currStreakNum"]}' stroke='none' font-family='\"Segoe UI\", Ubuntu, sans-serif' font-weight='700' font-size='28px' font-style='normal' style='animation: currstreak 0.6s linear forwards'>
                        ${currentStreak}
                    </text>
                </g>

                <!-- Current Streak label -->
                <g transform='translate(${currentStreakOffset}, ${currentStreakHeightOffset[1]})'>
                    <text x='0' y='32' stroke-width='0' text-anchor='middle' fill='${theme["currStreakLabel"]}' stroke='none' font-family='\"Segoe UI\", Ubuntu, sans-serif' font-weight='700' font-size='14px' font-style='normal' style='opacity: 0; animation: fadein 0.5s linear forwards 0.9s'>
                        ${currentStreakText}
                    </text>
                </g>

                <!-- Current Streak range -->
                <g transform='translate(${currentStreakOffset}, ${currentStreakHeightOffset[2]})'>
                    <text x='0' y='21' stroke-width='0' text-anchor='middle' fill='${theme["dates"]}' stroke='none' font-family='\"Segoe UI\", Ubuntu, sans-serif' font-weight='400' font-size='12px' font-style='normal' style='opacity: 0; animation: fadein 0.5s linear forwards 0.9s'>
                        ${currentStreakRange}
                    </text>
                </g>

                <!-- Ring around number -->
                <g mask='url(#mask_out_ring_behind_fire)'>
                    <circle cx='${currentStreakOffset}' cy='${currentStreakHeightOffset[3]}' r='40' fill='none' stroke='${theme["ring"]}' stroke-width='5' style='opacity: 0; animation: fadein 0.5s linear forwards 0.4s'></circle>
                </g>

                <!-- Fire icon -->
                <g transform='translate(${currentStreakOffset}, ${currentStreakHeightOffset[4]})' stroke-opacity='0' style='opacity: 0; animation: fadein 0.5s linear forwards 0.6s'>
                    <path d='M -12 -0.5 L 15 -0.5 L 15 23.5 L -12 23.5 L -12 -0.5 Z' fill='none'/>
                    <path d='M 1.5 0.67 C 1.5 0.67 2.24 3.32 2.24 5.47 C 2.24 7.53 0.89 9.2 -1.17 9.2 C -3.23 9.2 -4.79 7.53 -4.79 5.47 L -4.76 5.11 C -6.78 7.51 -8 10.62 -8 13.99 C -8 18.41 -4.42 22 0 22 C 4.42 22 8 18.41 8 13.99 C 8 8.6 5.41 3.79 1.5 0.67 Z M -0.29 19 C -2.07 19 -3.51 17.6 -3.51 15.86 C -3.51 14.24 -2.46 13.1 -0.7 12.74 C 1.07 12.38 2.9 11.53 3.92 10.16 C 4.31 11.45 4.51 12.81 4.51 14.2 C 4.51 16.85 2.36 19 -0.29 19 Z' fill='${theme["fire"]}' stroke-opacity='0'/>
                </g>

            </g>
            <g style='isolation: isolate'>
                <!-- Longest Streak big number -->
                <g transform='translate(${longestStreakOffset}, ${longestStreakHeightOffset[0]})'>
                    <text x='0' y='32' stroke-width='0' text-anchor='middle' fill='${theme["sideNums"]}' stroke='none' font-family='\"Segoe UI\", Ubuntu, sans-serif' font-weight='700' font-size='28px' font-style='normal' style='opacity: 0; animation: fadein 0.5s linear forwards 1.2s'>
                        ${longestStreak}
                    </text>
                </g>

                <!-- Longest Streak label -->
                <g transform='translate(${longestStreakOffset}, ${longestStreakHeightOffset[1]})'>
                    <text x='0' y='32' stroke-width='0' text-anchor='middle' fill='${theme["sideLabels"]}' stroke='none' font-family='\"Segoe UI\", Ubuntu, sans-serif' font-weight='400' font-size='14px' font-style='normal' style='opacity: 0; animation: fadein 0.5s linear forwards 1.3s'>
                        ${longestStreakText}
                    </text>
                </g>

                <!-- Longest Streak range -->
                <g transform='translate(${longestStreakOffset}, ${longestStreakHeightOffset[2]})'>
                    <text x='0' y='32' stroke-width='0' text-anchor='middle' fill='${theme["dates"]}' stroke='none' font-family='\"Segoe UI\", Ubuntu, sans-serif' font-weight='400' font-size='12px' font-style='normal' style='opacity: 0; animation: fadein 0.5s linear forwards 1.4s'>
                        ${longestStreakRange}
                    </text>
                </g>
            </g>
            ${excludedDays}
        </g>
    </svg>
`;
}

/**
 * Generate SVG displaying an error message
 * @param {string} message - The error message to display
 * @param {Object} params - Request parameters
 * @returns {string} The generated SVG error card
 */
function generateErrorCard(message, params = {}) {
    const theme = getRequestedTheme(params);
    const borderRadius = params.border_radius || 4.5;
    const cardWidth = getCardWidth(params);
    const rectWidth = cardWidth - 1;
    const centerOffset = cardWidth / 2;
    const cardHeight = getCardHeight(params);
    const rectHeight = cardHeight - 1;
    const heightOffset = (cardHeight - 195) / 2;
    const errorLabelOffset = cardHeight / 2 + 10.5;

    return `<svg xmlns='http://www.w3.org/2000/svg' xmlns:xlink='http://www.w3.org/1999/xlink' 
                style='isolation: isolate' viewBox='0 0 ${cardWidth} ${cardHeight}' 
                width='${cardWidth}px' height='${cardHeight}px'>
        <style>
            a { fill: ${theme.dates}; }
        </style>
        <defs>
            <clipPath id='outer_rectangle'>
                <rect width='${cardWidth}' height='${cardHeight}' rx='${borderRadius}'/>
            </clipPath>
            ${theme.backgroundGradient}
        </defs>
        <g clip-path='url(#outer_rectangle)'>
            <g style='isolation: isolate'>
                <rect stroke='${theme.border}' fill='${theme.background}' rx='${borderRadius}' 
                      x='0.5' y='0.5' width='${rectWidth}' height='${rectHeight}'/>
            </g>
            <g style='isolation: isolate'>
                <g transform='translate(${centerOffset}, ${errorLabelOffset})'>
                    <text x='0' y='50' dy='0.25em' stroke-width='0' text-anchor='middle' 
                          fill='${theme.sideLabels}' stroke='none' 
                          font-family='"Segoe UI", Ubuntu, sans-serif' 
                          font-weight='400' font-size='14px' font-style='normal'>
                        ${message}
                    </text>
                </g>
                <!-- Sad face -->
                <defs>
                    <mask id='cut-off-area'>
                        <rect x='0' y='0' width='500' height='500' fill='white' />
                        <ellipse cx='${centerOffset}' cy='31' rx='13' ry='18'/>
                    </mask>
                </defs>
                <g transform='translate(${centerOffset}, ${heightOffset})'>
                    <path fill='${theme.fire}' d='M0,35.8c-25.2,0-45.7,20.5-45.7,45.7s20.5,45.8,45.7,45.8s45.7-20.5,45.7-45.7S25.2,35.8,0,35.8z M0,122.3c-11.2,0-21.4-4.5-28.8-11.9c-2.9-2.9-5.4-6.3-7.4-10c-3-5.7-4.6-12.1-4.6-18.9c0-22.5,18.3-40.8,40.8-40.8 c10.7,0,20.4,4.1,27.7,10.9c3.8,3.5,6.9,7.7,9.1,12.4c2.6,5.3,4,11.3,4,17.6C40.8,104.1,22.5,122.3,0,122.3z'/>
                    <path fill='${theme.fire}' d='M4.8,93.8c5.4,1.1,10.3,4.2,13.7,8.6l3.9-3c-4.1-5.3-10-9-16.6-10.4c-10.6-2.2-21.7,1.9-28.3,10.4l3.9,3 C-13.1,95.3-3.9,91.9,4.8,93.8z'/>
                    <circle fill='${theme.fire}' cx='-15' cy='71' r='4.9'/>
                    <circle fill='${theme.fire}' cx='15' cy='71' r='4.9'/>
                </g>
            </g>
        </g>
    </svg>`;
}

/**
 * Remove animations from SVG
 * @param {string} svg - The SVG for the card as a string
 * @returns {string} The SVG without animations
 */
function removeAnimations(svg) {
    return svg
        .replace(/(<style>\X*?<\/style>)/m, '')
        .replace(/(opacity: 0;)/g, 'opacity: 1;')
        .replace(/(animation: fadein[^;'"]+)/g, 'opacity: 1;')
        .replace(/(animation: currstreak[^;'"]+)/g, 'font-size: 28px;')
        .replace(/<a \X*?>(\X*?)<\/a>/g, '$1');
}

/**
 * Convert a color from hex 3/4/6/8 digits to hex 6 digits and opacity
 * @param {string} color - The color to convert
 * @returns {Object} The converted color and opacity
 */
function convertHexColor(color) {
    color = color.replace(/[^0-9a-fA-F]/g, '');

    // Double each character if the color is in 3/4 digit format
    if (color.length === 3) {
        color = color.split('').map(c => c + c).join('');
    } else if (color.length === 4) {
        color = color.split('').map(c => c + c).join('');
    }

    // Convert to 6 digit hex and opacity
    if (color.length === 6) {
        return {
            color: `#${color}`,
            opacity: 1
        };
    } else if (color.length === 8) {
        return {
            color: `#${color.slice(0, 6)}`,
            opacity: parseInt(color.slice(6, 8), 16) / 255
        };
    }
    
    throw new Error(`Invalid color: ${color}`);
}


/**
 * Convert transparent hex colors in an SVG to hex 6 digits and opacity
 * @param {string} svg - The SVG string
 * @returns {string} The SVG with converted colors
 */
function convertHexColors(svg) {
    // Convert "transparent" to "#0000"
    svg = svg.replace(
        /(fill|stroke)=['"]transparent['"]/g,
        '$1="#0000"'
    );

    // Convert hex colors to 6 digits and corresponding opacity attribute
    svg = svg.replace(
        /(fill|stroke|stop-color)=['"]#([0-9a-fA-F]{4}|[0-9a-fA-F]{8})['"]/g,
        (match, attribute, color) => {
            const opacityAttribute = attribute === "stop-color" ? 
                                   "stop-opacity" : 
                                   `${attribute}-opacity`;
            const result = convertHexColor(color);
            return `${attribute}='${result.color}' ${opacityAttribute}='${result.opacity}'`;
        }
    );

    return svg;
}

/**
 * Converts an SVG card to a PNG image
 * @param {string} svg - The SVG for the card as a string
 * @param {number} cardWidth - The width of the card
 * @param {number} cardHeight - The height of the card
 * @returns {Promise<Buffer>} The generated PNG data
 * @throws {Error} If conversion fails
 */
async function convertSvgToPng(svg, cardWidth, cardHeight) {
    // Trim whitespaces to make a valid SVG string
    svg = svg.trim();

    // Remove style and animations
    svg = removeAnimations(svg);

    // Replace newlines with spaces
    svg = svg.replace(/\n/g, ' ');

    // Escape svg for shell
    svg = svg.replace(/'/g, "'\\''");
    svg = `'${svg}'`;

    // Build the inkscape command
    const cmd = `echo ${svg} | inkscape --pipe --export-filename - -w ${cardWidth} -h ${cardHeight} --export-type png`;

    try {
        // Convert svg to png
        const { stdout, stderr } = await execAsync(cmd);
        
        if (!stdout) {
            throw new Error(`Failed to convert SVG to PNG: ${stderr}`);
        }

        return Buffer.from(stdout, 'binary');
    } catch (error) {
        throw new Error(`Failed to convert SVG to PNG: ${error.message}`);
    }
}

/**
 * Generate Response for the request
 * @param {string|Object} output - The stats object or error message
 * @param {Object} params - Request parameters
 * @returns {Object} Response object with content type and body
 */
export function generateOutput(output, params = {}) {
    const requestedType = params.type || "svg";

    if (requestedType === "json") {
        const data = typeof output === "string" ? { error: output } : output;
        return {
            contentType: "application/json",
            body: JSON.stringify(data)
        };
    }

    const svg = typeof output === "string" ? 
                generateErrorCard(output, params) : 
                generateCard(output, params);

    if (params.disable_animations === "true") {
        return {
            contentType: "image/svg+xml",
            body: removeAnimations(svg)
        };
    }

    return {
        contentType: "image/svg+xml",
        body: svg
    };
}

/**
 * Set headers and output response
 * @param {string|Object} output - The stats object or error message
 * @param {number} responseCode - The HTTP response code
 * @returns {Object} Response object with status, headers and body
 */
export function renderOutput(output, responseCode = 200) {
    const response = generateOutput(output);
    return {
        status: response.status || responseCode,
        headers: {
            "Content-Type": response.contentType
        },
        body: response.body
    };
}
