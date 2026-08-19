import type { Slide } from "../deck/types";

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
