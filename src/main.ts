import "./styles/reset.css";
import "./styles/deck.css";
import source from "../slides.md?raw";

import { DeckError } from "./deck/errors";
import { parseDeck } from "./deck/parseDeck";
import { NavigationController } from "./navigation/controller";
import { connectHash } from "./navigation/hash";
import { connectKeyboard } from "./navigation/keyboard";
import { createHud } from "./view/hud";
import { renderDeck } from "./view/renderDeck";

const app = document.querySelector<HTMLElement>("#app");

if (!app) {
  throw new Error("[menma] マウント先 #app が見つかりません。");
}

try {
  const deck = parseDeck(source);

  document.title = deck.meta.title;
  document.documentElement.lang = deck.meta.lang;

  const view = renderDeck(deck);
  const hud = createHud({ showPageNumber: deck.meta.showPageNumber });
  view.root.append(hud.root);
  app.append(view.root);

  const controller = new NavigationController(deck.slides.length);

  // 描画は購読側にまとめる。位置を変えるのは controller.goTo() だけ
  controller.subscribe((state) => {
    view.showSlide(state.current);
    hud.update(state);
  });

  connectHash(controller, window);
  connectKeyboard(controller, window);
} catch (error) {
  // 専用のエラー画面は M4（view/errorScreen.ts）で作る。それまでの暫定表示
  const fallback = document.createElement("p");
  fallback.className = "mn-error";
  fallback.textContent =
    error instanceof DeckError ? error.userMessage : "原稿を読み込めませんでした。";
  app.append(fallback);
}
