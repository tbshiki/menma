import { describe, expect, it } from "vitest";

import { clamp } from "../../src/utils/clamp";

describe("clamp", () => {
  it("範囲内の値をそのまま返す", () => {
    expect(clamp(3, 1, 10)).toBe(3);
  });

  it("下限より小さい値を下限へ丸める", () => {
    expect(clamp(0, 1, 10)).toBe(1);
    expect(clamp(-5, 1, 10)).toBe(1);
  });

  it("上限より大きい値を上限へ丸める", () => {
    expect(clamp(9999, 1, 10)).toBe(10);
  });

  it("境界値をそのまま返す", () => {
    expect(clamp(1, 1, 10)).toBe(1);
    expect(clamp(10, 1, 10)).toBe(10);
  });

  it("NaN を下限として扱う", () => {
    expect(clamp(Number.NaN, 1, 10)).toBe(1);
  });

  it("上限が下限より小さい場合は下限を返す", () => {
    expect(clamp(5, 1, 0)).toBe(1);
  });
});
