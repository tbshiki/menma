import type { Appearance } from "../storage/appearance";
import type { Deck } from "../deck/types";
import type { AssetBindings } from "./assets";
import { computeColor, isDarkBackground, resolveColor } from "./colors";
import { renderSlide } from "./renderSlide";

/**
 * デッキ全体を DOM へ起こす（設計 7 章）。
 *
 * MVP では全スライドを最初に作り、`hidden` で表示を切り替える。単純で、印刷と
 * 将来の一覧表示にもそのまま使える。仮想化が必要になったらこのモジュールを差し替える。
 */

export type DeckView = {
  root: HTMLElement;
  /** 16:9 の基準キャンバス。拡縮の対象（設計 5.2） */
  stage: HTMLElement;
  /** 表示するスライドを切り替える */
  showSlide(index: number): void;
};

export function renderDeck(
  deck: Deck,
  bindings: AssetBindings,
  appearance: Appearance = {},
): DeckView {
  const root = document.createElement("div");
  root.className = "mn-deck";
  root.dataset.theme = deck.meta.theme;

  // 色は UI の指定 → 原稿の指定 → テーマ の順で決める（FR-36、FR-37、D-21）。
  // CSS Custom Property として渡すので、解釈できない値は無視されるだけで済む（NFR-07）
  const pageBackground = resolveColor(appearance.pageBackground, deck.meta.pageBackground);
  const progressColor = resolveColor(appearance.progressColor, deck.meta.progressColor);

  applyColor(root, "--mn-page-bg", pageBackground);
  applyColor(root, "--mn-progress-color", progressColor);
  applyHudContrast(root, pageBackground);

  const stage = document.createElement("div");
  stage.className = "mn-stage";

  const slides = deck.slides.map((slide) => {
    const element = renderSlide(slide, bindings);
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
    stage,
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

/** 指定があるときだけテーマの色を上書きする */
function applyColor(root: HTMLElement, property: string, value: string | undefined): void {
  if (value !== undefined && value !== "") {
    root.style.setProperty(property, value);
  }
}

/**
 * 操作 UI は画面の隅（スライドの外）に出るため、背景が濃いと文字が埋もれる。
 * 背景の明るさを見て読める色を決める（D-21）。
 */
function applyHudContrast(root: HTMLElement, pageBackground: string | undefined): void {
  if (pageBackground === undefined) {
    return;
  }

  const computed = computeColor(pageBackground, root.ownerDocument);

  if (computed === undefined) {
    return;
  }

  if (isDarkBackground(computed)) {
    root.style.setProperty("--mn-hud-fg", "#f4f6f8");
    root.style.setProperty("--mn-hud-bg", "rgb(0 0 0 / 0.55)");
  }
}
