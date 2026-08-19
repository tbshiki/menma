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

  const slides = deck.slides.map((slide) => renderSlide(slide));
  stage.append(...slides);
  root.append(stage);

  return {
    root,
    showSlide(index: number): void {
      slides.forEach((element, position) => {
        element.hidden = position !== index;
      });
    },
  };
}
