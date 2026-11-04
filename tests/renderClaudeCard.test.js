import { describe, expect, it } from "@jest/globals";
import { queryByTestId } from "@testing-library/dom";
import "@testing-library/jest-dom";
import { compact, renderClaudeCard } from "../src/cards/claude.js";
import { getCardColors } from "../src/common/color.js";

const stats = {
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
  heatmap: [...Array(80).fill(0), 3, 10, 40, null],
};

describe("renderClaudeCard", () => {
  it("renders the stats with compact numbers", () => {
    document.body.innerHTML = renderClaudeCard(stats);
    expect(queryByTestId(document.body, "header")).toHaveTextContent(
      "Claude Code Stats",
    );
    expect(queryByTestId(document.body, "Tokens Used")).toHaveTextContent(
      "482.4M",
    );
    expect(queryByTestId(document.body, "Tool Calls")).toHaveTextContent(
      "4.9k",
    );
    expect(document.body).toHaveTextContent("Top model: Opus 5.5");
    expect(queryByTestId(document.body, "logo")).not.toBeNull();
    // 84 days minus the one future (null) day.
    expect(document.querySelectorAll(".cell")).toHaveLength(83);
  });

  it("uses Claude orange for icons by default and respects overrides", () => {
    expect(renderClaudeCard(stats)).toContain("fill: #D97757");
    expect(renderClaudeCard(stats, { icon_color: "00ff00" })).toContain(
      "fill: #00ff00",
    );
  });

  it("escapes text that reaches the SVG", () => {
    const svg = renderClaudeCard(
      { ...stats, topModel: "<script>x</script>" },
      { custom_title: "<b>hi</b>" },
    );
    expect(svg).not.toContain("<script>");
    expect(svg).not.toContain("<b>hi</b>");
  });

  it("supports hide_title and hide_border", () => {
    document.body.innerHTML = renderClaudeCard(stats, {
      hide_title: true,
      hide_border: true,
    });
    expect(queryByTestId(document.body, "header")).toBeNull();
    expect(queryByTestId(document.body, "logo")).toBeNull();
    expect(queryByTestId(document.body, "card-bg")).toHaveAttribute(
      "stroke-opacity",
      "0",
    );
  });

  it("formats numbers compactly", () => {
    expect(compact(999)).toBe("999");
    expect(compact(1500)).toBe("1.5k");
    expect(compact(2_000_000)).toBe("2M");
    expect(compact(3_450_000_000)).toBe("3.5B");
  });
});

describe("getCardColors", () => {
  it("falls back to the default theme for unknown themes like light", () => {
    expect(getCardColors({ theme: "light" })).toEqual(
      getCardColors({ theme: "default" }),
    );
  });
});
