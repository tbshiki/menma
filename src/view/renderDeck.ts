import type { Deck } from "../deck/types";
import { renderSlide } from "./renderSlide";

/**
 * デッキ全体を DOM へ起こす（設計 7 章）。
 *
 * MVP では全スライドを最初に作り、`hidden` で表示を切り替える。単純で、印刷と
 * 将来の一覧表示にもそのまま使える。仮想化が必要になったらこのモジュールを差し替える。
 */

export type DeckView = {
  root: HTMLElement;
  /** 表示するスライドを切り替える */
  showSlide(index: number): void;
};

export function renderDeck(deck: Deck): DeckView {
  const root = document.createElement("div");
  root.className = "mn-deck";
  root.dataset.theme = deck.meta.theme;

  const stage = document.createElement("div");
  stage.className = "mn-stage";

  const slides = deck.slides.map((slide) => {
    const element = renderSlide(slide);
    // 生成時点では全て非表示にしておく。表示するのは showSlide() だけの責務にして、
    // DOM へ挿入した瞬間に全スライドが並ぶ状態を作らない
    element.hidden = true;
    return element;
  });

  // 1 枚ずつ挿入せず、まとめて 1 回で足す
  const fragment = document.createDocumentFragment();
  fragment.append(...slides);
  stage.append(fragment);
  root.append(stage);

  let visible: HTMLElement | undefined;

  return {
    root,
    showSlide(index: number): void {
      const next = slides[index];

      // 切り替えは 2 枚だけ触る。スライド数が増えても移動のコストを一定に保つ
      if (!next || next === visible) {
        return;
      }

      if (visible) {
        visible.hidden = true;
      }
      next.hidden = false;
      visible = next;
    },
  };
}
