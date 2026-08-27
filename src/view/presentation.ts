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
import { resolveShowProgress } from "./appearance";
import { toHexColor } from "./colors";
import { createHud, type HudOptions, type ReloadState } from "./hud";
import { createProgress } from "./progress";
import { renderDeck } from "./renderDeck";
import { connectScaler } from "./scaler";
import { createSettings } from "./settings";

/** 発表画面から外へ出る操作 */
export type PresentationHandlers = {
  /** 入口へ戻る（FR-28、D-22） */
  onExit: () => void;
  /** 読み直せる取得元のときだけ渡す（FR-40） */
  onReload?: HudOptions["onReload"];
  /** 見た目が変わったとき。保存は呼び出し側が行う（FR-43） */
  onAppearanceChange: (appearance: Appearance) => void;
};

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
  handlers: PresentationHandlers,
): Presentation {
  const view = renderDeck(deck, bindings, appearance);
  const controller = new NavigationController(deck.slides.length);
  const progress = createProgress();

  // 全画面は使える環境でだけ提供する（FR-17 は Progressive Enhancement）
  const fullscreenAvailable = isFullscreenSupported(target.document);
  const requestToggleFullscreen = fullscreenAvailable
    ? (): void => {
        void toggleFullscreen(view.root);
      }
    : undefined;

  /**
   * 見た目の変更をその場へ当てる（FR-43）。
   *
   * デッキを作り直さない。読み直し（FR-40）と違って原稿は変わっていないので、
   * DOM を捨てる理由が無い
   */
  const applyLive = (next: Appearance): void => {
    view.setAppearance(next);
    progress.root.hidden = !resolveShowProgress(deck.meta, next);
    handlers.onAppearanceChange(next);
  };

  const settings = createSettings({
    appearance,
    deckShowProgress: deck.meta.showProgress,
    // 未指定の欄には、いま実際に出ている色を出す
    readColors: () => ({
      pageBackground: toHexColor(target.getComputedStyle(view.root).backgroundColor),
      progressColor: toHexColor(target.getComputedStyle(progress.bar).backgroundColor),
    }),
    onChange: applyLive,
  });

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
    onExit: handlers.onExit,
    onReload: handlers.onReload,
    settings,
  });

  progress.root.hidden = !resolveShowProgress(deck.meta, appearance);

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
