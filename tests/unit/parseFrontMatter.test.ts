import { describe, expect, it } from "vitest";

import { DeckError } from "../../src/deck/errors";
import { parseFrontMatter } from "../../src/deck/parseFrontMatter";
import { DEFAULT_DECK_META } from "../../src/deck/types";

describe("parseFrontMatter", () => {
  it("Front Matter が無い原稿はそのまま本文として返す", () => {
    const result = parseFrontMatter("# タイトル\n\n本文");

    expect(result.meta).toEqual(DEFAULT_DECK_META);
    expect(result.body).toBe("# タイトル\n\n本文");
    expect(result.bodyStartLine).toBe(1);
    expect(result.warnings).toEqual([]);
  });

  it("対応キーを読み取り、本文の開始行を返す", () => {
    const source = ["---", "title: 発表タイトル", "author: tbshiki", "---", "", "# 見出し"].join(
      "\n",
    );
    const result = parseFrontMatter(source);

    expect(result.meta.title).toBe("発表タイトル");
    expect(result.meta.author).toBe("tbshiki");
    expect(result.body).toBe("\n# 見出し");
    expect(result.bodyStartLine).toBe(5);
    expect(result.warnings).toEqual([]);
  });

  it("boolean を解釈する（大文字小文字を区別しない）", () => {
    const result = parseFrontMatter(
      ["---", "showPageNumber: FALSE", "showControls: true", "---", "本文"].join("\n"),
    );

    expect(result.meta.showPageNumber).toBe(false);
    expect(result.meta.showControls).toBe(true);
  });

  it("boolean 以外の値は既定値へフォールバックして警告する", () => {
    const result = parseFrontMatter(["---", "showPageNumber: yes", "---", "本文"].join("\n"));

    expect(result.meta.showPageNumber).toBe(DEFAULT_DECK_META.showPageNumber);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]?.kind).toBe("invalid-type");
    expect(result.warnings[0]?.line).toBe(2);
  });

  it("許容値の決まったキーに未対応の値を書くと警告する", () => {
    const result = parseFrontMatter(["---", "transition: fade", "---", "本文"].join("\n"));

    expect(result.meta.transition).toBe("none");
    expect(result.warnings[0]?.kind).toBe("invalid-type");
  });

  it("未知のキーは無視して警告する", () => {
    const result = parseFrontMatter(["---", "unknownKey: 1", "---", "本文"].join("\n"));

    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]?.kind).toBe("unknown-key");
    expect(result.warnings[0]?.line).toBe(2);
  });

  it("引用符を外し、引用符の外側のコメントだけを落とす", () => {
    const result = parseFrontMatter(
      ["---", 'title: "# 見出しではない"  # ここはコメント', "author: '田中'", "---", "本文"].join(
        "\n",
      ),
    );

    expect(result.meta.title).toBe("# 見出しではない");
    expect(result.meta.author).toBe("田中");
  });

  it("空白を挟まない # は値の一部として扱う", () => {
    const result = parseFrontMatter(["---", "title: C# 入門 # 補足", "---", "本文"].join("\n"));

    expect(result.meta.title).toBe("C# 入門");
  });

  it("コメント行と空行を無視する", () => {
    const result = parseFrontMatter(
      ["---", "# コメント", "", "lang: en", "---", "本文"].join("\n"),
    );

    expect(result.meta.lang).toBe("en");
    expect(result.warnings).toEqual([]);
  });

  it("Front Matter の中にある key: value でない行を警告する", () => {
    const result = parseFrontMatter(
      ["---", "title: あり", "これは設定ではない", "---", "本文"].join("\n"),
    );

    expect(result.meta.title).toBe("あり");
    expect(result.warnings[0]?.kind).toBe("invalid-type");
    expect(result.warnings[0]?.line).toBe(3);
  });

  it("閉じられていない Front Matter は DeckError を投げる", () => {
    expect(() => parseFrontMatter(["---", "title: 未完", "", "# 本文"].join("\n"))).toThrow(
      DeckError,
    );
  });

  it("設定を含まない先頭の --- は Front Matter として扱わない", () => {
    const source = ["---", "", "# 1 枚目", "", "---", "", "# 2 枚目"].join("\n");
    const result = parseFrontMatter(source);

    expect(result.body).toBe(source);
    expect(result.bodyStartLine).toBe(1);
    expect(result.warnings).toEqual([]);
  });

  it("設定を含まず閉じてもいない先頭の --- でもエラーにしない", () => {
    const source = ["---", "", "# 1 枚目のみ"].join("\n");

    expect(parseFrontMatter(source).body).toBe(source);
  });

  it("見出しに見える行だけでは Front Matter と認めない", () => {
    const source = ["---", "# 見出し: 副題", "---", "", "# 本文"].join("\n");

    expect(parseFrontMatter(source).body).toBe(source);
  });

  it("既定値のオブジェクトを書き換えない", () => {
    const result = parseFrontMatter(["---", "title: 変更", "---", "本文"].join("\n"));

    expect(result.meta.title).toBe("変更");
    expect(DEFAULT_DECK_META.title).toBe("menma");
  });

  it("値に含まれるコロンを保持する", () => {
    const result = parseFrontMatter(["---", "title: menma: 副題", "---", "本文"].join("\n"));

    expect(result.meta.title).toBe("menma: 副題");
  });
});
