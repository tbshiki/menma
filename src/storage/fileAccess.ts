import {
  MAX_ASSETS_TOTAL_BYTES,
  MAX_ASSET_BYTES,
  SUPPORTED_EXTENSIONS,
  SUPPORTED_IMAGE_EXTENSIONS,
  isSupportedFileName,
  type DeckAsset,
  type FileDeckSource,
} from "../deck/source";

/**
 * 元ファイルの読み直し（設計 16 章、FR-40〜FR-42）。
 *
 * `File` は選んだ瞬間のスナップショットで、あとから中身を読み直せない。読み直すには
 * `FileSystemFileHandle` が要るが、これは Chromium 系にしか無い。**無い環境でも機能は残す**
 * ため、参照が使えないときはファイル選択のダイアログへ落ちる（D-27）。
 *
 * ここは DOM を組み立てない。開くのはブラウザのダイアログだけで、描画は `view/` が持つ。
 */

/** 読み直しの結果。失敗しても表示中のデッキは呼び出し側が保つ */
export type ReloadOutcome =
  /** 読み直せた。`source` を保存し直して描画する */
  | { status: "updated"; source: FileDeckSource; note?: string }
  /** 中身は前と同じ。参照が新しくなっただけなので保存だけする */
  | { status: "unchanged"; source: FileDeckSource; note?: string }
  /** ファイル選択を閉じた。何もしない */
  | { status: "cancelled" }
  /** 読めなかった。理由を短く伝える */
  | { status: "failed"; message: string };

export type ReloadOptions = {
  target: Window;
  /** 原稿と一緒に選んだ画像も読み直すか（FR-42） */
  includeAssets: boolean;
};

/** 権限を尋ねられるファイル参照。この 2 つは lib.dom に無いので自分で定義する */
type PermissionAwareHandle = FileSystemFileHandle & {
  queryPermission?: (descriptor: { mode: "read" }) => Promise<PermissionState>;
  requestPermission?: (descriptor: { mode: "read" }) => Promise<PermissionState>;
};

/** File System Access API を持つかもしれないウィンドウ */
type PickerWindow = Window & {
  showOpenFilePicker?: (options: {
    multiple?: boolean;
    types?: { description: string; accept: Record<string, readonly string[]> }[];
  }) => Promise<FileSystemFileHandle[]>;
};

/** ドロップされた項目。`getAsFileSystemHandle` も lib.dom に無い */
type HandleAwareItem = DataTransferItem & {
  getAsFileSystemHandle?: () => Promise<FileSystemHandle | null>;
};

const READ = { mode: "read" } as const;

/** `input` のファイル選択を待つ上限。これを過ぎたら閉じたものとして扱う */
const PICKER_TIMEOUT_MS = 120_000;

/** ファイル名から元ファイルへの参照を引く（設計 16.1） */
export type FileHandles = ReadonlyMap<string, FileSystemFileHandle>;

/** 選ばれたファイルと、取れた参照 */
export type PickedFiles = {
  files: readonly File[];
  handles: FileHandles;
};

/** 参照を持てるファイル選択が使えるか（Chromium 系）。使えなければ `input` で選ぶ */
export function isFilePickerSupported(target: Window): boolean {
  return typeof (target as PickerWindow).showOpenFilePicker === "function";
}

/**
 * 原稿と画像をまとめて選ぶ（FR-25、FR-30）。
 *
 * `input` と違って**参照が残る**ので、開いたあと ↻ を押すだけで読み直せる（FR-40）。
 * 閉じられた場合は undefined を返し、呼び出し側は何もしない。
 */
export async function pickDeckFiles(target: Window): Promise<PickedFiles | undefined> {
  const picker = (target as PickerWindow).showOpenFilePicker;

  if (!picker) {
    return undefined;
  }

  let picked: FileSystemFileHandle[];

  try {
    picked = await picker.call(target, {
      multiple: true,
      types: [
        {
          description: "原稿と画像",
          accept: { "text/markdown": SUPPORTED_EXTENSIONS, "image/*": SUPPORTED_IMAGE_EXTENSIONS },
        },
      ],
    });
  } catch {
    // 閉じただけか、選べなかった。どちらも入口画面は何も変えない
    return undefined;
  }

  const files: File[] = [];
  const handles = new Map<string, FileSystemFileHandle>();

  for (const handle of picked) {
    const file = await readFile(handle);

    if (!file) {
      continue;
    }

    files.push(file);

    // 同名が複数選ばれたら最初の 1 つ。画像の照合（D-20）と同じ扱いにする
    if (!handles.has(handle.name)) {
      handles.set(handle.name, handle);
    }
  }

  return { files, handles };
}

