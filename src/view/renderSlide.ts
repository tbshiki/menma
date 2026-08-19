import type { Slide } from "../deck/types";
import { applyAssets, resolveBackground, type AssetBindings } from "./assets";
import { toCssUrl } from "./cssValue";

/**
 * 1 枚のスライドを DOM へ起こす（設計 4 章）。
 *
 * レイアウトの違いは `data-layout` で表し、クラス名では表さない。
 * 利用者が `@slide class=...` で付けるクラスと衝突させないため。
 */
export function renderSlide(slide: Slide, bindings: AssetBindings): HTMLElement {
  const section = document.createElement("section");
  section.className = "mn-slide";
  section.dataset.layout = slide.layout;
  section.dataset.index = String(slide.index);

  if (slide.classes.length > 0) {
    section.classList.add(...slide.classes);
  }

  applyAppearance(section, slide, bindings);

  const main = document.createElement("div");
  main.className = "mn-slide__main";
  // innerHTML へ渡してよいのは Markdown パーサの出力だけ（NFR-07）。
  // raw HTML は parser 側で無効にしてある（FR-19）。
  main.innerHTML = slide.html;
  applyAssets(main, bindings);
  section.append(main);

  if (slide.asideHtml !== undefined) {
    const aside = document.createElement("div");
    aside.className = "mn-slide__aside";
    aside.innerHTML = slide.asideHtml;
    applyAssets(aside, bindings);
    section.append(aside);
  }

  return section;
}

/**
 * `@slide` で指定された見た目をスライドへ渡す。
 *
 * 値は CSS Custom Property として `setProperty()` で設定し、HTML 文字列や CSS テキストへは
 * 連結しない（NFR-07）。カスタムプロパティは `var()` で展開されるとき構文検査を受けるため、
 * 壊れた値を書いても宣言が無効になるだけで、別の宣言を差し込むことはできない。
 */
function applyAppearance(section: HTMLElement, slide: Slide, bindings: AssetBindings): void {
  if (slide.backgroundColor !== undefined) {
    section.style.setProperty("--mn-slide-bg", slide.backgroundColor);
  }

  if (slide.foreground !== undefined) {
    section.style.setProperty("--mn-slide-fg", slide.foreground);
  }

  // 取り込んだ画像があれば blob URL へ置き換える（設計 15.1）
  const background = resolveBackground(slide.background, bindings);

  if (background !== undefined) {
    const url = toCssUrl(background);
    if (url !== undefined) {
      section.style.setProperty("--mn-slide-bg-image", url);
    }
  }
}
