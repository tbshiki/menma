import { describe, expect, it } from "vitest";

import { createMarkdownRenderer } from "../../src/deck/markdown";

const render = createMarkdownRenderer({ externalLinksNewTab: true });

describe("createMarkdownRenderer", () => {
  it("標準的な Markdown を HTML へ変換する", () => {
    expect(render("# 見出し")).toContain("<h1>見出し</h1>");
    expect(render("- A\n- B")).toContain("<li>A</li>");
    expect(render("| A | B |\n| --- | --- |\n| 1 | 2 |")).toContain("<table>");
    expect(render("> 引用")).toContain("<blockquote>");
    expect(render("```ts\nconst a = 1;\n```")).toContain("<code");
  });

  it("raw HTML を実行可能な形で出力しない（FR-19）", () => {
    const html = render('<script>alert("x")</script>\n\n<b>太字</b>');

    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("危険なスキームをリンクにしない（NFR-07）", () => {
    for (const source of [
      "[x](javascript:alert(1))",
      "[x](JaVaScRiPt:alert(1))",
      "![x](javascript:alert(1))",
      "[x](vbscript:msgbox(1))",
      "[x](data:text/html;base64,PHNjcmlwdD4=)",
    ]) {
      const html = render(source);

      expect(html).not.toMatch(/href="\s*javascript:/i);
      expect(html).not.toMatch(/src="\s*javascript:/i);
      expect(html).not.toMatch(/href="\s*vbscript:/i);
      expect(html).not.toMatch(/href="\s*data:text\/html/i);
    }
  });

  it("イベントハンドラ付きの生タグをエスケープして無害化する", () => {
    const html = render("<img src=x onerror=alert(1)>");

    // 文字列としては残るが、タグとしては出力されない
    expect(html).not.toMatch(/<img/i);
    expect(html).toContain("&lt;img");
  });

  it("外部リンクを別タブで開き、rel を付ける（FR-20）", () => {
    const html = render("[例](https://example.com)");

    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
  });

  it("相対リンクとページ内アンカーには target を付けない", () => {
    expect(render("[相対](./other.html)")).not.toContain("target=");
    expect(render("[アンカー](#section)")).not.toContain("target=");
  });

  it("externalLinksNewTab が false なら target を付けない", () => {
    const sameTab = createMarkdownRenderer({ externalLinksNewTab: false });

    expect(sameTab("[例](https://example.com)")).not.toContain("target=");
  });

  it("バックスラッシュでディレクティブをエスケープできる（記法仕様 8 章）", () => {
    const html = render("\\@slide はディレクティブです。");

    expect(html).toContain("@slide はディレクティブです。");
    expect(html).not.toContain("\\@slide");
  });
});
