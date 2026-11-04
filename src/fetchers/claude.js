// @ts-check

import axios from "axios";
import { retryer } from "../common/retryer.js";
import { CustomError } from "../common/error.js";

/**
 * Where the monthly Claude Code stats JSON lives. It is written by a local
 * SessionStart hook (see README "Claude Code card") into a private repo, so
 * it is read through the GitHub contents API with the shared PATs.
 */
const DEFAULT_SOURCE = "AbdulDevHub/Claude-Code-Hub/claude-stats/stats.json";

const INVALID = "Check the stats.json written by the monthly hook";

const NUMBER_FIELDS = [
  "sessions",
  "prompts",
  "replies",
  "toolCalls",
  "tokens",
  "activeDays",
  "longestStreak",
];

/**
 * @typedef {{
 *   month: string, updatedAt: string, firstUsed: string|null,
 *   sessions: number, prompts: number, replies: number, toolCalls: number,
 *   tokens: number, activeDays: number, longestStreak: number,
 *   topModel: string|null, heatmap: (number|null)[]
 * }} ClaudeStats
 */

/**
 * @param {{ owner: string, repo: string, path: string }} variables Source location.
 * @param {string} token GitHub token.
 * @returns {Promise<import('axios').AxiosResponse>} Response.
 */
const fetcher = (variables, token) =>
  axios({
    method: "get",
    url: `https://api.github.com/repos/${variables.owner}/${variables.repo}/contents/${variables.path}`,
    headers: {
      Authorization: `token ${token}`,
      Accept: "application/vnd.github.raw+json",
    },
  });

/**
 * Checks and normalizes the stats JSON so nothing unexpected reaches the SVG.
 *
 * @param {any} data Parsed JSON.
 * @returns {ClaudeStats} Clean stats.
 */
const normalizeStats = (data) => {
  if (!data || typeof data !== "object") {
    throw new CustomError("Invalid Claude stats data", INVALID);
  }
  /** @type {any} */
  const out = {};
  for (const key of NUMBER_FIELDS) {
    const value = Number(data[key]);
    if (!Number.isFinite(value) || value < 0) {
      throw new CustomError("Invalid Claude stats data", INVALID);
    }
    out[key] = value;
  }
  out.month = typeof data.month === "string" ? data.month : "";
  out.updatedAt = typeof data.updatedAt === "string" ? data.updatedAt : "";
  out.firstUsed = typeof data.firstUsed === "string" ? data.firstUsed : null;
  out.topModel =
    typeof data.topModel === "string" ? data.topModel.slice(0, 40) : null;
  out.heatmap = Array.isArray(data.heatmap)
    ? data.heatmap
        .slice(-84)
        .map((v) => (v === null ? null : Math.max(0, Number(v) || 0)))
    : [];
  return out;
};

/**
 * Fetch the published Claude Code usage stats.
 *
 * @param {string=} source "owner/repo/path/to/file.json"; defaults to env CLAUDE_STATS_SOURCE.
 * @returns {Promise<ClaudeStats>} Stats.
 */
const fetchClaudeStats = async (
  source = process.env.CLAUDE_STATS_SOURCE || DEFAULT_SOURCE,
) => {
  const [owner, repo, ...rest] = source.split("/");
  const res = await retryer(fetcher, { owner, repo, path: rest.join("/") });

  if (!res || res.status !== 200) {
    const err = new CustomError(
      "Could not load Claude Code stats",
      CustomError.GITHUB_REST_API_ERROR,
    );
    if (res?.status === 404) {
      err.secondaryMessage = "Stats file not found or token lacks repo access";
    }
    throw err;
  }

  let data = res.data;
  if (typeof data === "string") {
    try {
      data = JSON.parse(data);
    } catch {
      throw new CustomError("Invalid Claude stats data", INVALID);
    }
  }
  return normalizeStats(data);
};

export { fetchClaudeStats, normalizeStats };
export default fetchClaudeStats;
