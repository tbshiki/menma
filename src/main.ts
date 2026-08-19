import "./styles/reset.css";
import source from "../slides.md?raw";

import { DeckError } from "./deck/errors";
import { parseDeck } from "./deck/parseDeck";

const app = document.querySelector<HTMLElement>("#app");

if (!app) {
  throw new Error("[menma] マウント先 #app が見つかりません。");
}

// M1 の時点ではパース結果の確認だけを行う。
// スライドとしての描画とナビゲーションは M2（view/ と navigation/）で実装する。
const output = document.createElement("pre");

try {
  const deck = parseDeck(source);
  const lines = [
    `title: ${deck.meta.title}`,
    `slides: ${String(deck.slides.length)}`,
    "",
    ...deck.slides.map(
      (slide) =>
        `#${String(slide.index + 1)} layout=${slide.layout}` +
        (slide.asideHtml ? " +aside" : "") +
        (slide.notes ? " +notes" : ""),
    ),
    "",
    ...(deck.warnings.length === 0
      ? ["warnings: なし"]
      : deck.warnings.map(
          (warning) =>
            `warning(${warning.kind})${warning.line ? ` ${String(warning.line)} 行目` : ""}: ${warning.message}`,
        )),
  ];
  output.textContent = lines.join("\n");
} catch (error) {
  output.textContent =
    error instanceof DeckError
      ? `${error.userMessage}\n\n${error.message}`
      : `原稿を読み込めませんでした。\n\n${String(error)}`;
}

app.append(output);
