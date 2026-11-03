// @ts-check

import {
  PROFILE_3D_SVG_URL,
  recolorProfile3d,
} from "../src/cards/profile-3d.js";
import { setCacheHeaders, setErrorCacheHeaders } from "../src/common/cache.js";
import { logger } from "../src/common/log.js";

const ONE_HOUR = 60 * 60;

/**
 * Recolored 3D contribution graph: /api/profile-3d (also served at /profile.svg).
 *
 * @param {any} _req Request.
 * @param {any} res Response.
 * @returns {Promise<any>} Response.
 */
export default async (_req, res) => {
  try {
    const response = await fetch(PROFILE_3D_SVG_URL);
    if (!response.ok) {
      throw new Error(`Failed to fetch SVG (${response.status})`);
    }
    const svg = await response.text();
    res.setHeader("Content-Type", "image/svg+xml");
    setCacheHeaders(res, ONE_HOUR);
    return res.status(200).send(recolorProfile3d(svg));
  } catch (err) {
    logger.error(err);
    setErrorCacheHeaders(res);
    res.setHeader("Content-Type", "application/json");
    return res.status(500).send(
      JSON.stringify({
        error: err instanceof Error ? err.message : "Unknown error",
      }),
    );
  }
};
