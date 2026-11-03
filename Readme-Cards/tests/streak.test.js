// @ts-check

import { afterEach, describe, expect, it, jest } from "@jest/globals";
import axios from "axios";
import MockAdapter from "axios-mock-adapter";
import streak from "../api/streak.js";
import { CACHE_TTL } from "../src/common/cache.js";

const mock = new MockAdapter(axios);

afterEach(() => {
  mock.reset();
});

const currentYear = new Date().getUTCFullYear();
const today = new Date().toISOString().slice(0, 10);

/**
 * Fake GraphQL response for one year.
 *
 * @param {number} year Year requested.
 * @returns {any} Response body.
 */
const yearResponse = (year) => ({
  data: {
    user: {
      createdAt: `${currentYear - 1}-06-01T00:00:00Z`,
      contributionsCollection: {
        contributionYears: [currentYear, currentYear - 1],
        contributionCalendar: {
          weeks: [
            {
              contributionDays:
                year === currentYear
                  ? [{ date: today, contributionCount: 3 }]
                  : [
                      { date: `${year}-07-01`, contributionCount: 5 },
                      { date: `${year}-07-02`, contributionCount: 0 },
                    ],
            },
          ],
        },
      },
    },
  },
});

const mockGraphQL = () => {
  mock.onPost("https://api.github.com/graphql").reply((config) => {
    const { variables } = JSON.parse(config.data);
    return [200, yearResponse(parseInt(variables.from.slice(0, 4), 10))];
  });
};

const makeRes = () => ({
  setHeader: jest.fn(),
  send: jest.fn(),
});

describe("/api/streak", () => {
  it("renders a streak card SVG", async () => {
    mockGraphQL();
    const res = makeRes();
    await streak({ query: { user: "abduldevhub", theme: "dark" } }, res);

    expect(res.setHeader).toHaveBeenCalledWith("Content-Type", "image/svg+xml");
    const svg = /** @type {string} */ (res.send.mock.calls[0][0]);
    expect(svg).toContain("<svg");
    expect(svg).toContain("Total Contributions");
    expect(svg).toContain(">\n                        8\n");
    expect(res.setHeader).toHaveBeenCalledWith(
      "Cache-Control",
      expect.stringContaining(`max-age=${CACHE_TTL.STREAK_CARD.DEFAULT}`),
    );
    // current year + one previous year
    expect(mock.history.post.length).toBe(2);
  });

  it("returns JSON stats with type=json", async () => {
    mockGraphQL();
    const res = makeRes();
    await streak({ query: { user: "abduldevhub", type: "json" } }, res);

    expect(res.setHeader).toHaveBeenCalledWith(
      "Content-Type",
      "application/json",
    );
    const data = JSON.parse(res.send.mock.calls[0][0]);
    expect(data.totalContributions).toBe(8);
    expect(data.firstContribution).toBe(`${currentYear - 1}-07-01`);
    expect(data.currentStreak.length).toBe(1);
  });

  it("renders an error card when user is missing", async () => {
    const res = makeRes();
    await streak({ query: {} }, res);
    const svg = /** @type {string} */ (res.send.mock.calls[0][0]);
    expect(svg).toContain("Missing params");
    expect(res.setHeader).toHaveBeenCalledWith(
      "Cache-Control",
      expect.stringContaining(`max-age=${CACHE_TTL.ERROR}`),
    );
  });

  it("renders a not-found error for unknown users", async () => {
    mock.onPost("https://api.github.com/graphql").reply(200, {
      data: { user: null },
      errors: [{ type: "NOT_FOUND", message: "Could not resolve" }],
    });
    const res = makeRes();
    await streak({ query: { user: "nobody-here" } }, res);
    expect(res.send.mock.calls[0][0]).toContain(
      "Could not find a user with that name.",
    );
  });

  it("returns JSON errors with type=json", async () => {
    const res = makeRes();
    await streak({ query: { type: "json" } }, res);
    expect(JSON.parse(res.send.mock.calls[0][0])).toEqual({
      error: expect.stringContaining("Missing params"),
    });
  });
});
