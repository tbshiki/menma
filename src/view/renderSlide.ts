import type { Slide } from "../deck/types";
import { toCssUrl } from "./cssValue";

/**
 * 1 枚のスライドを DOM へ起こす（設計 4 章）。
 *
 * レイアウトの違いは `data-layout` で表し、クラス名では表さない。
 * 利用者が `@slide class=...` で付けるクラスと衝突させないため。
 */
export function renderSlide(slide: Slide): HTMLElement {
  const section = document.createElement("section");
  section.className = "mn-slide";
  section.dataset.layout = slide.layout;
  section.dataset.index = String(slide.index);

  if (slide.classes.length > 0) {
    section.classList.add(...slide.classes);
  }

  applyAppearance(section, slide);

  const main = document.createElement("div");
  main.className = "mn-slide__main";
  // innerHTML へ渡してよいのは Markdown パーサの出力だけ（NFR-07）。
  // raw HTML は parser 側で無効にしてある（FR-19）。
  main.innerHTML = slide.html;
  section.append(main);

  if (slide.asideHtml !== undefined) {
    const aside = document.createElement("div");
    aside.className = "mn-slide__aside";
    aside.innerHTML = slide.asideHtml;
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
function applyAppearance(section: HTMLElement, slide: Slide): void {
  if (slide.backgroundColor !== undefined) {
    section.style.setProperty("--mn-slide-bg", slide.backgroundColor);
  }

  if (slide.foreground !== undefined) {
    section.style.setProperty("--mn-slide-fg", slide.foreground);
  }

  if (slide.background !== undefined) {
    const url = toCssUrl(slide.background);
    if (url !== undefined) {
      section.style.setProperty("--mn-slide-bg-image", url);
    }
  }
}
