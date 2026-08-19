import { describe, expect, it } from "vitest";

import { isDarkBackground, parseRgb, relativeLuminance, resolveColor } from "../../src/view/colors";

describe("resolveColor", () => {
  it("UI の指定を最優先にする（D-21）", () => {
    expect(resolveColor("#ff0000", "#00ff00")).toBe("#ff0000");
  });

  it("UI の指定が無ければ原稿の指定を使う", () => {
    expect(resolveColor(undefined, "#00ff00")).toBe("#00ff00");
    expect(resolveColor("", "#00ff00")).toBe("#00ff00");
  });

  it("どちらも無ければテーマに任せる", () => {
    expect(resolveColor(undefined, "")).toBeUndefined();
    expect(resolveColor("", "")).toBeUndefined();
  });
});

describe("parseRgb", () => {
  it("カンマ区切りとスペース区切りのどちらも読む", () => {
    expect(parseRgb("rgb(16, 20, 24)")).toEqual([16, 20, 24]);
    expect(parseRgb("rgb(16 20 24)")).toEqual([16, 20, 24]);
  });

  it("透明度が付いていても色の成分を取り出す", () => {
    expect(parseRgb("rgba(255, 255, 255, 0.5)")).toEqual([255, 255, 255]);
  });

  it("読めない値は undefined", () => {
    expect(parseRgb("")).toBeUndefined();
    expect(parseRgb("transparent")).toBeUndefined();
    expect(parseRgb("rgb(16, 20)")).toBeUndefined();
  });

  it("範囲外の値は受け付けない", () => {
    expect(parseRgb("rgb(300, 20, 24)")).toBeUndefined();
  });
});

describe("relativeLuminance", () => {
  it("黒は 0、白は 1", () => {
    expect(relativeLuminance([0, 0, 0])).toBeCloseTo(0, 5);
    expect(relativeLuminance([255, 255, 255])).toBeCloseTo(1, 5);
  });

  it("緑は赤より明るく扱われる", () => {
    expect(relativeLuminance([0, 255, 0])).toBeGreaterThan(relativeLuminance([255, 0, 0]));
  });
});

describe("isDarkBackground", () => {
  it("暗い色を暗いと判定する", () => {
    for (const color of ["rgb(0, 0, 0)", "rgb(16, 20, 24)", "rgb(29, 95, 168)"]) {
      expect(isDarkBackground(color)).toBe(true);
    }
  });

  it("明るい色を暗いと判定しない", () => {
    for (const color of ["rgb(255, 255, 255)", "rgb(244, 246, 248)", "rgb(249, 115, 22)"]) {
      expect(isDarkBackground(color)).toBe(false);
    }
  });

  it("判定できない値は明るい前提で扱う", () => {
    // 読めない値で文字色を反転させると、かえって読めなくなる
    expect(isDarkBackground("transparent")).toBe(false);
  });
});
