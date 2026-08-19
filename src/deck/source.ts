/**
 * 原稿の取得元と、その保存・復元（設計 14.1）。
 *
 * 原稿は URL へ載せない（D-19）。保存先はこのブラウザの `localStorage` だけで、
 * どこへも送信しない。
 */

/** 対応する拡張子。これ以外は受け付けない */
export const SUPPORTED_EXTENSIONS = [".md", ".markdown", ".txt"] as const;

export type DeckSource =
  /** 同梱のサンプル。本文は持たない（バンドル済みのものを使う） */
  | { kind: "sample" }
  | { kind: "file"; name: string; text: string }
  | { kind: "text"; text: string };

const STORAGE_KEY = "menma:source";
/** 保存形式の版。合わない値は捨てる */
const STORAGE_VERSION = 1;

type StoredSource = {
  version: number;
  source: DeckSource;
};

export function isSupportedFileName(name: string): boolean {
  const lower = name.toLowerCase();
  return SUPPORTED_EXTENSIONS.some((extension) => lower.endsWith(extension));
}

/** 取得元から原稿本文を取り出す。サンプルだけは同梱の本文を使う */
export function readSourceText(source: DeckSource, sampleText: string): string {
  return source.kind === "sample" ? sampleText : source.text;
}

/**
 * 保存された取得元を読む。
 *
 * 壊れた値・古い版・保存が使えない環境では undefined を返し、入口画面から始める。
 * ここで例外を投げると、保存の不具合だけでアプリが起動できなくなる。
 */
export function loadStoredSource(storage: Storage): DeckSource | undefined {
  let raw: string | null;

  try {
    raw = storage.getItem(STORAGE_KEY);
  } catch {
    return undefined;
  }

  if (raw === null) {
    return undefined;
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    return toDeckSource(parsed);
  } catch {
    return undefined;
  }
}

/** 取得元を保存する。容量超過などで失敗しても発表は続けられるようにする */
export function saveSource(storage: Storage, source: DeckSource): void {
  const stored: StoredSource = { version: STORAGE_VERSION, source };

  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(stored));
  } catch {
    // 保存できなくても、いま表示している原稿はそのまま使える
  }
}

export function clearStoredSource(storage: Storage): void {
  try {
    storage.removeItem(STORAGE_KEY);
  } catch {
    // 消せなくても実害はない
  }
}

/** 保存された値が今の形式に合っているかを確かめる */
function toDeckSource(value: unknown): DeckSource | undefined {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }

  const stored = value as Partial<StoredSource>;

  if (stored.version !== STORAGE_VERSION) {
    return undefined;
  }

  const source = stored.source;

  if (typeof source !== "object" || source === null) {
    return undefined;
  }

  const candidate = source as { kind?: unknown; name?: unknown; text?: unknown };

  if (candidate.kind === "sample") {
    return { kind: "sample" };
  }

  if (candidate.kind === "text" && typeof candidate.text === "string") {
    return { kind: "text", text: candidate.text };
  }

  if (
    candidate.kind === "file" &&
    typeof candidate.text === "string" &&
    typeof candidate.name === "string"
  ) {
    return { kind: "file", name: candidate.name, text: candidate.text };
  }

  return undefined;
}
