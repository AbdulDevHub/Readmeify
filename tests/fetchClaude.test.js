import { afterEach, describe, expect, it } from "@jest/globals";
import axios from "axios";
import MockAdapter from "axios-mock-adapter";
import { fetchClaudeStats } from "../src/fetchers/claude.js";

const mock = new MockAdapter(axios);
const URL =
  "https://api.github.com/repos/AbdulDevHub/Claude-Routines/contents/claude-stats/stats.json";

const data = {
  month: "2026-11",
  updatedAt: "2026-11-04T00:00:00.000Z",
  firstUsed: "2026-10-11",
  sessions: 87,
  prompts: 300,
  replies: 3219,
  toolCalls: 4917,
  tokens: 482378741,
  activeDays: 12,
  longestStreak: 6,
  topModel: "Opus 5.5",
  heatmap: [0, 1, null],
};

afterEach(() => mock.reset());

describe("fetchClaudeStats", () => {
  it("fetches and normalizes the stats file", async () => {
    mock.onGet(URL).reply(200, JSON.stringify(data));
    const stats = await fetchClaudeStats();
    expect(stats.tokens).toBe(482378741);
    expect(stats.topModel).toBe("Opus 5.5");
    expect(stats.heatmap).toEqual([0, 1, null]);
  });

  it("throws a helpful error when the file is missing", async () => {
    mock.onGet(URL).reply(404, { message: "Not Found" });
    await expect(fetchClaudeStats()).rejects.toThrow(
      "Could not load Claude Code stats",
    );
  });

  it("rejects malformed data", async () => {
    mock.onGet(URL).reply(200, { ...data, tokens: "lots" });
    await expect(fetchClaudeStats()).rejects.toThrow(
      "Invalid Claude stats data",
    );
  });
});

describe("fetchClaudeStats errors", () => {
  it("turns a non-JSON body into a card error", async () => {
    mock.onGet(URL).reply(200, "<html>oops</html>");
    await expect(fetchClaudeStats()).rejects.toThrow(
      "Invalid Claude stats data",
    );
  });
});
