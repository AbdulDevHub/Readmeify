// @ts-check

import { CustomError, MissingParamError } from "../common/error.js";
import { request } from "../common/http.js";
import { logger } from "../common/log.js";
import { retryer } from "../common/retryer.js";

/**
 * Ported from DenverCoder1/github-readme-streak-stats (api/stats.php).
 */

const QUERY = `
  query streak($login: String!, $from: DateTime!, $to: DateTime!) {
    user(login: $login) {
      createdAt
      contributionsCollection(from: $from, to: $to) {
        contributionYears
        contributionCalendar {
          weeks {
            contributionDays {
              contributionCount
              date
            }
          }
        }
      }
    }
  }
`;

/** Earliest year to request by default (the year Git was created). */
const GIT_CREATED_YEAR = 2005;

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/**
 * GraphQL fetcher for one year of a user's contribution calendar.
 *
 * @param {{ login: string, year: number }} variables Fetcher variables.
 * @param {string} token GitHub token.
 * @returns {Promise<import("axios").AxiosResponse>} Response.
 */
const fetcher = ({ login, year }, token) => {
  return request(
    {
      query: QUERY,
      variables: {
        login,
        from: `${year}-01-01T00:00:00Z`,
        to: `${year}-12-31T23:59:59Z`,
      },
    },
    {
      Authorization: `bearer ${token}`,
    },
  );
};

/**
 * Fetch one year of contributions, retrying once on a bad response.
 *
 * @param {string} login GitHub username.
 * @param {number} year Year to fetch.
 * @returns {Promise<any|null>} GraphQL response body, or null if it failed twice.
 */
const fetchYear = async (login, year) => {
  for (let attempt = 1; attempt <= 2; attempt++) {
    const res = await retryer(fetcher, { login, year });
    const body = res?.data;
    const errors = body?.errors;
    if (errors?.[0]?.type === "NOT_FOUND") {
      throw new CustomError(
        "Could not find a user with that name.",
        CustomError.USER_NOT_FOUND,
      );
    }
    if (body?.data?.user && !errors) {
      return body;
    }
    logger.error(
      `Attempt ${attempt} to fetch ${login}'s ${year} contributions failed.`,
      errors?.[0]?.message || body?.message || "",
    );
  }
  return null;
};

/**
 * Format a Date as a Y-m-d string in UTC.
 *
 * @param {Date} date Date.
 * @returns {string} Y-m-d string.
 */
const toYmd = (date) => date.toISOString().slice(0, 10);

/**
 * Get all contribution graph responses for a user, keyed by year.
 *
 * @param {string} login GitHub username.
 * @param {number|null=} startingYear Override the first year to fetch.
 * @param {Date=} now Current time (for tests).
 * @returns {Promise<Record<number, any>>} Responses keyed by year.
 */
const getContributionGraphs = async (
  login,
  startingYear = null,
  now = new Date(),
) => {
  const currentYear = now.getUTCFullYear();
  const current = await fetchYear(login, currentYear);
  const createdAt = current?.data?.user?.createdAt;
  if (!createdAt) {
    throw new CustomError(
      "Failed to retrieve contributions. This is likely a GitHub API issue.",
      CustomError.GRAPHQL_ERROR,
    );
  }

  const createdYear = parseInt(createdAt.split("-")[0], 10);
  const minimumYear = Math.max(startingYear || createdYear, GIT_CREATED_YEAR);
  const years = [];
  for (let year = minimumYear; year < currentYear; year++) {
    years.push(year);
  }

  // Users may have backdated commits to a year before Git existed (e.g. 1970).
  const contributionYears =
    current.data.user.contributionsCollection?.contributionYears || [];
  const firstContributionYear =
    contributionYears[contributionYears.length - 1] ?? createdYear;
  if (firstContributionYear < GIT_CREATED_YEAR) {
    years.unshift(firstContributionYear);
  }

  /** @type {Record<number, any>} */
  const responses = { [currentYear]: current };
  const previous = await Promise.all(years.map((y) => fetchYear(login, y)));
  previous.forEach((res, i) => {
    // A missing year would give wrong streaks that get cached for hours, so
    // fail instead (error cards are only cached briefly).
    if (!res) {
      throw new CustomError(
        `Failed to retrieve ${years[i]} contributions. This is likely a GitHub API issue.`,
        CustomError.GRAPHQL_ERROR,
      );
    }
    responses[years[i]] = res;
  });
  return responses;
};

/**
 * Flatten contribution graphs into a sorted map of Y-m-d dates to counts.
 *
 * @param {Record<number, any>} graphs Responses keyed by year.
 * @param {Date=} now Current time (for tests).
 * @returns {Record<string, number>} Dates mapped to contribution counts, in date order.
 */
const getContributionDates = (graphs, now = new Date()) => {
  const today = toYmd(now);
  const tomorrow = toYmd(new Date(now.getTime() + 24 * 60 * 60 * 1000));
  const days = [];
  const years = Object.keys(graphs)
    .map(Number)
    .sort((a, b) => a - b);
  for (const year of years) {
    const weeks =
      graphs[year].data.user.contributionsCollection.contributionCalendar.weeks;
    for (const week of weeks) {
      for (const { date, contributionCount } of week.contributionDays) {
        // count up until today, plus tomorrow if the user already contributed
        if (date <= today || (date === tomorrow && contributionCount > 0)) {
          days.push([date, contributionCount]);
        }
      }
    }
  }
  days.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  return Object.fromEntries(days);
};

/**
 * Normalize day names, e.g. ["Sunday", " mon", "TUE"] -> ["Sun", "Mon", "Tue"].
 *
 * @param {string[]} days Day names.
 * @returns {string[]} Valid, normalized 3-letter day names.
 */
