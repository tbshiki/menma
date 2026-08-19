import type { PresentationState } from "../navigation/controller";
import { createCounter } from "./counter";

/**
 * 発表中に出す最小限の情報と操作（FR-18、FR-22）。
 *
 * 発表の邪魔をしないよう、既定では低コントラストで表示し、ポインタやフォーカスが
 * 触れたときだけはっきり見せる（濃さの制御は CSS 側）。
 */

export type HudOptions = {
  showPageNumber: boolean;
  showControls: boolean;
  onPrevious: () => void;
  onNext: () => void;
  /** 全画面が使える環境でだけ渡す。無ければボタンを出さない */
  onToggleFullscreen?: (() => void) | undefined;
  /** ページ番号を 2 段階で操作したときに呼ぶ（D-22） */
  onExit: () => void;
};

export type Hud = {
  root: HTMLElement;
  update(state: PresentationState): void;
  /** 全画面状態に合わせてボタンの表示を切り替える */
  setFullscreen(active: boolean): void;
  /** タイマーなどの後始末 */
  destroy(): void;
};

export function createHud(options: HudOptions): Hud {
  const root = document.createElement("div");
  root.className = "mn-hud";
  root.hidden = !options.showPageNumber && !options.showControls;

  const counter = createCounter(options.onExit);
  counter.root.hidden = !options.showPageNumber;
  root.append(counter.root);

  const actions = document.createElement("div");
  actions.className = "mn-hud__actions";
  actions.hidden = !options.showControls;
  root.append(actions);

  const previous = createButton("前のスライド", "‹", options.onPrevious);
  const next = createButton("次のスライド", "›", options.onNext);
  actions.append(previous, next);

  const fullscreen = options.onToggleFullscreen
    ? createButton("全画面表示", "⤢", options.onToggleFullscreen)
    : undefined;

  if (fullscreen) {
    actions.append(fullscreen);
  }

  return {
    root,

    update(state: PresentationState): void {
      counter.update(state);
      previous.disabled = state.current === 0;
      next.disabled = state.current === state.total - 1;
    },

    destroy(): void {
      counter.destroy();
    },

    setFullscreen(active: boolean): void {
      if (!fullscreen) {
        return;
      }
      fullscreen.setAttribute("aria-label", active ? "全画面表示を終了" : "全画面表示");
      fullscreen.setAttribute("aria-pressed", String(active));
    },
  };
}

function createButton(label: string, glyph: string, onClick: () => void): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "mn-hud__button";
  // 記号だけのボタンなので、読み上げ用の名前を必ず付ける（FR-22）
  button.setAttribute("aria-label", label);
  button.textContent = glyph;

  button.addEventListener("click", (event) => {
    // ポインタ操作ではフォーカスを残さない。ボタンにフォーカスが残ると
    // 以降キーでページを送れなくなる（FR-14 が button を入力要素として扱うため）。
    // キーボードで押した場合（detail === 0）は、フォーカスの居場所を奪わない
    if (event.detail > 0) {
      button.blur();
    }
    onClick();
  });

  return button;
}
