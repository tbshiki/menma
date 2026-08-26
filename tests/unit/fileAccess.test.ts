import { describe, expect, it } from "vitest";

import { MAX_ASSET_BYTES, type FileDeckSource } from "../../src/deck/source";
import { hasFileUpdate, reloadFileSource } from "../../src/storage/fileAccess";

/**
 * 元ファイルの読み直し（設計 16 章、FR-40〜FR-42）。
 *
 * ブラウザのファイル参照は偽物を渡して確かめる。DOM は使わないので node 環境で足りる。
 */

type FakeHandle = {
  name: string;
  permission: PermissionState;
  /** 権限を尋ねられた回数。更新の確認で尋ねていないことを見る */
  requests: number;
  file: File;
};

function createHandle(
  name: string,
  content: string,
  lastModified: number,
  permission: PermissionState = "granted",
  /** 許可を求められたときに返す答え。省略したら今の状態のまま */
  answer?: PermissionState,
): FakeHandle & FileSystemFileHandle {
  const handle = {
    kind: "file" as const,
    name,
    permission,
    requests: 0,
    file: new File([content], name, { lastModified }),
    queryPermission(): Promise<PermissionState> {
      return Promise.resolve(handle.permission);
    },
    requestPermission(): Promise<PermissionState> {
      handle.requests += 1;
      handle.permission = answer ?? handle.permission;
      return Promise.resolve(handle.permission);
    },
    getFile(): Promise<File> {
      return Promise.resolve(handle.file);
    },
  };

  return handle as unknown as FakeHandle & FileSystemFileHandle;
}

/** File System Access API を持たないウィンドウ。参照が使えるときはここへ来ない */
const noPicker = {} as unknown as Window;

function pickerWindow(handles: FileSystemFileHandle[] | Error): Window {
  return {
    showOpenFilePicker: () =>
      handles instanceof Error ? Promise.reject(handles) : Promise.resolve(handles),
  } as unknown as Window;
}

function fileSource(handle: FileSystemFileHandle, overrides: Partial<FileDeckSource> = {}) {
  const source: FileDeckSource = {
    kind: "file",
    name: "talk.md",
    text: "# 前の原稿",
    assets: [],
    handle,
    lastModified: 1000,
    ...overrides,
  };

  return source;
}

describe("hasFileUpdate", () => {
  it("更新時刻が変わっていれば更新とみなす", async () => {
    const handle = createHandle("talk.md", "# 新しい原稿", 2000);

    await expect(hasFileUpdate(fileSource(handle))).resolves.toBe(true);
  });

  it("更新時刻が同じなら更新ではない", async () => {
    const handle = createHandle("talk.md", "# 前の原稿", 1000);

    await expect(hasFileUpdate(fileSource(handle))).resolves.toBe(false);
  });

  it("権限が未許可なら調べず、許可も求めない（設計 16.2）", async () => {
    const handle = createHandle("talk.md", "# 新しい原稿", 2000, "prompt");

    await expect(hasFileUpdate(fileSource(handle))).resolves.toBe(false);
    expect((handle as unknown as FakeHandle).requests).toBe(0);
  });

  it("参照を持っていなければ調べない", async () => {
    const source: FileDeckSource = { kind: "file", name: "talk.md", text: "A", assets: [] };

    await expect(hasFileUpdate(source)).resolves.toBe(false);
  });
});

