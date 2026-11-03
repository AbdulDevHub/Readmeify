// @ts-check

import { afterEach, describe, expect, it, jest } from "@jest/globals";
import profile3d from "../api/profile-3d.js";
import {
  COLOR_REPLACEMENTS,
  PROFILE_3D_SVG_URL,
  recolorProfile3d,
} from "../src/cards/profile-3d.js";

const makeRes = () => {
  const res = {
    setHeader: jest.fn(),
    send: jest.fn(),
    status: jest.fn(() => res),
  };
  return res;
};

const originalFetch = global.fetch;
afterEach(() => {
  global.fetch = originalFetch;
});

describe("profile 3d recolor", () => {
  it("replaces every mapped color, including repeats", () => {
    const svg = `<rect fill="#00000f"/><path fill="rgb(27, 125, 40)"/><path fill="rgb(27, 125, 40)"/>`;
    expect(recolorProfile3d(svg)).toBe(
      `<rect fill="#0d1117"/><path fill="rgb(216, 232, 135)"/><path fill="rgb(216, 232, 135)"/>`,
    );
  });

  it("does not map one replacement onto another original color", () => {
    const originals = new Set(COLOR_REPLACEMENTS.map(([from]) => from));
    for (const [, to] of COLOR_REPLACEMENTS) {
      expect(originals.has(to)).toBe(false);
    }
  });
});

describe("/api/profile-3d", () => {
  it("serves the recolored SVG", async () => {
    // @ts-ignore
    global.fetch = jest.fn(async () => ({
      ok: true,
      text: async () => `<svg fill="#00000f"/>`,
    }));
    const res = makeRes();
    await profile3d({}, res);

    expect(global.fetch).toHaveBeenCalledWith(PROFILE_3D_SVG_URL);
    expect(res.setHeader).toHaveBeenCalledWith("Content-Type", "image/svg+xml");
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith(`<svg fill="#0d1117"/>`);
  });

  it("returns a 500 JSON error when the source fails", async () => {
    // @ts-ignore
    global.fetch = jest.fn(async () => ({ ok: false, status: 404 }));
    const res = makeRes();
    await profile3d({}, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(JSON.parse(res.send.mock.calls[0][0])).toEqual({
      error: "Failed to fetch SVG (404)",
    });
  });
});
