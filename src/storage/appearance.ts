/**
 * 見た目の指定（FR-37）。
 *
 * 原稿とは別に、**この端末で見るときの好み**として保存する。原稿の指定より優先される（D-21）。
 * 小さな値しか持たないので `localStorage` を使う（原稿と画像は IndexedDB）。
 */

export type Appearance = {
  /** スライドの外側の色。未指定なら原稿かテーマに従う */
  pageBackground?: string;
  /** 進み具合のバーの色。未指定なら原稿かテーマに従う */
  progressColor?: string;
};

const STORAGE_KEY = "menma:appearance";

export function loadAppearance(target: Window): Appearance {
  let raw: string | null;

  try {
    raw = target.localStorage.getItem(STORAGE_KEY);
  } catch {
    return {};
  }

  if (raw === null) {
    return {};
  }

  try {
    return toAppearance(JSON.parse(raw));
  } catch {
    return {};
  }
}

export function saveAppearance(target: Window, appearance: Appearance): void {
  try {
    if (appearance.pageBackground === undefined && appearance.progressColor === undefined) {
      target.localStorage.removeItem(STORAGE_KEY);
      return;
    }
    target.localStorage.setItem(STORAGE_KEY, JSON.stringify(appearance));
  } catch {
    // 保存できなくても、いま表示している内容はそのまま使える
  }
}

/** 保存された値が今の形に合っているかを確かめる。合わなければ既定（未指定）に戻す */
function toAppearance(value: unknown): Appearance {
  if (typeof value !== "object" || value === null) {
    return {};
  }

  const record = value as Record<string, unknown>;
  const appearance: Appearance = {};

  if (typeof record["pageBackground"] === "string") {
    appearance.pageBackground = record["pageBackground"];
  }
  if (typeof record["progressColor"] === "string") {
    appearance.progressColor = record["progressColor"];
  }

  return appearance;
}
