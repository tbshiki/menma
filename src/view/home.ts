import { SUPPORTED_EXTENSIONS, isSupportedFileName, type DeckSource } from "../deck/source";

/**
 * 入口画面（FR-24〜FR-26、FR-29）。
 *
 * 原稿の渡し方は 3 つだけ。ここは受け取るだけで、解釈も描画もしない。
 */

export type HomeOptions = {
  /** 原稿が決まったときに呼ばれる */
  onSource: (source: DeckSource) => void;
  /** 保存された原稿があるときだけ渡す。「前回の原稿を開く」を出すため */
  onResume?: (() => void) | undefined;
  /** 保存された原稿があるときだけ渡す。「保存を消す」を出すため */
  onClearStored?: (() => void) | undefined;
};

export type HomeView = {
  root: HTMLElement;
  /** 受け付けられなかった理由を表示する */
  showError(message: string): void;
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
    "原稿はこのブラウザの中だけで扱います。どこにも送信しません。読み込んだ原稿の相対パス画像は表示できません。";

  const error = document.createElement("p");
  error.className = "mn-home__error";
  error.setAttribute("role", "alert");
  error.hidden = true;

  root.append(title, lead, error);

  if (options.onResume) {
    root.append(createResumeSection(options.onResume));
  }

  const cleanups: (() => void)[] = [];

  const showError = (message: string): void => {
    error.textContent = message;
    error.hidden = false;
  };

  const clearError = (): void => {
    error.textContent = "";
    error.hidden = true;
  };

  const acceptFile = (file: File | undefined): void => {
    if (!file) {
      return;
    }

    if (!isSupportedFileName(file.name)) {
      showError(
        `${file.name} は読み込めません。${SUPPORTED_EXTENSIONS.join(" / ")} を選んでください。`,
      );
      return;
    }

    void file
      .text()
      .then((text) => {
        if (text.trim() === "") {
          showError(`${file.name} は空でした。`);
          return;
        }
        clearError();
        options.onSource({ kind: "file", name: file.name, text });
      })
      .catch(() => {
        showError(`${file.name} を読み込めませんでした。`);
      });
  };

  root.append(
    createFileSection(acceptFile, cleanups),
    createTextSection((text) => {
      if (text.trim() === "") {
        showError("原稿が空です。Markdown を貼り付けてください。");
        return;
      }
      clearError();
      options.onSource({ kind: "text", text });
    }),
    createSampleSection(() => {
      clearError();
      options.onSource({ kind: "sample" });
    }, options.onClearStored),
    note,
  );

  return {
    root,
    showError,
    destroy(): void {
      for (const cleanup of cleanups) {
        cleanup();
      }
      root.remove();
    },
  };
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

function createFileSection(onFile: (file: File | undefined) => void, cleanups: (() => void)[]) {
  const section = createSection(
    "ファイルを開く",
    "手元の Markdown を選ぶか、ここへ落としてください。",
  );

  const input = document.createElement("input");
  input.type = "file";
  input.className = "mn-home__file";
  input.accept = SUPPORTED_EXTENSIONS.join(",");
  input.addEventListener("change", () => {
    // 複数選ばれても 1 つ目だけを使う（FR-25）
    onFile(input.files?.[0]);
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
    onFile(event.dataTransfer?.files[0]);
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
