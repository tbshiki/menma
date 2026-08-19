import { describe, expect, it } from "vitest";

import { formatHash, parseHash } from "../../src/navigation/hash";

describe("parseHash", () => {
  it("1 始まりのページ番号を 0 始まりのインデックスへ変換する", () => {
    expect(parseHash("#/1", 10)).toBe(0);
    expect(parseHash("#/5", 10)).toBe(4);
  });

  it("先頭の # が無くても解釈する", () => {
    expect(parseHash("/3", 10)).toBe(2);
  });

  it("解釈できない値は先頭ページにする", () => {
    for (const hash of ["", "#", "#/", "#/abc", "#/1.5", "#/ 2", "#abc", "#/2x"]) {
      expect(parseHash(hash, 10)).toBe(0);
    }
  });

  it("1 未満は先頭ページにする", () => {
    expect(parseHash("#/0", 10)).toBe(0);
    expect(parseHash("#/-1", 10)).toBe(0);
  });

  it("総数を超えた指定は最終ページへ丸める（D-03）", () => {
    expect(parseHash("#/9999", 10)).toBe(9);
    expect(parseHash("#/11", 10)).toBe(9);
  });

  it("スライドが 1 枚のときは常に先頭ページ", () => {
    expect(parseHash("#/7", 1)).toBe(0);
  });
});

describe("formatHash", () => {
  it("0 始まりのインデックスを #/N へ変換する", () => {
    expect(formatHash(0)).toBe("#/1");
    expect(formatHash(23)).toBe("#/24");
  });

  it("parseHash と往復できる", () => {
    for (const index of [0, 3, 9]) {
      expect(parseHash(formatHash(index), 10)).toBe(index);
    }
  });
});