describe("reloadFileSource", () => {
  it("覚えている参照から読み直す（FR-40）", async () => {
    const handle = createHandle("talk.md", "# 新しい原稿", 2000);

    const outcome = await reloadFileSource(fileSource(handle), {
      target: noPicker,
      includeAssets: false,
    });

    expect(outcome).toMatchObject({
      status: "updated",
      source: { text: "# 新しい原稿", lastModified: 2000, handle },
    });
  });

  it("中身が同じなら差し替えない", async () => {
    const handle = createHandle("talk.md", "# 前の原稿", 2000);

    const outcome = await reloadFileSource(fileSource(handle), {
      target: noPicker,
      includeAssets: false,
    });

    expect(outcome.status).toBe("unchanged");
  });

  it("権限を拒否されたらファイル選択へ落ちる（設計 16.2）", async () => {
    const denied = createHandle("talk.md", "# 読めない", 2000, "denied");
    const picked = createHandle("talk.md", "# 選び直した原稿", 3000);

    const outcome = await reloadFileSource(fileSource(denied), {
      target: pickerWindow([picked]),
      includeAssets: false,
    });

    expect(outcome).toMatchObject({ status: "updated", source: { text: "# 選び直した原稿" } });
  });

  it("参照が無ければファイル選択で選び直す", async () => {
    const source: FileDeckSource = { kind: "file", name: "talk.md", text: "# 前", assets: [] };
    const picked = createHandle("other.md", "# 選んだ原稿", 3000);

    const outcome = await reloadFileSource(source, {
      target: pickerWindow([picked]),
      includeAssets: false,
    });

    expect(outcome).toMatchObject({
      status: "updated",
      source: { name: "other.md", text: "# 選んだ原稿" },
    });
  });

  it("ファイル選択を閉じたら何もしない", async () => {
    const source: FileDeckSource = { kind: "file", name: "talk.md", text: "# 前", assets: [] };
    const abort = new Error("閉じた");
    abort.name = "AbortError";

    const outcome = await reloadFileSource(source, {
      target: pickerWindow(abort),
      includeAssets: false,
    });

    expect(outcome).toEqual({ status: "cancelled" });
  });

  it("対応外の拡張子は受け付けない（FR-29 と同じ扱い）", async () => {
    const handle = createHandle("talk.pdf", "%PDF", 2000);

    const outcome = await reloadFileSource(fileSource(handle), {
      target: noPicker,
      includeAssets: false,
    });

    expect(outcome).toMatchObject({ status: "failed" });
    expect(outcome.status === "failed" && outcome.message).toContain("talk.pdf");
  });

  it("空になった原稿は受け付けない", async () => {
    const handle = createHandle("talk.md", "   \n", 2000);

    const outcome = await reloadFileSource(fileSource(handle), {
      target: noPicker,
      includeAssets: false,
    });

    expect(outcome).toMatchObject({ status: "failed" });
  });

  it("求められたときだけ画像も読み直す（FR-42）", async () => {
    const handle = createHandle("talk.md", "# 新しい原稿", 2000);
    const image = createHandle("a.png", "新しい画像", 2000);
    const source = fileSource(handle, {
      assets: [{ name: "a.png", blob: new Blob(["古い画像"]), handle: image }],
    });

    const kept = await reloadFileSource(source, { target: noPicker, includeAssets: false });
    const reloaded = await reloadFileSource(source, { target: noPicker, includeAssets: true });

    expect(kept.status === "updated" && (await kept.source.assets[0]?.blob.text())).toBe(
      "古い画像",
    );
    expect(reloaded.status === "updated" && (await reloaded.source.assets[0]?.blob.text())).toBe(
      "新しい画像",
    );
  });

  it("上限を超えた画像は古いままにして名前を伝える（FR-33）", async () => {
    const handle = createHandle("talk.md", "# 新しい原稿", 2000);
    const image = createHandle("big.png", "x", 2000);
    (image as unknown as FakeHandle).file = new File(
      [new Uint8Array(MAX_ASSET_BYTES + 1)],
      "big.png",
    );
    const source = fileSource(handle, {
      assets: [{ name: "big.png", blob: new Blob(["小さい画像"]), handle: image }],
    });

    const outcome = await reloadFileSource(source, { target: noPicker, includeAssets: true });

    expect(outcome.status === "updated" && (await outcome.source.assets[0]?.blob.text())).toBe(
      "小さい画像",
    );
    expect(outcome.status === "updated" && outcome.note).toContain("big.png");
  });

  it("未許可の画像も、押されたときは許可を求めて読み直す（設計 16.2）", async () => {
    const handle = createHandle("talk.md", "# 新しい原稿", 2000);
    const image = createHandle("a.png", "新しい画像", 2000, "prompt", "granted");
    const source = fileSource(handle, {
      assets: [{ name: "a.png", blob: new Blob(["古い画像"]), handle: image }],
    });

    const outcome = await reloadFileSource(source, { target: noPicker, includeAssets: true });

    expect(outcome.status === "updated" && (await outcome.source.assets[0]?.blob.text())).toBe(
      "新しい画像",
    );
    expect((image as unknown as FakeHandle).requests).toBe(1);
  });

  it("許可されなかった画像は古いまま残し、名前を伝える", async () => {
    const handle = createHandle("talk.md", "# 新しい原稿", 2000);
    const image = createHandle("a.png", "新しい画像", 2000, "prompt", "denied");
    const source = fileSource(handle, {
      assets: [{ name: "a.png", blob: new Blob(["古い画像"]), handle: image }],
    });

    const outcome = await reloadFileSource(source, { target: noPicker, includeAssets: true });

    expect(outcome.status === "updated" && (await outcome.source.assets[0]?.blob.text())).toBe(
      "古い画像",
    );
    expect(outcome.status === "updated" && outcome.note).toContain("a.png");
  });

  it("一度断られたら、残りの画像では許可を求めない", async () => {
    const handle = createHandle("talk.md", "# 新しい原稿", 2000);
    const first = createHandle("a.png", "新しい画像", 2000, "prompt", "denied");
    const second = createHandle("b.png", "新しい画像", 2000, "prompt", "granted");
    const source = fileSource(handle, {
      assets: [
        { name: "a.png", blob: new Blob(["古い画像 A"]), handle: first },
        { name: "b.png", blob: new Blob(["古い画像 B"]), handle: second },
      ],
    });

    const outcome = await reloadFileSource(source, { target: noPicker, includeAssets: true });

    expect((first as unknown as FakeHandle).requests).toBe(1);
    expect((second as unknown as FakeHandle).requests).toBe(0);
    expect(outcome.status === "updated" && outcome.note).toContain("b.png");
  });

  it("参照を持たない画像はそのまま残す", async () => {
    const handle = createHandle("talk.md", "# 新しい原稿", 2000);
    const asset = { name: "a.png", blob: new Blob(["画像"]) };
    const source = fileSource(handle, { assets: [asset] });

    const outcome = await reloadFileSource(source, { target: noPicker, includeAssets: true });

    expect(outcome.status === "updated" && outcome.source.assets[0]).toBe(asset);
  });
});
