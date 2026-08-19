import type { Deck } from "../deck/types";
import type { AssetBindings } from "./assets";
import { NavigationController } from "../navigation/controller";
import {
  isFullscreenSupported,
  onFullscreenChange,
  toggleFullscreen,
} from "../navigation/fullscreen";
import { connectHash } from "../navigation/hash";
import { connectKeyboard } from "../navigation/keyboard";
import { createHud } from "./hud";
import { createProgress } from "./progress";
import { renderDeck } from "./renderDeck";
import { connectScaler } from "./scaler";

/**
 * 発表画面を組み立てる（設計 14.2）。
 *
 * デッキを差し替えられるよう、**後始末の関数を返す**。DOM だけでなく購読も解く。
 * `NavigationController` は総ページ数を固定で持つため、デッキごとに作り直す。
 */
export function startPresentation(
  deck: Deck,
  bindings: AssetBindings,
  mount: HTMLElement,
  target: Window,
): () => void {
  const view = renderDeck(deck, bindings);
  const controller = new NavigationController(deck.slides.length);

  // 全画面は使える環境でだけ提供する（FR-17 は Progressive Enhancement）
  const fullscreenAvailable = isFullscreenSupported(target.document);
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

  const progress = createProgress();
  progress.root.hidden = !deck.meta.showProgress;

  // 操作 UI はスライドの上に重ねる。余白の色を変えても常にスライドの地色の上に乗るので読める
  view.stage.append(hud.root);
  // 進み具合のバーは画面の最下部。スライドの外側に置いて全体の進みを示す
  view.root.append(progress.root);
  mount.append(view.root);

  const cleanups: (() => void)[] = [];

  cleanups.push(
    controller.subscribe((state) => {
      view.showSlide(state.current);
      hud.update(state);
      progress.update(state);
    }),
  );
  cleanups.push(connectScaler(view.stage, view.root));
  cleanups.push(connectHash(controller, target));
  cleanups.push(connectKeyboard(controller, target, { toggleFullscreen: requestToggleFullscreen }));

  if (fullscreenAvailable) {
    cleanups.push(
      onFullscreenChange(target.document, (active) => {
        hud.setFullscreen(active);
      }),
    );
  }

  return () => {
    for (const cleanup of cleanups) {
      cleanup();
    }
    view.root.remove();
  };
}
