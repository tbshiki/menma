import { describe, expect, it } from "vitest";

import { parseDirectives } from "../../src/deck/parseDirectives";
import type { RawSlide } from "../../src/deck/types";

function slide(source: string, startLine = 1): RawSlide {
  return { source, startLine };
}

describe("parseDirectives", () => {
  it("ディレクティブが無ければ既定のレイアウトになる", () => {
    const result = parseDirectives(slide("# 見出し\n\n本文"));

    expect(result.layout).toBe("default");
    expect(result.classes).toEqual([]);
    expect(result.main).toBe("# 見出し\n\n本文");
    expect(result.aside).toBeUndefined();
    expect(result.notes).toBeUndefined();
    expect(result.warnings).toEqual([]);
  });

  it("最初の行の @slide から属性を読む", () => {
    const result = parseDirectives(
      slide('@slide layout=cover background="./assets/hero.jpg" class=intro\n\n# 表紙'),
    );

    expect(result.layout).toBe("cover");
    expect(result.background).toBe("./assets/hero.jpg");
    expect(result.classes).toEqual(["intro"]);
    expect(result.main).toBe("# 表紙");
  });

  it("class を空白区切りで複数指定できる", () => {
    const result = parseDirectives(slide('@slide class="intro dark-theme"\n\n本文'));

    expect(result.classes).toEqual(["intro", "dark-theme"]);
  });

  it("未知の layout は default へフォールバックして警告する", () => {
    const result = parseDirectives(slide("@slide layout=fancy\n\n本文"));

    expect(result.layout).toBe("default");
    expect(result.warnings[0]?.kind).toBe("unknown-layout");
  });

  it("許可されていない属性を無視して警告する", () => {
    const result = parseDirectives(slide("@slide onclick=alert style=color:red\n\n本文"));

    expect(result.warnings.map((warning) => warning.kind)).toEqual([
      "unknown-attribute",
      "unknown-attribute",
    ]);
  });

  it("name=value の形式でない指定を警告する", () => {
    const result = parseDirectives(slide("@slide center\n\n本文"));

    expect(result.warnings[0]?.kind).toBe("invalid-type");
  });

  it("class に使えない文字を弾く", () => {
    const result = parseDirectives(slide('@slide class="ok あ"\n\n本文'));

    expect(result.classes).toEqual(["ok"]);
    expect(result.warnings[0]?.kind).toBe("invalid-type");
  });

  it("mn- で始まるクラス名を拒否する", () => {
    const result = parseDirectives(slide('@slide class="intro mn-slide"\n\n本文'));

    expect(result.classes).toEqual(["intro"]);
    expect(result.warnings[0]?.kind).toBe("invalid-type");
  });

  it("@aside で本文を主要部と補助部へ分ける", () => {
    const result = parseDirectives(
      slide(["@slide layout=split", "", "# 左", "", "@aside", "", "![図](./a.png)"].join("\n")),
    );

    expect(result.main).toBe("# 左");
    expect(result.aside).toBe("![図](./a.png)");
  });

  it("2 つ目の @aside は本文として残し、警告する", () => {
    const result = parseDirectives(
      slide(["# 見出し", "", "@aside", "", "補助", "", "@aside", "", "続き"].join("\n"), 10),
    );

    expect(result.aside).toBe("補助\n\n@aside\n\n続き");
    expect(result.warnings[0]?.kind).toBe("duplicate-directive");
    expect(result.warnings[0]?.line).toBe(16);
  });

  it("@notes 以降を発表者ノートとして切り出す", () => {
    const result = parseDirectives(
      slide(["# 見出し", "", "本文", "", "@notes", "", "2 分で話す"].join("\n")),
    );

    expect(result.main).toBe("# 見出し\n\n本文");
    expect(result.notes).toBe("2 分で話す");
  });

  it("@notes より後ろのディレクティブはノート本文として扱う", () => {
    const result = parseDirectives(
      slide(["# 見出し", "", "@notes", "", "@aside と書いても本文", ""].join("\n")),
    );

    expect(result.aside).toBeUndefined();
    expect(result.notes).toBe("@aside と書いても本文");
  });

  it("@aside と @notes を併記できる", () => {
    const result = parseDirectives(
      slide(["# 左", "", "@aside", "", "右", "", "@notes", "", "メモ"].join("\n")),
    );

    expect(result.main).toBe("# 左");
    expect(result.aside).toBe("右");
    expect(result.notes).toBe("メモ");
  });

  it("2 つ目の @slide は本文として残し、警告する", () => {
    const result = parseDirectives(
      slide(["@slide layout=center", "", "# 見出し", "", "@slide layout=cover"].join("\n")),
    );

    expect(result.layout).toBe("center");
    expect(result.main).toBe("# 見出し\n\n@slide layout=cover");
    expect(result.warnings[0]?.kind).toBe("duplicate-directive");
  });

  it("最初の非空行でない @slide はディレクティブとして扱わない", () => {
    const result = parseDirectives(slide("# 見出し\n\n@slide layout=cover"));

    expect(result.layout).toBe("default");
    expect(result.warnings[0]?.kind).toBe("duplicate-directive");
  });

  it("コードフェンスの中のディレクティブを解釈しない", () => {
    const source = ["# 記法の説明", "", "```md", "@slide layout=center", "@aside", "```"].join(
      "\n",
    );
    const result = parseDirectives(slide(source));

    expect(result.layout).toBe("default");
    expect(result.aside).toBeUndefined();
    expect(result.warnings).toEqual([]);
    expect(result.main).toBe(source);
  });
});
