import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { DeckError } from "../../src/deck/errors";
import { parseDeck } from "../../src/deck/parseDeck";

const SAMPLE = readFileSync(fileURLToPath(new URL("../../slides.md", import.meta.url)), "utf8");

describe("parseDeck", () => {
  it("Front Matter とスライドをまとめて解釈する", () => {
    const deck = parseDeck(
      [
        "---",
        "title: テスト",
        "---",
        "",
        "@slide layout=center",
        "",
        "# 1 枚目",
        "",
        "---",
        "",
        "# 2 枚目",
        "",
        "[例](https://example.com)",
      ].join("\n"),
    );

    expect(deck.meta.title).toBe("テスト");
    expect(deck.slides).toHaveLength(2);
    expect(deck.slides[0]?.layout).toBe("center");
    expect(deck.slides[0]?.html).toContain("<h1>1 枚目</h1>");
    expect(deck.slides[1]?.html).toContain('target="_blank"');
    expect(deck.warnings).toEqual([]);
  });

  it("インデックスを 0 始まりで振る", () => {
    const deck = parseDeck(["A", "", "---", "", "B", "", "---", "", "C"].join("\n"));

    expect(deck.slides.map((slide) => slide.index)).toEqual([0, 1, 2]);
  });

  it("原文とノートを Markdown のまま保持する（D-10）", () => {
    const deck = parseDeck(["# 見出し", "", "@notes", "", "話す内容"].join("\n"));

    expect(deck.slides[0]?.notes).toBe("話す内容");
    expect(deck.slides[0]?.html).not.toContain("話す内容");
    expect(deck.slides[0]?.source).toContain("@notes");
  });

  it("補助部を別の HTML として返す", () => {
    const deck = parseDeck(
      ["@slide layout=split", "", "# 左", "", "@aside", "", "右の内容"].join("\n"),
    );

    expect(deck.slides[0]?.html).toContain("<h1>左</h1>");
    expect(deck.slides[0]?.asideHtml).toContain("右の内容");
  });

  it("スライドが 1 枚も無ければ DeckError を投げる", () => {
    expect(() => parseDeck("---\ntitle: 空\n---\n\n\n")).toThrow(DeckError);
  });

  it("CRLF と BOM を含む原稿を扱える", () => {
    const deck = parseDeck("﻿---\r\ntitle: CRLF\r\n---\r\n\r\n# 見出し\r\n");

    expect(deck.meta.title).toBe("CRLF");
    expect(deck.slides).toHaveLength(1);
    expect(deck.slides[0]?.html).toContain("<h1>見出し</h1>");
  });

  it("警告を Front Matter とスライドの順で集約する", () => {
    const deck = parseDeck(
      ["---", "unknownKey: 1", "---", "", "@slide layout=fancy", "", "# 見出し"].join("\n"),
    );

    expect(deck.warnings.map((warning) => warning.kind)).toEqual(["unknown-key", "unknown-layout"]);
    expect(deck.warnings[1]?.line).toBe(5);
  });

  it("同梱のサンプル原稿を解釈できる", () => {
    const deck = parseDeck(SAMPLE);

    expect(deck.meta.title).toBe("menma");
    expect(deck.slides.length).toBeGreaterThanOrEqual(6);
    expect(deck.slides[0]?.layout).toBe("cover");
    expect(deck.warnings).toEqual([]);

    const codeSlide = deck.slides.find((slide) => slide.html.includes("<code"));
    expect(codeSlide).toBeDefined();

    const tableSlide = deck.slides.find((slide) => slide.html.includes("<table>"));
    expect(tableSlide?.notes).toBeDefined();
  });
});