/**
 * ドロップされた項目からファイル参照を取り出す（設計 16.1）。
 *
 * **ドロップのハンドラの中で同期的に呼ぶ必要がある。** イベントを抜けると
 * `DataTransferItem` は無効になるため、呼び出し側は Promise だけ集めてあとで待つ。
 */
export function readDroppedHandle(
  item: DataTransferItem,
): Promise<FileSystemFileHandle | undefined> {
  const aware = item as HandleAwareItem;

  if (item.kind !== "file" || !aware.getAsFileSystemHandle) {
    return Promise.resolve(undefined);
  }

  return aware
    .getAsFileSystemHandle()
    .then((handle) =>
      handle && handle.kind === "file" ? (handle as FileSystemFileHandle) : undefined,
    )
    .catch(() => undefined);
}

/**
 * 原稿が更新されているかを調べる（FR-41）。
 *
 * **権限を求めない。** すでに許可されている参照だけを見る。ここでダイアログを出すと、
 * タブへ戻っただけで許可を聞かれることになる。
 */
export async function hasFileUpdate(source: FileDeckSource): Promise<boolean> {
  const handle = source.handle;

  if (!handle || source.lastModified === undefined) {
    return false;
  }

  if (!(await isReadable(handle))) {
    return false;
  }

  try {
    const file = await handle.getFile();
    return file.lastModified !== source.lastModified;
  } catch {
    // 移動・削除された。読み直しは押されたときに選び直してもらう
    return false;
  }
}

/** 原稿（と、求められていれば画像）を読み直して新しい取得元を作る */
export async function reloadFileSource(
  source: FileDeckSource,
  options: ReloadOptions,
): Promise<ReloadOutcome> {
  const picked = await pickMarkdown(source, options.target);

  if (picked.status !== "picked") {
    return picked;
  }

  const { file, handle } = picked;

  if (!isSupportedFileName(file.name)) {
    return {
      status: "failed",
      message: `${file.name} は読み直せません。${SUPPORTED_EXTENSIONS.join(" / ")} を選んでください。`,
    };
  }

  let text: string;

  try {
    text = await file.text();
  } catch {
    return { status: "failed", message: `${file.name} を読み込めませんでした。` };
  }

  if (text.trim() === "") {
    return { status: "failed", message: `${file.name} は空でした。` };
  }

  const assets = options.includeAssets
    ? await reloadAssets(source.assets, options.target)
    : { assets: source.assets, changed: false, note: undefined };

  const next: FileDeckSource = {
    kind: "file",
    name: file.name,
    text,
    assets: assets.assets,
    handle,
    lastModified: file.lastModified,
  };

  const changed = text !== source.text || assets.changed;

  return { status: changed ? "updated" : "unchanged", source: next, note: assets.note };
}

/**
 * 画像を読み直す（FR-42）。
 *
 * **増えることはない。** すでに取り込んだ画像を同じ参照から読み直すだけで、新しい画像を
 * 足すには入口から選び直す。読めなかったもの、上限（FR-33）を超えたものは古いままにし、
 * **黙って古いままにしない**で名前を伝える。
 *
 * 権限は操作を起点にしているので求めてよい（設計 16.2）。ただし**断られたらそこで止める**。
 * 画像の枚数だけダイアログが並ぶと、発表中には手に負えなくなるため。
 */
async function reloadAssets(
  assets: readonly DeckAsset[],
  target: Window,
): Promise<{
  assets: readonly DeckAsset[];
  changed: boolean;
  note: string | undefined;
}> {
  const next: DeckAsset[] = [];
  const tooLarge: string[] = [];
  const unreadable: string[] = [];
  let allowPrompt = true;
  let changed = false;
  let total = 0;

  for (const asset of assets) {
    const handle = asset.handle;
    let file: File | undefined;

    if (handle) {
      if (await isReadable(handle, allowPrompt ? target : undefined)) {
        file = await readFile(handle);
      } else {
        allowPrompt = false;
      }

      if (!file) {
        unreadable.push(asset.name);
      }
    }

    if (!file || file.size > MAX_ASSET_BYTES || total + file.size > MAX_ASSETS_TOTAL_BYTES) {
      if (file) {
        tooLarge.push(asset.name);
      }
      total += asset.blob.size;
      next.push(asset);
      continue;
    }

    total += file.size;
    // 中身が同じかどうかは比べない。画像の読み直しは明示的に求められたときだけ走るので、
    // 読めた時点で差し替える（比較のために全体を読み出すほうが高くつく）
    changed = true;
    next.push({ name: asset.name, blob: file.slice(0, file.size, file.type), handle });
  }

  const notes = [
    tooLarge.length > 0 ? `大きすぎる画像はそのままにしました: ${tooLarge.join(" / ")}` : undefined,
    unreadable.length > 0
      ? `読み直せなかった画像はそのままです: ${unreadable.join(" / ")}`
      : undefined,
  ].filter((part): part is string => part !== undefined);

  return { assets: next, changed, note: notes.length > 0 ? notes.join(" ") : undefined };
}

