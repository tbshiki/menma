import type { Appearance } from "../storage/appearance";

/**
 * 発表中に見た目を変える設定パネル（FR-43、[D-28](../../docs/decisions.md)）。
 *
 * 変えられるのは**この端末での見え方だけ**で、原稿は書き換えない。値の持ち主は呼び出し側で、
 * ここは受け取って表示し、変更を返すだけにする。
 *
 * **発表の邪魔をしないことを優先する。** 既定では閉じており、`Esc` と外側のクリックで閉じる。
 */

/**
 * 開閉ボタンの目印。外側のクリックで閉じる判定から外すために使う。
 *
 * ボタンの参照を渡し合わずに済ませるため、属性で示し合わせる
 */
export const TOGGLE_ATTRIBUTE = "data-settings-toggle";

export type SettingsOptions = {
  /** いま保存されている指定 */
  appearance: Appearance;
  /** 原稿が指定しているバーの表示。UI が未指定のときはこれに従う */
  deckShowProgress: boolean;
  /**
   * 開いたときに、いま実際に見えている色を教えてもらう。
   *
   * 未指定の項目に「テーマや原稿で実際に出ている色」を出すため。開くたびに読むのは、
   * デッキの DOM が組み上がるのがパネルの生成より後になるため
   */
  readColors: () => { pageBackground: string | undefined; progressColor: string | undefined };
  /** 変更のたびに呼ばれる。未指定へ戻す場合は該当キーを持たない値を渡す */
  onChange: (appearance: Appearance) => void;
};

export type SettingsView = {
  root: HTMLElement;
  isOpen(): boolean;
  open(): void;
  close(): void;
  /** 登録したイベントを解く */
  destroy(): void;
};

export function createSettings(options: SettingsOptions): SettingsView {
  const root = document.createElement("div");
  root.className = "mn-settings";
  root.hidden = true;
  // 操作 UI の層は pointer-events を切ってあるので、ここだけ受け取れるようにする
  root.setAttribute("role", "group");
  root.setAttribute("aria-label", "表示の設定");

  const current: Appearance = { ...options.appearance };

  const notify = (): void => {
    options.onChange({ ...current });
  };

  const progress = createCheck(
    "進み具合のバーを出す",
    current.showProgress ?? options.deckShowProgress,
    (checked) => {
      current.showProgress = checked;
      notify();
    },
  );

  const background = createColorField("スライドの外側の色", (value) => {
    current.pageBackground = value;
    notify();
  });

  const bar = createColorField("バーの色", (value) => {
    current.progressColor = value;
    notify();
  });

  const reset = document.createElement("button");
  reset.type = "button";
  reset.className = "mn-settings__reset";
  reset.textContent = "原稿の指定に戻す";
  reset.addEventListener("click", () => {
    delete current.pageBackground;
    delete current.progressColor;
    delete current.showProgress;
    notify();
    // 原稿とテーマの値へ戻ったので、表示も引き直す
    sync();
  });

  root.append(progress.root, background.root, bar.root, reset);

  /** いま効いている値を入力へ映す */
  const sync = (): void => {
    progress.input.checked = current.showProgress ?? options.deckShowProgress;

    const colors = options.readColors();
    background.input.value = current.pageBackground ?? colors.pageBackground ?? "#ffffff";
    bar.input.value = current.progressColor ?? colors.progressColor ?? "#1d5fa8";
  };

  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === "Escape") {
      // 発表画面へ伝えない。ここで閉じるだけにする
      event.stopPropagation();
      close();
    }
  };

  /**
   * 外側を触ったら閉じる。
   *
   * `pointerdown` で見るのは、押した先が消えても判定が変わらないようにするため。
   * **開閉ボタン自身は対象から外す。** ここで閉じると、続くクリックが開き直してしまう
   */
  const onPointerDown = (event: Event): void => {
    const target = event.target;

    if (target instanceof Node && root.contains(target)) {
      return;
    }

    if (target instanceof Element && target.closest(`[${TOGGLE_ATTRIBUTE}]`)) {
      return;
    }

    close();
  };

  const close = (): void => {
    if (root.hidden) {
      return;
    }
    root.hidden = true;
    root.ownerDocument.removeEventListener("pointerdown", onPointerDown, true);
  };

  root.addEventListener("keydown", onKeyDown);

  return {
    root,

    isOpen(): boolean {
      return !root.hidden;
    },

    open(): void {
      if (!root.hidden) {
        return;
      }
      // 開くたびに引き直す。入口画面や別のデッキで値が変わっていることがある
      sync();
      root.hidden = false;
      root.ownerDocument.addEventListener("pointerdown", onPointerDown, true);
      progress.input.focus();
    },

    close,

    destroy(): void {
      close();
      root.removeEventListener("keydown", onKeyDown);
      root.remove();
    },
  };
}

function createCheck(
  label: string,
  checked: boolean,
  onChange: (checked: boolean) => void,
): { root: HTMLElement; input: HTMLInputElement } {
  const root = document.createElement("label");
  root.className = "mn-settings__row";

  const input = document.createElement("input");
  input.type = "checkbox";
  input.className = "mn-settings__check";
  input.checked = checked;
  input.addEventListener("change", () => {
    onChange(input.checked);
  });

  const text = document.createElement("span");
  text.textContent = label;

  root.append(input, text);
  return { root, input };
}

function createColorField(
  label: string,
  onChange: (value: string) => void,
): { root: HTMLElement; input: HTMLInputElement } {
  const root = document.createElement("label");
  root.className = "mn-settings__row";

  const text = document.createElement("span");
  text.textContent = label;

  const input = document.createElement("input");
  input.type = "color";
  input.className = "mn-settings__color";
  input.addEventListener("change", () => {
    onChange(input.value);
  });

  root.append(text, input);
  return { root, input };
}
