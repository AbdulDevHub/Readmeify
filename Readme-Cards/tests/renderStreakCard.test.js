// @ts-check

import { beforeEach, describe, expect, it } from "@jest/globals";
import fs from "node:fs";
import {
  finalizeSvg,
  getTranslations,
  normalizeLocaleCode,
  renderStreakCard,
  renderStreakError,
  splitLines,
} from "../src/cards/streak.js";

const fixture = (/** @type {string} */ name) =>
  fs
    .readFileSync(new URL(`./fixtures/streak/${name}.svg`, import.meta.url))
    .toString()
    .replace(/\r\n/g, "\n");

/** @type {Record<string, string>} */
let params;
/** @type {import("../src/fetchers/streak.js").StreakStats} */
let stats;

beforeEach(() => {
  params = {
    background: "000000",
    border: "111111",
    stroke: "222222",
    ring: "333333",
    fire: "444444",
    currStreakNum: "555555",
    sideNums: "666666",
    currStreakLabel: "777777",
    sideLabels: "888888",
    dates: "999999",
    excludeDaysLabel: "aaaaaa",
  };
  stats = {
    mode: "daily",
    totalContributions: 2048,
    firstContribution: "2016-08-10",
    longestStreak: { start: "2016-12-19", end: "2016-03-14", length: 86 },
    currentStreak: { start: "2019-03-28", end: "2019-04-12", length: 16 },
    excludedDays: [],
  };
});

describe("streak card", () => {
  it("matches the original PHP card output", () => {
    expect(renderStreakCard(stats, params)).toBe(fixture("test_card"));
  });

  it("matches the original PHP error card output", () => {
    expect(renderStreakError("An unknown error occurred", params)).toBe(
      fixture("test_error_card"),
    );
  });

  it("escapes error messages", () => {
    expect(renderStreakError("<script>", params)).toContain("&lt;script&gt;");
  });

  it("shortens numbers", () => {
    params.short_numbers = "true";
    expect(renderStreakCard(stats, params)).toContain("2K");
  });

  it("supports date_format with an optional year part", () => {
    const year = new Date().getUTCFullYear();
    stats.currentStreak.end = `${year}-04-12`;
    params.date_format = "[Y-]m-d";
    const svg = renderStreakCard(stats, params);
    expect(svg).toContain("2016-08-10 - Present");
    expect(svg).toContain("2019-03-28 - 04-12");
    expect(svg).toContain("2016-12-19 - 2016-03-14");
  });

  it("uses locale labels and date format", () => {
    params.locale = "ja";
    const svg = renderStreakCard(stats, params);
    expect(svg).toContain("2,048");
    expect(svg).toContain("総ｺﾝﾄﾘﾋﾞｭｰｼｮﾝ数");
    expect(svg).toContain("2016.8.10 - 今");
    expect(svg).toContain("現在のストリーク");
    expect(svg).toContain("2019.3.28 - 2019.4.12");
    expect(svg).toContain("2016.12.19 - 2016.3.14");
  });

  it("uses Intl for default date formatting", () => {
    const svg = renderStreakCard(stats, {});
    expect(svg).toContain("Aug 10, 2016 - Present");
    expect(svg).toContain("Mar 28, 2019 - Apr 12, 2019");
  });

  it("applies border radius and ignores invalid values", () => {
    params.border_radius = "16";
    expect(renderStreakCard(stats, params)).toContain(
      "<rect stroke='#111111' fill='#000000' rx='16' x='0.5' y='0.5' width='494' height='194'/>",
    );
    params.border_radius = "'/><script>";
    expect(renderStreakCard(stats, params)).toContain(
      "<rect width='495' height='195' rx='4.5'/>",
    );
  });

  it("removes animations when disable_animations=true", () => {
    params.disable_animations = "true";
    const svg = finalizeSvg(renderStreakCard(stats, params), params);
    expect(svg).not.toContain("opacity: 0;");
    expect(svg).toContain("opacity: 1;");
    expect(svg).toContain("font-size: 28px;");
    expect(svg).not.toContain("animation:");
    expect(svg).not.toContain("<style>");
  });

  it("converts alpha hex colors to opacity attributes", () => {
    params.background = "transparent";
    expect(finalizeSvg(renderStreakCard(stats, params))).toContain(
      "fill='#000000' fill-opacity='0'",
    );
    params.background = "ff000080";
    expect(finalizeSvg(renderStreakCard(stats, params))).toContain(
      "fill='#ff0000' fill-opacity='0.50196078431373'",
    );
    params.border = "00ff0080";
    expect(finalizeSvg(renderStreakCard(stats, params))).toContain(
      "stroke='#00ff00' stroke-opacity='0.50196078431373'",
    );
  });

  it("renders gradient backgrounds", () => {
    params.background = "-45,f00,4e5,ddd,fff";
    const svg = renderStreakCard(stats, params);
    expect(svg).toContain("fill='url(#gradient)'");
    expect(svg).toContain(
      "<linearGradient id='gradient' gradientTransform='rotate(-45)' gradientUnits='userSpaceOnUse'><stop offset='0%' stop-color='#f00' /><stop offset='33.333333333333%' stop-color='#4e5' /><stop offset='66.666666666667%' stop-color='#ddd' /><stop offset='100%' stop-color='#fff' /></linearGradient>",
    );
  });

  it("shows excluded days, translated", () => {
    stats.excludedDays = ["Sun", "Sat"];
    expect(renderStreakCard(stats, params)).toContain("* Excluding Sun, Sat");
    params.locale = "fr";
    expect(renderStreakCard(stats, params)).toContain("dim.");
  });

  it("respects card_width", () => {
    params.card_width = "600";
    const svg = renderStreakCard(stats, params);
    expect(svg).toContain("viewBox='0 0 600 195' width='600px' height='195px'");
    expect(svg).toContain("<line x1='200' y1='28'");
    expect(svg).toContain("<line x1='400' y1='28'");
    expect(svg).toContain("<g transform='translate(500,");
  });

  it("hides columns", () => {
    params.hide_total_contributions = "true";
    params.hide_longest_streak = "true";
    const svg = renderStreakCard(stats, params);
    expect(svg).toContain("viewBox='0 0 495 195'");
    expect(svg).toContain("<g transform='translate(247.5, 48)'>");
    expect(svg).toContain("<g transform='translate(-999, 48)'>");
  });

  it("uses theme colors and hide_border", () => {
    const svg = renderStreakCard(stats, { theme: "dark", hide_border: "true" });
    expect(svg).toContain("stroke='#0000' fill='#151515'");
  });

  it("falls back to the default theme for unknown or prototype names", () => {
    for (const theme of ["nope", "constructor", "__proto__"]) {
      const svg = renderStreakCard(stats, { theme });
      expect(svg).not.toContain("undefined");
      expect(svg).toContain("fill='#FFFEFE'");
    }
  });

  it("uses weekly labels in weekly mode", () => {
    stats.mode = "weekly";
    const svg = renderStreakCard(stats, params);
    expect(svg).toContain("Week Streak");
    expect(svg).toContain("Longest Week Streak");
  });
});

