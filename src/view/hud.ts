import type { PresentationState } from "../navigation/controller";
import { createCounter } from "./counter";

/**
 * 発表中に出す最小限の情報と操作（FR-18、FR-22）。
 *
 * 発表の邪魔をしないよう、既定では低コントラストで表示し、ポインタやフォーカスが
 * 触れたときだけはっきり見せる（濃さの制御は CSS 側）。
 */

/**
 * 読み直しボタンの見せ方（設計 16.5）。
 *
 * `message` は結果の短い知らせ。数秒で消える
 */
export type ReloadState = {
  status: "idle" | "updated" | "busy";
  message?: string | undefined;
};

export type HudOptions = {
  showPageNumber: boolean;
  showControls: boolean;
  onPrevious: () => void;
  onNext: () => void;
  /** 全画面が使える環境でだけ渡す。無ければボタンを出さない */
  onToggleFullscreen?: (() => void) | undefined;
  /** ページ番号を 2 段階で操作したときに呼ぶ（D-22） */
  onExit: () => void;
  /** 読み直せる取得元のときだけ渡す。無ければボタンを出さない（FR-40） */
  onReload?: ((options: { includeAssets: boolean }) => void) | undefined;
};

export type Hud = {
  root: HTMLElement;
  update(state: PresentationState): void;
  /** 全画面状態に合わせてボタンの表示を切り替える */
  setFullscreen(active: boolean): void;
  /** 読み直しの状態と結果を伝える（FR-41）。ボタンが無ければ何もしない */
  setReload(state: ReloadState): void;
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

  const status = document.createElement("span");
  status.className = "mn-hud__status";
  // 読み直しの結果は割り込ませない。ページ切り替えの読み上げと競合させないため polite にする
  status.setAttribute("aria-live", "polite");

  const reload = createReloadButton(options.onReload);

  if (reload) {
    actions.append(status, reload);
  }

  const previous = createButton("前のスライド", "‹", options.onPrevious);
  const next = createButton("次のスライド", "›", options.onNext);
  actions.append(previous, next);

  const fullscreen = options.onToggleFullscreen
    ? createButton("全画面表示", "⤢", options.onToggleFullscreen)
    : undefined;

  if (fullscreen) {
    actions.append(fullscreen);
  }

  // 知らせを消すためのタイマー。デッキを差し替えても残らないよう destroy で止める
  let timer: number | undefined;

  const notify = (message: string): void => {
    if (timer !== undefined) {
      window.clearTimeout(timer);
      timer = undefined;
    }

    status.textContent = message;

    timer = window.setTimeout(() => {
      status.textContent = "";
      timer = undefined;
    }, 4000);
  };

  return {
    root,

    update(state: PresentationState): void {
      counter.update(state);
      previous.disabled = state.current === 0;
      next.disabled = state.current === state.total - 1;
    },

    destroy(): void {
      counter.destroy();
      if (timer !== undefined) {
        window.clearTimeout(timer);
      }
    },

    setReload(state: ReloadState): void {
      if (!reload) {
        return;
      }

      reload.disabled = state.status === "busy";
      reload.dataset.updated = String(state.status === "updated");
      reload.setAttribute(
        "aria-label",
        state.status === "updated" ? "原稿を読み直す（更新があります）" : "原稿を読み直す",
      );
      // 知らせを持たない更新（更新の検知など）で、読みかけの知らせを消さない
      if (state.message !== undefined) {
        notify(state.message);
      }
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

/**
 * 原稿の読み直し（FR-40〜FR-42）。
 *
 * 1 クリックは原稿だけ。画像も読み直すのは右クリックと `Shift` + クリックに割り当てる。
 * **右クリックだけにしない。** キーボードや触るだけの環境から届かなくなるため（D-27）。
 */
function createReloadButton(onReload: HudOptions["onReload"]): HTMLButtonElement | undefined {
  if (!onReload) {
    return undefined;
  }

  const button = createButton("原稿を読み直す", "↻", (event) => {
    onReload({ includeAssets: event.shiftKey });
  });
  button.dataset.updated = "false";
  button.title = "原稿を読み直す（右クリックか Shift + クリックで画像も）";

  button.addEventListener("contextmenu", (event) => {
    event.preventDefault();
    onReload({ includeAssets: true });
  });

  return button;
}

function createButton(
  label: string,
  glyph: string,
  onClick: (event: MouseEvent) => void,
): HTMLButtonElement {
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
    onClick(event);
  });

  return button;
}
