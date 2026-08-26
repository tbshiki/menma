import { describe, expect, it } from "vitest";

import {
  isDefaultAppearance,
  loadAppearance,
  saveAppearance,
  type Appearance,
} from "../../src/storage/appearance";

/**
 * 見た目の指定の保存（FR-37、FR-43）。
 *
 * `localStorage` は偽物で足りる。壊れた値でも既定へ戻せることを見る。
 */

const KEY = "menma:appearance";

function fakeWindow(initial?: string): { target: Window; store: Map<string, string> } {
  const store = new Map<string, string>();

  if (initial !== undefined) {
    store.set(KEY, initial);
  }

  const localStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
  };

  return { target: { localStorage } as unknown as Window, store };
}

describe("isDefaultAppearance", () => {
  it("何も指定が無いときだけ既定とみなす", () => {
    expect(isDefaultAppearance({})).toBe(true);
    expect(isDefaultAppearance({ showProgress: false })).toBe(false);
    expect(isDefaultAppearance({ pageBackground: "#fff" })).toBe(false);
  });
});

describe("loadAppearance / saveAppearance", () => {
  it("色とバーの表示を往復できる", () => {
    const { target } = fakeWindow();
    const appearance: Appearance = {
      pageBackground: "#102030",
      progressColor: "#f97316",
      showProgress: false,
    };

    saveAppearance(target, appearance);

    expect(loadAppearance(target)).toEqual(appearance);
  });

  it("何も指定が無くなったら保存そのものを消す", () => {
    const { target, store } = fakeWindow();

    saveAppearance(target, { showProgress: true });
    expect(store.has(KEY)).toBe(true);

    saveAppearance(target, {});
    expect(store.has(KEY)).toBe(false);
    expect(loadAppearance(target)).toEqual({});
  });

  it("バーの表示は真偽値以外を受け取らない", () => {
    const { target } = fakeWindow(JSON.stringify({ showProgress: "false" }));

    expect(loadAppearance(target)).toEqual({});
  });

  it("壊れた保存は既定へ戻す", () => {
    for (const raw of ["{", "null", "42", '"文字列"', "[]"]) {
      expect(loadAppearance(fakeWindow(raw).target)).toEqual({});
    }
  });

  it("知らないキーは無視する", () => {
    const { target } = fakeWindow(JSON.stringify({ pageBackground: "#fff", theme: "dark" }));

    expect(loadAppearance(target)).toEqual({ pageBackground: "#fff" });
  });
});
