import type { Appearance } from "../storage/appearance";
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
import { createHud, type HudOptions, type ReloadState } from "./hud";
import { createProgress } from "./progress";
import { renderDeck } from "./renderDeck";
import { connectScaler } from "./scaler";

/** 表示中の発表画面。差し替えと後始末はここを通す */
export type Presentation = {
  /** DOM と購読を捨てる（設計 14.2） */
  stop(): void;
  /** 読み直しの状態を操作 UI へ伝える（設計 16.5） */
  setReload(state: ReloadState): void;
};

/**
 * 発表画面を組み立てる（設計 14.2）。
 *
 * デッキを差し替えられるよう、**後始末を持つオブジェクトを返す**。DOM だけでなく購読も解く。
 * `NavigationController` は総ページ数を固定で持つため、デッキごとに作り直す。
 */
export function startPresentation(
  deck: Deck,
  bindings: AssetBindings,
  appearance: Appearance,
  mount: HTMLElement,
  target: Window,
  onExit: () => void,
  onReload?: HudOptions["onReload"],
): Presentation {
  const view = renderDeck(deck, bindings, appearance);
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
    onExit,
    onReload,
  });

  const progress = createProgress();
  progress.root.hidden = !deck.meta.showProgress;

  // 操作 UI と進み具合のバーは画面基準。拡縮されても位置が動かない（FR-18、FR-35）
  view.root.append(hud.root, progress.root);
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

  return {
    stop(): void {
      for (const cleanup of cleanups) {
        cleanup();
      }
      hud.destroy();
      view.root.remove();
    },

    setReload(state: ReloadState): void {
      hud.setReload(state);
    },
  };
}
