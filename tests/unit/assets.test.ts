import { describe, expect, it } from "vitest";

import { parseDeck } from "../../src/deck/parseDeck";
import { collectReferencedAssets, toAssetKey } from "../../src/view/assets";

/**
 * blob URL を作らない範囲（照合の規則）を単体で押さえる。
 * `URL.createObjectURL` を含む経路は E2E で確認する（D-20）。
 */

describe("toAssetKey", () => {
  it("相対パスからファイル名を取り出す", () => {
    expect(toAssetKey("./img/flow.png")).toBe("flow.png");
    expect(toAssetKey("../assets/flow.png")).toBe("flow.png");
    expect(toAssetKey("flow.png")).toBe("flow.png");
  });

  it("ルート基準のパスは取り込みの対象にしない", () => {
    // 配信元のファイルを指していて、原稿の隣にあるファイルではない
    expect(toAssetKey("/assets/flow.png")).toBeUndefined();
  });

  it("クエリとフラグメントを名前に含めない", () => {
    expect(toAssetKey("./flow.png?v=2")).toBe("flow.png");
    expect(toAssetKey("./flow.svg#layer")).toBe("flow.svg");
  });

  it("パーセントエンコードを戻す", () => {
    expect(toAssetKey("./%E5%9B%B3.png")).toBe("図.png");
  });

  it("絶対 URL は取り込みの対象にしない", () => {
    for (const reference of [
      "https://example.com/a.png",
      "http://example.com/a.png",
      "//example.com/a.png",
      "data:image/png;base64,AAAA",
      "blob:http://localhost/abc",
    ]) {
      expect(toAssetKey(reference)).toBeUndefined();
    }
  });

  it("名前が取れない参照は undefined", () => {
    expect(toAssetKey("")).toBeUndefined();
    expect(toAssetKey("./")).toBeUndefined();
  });
});

describe("collectReferencedAssets", () => {
  it("本文・補助部・背景の画像を集める", () => {
    const deck = parseDeck(
      [
        "@slide layout=cover background=./hero.jpg",
        "",
        "# 表紙",
        "",
        "---",
        "",
        "@slide layout=split",
        "",
        "![本文](./img/main.png)",
        "",
        "@aside",
        "",
        "![補助](../assets/side.webp)",
      ].join("\n"),
    );

    expect(collectReferencedAssets(deck).sort()).toEqual(
      ["hero.jpg", "main.png", "side.webp"].sort(),
    );
  });

  it("絶対 URL の画像は集めない", () => {
    const deck = parseDeck("![外部](https://example.com/a.png)\n\n![手元](./b.png)");

    expect(collectReferencedAssets(deck)).toEqual(["b.png"]);
  });

  it("同じ画像を何度参照しても 1 つにまとめる", () => {
    const deck = parseDeck("![1](./a.png)\n\n---\n\n![2](./img/a.png)");

    expect(collectReferencedAssets(deck)).toEqual(["a.png"]);
  });

  it("画像が無ければ空", () => {
    expect(collectReferencedAssets(parseDeck("# 見出しだけ"))).toEqual([]);
  });
});