type PickedMarkdown =
  | { status: "picked"; file: File; handle: FileSystemFileHandle | undefined }
  | { status: "cancelled" }
  | { status: "failed"; message: string };

/**
 * 読み直す原稿を決める（設計 16.1、16.2）。
 *
 * 覚えている参照 → ファイル選択（File System Access）→ `input` の順に落ちる。
 * 参照が使えるときだけ 1 クリックで済み、それ以外はダイアログが出る。
 */
async function pickMarkdown(source: FileDeckSource, target: Window): Promise<PickedMarkdown> {
  const handle = source.handle;

  if (handle && (await isReadable(handle, target))) {
    const file = await readFile(handle);

    if (file) {
      return { status: "picked", file, handle };
    }
    // 移動・削除されている。選び直してもらう
  }

  const picker = (target as PickerWindow).showOpenFilePicker;

  if (picker) {
    try {
      const picked = await picker.call(target, {
        multiple: false,
        types: [
          { description: "Markdown の原稿", accept: { "text/markdown": SUPPORTED_EXTENSIONS } },
        ],
      });
      const next = picked[0];

      if (!next) {
        return { status: "cancelled" };
      }

      const file = await next.getFile();
      return { status: "picked", file, handle: next };
    } catch (error) {
      // 閉じただけなら何も言わない。それ以外は理由を出す
      return isAbort(error)
        ? { status: "cancelled" }
        : { status: "failed", message: "ファイルを開けませんでした。" };
    }
  }

  const file = await pickWithInput(target);

  return file ? { status: "picked", file, handle: undefined } : { status: "cancelled" };
}

/**
 * File System Access API が無い環境のファイル選択（Firefox / Safari）。
 *
 * 参照は得られないので、読み直すたびにここを通る。**開いたまま戻らない状態を作らない**。
 * `cancel` の無い環境ではウィンドウへ戻った時点で閉じたものとして扱い、それも起きない
 * 環境（WebKit のシート型ダイアログなど）に備えて時間でも打ち切る。ここが解決しないと
 * 読み直しが走ったままになり、ボタンが押せなくなる。
 */
function pickWithInput(target: Window): Promise<File | undefined> {
  return new Promise((resolve) => {
    const input = target.document.createElement("input");
    input.type = "file";
    input.accept = SUPPORTED_EXTENSIONS.join(",");
    input.hidden = true;

    let settled = false;
    const finish = (file: File | undefined): void => {
      if (settled) {
        return;
      }
      settled = true;
      target.clearTimeout(giveUp);
      target.removeEventListener("focus", onFocus);
      input.remove();
      resolve(file);
    };

    const onFocus = (): void => {
      // change は focus より先に届く。少し待ってからでなければ選択を取りこぼす。
      // それでも遅れて届いた場合に備え、打ち切る時点の選択も拾う
      target.setTimeout(() => {
        finish(input.files?.[0]);
      }, 500);
    };

    // どのイベントも来ない環境の保険。長めに取って、閉じたものとして扱う
    const giveUp = target.setTimeout(() => {
      finish(undefined);
    }, PICKER_TIMEOUT_MS);

    input.addEventListener("change", () => {
      finish(input.files?.[0]);
    });
    input.addEventListener("cancel", () => {
      finish(undefined);
    });
    target.addEventListener("focus", onFocus);

    target.document.body.append(input);
    input.click();
  });
}

async function readFile(handle: FileSystemFileHandle): Promise<File | undefined> {
  try {
    return await handle.getFile();
  } catch {
    return undefined;
  }
}

/**
 * 参照が読めるかを確かめる（設計 16.2）。
 *
 * `target` を渡したときだけ権限を求める。求めるのは操作を起点にしたときに限り、
 * 更新の確認では尋ねない。
 */
async function isReadable(handle: FileSystemFileHandle, target?: Window): Promise<boolean> {
  const aware = handle as PermissionAwareHandle;

  try {
    // 権限 API が無い実装では、読めるかどうかは getFile の結果で分かる
    const state = aware.queryPermission ? await aware.queryPermission(READ) : "granted";

    if (state === "granted") {
      return true;
    }

    if (!target || state === "denied" || !aware.requestPermission) {
      return false;
    }

    return (await aware.requestPermission(READ)) === "granted";
  } catch {
    return false;
  }
}

function isAbort(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}
