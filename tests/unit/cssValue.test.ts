import { describe, expect, it } from "vitest";

import { toCssUrl } from "../../src/view/cssValue";

describe("toCssUrl", () => {
  it("通常のパスを url() へ包む", () => {
    expect(toCssUrl("/assets/hero.jpg")).toBe('url("/assets/hero.jpg")');
    expect(toCssUrl("./images/背景 1.png")).toBe('url("./images/背景 1.png")');
  });

  it("url() の括りを抜け出せる文字を含むパスは使わない（NFR-07）", () => {
    for (const path of [
      'a.jpg"); background: red; content: "',
      "a.jpg'); color: red",
      "a.jpg)",
      "a.jpg\\",
      "a.jpg\nbackground: red",
      "a.jpg\rbackground: red",
    ]) {
      expect(toCssUrl(path)).toBeUndefined();
    }
  });

  it("空文字は使わない", () => {
    expect(toCssUrl("")).toBeUndefined();
  });
});