const normalizeDays = (days) => {
  return days
    .map((day) => {
      const lower = day.trim().toLowerCase();
      return (lower.charAt(0).toUpperCase() + lower.slice(1)).slice(0, 3);
    })
    .filter((day) => DAY_NAMES.includes(day));
};

/**
 * Day of week (0 = Sunday) for a Y-m-d string.
 *
 * @param {string} date Y-m-d date.
 * @returns {number} Day of week.
 */
const dayOfWeek = (date) => new Date(`${date}T00:00:00Z`).getUTCDay();

/**
 * Check if a date falls on an excluded day of the week.
 *
 * @param {string} date Y-m-d date.
 * @param {string[]} excludedDays Normalized day names.
 * @returns {boolean} True if excluded.
 */
const isExcludedDay = (date, excludedDays) => {
  return (
    excludedDays.length > 0 && excludedDays.includes(DAY_NAMES[dayOfWeek(date)])
  );
};

/**
 * @typedef {{ start: string, end: string, length: number }} Streak
 * @typedef {{
 *   mode: "daily" | "weekly",
 *   totalContributions: number,
 *   firstContribution: string,
 *   longestStreak: Streak,
 *   currentStreak: Streak,
 *   excludedDays?: string[],
 * }} StreakStats
 */

/**
 * Compute streak stats from a sorted map of keys (days or weeks) to counts.
 *
 * @param {[string, number][]} entries Sorted [key, count] pairs.
 * @param {string} first First key.
 * @param {(key: string, length: number) => boolean} keepsStreak Whether a zero-count key keeps the streak alive.
 * @returns {Omit<StreakStats, "mode" | "firstContribution">} Stats.
 */
const computeStreaks = (entries, first, keepsStreak) => {
  const last = entries[entries.length - 1][0];
  const longest = { start: first, end: first, length: 0 };
  const current = { start: first, end: first, length: 0 };
  let total = 0;
  for (const [key, count] of entries) {
    total += count;
    if (count > 0 || keepsStreak(key, current.length)) {
      current.length++;
      current.end = key;
      if (current.length === 1) {
        current.start = key;
      }
      if (current.length > longest.length) {
        Object.assign(longest, current);
      }
    } else if (key !== last) {
      // reset streak, except for today / this week
      current.length = 0;
      current.start = last;
      current.end = last;
    }
  }
  return {
    totalContributions: total,
    longestStreak: longest,
    currentStreak: current,
  };
};

/**
 * Daily streak stats.
 *
 * @param {Record<string, number>} contributions Sorted dates mapped to counts.
 * @param {string[]} excludedDays Normalized day names that don't break a streak.
 * @returns {StreakStats} Stats.
 */
const getContributionStats = (contributions, excludedDays = []) => {
  const entries = Object.entries(contributions);
  if (!entries.length) {
    throw new CustomError("No contributions found.", CustomError.GRAPHQL_ERROR);
  }
  const firstContribution = entries.find(([, count]) => count > 0)?.[0] || "";
  const streaks = computeStreaks(
    entries,
    entries[0][0],
    (date, length) => length > 0 && isExcludedDay(date, excludedDays),
  );
  return {
    mode: "daily",
    totalContributions: streaks.totalContributions,
    firstContribution,
    longestStreak: streaks.longestStreak,
    currentStreak: streaks.currentStreak,
    excludedDays,
  };
};

/**
 * The Sunday on or before a date.
 *
 * @param {string} date Y-m-d date.
 * @returns {string} Y-m-d of the previous Sunday.
 */
const getPreviousSunday = (date) => {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - d.getUTCDay());
  return toYmd(d);
};

/**
 * Weekly streak stats.
 *
 * @param {Record<string, number>} contributions Sorted dates mapped to counts.
 * @returns {StreakStats} Stats.
 */
const getWeeklyContributionStats = (contributions) => {
  const entries = Object.entries(contributions);
  if (!entries.length) {
    throw new CustomError("No contributions found.", CustomError.GRAPHQL_ERROR);
  }
  /** @type {Map<string, number>} */
  const weeks = new Map();
  let firstContribution = "";
  for (const [date, count] of entries) {
    const week = getPreviousSunday(date);
    weeks.set(week, (weeks.get(week) || 0) + count);
    if (count > 0 && !firstContribution) {
      firstContribution = date;
    }
  }
  const streaks = computeStreaks(
    [...weeks.entries()],
    getPreviousSunday(entries[0][0]),
    () => false,
  );
  return {
    mode: "weekly",
    totalContributions: streaks.totalContributions,
    firstContribution,
    longestStreak: streaks.longestStreak,
    currentStreak: streaks.currentStreak,
  };
};

/**
 * Fetch a user's contributions and compute streak stats.
 *
 * @param {string} username GitHub username.
 * @param {{ mode?: string, excludeDays?: string[], startingYear?: number|null }} options Options.
 * @returns {Promise<StreakStats>} Stats.
 */
const fetchStreak = async (username, options = {}) => {
  if (!username) {
    throw new MissingParamError(["user"]);
  }
  const graphs = await getContributionGraphs(
    username,
    options.startingYear ?? null,
  );
  const contributions = getContributionDates(graphs);
  if (options.mode === "weekly") {
    return getWeeklyContributionStats(contributions);
  }
  return getContributionStats(
    contributions,
    normalizeDays(options.excludeDays || []),
  );
};

export {
  fetchStreak,
  getContributionGraphs,
  getContributionDates,
  normalizeDays,
  isExcludedDay,
  getContributionStats,
  getPreviousSunday,
  getWeeklyContributionStats,
};
export default fetchStreak;
