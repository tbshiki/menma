import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { parseDeck } from "../../src/deck/parseDeck";

/**
 * マニュアル（`docs/writing-slides.md`）がデッキとして成立していることを守る（FR-38、D-26）。
 *
 * この文書は「人が読む文書」と「menma の原稿」を兼ねている（D-26）。文書として直したときに
 * 記法が壊れても、文章としては読めてしまうので気づけない。入口画面から開けなくなる前に、
 * ここで落とす。
 */
const MANUAL_FILE = fileURLToPath(new URL("../../docs/writing-slides.md", import.meta.url));

/** 1 枚に詰め込みすぎるとキャンバスから切れる。マニュアル自身が守る（記法の「1 枚の目安」） */
const MAX_LINES_PER_SLIDE = 26;

describe("マニュアルがデッキとして成立する", () => {
  const deck = parseDeck(readFileSync(MANUAL_FILE, "utf8"));

  it("複数のスライドに分かれる", () => {
    expect(deck.slides.length).toBeGreaterThan(10);
  });

  it("Front Matter の題名を読める", () => {
    expect(deck.meta.title).toBe("menma で原稿を書く");
  });

  it("1 枚目が表紙である", () => {
    expect(deck.slides[0]?.layout).toBe("cover");
  });

  it("空のスライドが無い", () => {
    for (const slide of deck.slides) {
      expect(slide.html.trim()).not.toBe("");
    }
  });

  it("未知のレイアウトを指していない", () => {
    // 未知の名前は default に落ちるため、書き間違いは表示からは気づけない
    const declared = readFileSync(MANUAL_FILE, "utf8").matchAll(/^@slide layout=(\S+)/gm);
    const known = new Set([
      "default",
      "center",
      "cover",
      "split",
      "image-left",
      "image-right",
      "quote",
      "blank",
    ]);

    for (const [, name] of declared) {
      expect(known).toContain(name);
    }
  });

  it.each([
    "---",
    "@slide",
    "@aside",
    "@notes",
    "Front Matter",
    "layout=cover",
    "spec-markdown.md",
  ])("記法の説明として %s に触れている", (keyword) => {
    expect(readFileSync(MANUAL_FILE, "utf8")).toContain(keyword);
  });

  it("1 枚あたりが長すぎない", () => {
    const tooLong = deck.slides
      .map((slide, index) => ({ page: index + 1, lines: slide.source.split("\n").length }))
      .filter((slide) => slide.lines > MAX_LINES_PER_SLIDE);

    expect(tooLong).toEqual([]);
  });
});
