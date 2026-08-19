import "./styles/reset.css";
import "./styles/deck.css";
import "./styles/layouts.css";
import "./styles/themes/default.css";
import source from "../slides.md?raw";

import { DeckError } from "./deck/errors";
import { parseDeck } from "./deck/parseDeck";
import { NavigationController } from "./navigation/controller";
import {
  isFullscreenSupported,
  onFullscreenChange,
  toggleFullscreen,
} from "./navigation/fullscreen";
import { connectHash } from "./navigation/hash";
import { connectKeyboard } from "./navigation/keyboard";
import { createHud } from "./view/hud";
import { renderDeck } from "./view/renderDeck";
import { connectScaler } from "./view/scaler";

const app = document.querySelector<HTMLElement>("#app");

if (!app) {
  throw new Error("[menma] マウント先 #app が見つかりません。");
}

try {
  const deck = parseDeck(source);

  document.title = deck.meta.title;
  document.documentElement.lang = deck.meta.lang;

  const view = renderDeck(deck);
  const controller = new NavigationController(deck.slides.length);

  // 全画面は使える環境でだけ提供する（FR-17 は Progressive Enhancement）
  const fullscreenAvailable = isFullscreenSupported(document);
  const requestToggleFullscreen = fullscreenAvailable
    ? (): void => {
        void toggleFullscreen(view.root);
      }
    : undefined;

  const hud = createHud({
    showPageNumber: deck.meta.showPageNumber,
    showControls: deck.meta.showControls,
    onPrevious: () => {
      controller.previous();
    },
    onNext: () => {
      controller.next();
    },
    onToggleFullscreen: requestToggleFullscreen,
  });

  view.root.append(hud.root);
  app.append(view.root);

  controller.subscribe((state) => {
    view.showSlide(state.current);
    hud.update(state);
  });

  connectScaler(view.stage, view.root);
  connectHash(controller, window);
  connectKeyboard(controller, window, { toggleFullscreen: requestToggleFullscreen });

  if (fullscreenAvailable) {
    onFullscreenChange(document, (active) => {
      hud.setFullscreen(active);
    });
  }
} catch (error) {
  // 専用のエラー画面は M4（view/errorScreen.ts）で作る。それまでの暫定表示
  const fallback = document.createElement("p");
  fallback.className = "mn-error";
  fallback.textContent =
    error instanceof DeckError ? error.userMessage : "原稿を読み込めませんでした。";
  app.append(fallback);
}
