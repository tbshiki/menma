import {
  SUPPORTED_EXTENSIONS,
  SUPPORTED_IMAGE_EXTENSIONS,
  type DeckAsset,
  type DeckSource,
} from "../deck/source";
import type { Appearance } from "../storage/appearance";
import { describeRejected, selectFiles } from "./fileSelection";

/**
 * 入口画面（FR-24〜FR-26、FR-29、FR-30、FR-33、FR-34）。
 *
 * 原稿の渡し方は 3 つだけ。ここは受け取るだけで、解釈も描画もしない。
 */

export type HomeOptions = {
  /**
   * 原稿が決まったときに呼ばれる。
   *
   * `notice` は取り込めなかったファイルの知らせ。開く前に伝えるかどうかは呼び出し側が決める
   */
  onSource: (source: DeckSource, notice?: string) => void;
  /** 保存された原稿があるときだけ渡す。「前回の原稿を開く」を出すため */
  onResume?: (() => void) | undefined;
  /** 保存された原稿があるときだけ渡す。「保存を消す」を出すため */
  onClearStored?: (() => void) | undefined;
  /** いま保存されている見た目の指定 */
  appearance: Appearance;
  /** 色を変えたときに呼ばれる。未指定へ戻す場合は undefined を渡す */
  onAppearanceChange: (appearance: Appearance) => void;
};

export type HomeView = {
  root: HTMLElement;
  /** 受け付けられなかった理由を表示する */
  showError(message: string): void;
  /** 開けるが伝えておきたいことを表示し、そのまま進む手段を添える */
  showWarning(message: string, onContinue: () => void): void;
  /** 後始末（登録したイベントを解く） */
  destroy(): void;
};

export function createHome(options: HomeOptions): HomeView {
  const root = document.createElement("main");
  root.className = "mn-home";

  const title = document.createElement("h1");
  title.className = "mn-home__title";
  title.textContent = "menma";

  const lead = document.createElement("p");
  lead.className = "mn-home__lead";
  lead.textContent = "Markdown を渡すと、そのままスライドになります。";

  const note = document.createElement("p");
  note.className = "mn-home__note";
  note.textContent =
    "原稿も画像もこのブラウザの中だけで扱います。どこにも送信しません。画像は原稿と一緒に選んでください（ファイル名で結び付けます）。";

  const error = document.createElement("p");
  error.className = "mn-home__error";
  error.setAttribute("role", "alert");
  error.hidden = true;

  const warning = document.createElement("div");
  warning.className = "mn-home__warning";
  // 受け付けられなかった知らせ（alert）とは役割を分ける。開けるが伝えておきたい状態
  warning.setAttribute("role", "status");
  warning.hidden = true;

  const warningText = document.createElement("p");
  warningText.className = "mn-home__warning-text";
  const warningButton = document.createElement("button");
  warningButton.type = "button";
  warningButton.className = "mn-home__button";
  warningButton.textContent = "このまま開く";
  warning.append(warningText, warningButton);

  root.append(title, lead, error, warning);

  if (options.onResume) {
    root.append(createResumeSection(options.onResume));
  }

  const cleanups: (() => void)[] = [];

  const showError = (message: string): void => {
    error.textContent = message;
    error.hidden = false;
  };

  const clearMessages = (): void => {
    error.textContent = "";
    error.hidden = true;
    warning.hidden = true;
  };

  const acceptFiles = (files: readonly File[]): void => {
    if (files.length === 0) {
      return;
    }

    const selection = selectFiles(files);
    const rejected = describeRejected(selection.rejected);

    if (!selection.markdown) {
      // 何が受け付けられなかったかも一緒に伝える
      showError(
        [
          `Markdown が見つかりません。${SUPPORTED_EXTENSIONS.join(" / ")} のファイルを一緒に選んでください。`,
          rejected,
        ]
          .filter((part) => part !== undefined)
          .join(" "),
      );
      return;
    }

    const markdown = selection.markdown;

    void Promise.all([markdown.text(), ...selection.assets.map(toDeckAsset)])
      .then(([text, ...assets]) => {
        if (typeof text !== "string" || text.trim() === "") {
          showError(`${markdown.name} は空でした。`);
          return;
        }

        clearMessages();
        options.onSource(
          {
            kind: "file",
            name: markdown.name,
            text,
            assets: assets as DeckAsset[],
          },
          rejected,
        );
      })
      .catch(() => {
        showError(`${markdown.name} を読み込めませんでした。`);
      });
  };

  root.append(
    createFileSection(acceptFiles, cleanups),
    createTextSection((text) => {
      if (text.trim() === "") {
        showError("原稿が空です。Markdown を貼り付けてください。");
        return;
      }
      clearMessages();
      options.onSource({ kind: "text", text, assets: [] });
    }),
    createSampleSection(() => {
      clearMessages();
      options.onSource({ kind: "sample" });
    }, options.onClearStored),
    createAppearanceSection(options),
    note,
  );

  let continueHandler: (() => void) | undefined;
  warningButton.addEventListener("click", () => {
    continueHandler?.();
  });

  return {
    root,
    showError,

    showWarning(message: string, onContinue: () => void): void {
      warningText.textContent = message;
      continueHandler = onContinue;
      warning.hidden = false;
    },

    destroy(): void {
      for (const cleanup of cleanups) {
        cleanup();
      }
      root.remove();
    },
  };
}

async function toDeckAsset(file: File): Promise<DeckAsset> {
  // Blob のまま持つ。IndexedDB は構造化クローンで保存できる（設計 15.3）
  return { name: file.name, blob: file.slice(0, file.size, file.type) };
}

