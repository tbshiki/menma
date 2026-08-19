import { clamp } from "../utils/clamp";
import type { NavigationController } from "./controller";

/**
 * URL のハッシュと表示位置の同期（FR-15、FR-16）。
 *
 * 表現は `#/N`（N は 1 始まり）。0 始まりの内部インデックスとの変換はここだけで行う。
 */

const HASH_PATTERN = /^#?\/(\d+)$/;

/**
 * ハッシュを 0 始まりのインデックスへ変換する。
 *
 * - 数値として解釈できない値は先頭ページ
 * - 範囲外の数値は近い端のページへ丸める（決定 D-03）
 */
export function parseHash(hash: string, total: number): number {
  const match = HASH_PATTERN.exec(hash.trim());

  if (!match) {
    return 0;
  }

  const page = Number(match[1]);

  if (!Number.isFinite(page) || page < 1) {
    return 0;
  }

  return clamp(page - 1, 0, total - 1);
}

/** 0 始まりのインデックスを `#/N` 形式へ変換する */
export function formatHash(index: number): string {
  return `#/${String(index + 1)}`;
}

/**
 * ハッシュと controller を双方向につなぐ。
 *
 * 無限ループは「同じ値なら何もしない」で防ぐ。`goTo()` は同じ位置なら通知せず、
 * ハッシュも現在と同じ文字列なら書き換えない。
 *
 * @returns 購読を解除する関数
 */
export function connectHash(controller: NavigationController, target: Window): () => void {
  const applyHash = (): void => {
    controller.goTo(parseHash(target.location.hash, controller.state.total));
  };

  // 初期位置はハッシュから決める。履歴を増やさないよう replaceState で正規化する
  applyHash();
  const normalized = formatHash(controller.state.current);
  if (target.location.hash !== normalized) {
    const { pathname, search } = target.location;
    target.history.replaceState(null, "", `${pathname}${search}${normalized}`);
  }

  const unsubscribe = controller.subscribe((state) => {
    const next = formatHash(state.current);
    if (target.location.hash !== next) {
      target.location.hash = next;
    }
  });

  target.addEventListener("hashchange", applyHash);

  return () => {
    unsubscribe();
    target.removeEventListener("hashchange", applyHash);
  };
}
