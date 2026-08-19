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
 * 履歴の積み方は変更の起点で分ける。
 * - 操作（キーや UI）で移動したとき: 履歴へ積む。ブラウザの戻る／進むで辿れるようにするため
 * - ハッシュ側から来たとき（初期表示、戻る／進む、アドレスバー編集）: 置き換える。
 *   `#/0` のような不正値を履歴に残すと、戻るたびに正規化が繰り返されて前へ戻れなくなる
 *
 * @returns 購読を解除する関数
 */
export function connectHash(controller: NavigationController, target: Window): () => void {
  /** ハッシュ側から来た変更を処理している間だけ true */
  let applyingHash = false;

  const replaceHash = (next: string): void => {
    if (target.location.hash === next) {
      return;
    }
    const { pathname, search } = target.location;
    target.history.replaceState(null, "", `${pathname}${search}${next}`);
  };

  const applyHash = (): void => {
    applyingHash = true;
    try {
      controller.goTo(parseHash(target.location.hash, controller.state.total));
      // 位置が変わらない不正値（`#/0` や `#/abc`）もここで正規形へ直す。
      // controller の通知だけに任せると、同じ位置のときに URL が古いまま残る
      replaceHash(formatHash(controller.state.current));
    } finally {
      applyingHash = false;
    }
  };

  // 購読より先に初期位置を決める。`subscribe()` は登録時に現在状態を 1 度渡すため、
  // 順序を逆にすると URL のページ指定を読む前に `#/1` で上書きしてしまう
  applyHash();

  const unsubscribe = controller.subscribe((state) => {
    const next = formatHash(state.current);

    if (target.location.hash === next) {
      return;
    }

    if (applyingHash) {
      replaceHash(next);
      return;
    }

    target.location.hash = next;
  });

  target.addEventListener("hashchange", applyHash);

  return () => {
    unsubscribe();
    target.removeEventListener("hashchange", applyHash);
  };
}
