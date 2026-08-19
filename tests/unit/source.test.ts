import { describe, expect, it } from "vitest";

import {
  SOURCE_FORMAT_VERSION,
  isSupportedFileName,
  isSupportedImageName,
  readSourceText,
  sourceAssets,
  toStoredDeckSource,
  type DeckSource,
} from "../../src/deck/source";

function stored(source: unknown, version: number = SOURCE_FORMAT_VERSION): unknown {
  return { version, source };
}

describe("isSupportedFileName", () => {
  it("Markdown とテキストを受け付ける", () => {
    for (const name of ["slides.md", "SLIDES.MD", "talk.markdown", "memo.txt"]) {
      expect(isSupportedFileName(name)).toBe(true);
    }
  });

  it("それ以外は受け付けない", () => {
    for (const name of ["slides.pdf", "image.png", "script.js", "noextension"]) {
      expect(isSupportedFileName(name)).toBe(false);
    }
  });
});

describe("isSupportedImageName", () => {
  it("対応する画像形式を受け付ける", () => {
    for (const name of ["a.png", "B.JPG", "c.jpeg", "d.gif", "e.webp", "f.avif", "g.svg"]) {
      expect(isSupportedImageName(name)).toBe(true);
    }
  });

  it("画像でない拡張子は受け付けない", () => {
    for (const name of ["a.md", "b.pdf", "c.mp4", "d.zip"]) {
      expect(isSupportedImageName(name)).toBe(false);
    }
  });
});

describe("readSourceText / sourceAssets", () => {
  it("サンプルは同梱の本文を使い、画像を持たない", () => {
    const sample: DeckSource = { kind: "sample" };

    expect(readSourceText(sample, "サンプル本文")).toBe("サンプル本文");
    expect(sourceAssets(sample)).toEqual([]);
  });

  it("ファイルと貼り付けは自分の本文と画像を使う", () => {
    const asset = { name: "a.png", blob: new Blob(["x"]) };

    expect(readSourceText({ kind: "file", name: "a.md", text: "A", assets: [] }, "サンプル")).toBe(
      "A",
    );
    expect(sourceAssets({ kind: "text", text: "B", assets: [asset] })).toEqual([asset]);
  });
});

describe("toStoredDeckSource", () => {
  it("保存された取得元を読み戻せる", () => {
    const asset = { name: "a.png", blob: new Blob(["x"]) };
    const sources: DeckSource[] = [
      { kind: "sample" },
      { kind: "text", text: "# 貼り付け", assets: [] },
      { kind: "file", name: "talk.md", text: "# ファイル", assets: [asset] },
    ];

    for (const source of sources) {
      expect(toStoredDeckSource(stored(source))).toEqual(source);
    }
  });

  it("版が違う保存は捨てる", () => {
    expect(toStoredDeckSource(stored({ kind: "sample" }, 99))).toBeUndefined();
  });

  it("形の合わない取得元は捨てる", () => {
    const broken = [
      { kind: "unknown" },
      { kind: "text" },
      { kind: "file", name: "a.md" },
      { kind: "text", text: "本文" },
      { kind: "text", text: "本文", assets: "画像ではない" },
      { kind: "text", text: "本文", assets: [{ name: "a.png" }] },
      { kind: "text", text: "本文", assets: [{ name: "a.png", blob: "Blob ではない" }] },
    ];

    for (const source of broken) {
      expect(toStoredDeckSource(stored(source))).toBeUndefined();
    }
  });

  it("保存の形そのものが壊れていたら捨てる", () => {
    for (const value of [null, undefined, "文字列", 42, [], {}]) {
      expect(toStoredDeckSource(value)).toBeUndefined();
    }
  });
});
