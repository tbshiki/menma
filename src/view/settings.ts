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

/**
 * 進み具合のバーの選択肢（FR-43）。
 *
 * **2 択にしない。** 「出す / 出さない」だけだと、一度触った時点でこの端末の指定が必ず残り、
 * 以降どの原稿を開いても原稿の `showProgress` が効かなくなる（D-28）。
 */
function progressChoices(deckShowProgress: boolean): { value: string; label: string }[] {
  return [
    // 原稿がどちらを指定しているかも見せる。「従う」と言われても中身が分からないため
    { value: "", label: `原稿に従う（${deckShowProgress ? "出す" : "出さない"}）` },
    { value: "true", label: "出す" },
    { value: "false", label: "出さない" },
  ];
}

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
  /**
   * 開閉が変わったときに呼ばれる先を登録する。
   *
   * `Esc` や外側のクリックなど**ボタンを経由しない閉じ方**があるので、
   * 開閉ボタン側の表示はここから知らせる
   */
  onToggle(listener: () => void): void;
  /** 登録したイベントを解く */
  destroy(): void;
};

export function createSettings(options: SettingsOptions): SettingsView {
  const root = document.createElement("div");
  root.className = "mn-settings";
  root.hidden = true;
  root.setAttribute("role", "group");
  root.setAttribute("aria-label", "表示の設定");
  // 開いたときのフォーカスの行き先。入力欄へ入れると、次のスライドへ送るつもりで押した
  // 矢印キーが設定の値を変えてしまう。ここなら矢印キーはページ送りのまま効く
  root.tabIndex = -1;

  const current: Appearance = { ...options.appearance };

  const notify = (): void => {
    options.onChange({ ...current });
  };

  const progress = createSelect(
    "進み具合のバー",
    progressChoices(options.deckShowProgress),
    (value) => {
      if (value === "") {
        delete current.showProgress;
      } else {
        current.showProgress = value === "true";
      }
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
    progress.input.value = current.showProgress === undefined ? "" : String(current.showProgress);

    const colors = options.readColors();
    background.input.value = current.pageBackground ?? colors.pageBackground ?? "#ffffff";
    bar.input.value = current.progressColor ?? colors.progressColor ?? "#1d5fa8";
  };

  /**
   * `Esc` で閉じる。
   *
   * **document で拾う。** パネルの中だけで拾うと、フォーカスが外（操作ボタンなど）へ
   * 移ったあとに閉じられなくなる
   */
  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === "Escape") {
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

  let onToggle: (() => void) | undefined;

  const close = (): void => {
    if (root.hidden) {
      return;
    }

    // **中にフォーカスを残したまま隠さない。** 隠れた入力にフォーカスが残ると、以降の
    // キーがそこへ届き続け、矢印キーでページを送れなくなる（FR-14）
    const active = root.ownerDocument.activeElement;

    if (active instanceof HTMLElement && root.contains(active)) {
      active.blur();
    }

    root.hidden = true;
    root.ownerDocument.removeEventListener("pointerdown", onPointerDown, true);
    root.ownerDocument.removeEventListener("keydown", onKeyDown, true);
    onToggle?.();
  };

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
      root.ownerDocument.addEventListener("keydown", onKeyDown, true);
      root.focus();
      onToggle?.();
    },

    close,

    onToggle(listener: () => void): void {
      onToggle = listener;
    },

    destroy(): void {
      close();
      root.remove();
    },
  };
}

function createSelect(
  label: string,
  choices: readonly { value: string; label: string }[],
  onChange: (value: string) => void,
): { root: HTMLElement; input: HTMLSelectElement } {
  const root = document.createElement("label");
  root.className = "mn-settings__row";

  const text = document.createElement("span");
  text.textContent = label;

  const input = document.createElement("select");
  input.className = "mn-settings__select";

  for (const choice of choices) {
    const option = document.createElement("option");
    option.value = choice.value;
    option.textContent = choice.label;
    input.append(option);
  }

  input.addEventListener("change", () => {
    onChange(input.value);
  });

  root.append(text, input);
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
