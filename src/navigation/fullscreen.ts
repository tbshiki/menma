/**
 * 全画面表示（FR-17）。
 *
 * 必須機能ではなく Progressive Enhancement として扱う。API が無い環境でも発表は続けられる。
 */

export function isFullscreenSupported(target: Document): boolean {
  return target.fullscreenEnabled;
}

export function isFullscreen(target: Document): boolean {
  return target.fullscreenElement !== null;
}

/**
 * 全画面を切り替える。
 *
 * 失敗しても発表を止めない。ブラウザは「ユーザー操作が起点でない」などの理由で拒否できる。
 */
export async function toggleFullscreen(element: Element): Promise<void> {
  const doc = element.ownerDocument;

  if (!isFullscreenSupported(doc)) {
    return;
  }

  try {
    if (isFullscreen(doc)) {
      await doc.exitFullscreen();
    } else {
      await element.requestFullscreen();
    }
  } catch {
    // 拒否された場合は通常表示のまま続ける
  }
}

/**
 * 全画面状態の変化を購読する。
 *
 * @returns 購読を解除する関数
 */
export function onFullscreenChange(
  target: Document,
  listener: (active: boolean) => void,
): () => void {
  const handle = (): void => {
    listener(isFullscreen(target));
  };

  target.addEventListener("fullscreenchange", handle);
  handle();

  return () => {
    target.removeEventListener("fullscreenchange", handle);
  };
}
