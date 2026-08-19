import type { DeckAsset } from "../deck/source";
import type { Deck } from "../deck/types";

/**
 * 取り込んだ画像を、原稿の相対パス参照へ結び付ける（設計 15.1、FR-31）。
 *
 * ファイル選択からはフォルダ構造が得られないため、**ファイル名だけで照合する**（D-20）。
 */

/**
 * 取り込みの対象にしない参照（そのまま読み込む）。
 *
 * `/assets/a.png` のようなルート基準のパスは、配信元のファイルを指していて
 * 原稿の隣にあるファイルではない。取り込みの対象は相対パスだけにする。
 */
const ABSOLUTE_REFERENCE = /^(https?:)?\/\/|^\/|^data:|^blob:/i;

export type AssetBindings = {
  /** ファイル名 → blob URL */
  urls: ReadonlyMap<string, string>;
  /** 同じ名前が複数選ばれた場合の名前 */
  duplicates: readonly string[];
  /** blob URL をまとめて解放する */
  release(): void;
};

/** 参照からファイル名を取り出す。`./img/a.png` も `../assets/a.png` も `a.png` */
export function toAssetKey(reference: string): string | undefined {
  if (reference === "" || ABSOLUTE_REFERENCE.test(reference)) {
    return undefined;
  }

  // クエリやフラグメントは名前の一部ではない
  const path = reference.split(/[?#]/)[0] ?? "";
  const name = path.split("/").pop() ?? "";

  if (name === "") {
    return undefined;
  }

  try {
    return decodeURIComponent(name);
  } catch {
    return name;
  }
}

/** 原稿が参照している画像の名前を集める（本文の img と `@slide background`） */
export function collectReferencedAssets(deck: Deck): string[] {
  const names = new Set<string>();

  for (const slide of deck.slides) {
    for (const html of [slide.html, slide.asideHtml ?? ""]) {
      for (const match of html.matchAll(/<img\b[^>]*\bsrc="([^"]*)"/gi)) {
        addKey(names, match[1]);
      }
    }
    addKey(names, slide.background);
  }

  return [...names];
}

/**
 * 画像を blob URL へ変換して名前で引けるようにする。
 *
 * 作った URL は `release()` でまとめて解放する。放っておくとページを離れるまで残る（設計 15.2）。
 */
export function createAssetBindings(assets: readonly DeckAsset[]): AssetBindings {
  const urls = new Map<string, string>();
  const duplicates: string[] = [];

  for (const asset of assets) {
    const key = toAssetKey(asset.name) ?? asset.name;

    if (urls.has(key)) {
      // 同名は最初のものを使う（D-20）
      duplicates.push(key);
      continue;
    }

    urls.set(key, URL.createObjectURL(asset.blob));
  }

  return {
    urls,
    duplicates,
    release(): void {
      for (const url of urls.values()) {
        URL.revokeObjectURL(url);
      }
      urls.clear();
    },
  };
}

/** スライド内の相対パス画像を、取り込んだ画像へ差し替える */
export function applyAssets(slide: HTMLElement, bindings: AssetBindings): void {
  for (const image of slide.querySelectorAll("img")) {
    const key = toAssetKey(image.getAttribute("src") ?? "");
    const url = key === undefined ? undefined : bindings.urls.get(key);

    if (url !== undefined) {
      image.src = url;
    }
  }
}

/** 背景画像の参照を、取り込んだ画像の blob URL へ置き換える */
export function resolveBackground(
  background: string | undefined,
  bindings: AssetBindings,
): string | undefined {
  if (background === undefined) {
    return undefined;
  }

  const key = toAssetKey(background);
  return key === undefined ? background : (bindings.urls.get(key) ?? background);
}

/** 原稿が参照しているのに選ばれていない画像の名前 */
export function findMissingAssets(deck: Deck, bindings: AssetBindings): string[] {
  return collectReferencedAssets(deck).filter((name) => !bindings.urls.has(name));
}

function addKey(names: Set<string>, reference: string | undefined): void {
  if (reference === undefined) {
    return;
  }

  const key = toAssetKey(reference);

  if (key !== undefined) {
    names.add(key);
  }
}
