import { describe, expect, it } from "vitest";

import { splitSlides } from "../../src/deck/splitSlides";

describe("splitSlides", () => {
  it("空行で挟まれた --- でスライドを分割する", () => {
    const slides = splitSlides(["# 1 枚目", "", "---", "", "# 2 枚目"].join("\n"), 1);

    expect(slides.map((slide) => slide.source)).toEqual(["# 1 枚目", "# 2 枚目"]);
  });

  it("元原稿の行番号を保持する", () => {
    const body = ["", "# 1 枚目", "", "---", "", "# 2 枚目"].join("\n");
    const slides = splitSlides(body, 6);

    expect(slides[0]?.startLine).toBe(7);
    expect(slides[1]?.startLine).toBe(11);
  });

  it("コードフェンスの内側の --- では分割しない", () => {
    const body = ["# コード", "", "```md", "# 前", "", "---", "", "# 後", "```"].join("\n");
    const slides = splitSlides(body, 1);

    expect(slides).toHaveLength(1);
    expect(slides[0]?.source).toContain("---");
  });

  it("チルダのコードフェンスも追跡する", () => {
    // フェンス内の --- は区切りにしない。前後に空行を置き、追跡が外れれば 3 枚に割れる形にしておく
    const body = ["~~~text", "", "---", "", "~~~", "", "---", "", "# 次"].join("\n");
    const slides = splitSlides(body, 1);

    expect(slides).toHaveLength(2);
    expect(slides[0]?.source).toContain("~~~text");
  });

  it("直前の行が非空の --- はセットアップ見出しとして扱い、分割しない", () => {
    const slides = splitSlides(["見出しになる行", "---", "", "本文"].join("\n"), 1);

    expect(slides).toHaveLength(1);
  });

  it("*** と ___ では分割しない", () => {
    const slides = splitSlides(["# 1 枚目", "", "***", "", "___", "", "続き"].join("\n"), 1);

    expect(slides).toHaveLength(1);
  });

  it("ハイフンが 4 つ以上でも区切りとして扱う", () => {
    const slides = splitSlides(["# 1 枚目", "", "----", "", "# 2 枚目"].join("\n"), 1);

    expect(slides).toHaveLength(2);
  });

  it("区切りが連続しても空のスライドを作らない", () => {
    const slides = splitSlides(["---", "", "# 1 枚目", "", "---", "", "---", ""].join("\n"), 1);

    expect(slides.map((slide) => slide.source)).toEqual(["# 1 枚目"]);
  });

  it("前後の空行を取り除く", () => {
    const slides = splitSlides(["", "", "# 見出し", "", ""].join("\n"), 1);

    expect(slides[0]?.source).toBe("# 見出し");
    expect(slides[0]?.startLine).toBe(3);
  });

  it("内容が無ければ 1 枚も返さない", () => {
    expect(splitSlides("\n\n   \n", 1)).toEqual([]);
  });
});
