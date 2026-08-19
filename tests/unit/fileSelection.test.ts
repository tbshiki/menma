import { describe, expect, it } from "vitest";

import { MAX_ASSETS_TOTAL_BYTES, MAX_ASSET_BYTES } from "../../src/deck/source";
import { describeRejected, selectFiles } from "../../src/view/fileSelection";

/** 指定した大きさのファイルを作る（中身は問わない） */
function file(name: string, bytes = 1): File {
  return new File([new Uint8Array(bytes)], name);
}

describe("selectFiles", () => {
  it("原稿と画像へ振り分ける", () => {
    const selection = selectFiles([file("talk.md"), file("a.png"), file("b.jpg")]);

    expect(selection.markdown?.name).toBe("talk.md");
    expect(selection.assets.map((asset) => asset.name)).toEqual(["a.png", "b.jpg"]);
    expect(selection.rejected).toEqual([]);
  });

  it("順番が入れ替わっても原稿を見つける", () => {
    const selection = selectFiles([file("a.png"), file("talk.md")]);

    expect(selection.markdown?.name).toBe("talk.md");
  });

  it("原稿が無ければ undefined", () => {
    const selection = selectFiles([file("a.png")]);

    expect(selection.markdown).toBeUndefined();
    expect(selection.assets).toHaveLength(1);
  });

  it("2 つ目以降の原稿は受け付けず、そのことを残す", () => {
    const selection = selectFiles([file("first.md"), file("second.md")]);

    expect(selection.markdown?.name).toBe("first.md");
    expect(selection.rejected).toEqual([{ name: "second.md", reason: "unsupported" }]);
  });

  it("対応外の形式を受け付けない", () => {
    const selection = selectFiles([file("talk.md"), file("movie.mp4")]);

    expect(selection.assets).toEqual([]);
    expect(selection.rejected).toEqual([{ name: "movie.mp4", reason: "unsupported" }]);
  });

  it("1 枚の上限を超える画像を受け付けない（FR-33）", () => {
    const selection = selectFiles([file("talk.md"), file("huge.png", MAX_ASSET_BYTES + 1)]);

    expect(selection.assets).toEqual([]);
    expect(selection.rejected).toEqual([{ name: "huge.png", reason: "too-large" }]);
  });

  it("上限ちょうどは受け付ける", () => {
    const selection = selectFiles([file("edge.png", MAX_ASSET_BYTES)]);

    expect(selection.assets).toHaveLength(1);
  });

  it("合計の上限を超えた分を受け付けない（FR-33）", () => {
    const count = Math.ceil(MAX_ASSETS_TOTAL_BYTES / MAX_ASSET_BYTES);
    const files = Array.from({ length: count + 1 }, (_, index) =>
      file(`image-${String(index)}.png`, MAX_ASSET_BYTES),
    );

    const selection = selectFiles(files);
    const total = selection.assets.reduce((sum, asset) => sum + asset.size, 0);

    expect(total).toBeLessThanOrEqual(MAX_ASSETS_TOTAL_BYTES);
    expect(selection.rejected.at(-1)?.reason).toBe("total-exceeded");
  });
});

describe("describeRejected", () => {
  it("受け付けたものだけなら何も言わない", () => {
    expect(describeRejected([])).toBeUndefined();
  });

  it("理由ごとにまとめて伝える", () => {
    const message = describeRejected([
      { name: "movie.mp4", reason: "unsupported" },
      { name: "huge.png", reason: "too-large" },
      { name: "extra.png", reason: "total-exceeded" },
    ]);

    expect(message).toContain("movie.mp4");
    expect(message).toContain("huge.png");
    expect(message).toContain("extra.png");
    expect(message).toContain("10MB");
    expect(message).toContain("50MB");
  });
});
