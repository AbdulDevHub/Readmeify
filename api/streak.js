// @ts-check

import {
  finalizeSvg,
  renderStreakCard,
  renderStreakError,
} from "../src/cards/streak.js";
import { guardAccess } from "../src/common/access.js";
import {
  CACHE_TTL,
  resolveCacheSeconds,
  setCacheHeaders,
  setErrorCacheHeaders,
} from "../src/common/cache.js";
import { MissingParamError } from "../src/common/error.js";
import { logger } from "../src/common/log.js";
import { fetchStreak } from "../src/fetchers/streak.js";

/**
 * Streak card endpoint: /api/streak?user=<username>
 *
 * Accepts the same query parameters as DenverCoder1/github-readme-streak-stats
 * (theme, color overrides, hide_border, mode, exclude_days, starting_year,
 * locale, date_format, short_numbers, card_width, card_height, border_radius,
 * hide_total_contributions, hide_current_streak, hide_longest_streak,
 * disable_animations) plus `type=json` and `cache_seconds`.
 *
 * @param {any} req Request.
 * @param {any} res Response.
 * @returns {Promise<any>} Response.
 */
// @ts-ignore
export default async (req, res) => {
  /** @type {Record<string, string>} */
  const params = {};
  for (const [key, value] of Object.entries(req.query || {})) {
    if (typeof value === "string") {
      params[key] = value;
    }
  }
  const asJson = params.type === "json";
  const user = (params.user || "").replace(/[^a-zA-Z0-9-]/g, "");

  /**
   * Send an error as JSON or as an error card.
   *
   * @param {string} message Error message.
   * @returns {any} Response.
   */
  const sendError = (message) => {
    setErrorCacheHeaders(res);
    if (asJson) {
      res.setHeader("Content-Type", "application/json");
      return res.send(JSON.stringify({ error: message }));
    }
    res.setHeader("Content-Type", "image/svg+xml");
    return res.send(finalizeSvg(renderStreakError(message, params), params));
  };

  // guardAccess always replies with an SVG error card
  res.setHeader("Content-Type", "image/svg+xml");
  const access = guardAccess({
    res,
    id: user,
    type: "username",
    colors: { theme: params.theme },
  });
  if (!access.isPassed) {
    return access.result;
  }
  if (asJson) {
    res.setHeader("Content-Type", "application/json");
  }

  try {
    if (!user) {
      throw new MissingParamError(["user"]);
    }
    const startingYear = parseInt(params.starting_year ?? "", 10);
    const stats = await fetchStreak(user, {
      mode: params.mode,
      excludeDays: (params.exclude_days || "").split(","),
      startingYear: Number.isNaN(startingYear) ? null : startingYear,
    });

    setCacheHeaders(
      res,
      resolveCacheSeconds({
        requested: parseInt(params.cache_seconds ?? "", 10),
        def: CACHE_TTL.STREAK_CARD.DEFAULT,
        min: CACHE_TTL.STREAK_CARD.MIN,
        max: CACHE_TTL.STREAK_CARD.MAX,
      }),
    );

    if (asJson) {
      return res.send(JSON.stringify(stats));
    }
    return res.send(finalizeSvg(renderStreakCard(stats, params), params));
  } catch (err) {
    logger.error(err);
    return sendError(
      err instanceof Error ? err.message : "An unknown error occurred",
    );
  }
};