describe("text helpers", () => {
  it("splits long lines into tspans", () => {
    expect(splitLines("Total Contributions", 24, -9)).toBe(
      "Total Contributions",
    );
    expect(splitLines("Chuỗi đóng góp hiện tại", 22, -9)).toBe(
      "<tspan x='0' dy='-9'>Chuỗi đóng góp hiện</tspan><tspan x='0' dy='16'>tại</tspan>",
    );
    expect(splitLines("Chuỗi đóng góp\nhiện tại", 22, -9)).toBe(
      "<tspan x='0' dy='-9'>Chuỗi đóng góp</tspan><tspan x='0' dy='16'>hiện tại</tspan>",
    );
    expect(splitLines("19 de dez. de 2021 - 14 de mar.", 24, 0)).toBe(
      "<tspan x='0' dy='0'>19 de dez. de 2021</tspan><tspan x='0' dy='16'>- 14 de mar.</tspan>",
    );
  });

  it("normalizes locale codes", () => {
    expect(normalizeLocaleCode("zh-hans-cn")).toBe("zh_Hans_CN");
    expect(normalizeLocaleCode("PT_br")).toBe("pt_BR");
    expect(normalizeLocaleCode("not a locale")).toBe("en");
  });

  it("falls back to English for missing locales and keys", () => {
    expect(getTranslations("xx")["Total Contributions"]).toBe(
      "Total Contributions",
    );
    expect(getTranslations("bg")["Excluding {days}"]).toBe("Excluding {days}");
  });
});