function createResumeSection(onResume: () => void) {
  const section = createSection("前回の続き", "このブラウザに残っている原稿をもう一度開きます。");

  const button = document.createElement("button");
  button.type = "button";
  button.className = "mn-home__button";
  button.textContent = "前回の原稿を開く";
  button.addEventListener("click", onResume);

  section.append(button);
  return section;
}

function createFileSection(onFiles: (files: readonly File[]) => void, cleanups: (() => void)[]) {
  const section = createSection(
    "ファイルを開く",
    "Markdown と、原稿が使う画像をまとめて選ぶか、ここへ落としてください。",
  );

  const input = document.createElement("input");
  input.type = "file";
  input.className = "mn-home__file";
  input.multiple = true;
  input.accept = [...SUPPORTED_EXTENSIONS, ...SUPPORTED_IMAGE_EXTENSIONS].join(",");
  input.addEventListener("change", () => {
    onFiles([...(input.files ?? [])]);
    // 同じファイルを選び直せるように値を戻す
    input.value = "";
  });

  const drop = document.createElement("div");
  drop.className = "mn-home__drop";
  drop.append(input);

  const onDragOver = (event: DragEvent): void => {
    event.preventDefault();
    drop.dataset.active = "true";
  };
  const onDragLeave = (): void => {
    delete drop.dataset.active;
  };
  const onDrop = (event: DragEvent): void => {
    event.preventDefault();
    delete drop.dataset.active;
    onFiles([...(event.dataTransfer?.files ?? [])]);
  };

  drop.addEventListener("dragover", onDragOver);
  drop.addEventListener("dragleave", onDragLeave);
  drop.addEventListener("drop", onDrop);

  cleanups.push(() => {
    drop.removeEventListener("dragover", onDragOver);
    drop.removeEventListener("dragleave", onDragLeave);
    drop.removeEventListener("drop", onDrop);
  });

  section.append(drop);
  return section;
}

function createTextSection(onText: (text: string) => void) {
  const section = createSection("貼り付ける", "書きかけの原稿をそのまま試せます。");

  const textarea = document.createElement("textarea");
  textarea.className = "mn-home__textarea";
  textarea.rows = 8;
  textarea.placeholder = "# 見出し\n\n本文\n\n---\n\n# 次のスライド";
  textarea.setAttribute("aria-label", "Markdown の原稿");

  const button = document.createElement("button");
  button.type = "button";
  button.className = "mn-home__button";
  button.textContent = "スライドにする";
  button.addEventListener("click", () => {
    onText(textarea.value);
  });

  section.append(textarea, button);
  return section;
}

function createSampleSection(onSample: () => void, onClearStored: (() => void) | undefined) {
  const section = createSection("サンプルを見る", "記法とレイアウトの一通りが入っています。");

  const button = document.createElement("button");
  button.type = "button";
  button.className = "mn-home__button";
  button.textContent = "サンプルスライドを見る";
  button.addEventListener("click", onSample);
  section.append(button);

  if (onClearStored) {
    const clear = document.createElement("button");
    clear.type = "button";
    clear.className = "mn-home__link";
    clear.textContent = "保存した原稿を消す";
    clear.addEventListener("click", () => {
      onClearStored();
      clear.remove();
    });
    section.append(clear);
  }

  return section;
}

function createSection(heading: string, description: string): HTMLElement {
  const section = document.createElement("section");
  section.className = "mn-home__section";

  const title = document.createElement("h2");
  title.className = "mn-home__heading";
  title.textContent = heading;

  const text = document.createElement("p");
  text.className = "mn-home__description";
  text.textContent = description;

  section.append(title, text);
  return section;
}

/**
 * 色の設定（FR-37）。
 *
 * ここで選んだ色はこのブラウザに保存され、**原稿の指定より優先される**（D-21）。
 * 「原稿の指定に戻す」を押すと保存を消し、原稿かテーマの色に戻る。
 */
function createAppearanceSection(options: HomeOptions): HTMLElement {
  const section = createSection(
    "色",
    "この端末で見るときの色。原稿に書かれた指定より優先されます。",
  );

  const current: Appearance = { ...options.appearance };

  const update = (next: Appearance): void => {
    current.pageBackground = next.pageBackground;
    current.progressColor = next.progressColor;
    options.onAppearanceChange({ ...current });
  };

  const background = createColorField(
    "スライドの外側",
    options.appearance.pageBackground ?? "#ffffff",
    (value) => {
      update({ ...current, pageBackground: value });
    },
  );

  const progress = createColorField(
    "進み具合のバー",
    options.appearance.progressColor ?? "#1d5fa8",
    (value) => {
      update({ ...current, progressColor: value });
    },
  );

  const reset = document.createElement("button");
  reset.type = "button";
  reset.className = "mn-home__link";
  reset.textContent = "原稿の指定に戻す";
  reset.addEventListener("click", () => {
    background.input.value = "#ffffff";
    progress.input.value = "#1d5fa8";
    update({});
  });

  section.append(background.root, progress.root, reset);
  return section;
}

function createColorField(
  label: string,
  value: string,
  onChange: (value: string) => void,
): { root: HTMLElement; input: HTMLInputElement } {
  const root = document.createElement("label");
  root.className = "mn-home__color";

  const text = document.createElement("span");
  text.textContent = label;

  const input = document.createElement("input");
  input.type = "color";
  input.className = "mn-home__color-input";
  input.value = value;
  input.addEventListener("change", () => {
    onChange(input.value);
  });

  root.append(text, input);
  return { root, input };
}
