import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  clearStoredSource,
  isSupportedFileName,
  loadStoredSource,
  readSourceText,
  saveSource,
  type DeckSource,
} from "../../src/deck/source";

/** localStorage の代わり。壊れた値や失敗する保存も再現できるようにしておく */
function createStorage(initial: Record<string, string> = {}): Storage {
  const data = new Map(Object.entries(initial));

  return {
    get length() {
      return data.size;
    },
    clear: () => {
      data.clear();
    },
    getItem: (key: string) => data.get(key) ?? null,
    key: (index: number) => [...data.keys()][index] ?? null,
    removeItem: (key: string) => {
      data.delete(key);
    },
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
  };
}

let storage: Storage;

beforeEach(() => {
  storage = createStorage();
});

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

describe("readSourceText", () => {
  it("サンプルは同梱の本文を使う", () => {
    expect(readSourceText({ kind: "sample" }, "サンプル本文")).toBe("サンプル本文");
  });

  it("ファイルと貼り付けは自分の本文を使う", () => {
    expect(readSourceText({ kind: "file", name: "a.md", text: "A" }, "サンプル")).toBe("A");
    expect(readSourceText({ kind: "text", text: "B" }, "サンプル")).toBe("B");
  });
});

describe("saveSource / loadStoredSource", () => {
  it("保存した取得元を読み戻せる", () => {
    const sources: DeckSource[] = [
      { kind: "sample" },
      { kind: "text", text: "# 貼り付け" },
      { kind: "file", name: "talk.md", text: "# ファイル" },
    ];

    for (const source of sources) {
      saveSource(storage, source);
      expect(loadStoredSource(storage)).toEqual(source);
    }
  });

  it("何も保存されていなければ undefined", () => {
    expect(loadStoredSource(storage)).toBeUndefined();
  });

  it("壊れた値は捨てる", () => {
    for (const raw of ["", "{", "null", '"文字列"', "[]"]) {
      storage.setItem("menma:source", raw);
      expect(loadStoredSource(storage)).toBeUndefined();
    }
  });

  it("版が違う保存は捨てる", () => {
    storage.setItem("menma:source", JSON.stringify({ version: 99, source: { kind: "sample" } }));

    expect(loadStoredSource(storage)).toBeUndefined();
  });

  it("形の合わない取得元は捨てる", () => {
    for (const source of [{ kind: "unknown" }, { kind: "text" }, { kind: "file", name: "a.md" }]) {
      storage.setItem("menma:source", JSON.stringify({ version: 1, source }));
      expect(loadStoredSource(storage)).toBeUndefined();
    }
  });

  it("保存を消せる", () => {
    saveSource(storage, { kind: "sample" });
    clearStoredSource(storage);

    expect(loadStoredSource(storage)).toBeUndefined();
  });

  it("保存に失敗しても例外を投げない（容量超過など）", () => {
    const failing = createStorage();
    vi.spyOn(failing, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });

    expect(() => {
      saveSource(failing, { kind: "text", text: "長い原稿" });
    }).not.toThrow();
  });

  it("読み取りに失敗しても例外を投げない（プライベートモードなど）", () => {
    const failing = createStorage();
    vi.spyOn(failing, "getItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });

    expect(loadStoredSource(failing)).toBeUndefined();
  });
});
