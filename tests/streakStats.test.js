// @ts-check

import { describe, expect, it } from "@jest/globals";
import {
  getContributionDates,
  getContributionStats,
  getPreviousSunday,
  getWeeklyContributionStats,
  isExcludedDay,
  normalizeDays,
} from "../src/fetchers/streak.js";

/**
 * Build a fake GraphQL response holding the given days.
 *
 * @param {[string, number][]} days [date, count] pairs.
 * @returns {any} Response body.
 */
const graph = (days) => ({
  data: {
    user: {
      contributionsCollection: {
        contributionCalendar: {
          weeks: [
            {
              contributionDays: days.map(([date, contributionCount]) => ({
                date,
                contributionCount,
              })),
            },
          ],
        },
      },
    },
  },
});

describe("daily streak stats", () => {
  it("counts a streak that includes today", () => {
    const stats = getContributionStats({
      "2021-04-15": 5,
      "2021-04-16": 3,
      "2021-04-17": 2,
      "2021-04-18": 7,
    });
    expect(stats).toEqual({
      mode: "daily",
      totalContributions: 17,
      firstContribution: "2021-04-15",
      longestStreak: { start: "2021-04-15", end: "2021-04-18", length: 4 },
      currentStreak: { start: "2021-04-15", end: "2021-04-18", length: 4 },
      excludedDays: [],
    });
  });

  it("keeps the streak alive when today has no contributions yet", () => {
    const stats = getContributionStats({
      "2021-04-15": 5,
      "2021-04-16": 3,
      "2021-04-17": 2,
      "2021-04-18": 0,
    });
    expect(stats.totalContributions).toBe(10);
    expect(stats.currentStreak).toEqual({
      start: "2021-04-15",
      end: "2021-04-17",
      length: 3,
    });
  });

  it("resets the current streak after a missed day", () => {
    const stats = getContributionStats({
      "2021-04-15": 5,
      "2021-04-16": 0,
      "2021-04-17": 2,
      "2021-04-18": 0,
    });
    expect(stats.longestStreak).toEqual({
      start: "2021-04-15",
      end: "2021-04-15",
      length: 1,
    });
    expect(stats.currentStreak).toEqual({
      start: "2021-04-17",
      end: "2021-04-17",
      length: 1,
    });
  });

  it("reports a zero streak that ends today when the user stopped", () => {
    const stats = getContributionStats({
      "2021-04-15": 5,
      "2021-04-16": 0,
      "2021-04-17": 0,
    });
    expect(stats.currentStreak).toEqual({
      start: "2021-04-17",
      end: "2021-04-17",
      length: 0,
    });
    expect(stats.firstContribution).toBe("2021-04-15");
  });

  it("does not break a streak on excluded days", () => {
    // 2023-01-07 is a Saturday, 2023-01-08 a Sunday
    const stats = getContributionStats(
      {
        "2023-01-06": 1,
        "2023-01-07": 0,
        "2023-01-08": 0,
        "2023-01-09": 2,
      },
      ["Sat", "Sun"],
    );
    expect(stats.currentStreak).toEqual({
      start: "2023-01-06",
      end: "2023-01-09",
      length: 4,
    });
    expect(stats.excludedDays).toEqual(["Sat", "Sun"]);
  });

  it("throws when there are no contributions", () => {
    expect(() => getContributionStats({})).toThrow("No contributions found.");
  });
});

describe("weekly streak stats", () => {
  it("groups contributions by week starting Sunday", () => {
    const stats = getWeeklyContributionStats({
      "2023-01-01": 1, // Sun, week of 01-01
      "2023-01-05": 2,
      "2023-01-09": 0, // week of 01-08, no contributions
      "2023-01-16": 3, // week of 01-15
      "2023-01-17": 0,
    });
    expect(stats.mode).toBe("weekly");
    expect(stats.totalContributions).toBe(6);
    expect(stats.firstContribution).toBe("2023-01-01");
    expect(stats.longestStreak).toEqual({
      start: "2023-01-01",
      end: "2023-01-01",
      length: 1,
    });
    expect(stats.currentStreak).toEqual({
      start: "2023-01-15",
      end: "2023-01-15",
      length: 1,
    });
  });
});

describe("helpers", () => {
  it("normalizes day names", () => {
    expect(normalizeDays(["Sunday", " mon", "TUE", "nope", ""])).toEqual([
      "Sun",
      "Mon",
      "Tue",
    ]);
  });

  it("detects excluded days", () => {
    expect(isExcludedDay("2023-01-07", ["Sat"])).toBe(true);
    expect(isExcludedDay("2023-01-09", ["Sat"])).toBe(false);
    expect(isExcludedDay("2023-01-07", [])).toBe(false);
  });

  it("finds the previous Sunday", () => {
    expect(getPreviousSunday("2023-01-05")).toBe("2023-01-01");
    expect(getPreviousSunday("2023-01-01")).toBe("2023-01-01");
    expect(getPreviousSunday("2024-03-02")).toBe("2024-02-25");
  });

  it("flattens graphs in date order and drops future days", () => {
    const now = new Date("2023-01-03T12:00:00Z");
    const dates = getContributionDates(
      {
        2023: graph([
          ["2023-01-01", 1],
          ["2023-01-02", 0],
          ["2023-01-03", 0],
          ["2023-01-04", 0], // tomorrow, no contributions -> dropped
          ["2023-01-05", 9], // after tomorrow -> dropped
        ]),
        2022: graph([["2022-12-31", 4]]),
      },
      now,
    );
    expect(Object.keys(dates)).toEqual([
      "2022-12-31",
      "2023-01-01",
      "2023-01-02",
      "2023-01-03",
    ]);
  });

  it("keeps tomorrow when the user already contributed (time zones)", () => {
    const now = new Date("2023-01-03T12:00:00Z");
    const dates = getContributionDates(
      { 2023: graph([["2023-01-04", 2]]) },
      now,
    );
    expect(dates).toEqual({ "2023-01-04": 2 });
  });
});
