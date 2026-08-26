import type { PresentationState } from "../navigation/controller";

/**
 * 進み具合を示す画面下端のバー（FR-35）。
 *
 * ページ番号より先に「あとどれくらいか」が伝わる。発表の邪魔をしないよう、
 * 高さは数 px に留め、色はテーマのアクセントを使う。
 */

export type Progress = {
  root: HTMLElement;
  /** 実際に色が付く要素。設定パネルが現在の色を読む（FR-43） */
  bar: HTMLElement;
  update(state: PresentationState): void;
};

export function createProgress(): Progress {
  const root = document.createElement("div");
  root.className = "mn-progress";
  // 読み上げには不要。ページ番号が同じ情報を持つ
  root.setAttribute("aria-hidden", "true");

  const bar = document.createElement("div");
  bar.className = "mn-progress__bar";
  root.append(bar);

  return {
    root,
    bar,

    update(state: PresentationState): void {
      // 1 枚しかないデッキでは満杯にする（0 除算も避ける）
      const ratio = state.total <= 1 ? 1 : state.current / (state.total - 1);
      bar.style.setProperty("--mn-progress", String(ratio));
    },
  };
}
