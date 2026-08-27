import { describe, expect, it } from "vitest";

import {
  isDarkBackground,
  parseRgb,
  relativeLuminance,
  resolveColor,
  toHexColor,
} from "../../src/view/colors";

/**
 * 解釈できるかの判定はブラウザの仕事なので、ここでは「`#` で始まる 7 文字だけ読める」偽物を渡す。
 * 実際の色の解釈は E2E で確かめる（D-20 と同じ切り分け）。
 */
function compute(value: string): string | undefined {
  return /^#[0-9a-f]{6}$/i.test(value) ? `rgb(${value})` : undefined;
}

describe("resolveColor", () => {
  it("UI の指定を最優先にする（D-21）", () => {
    expect(resolveColor(["#ff0000", "#0000ff", "#00ff00"], compute)?.value).toBe("#ff0000");
  });

  it("UI の指定が無ければ @slide、それも無ければ原稿全体の指定を使う（D-29）", () => {
    expect(resolveColor([undefined, "#0000ff", "#00ff00"], compute)?.value).toBe("#0000ff");
    expect(resolveColor(["", "", "#00ff00"], compute)?.value).toBe("#00ff00");
  });

  it("どれも無ければテーマに任せる", () => {
    expect(resolveColor([undefined, undefined, ""], compute)).toBeUndefined();
    expect(resolveColor([], compute)).toBeUndefined();
  });

  it("解釈できない指定は無かったことにして次の候補へ落ちる（D-30）", () => {
    expect(resolveColor(["notacolor", "#00ff00"], compute)?.value).toBe("#00ff00");
    // どれも読めなければテーマ。透明になる値を当てさせない
    expect(resolveColor(["notacolor", "rgb(0 0 0)"], compute)).toBeUndefined();
  });

  it("選んだ値と算出結果の両方を返す（操作 UI の文字色に使う）", () => {
    expect(resolveColor(["#101418"], compute)).toEqual({
      value: "#101418",
      computed: "rgb(#101418)",
    });
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

describe("toHexColor", () => {
  it("算出済みの色を #rrggbb へ直す（FR-43）", () => {
    expect(toHexColor("rgb(18, 52, 86)")).toBe("#123456");
    expect(toHexColor("rgb(0, 0, 0)")).toBe("#000000");
    // 透明度は落とす。設定パネルの初期値にしか使わない
    expect(toHexColor("rgb(255 255 255 / 0.5)")).toBe("#ffffff");
  });

  it("色として読めない値は undefined", () => {
    expect(toHexColor("transparent")).toBeUndefined();
    expect(toHexColor("")).toBeUndefined();
  });

  it("完全に透明は黒にせず undefined にする", () => {
    // getComputedStyle は背景の指定が無いとき rgba(0, 0, 0, 0) を返す。
    // これを黒として扱うと、設定パネルが「いまの色は黒」と嘘をつく
    expect(toHexColor("rgba(0, 0, 0, 0)")).toBeUndefined();
    expect(toHexColor("rgb(255 255 255 / 0)")).toBeUndefined();
  });
});
