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

/** 本文を同梱している取得元。保存するのは種類だけで足りる */
export const BUNDLED_KINDS = ["sample", "manual"] as const;

export type BundledKind = (typeof BUNDLED_KINDS)[number];

/** 同梱の原稿。サンプルと書き方のマニュアル（D-26） */
export type BundledText = Readonly<Record<BundledKind, string>>;

export type DeckSource =
  /** 同梱のサンプルとマニュアル。本文も画像も持たない（バンドル済みのものを使う） */
  | { kind: BundledKind }
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

/** 同梱の原稿かどうか。本文を持たない取得元を 1 か所で判定する */
export function isBundled(source: DeckSource): source is { kind: BundledKind } {
  return (BUNDLED_KINDS as readonly string[]).includes(source.kind);
}

/** 取得元が持つ画像。同梱の原稿は画像を持たない */
export function sourceAssets(source: DeckSource): readonly DeckAsset[] {
  return isBundled(source) ? [] : source.assets;
}

/** 取得元から原稿本文を取り出す。同梱の原稿だけはバンドル済みの本文を使う */
export function readSourceText(source: DeckSource, bundled: BundledText): string {
  return isBundled(source) ? bundled[source.kind] : source.text;
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

  const kind = source["kind"];

  if (typeof kind === "string" && (BUNDLED_KINDS as readonly string[]).includes(kind)) {
    return { kind: kind as BundledKind };
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
