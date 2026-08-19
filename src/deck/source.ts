/**
 * 原稿の取得元の型と検証（設計 14.1、15 章）。
 *
 * 保存そのものは `storage/deckStore.ts` が担う。ここは形と規則だけを持ち、
 * ブラウザの保存 API には触らない。
 */

/** 原稿として受け付ける拡張子 */
export const SUPPORTED_EXTENSIONS = [".md", ".markdown", ".txt"] as const;

/** 画像として受け付ける拡張子（設計 15 章） */
export const SUPPORTED_IMAGE_EXTENSIONS = [
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".avif",
  ".svg",
] as const;

/** 画像 1 枚の上限 */
export const MAX_ASSET_BYTES = 10 * 1024 * 1024;
/** 画像の合計の上限 */
export const MAX_ASSETS_TOTAL_BYTES = 50 * 1024 * 1024;

/** 保存形式の版。合わない値は捨てる */
export const SOURCE_FORMAT_VERSION = 1;

/** 原稿と一緒に選ばれた画像。ファイル名だけで照合する（D-20） */
export type DeckAsset = {
  name: string;
  blob: Blob;
};

export type DeckSource =
  /** 同梱のサンプル。本文も画像も持たない（バンドル済みのものを使う） */
  | { kind: "sample" }
  | { kind: "file"; name: string; text: string; assets: readonly DeckAsset[] }
  | { kind: "text"; text: string; assets: readonly DeckAsset[] };

export type StoredSource = {
  version: number;
  source: DeckSource;
};

export function isSupportedFileName(name: string): boolean {
  return hasExtension(name, SUPPORTED_EXTENSIONS);
}

export function isSupportedImageName(name: string): boolean {
  return hasExtension(name, SUPPORTED_IMAGE_EXTENSIONS);
}

/** 取得元が持つ画像。サンプルは画像を持たない */
export function sourceAssets(source: DeckSource): readonly DeckAsset[] {
  return source.kind === "sample" ? [] : source.assets;
}

/** 取得元から原稿本文を取り出す。サンプルだけは同梱の本文を使う */
export function readSourceText(source: DeckSource, sampleText: string): string {
  return source.kind === "sample" ? sampleText : source.text;
}

/**
 * 保存されていた値が今の形式に合っているかを確かめる。
 *
 * 合わなければ undefined を返し、呼び出し側は入口画面から始める。ここで例外を投げると、
 * 保存の不具合だけでアプリが起動できなくなる。
 */
export function toStoredDeckSource(value: unknown): DeckSource | undefined {
  if (!isRecord(value) || value["version"] !== SOURCE_FORMAT_VERSION) {
    return undefined;
  }

  const source = value["source"];

  if (!isRecord(source)) {
    return undefined;
  }

  if (source["kind"] === "sample") {
    return { kind: "sample" };
  }

  const text = source["text"];
  const assets = toDeckAssets(source["assets"]);

  if (typeof text !== "string" || !assets) {
    return undefined;
  }

  if (source["kind"] === "text") {
    return { kind: "text", text, assets };
  }

  const name = source["name"];

  if (source["kind"] === "file" && typeof name === "string") {
    return { kind: "file", name, text, assets };
  }

  return undefined;
}

function toDeckAssets(value: unknown): DeckAsset[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const assets: DeckAsset[] = [];

  for (const item of value as unknown[]) {
    if (!isRecord(item)) {
      return undefined;
    }

    const name = item["name"];
    const blob = item["blob"];

    if (typeof name !== "string" || !(blob instanceof Blob)) {
      return undefined;
    }

    assets.push({ name, blob });
  }

  return assets;
}

function hasExtension(name: string, extensions: readonly string[]): boolean {
  const lower = name.toLowerCase();
  return extensions.some((extension) => lower.endsWith(extension));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
