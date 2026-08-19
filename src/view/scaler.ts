/**
 * 基準キャンバスを表示領域へ収める（FR-09、設計 5.2）。
 *
 * **16:9 を崩さずに、縦か横のどちらかを画面いっぱいにする。**
 * 幅と高さの比率のうち小さいほうを採れば、はみ出さずに片方がぴったり埋まる。
 * キャンバスの大きさ（1600x900）は CSS 側の `.mn-stage` が正典で、ここでは実寸を読んで倍率だけ決める。
 */

/**
 * @param stage 拡縮する基準キャンバス
 * @param container 収める先。この要素のサイズ変化を監視する
 * @returns 監視を解除する関数
 */
export function connectScaler(stage: HTMLElement, container: HTMLElement): () => void {
  let frame = 0;

  const apply = (): void => {
    const canvasWidth = stage.offsetWidth;
    const canvasHeight = stage.offsetHeight;

    // 非表示などで実寸が取れないときは倍率を変えない
    if (canvasWidth <= 0 || canvasHeight <= 0) {
      return;
    }

    const scale = Math.min(
      container.clientWidth / canvasWidth,
      container.clientHeight / canvasHeight,
    );

    if (!Number.isFinite(scale) || scale <= 0) {
      return;
    }

    stage.style.setProperty("--mn-scale", String(scale));
  };

  // リサイズは連続して起きる。1 フレームに 1 回だけ計算する
  const schedule = (): void => {
    if (frame !== 0) {
      return;
    }
    frame = requestAnimationFrame(() => {
      frame = 0;
      apply();
    });
  };

  apply();

  const observer = new ResizeObserver(schedule);
  observer.observe(container);
  // キャンバス自身も監視する。スタイルシートの適用やフォントの読み込みで基準の実寸が
  // 後から変わることがあり、収める先だけを見ていると初回の誤った倍率が残る
  observer.observe(stage);

  return () => {
    observer.disconnect();
    if (frame !== 0) {
      cancelAnimationFrame(frame);
      frame = 0;
    }
  };
}
