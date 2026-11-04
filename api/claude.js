// @ts-check

import { renderClaudeCard } from "../src/cards/claude.js";
import { renderError } from "../src/common/render.js";
import { fetchClaudeStats } from "../src/fetchers/claude.js";
import {
  CACHE_TTL,
  resolveCacheSeconds,
  setCacheHeaders,
  setErrorCacheHeaders,
} from "../src/common/cache.js";
import { retrieveSecondaryMessage } from "../src/common/error.js";
import { parseBoolean } from "../src/common/ops.js";

// @ts-ignore
export default async (req, res) => {
  const {
    title_color,
    icon_color,
    text_color,
    bg_color,
    border_color,
    theme,
    hide_border,
    hide_title,
    custom_title,
    border_radius,
    cache_seconds,
    disable_animations,
  } = req.query;

  res.setHeader("Content-Type", "image/svg+xml");

  try {
    const stats = await fetchClaudeStats();
    setCacheHeaders(
      res,
      resolveCacheSeconds({
        requested: parseInt(cache_seconds, 10),
        def: CACHE_TTL.CLAUDE_CARD.DEFAULT,
        min: CACHE_TTL.CLAUDE_CARD.MIN,
        max: CACHE_TTL.CLAUDE_CARD.MAX,
      }),
    );

    const radius = parseFloat(border_radius);
    return res.send(
      renderClaudeCard(stats, {
        title_color,
        icon_color,
        text_color,
        bg_color,
        border_color,
        theme,
        hide_border: parseBoolean(hide_border),
        hide_title: parseBoolean(hide_title),
        custom_title,
        border_radius: Number.isFinite(radius) ? radius : undefined,
        disable_animations: parseBoolean(disable_animations),
      }),
    );
  } catch (err) {
    setErrorCacheHeaders(res);
    return res.send(
      renderError({
        message:
          err instanceof Error ? err.message : "An unknown error occurred",
        secondaryMessage:
          err instanceof Error ? retrieveSecondaryMessage(err) : undefined,
        renderOptions: {
          title_color,
          text_color,
          bg_color,
          border_color,
          theme,
          show_repo_link: false,
        },
      }),
    );
  }
};
