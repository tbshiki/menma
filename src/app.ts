import manualText from "../docs/writing-slides.md?raw";
import sampleText from "../slides.md?raw";

import { DeckError } from "./deck/errors";
import { parseDeck } from "./deck/parseDeck";
import {
  canReloadSource,
  readSourceText,
  sourceAssets,
  type BundledText,
  type DeckSource,
} from "./deck/source";
import { loadAppearance, saveAppearance, type Appearance } from "./storage/appearance";
import { clearSource, loadSource, saveSource } from "./storage/deckStore";
import { hasFileUpdate, reloadFileSource } from "./storage/fileAccess";
import type { Deck } from "./deck/types";
import { createAssetBindings, findMissingAssets, type AssetBindings } from "./view/assets";
import { createHome, type HomeView } from "./view/home";
import type { ReloadState } from "./view/hud";
import { startPresentation, type Presentation } from "./view/presentation";

/** 同梱の原稿。取得に失敗する経路を作らないため、どちらもバンドルへ入れる（D-26） */
const bundled: BundledText = { sample: sampleText, manual: manualText };

/**
 * 画面の切り替え（設計 14 章）。
 *
 * 出す画面はハッシュの有無で決まる。
 * - ハッシュ無し → 入口画面
 * - `#/N` かつ原稿がある → 発表画面
 *
 * 原稿も画像も URL へ載せない（D-19）。保存先はこのブラウザだけ。
 */
export async function startApp(mount: HTMLElement, target: Window): Promise<() => void> {
  let source: DeckSource | undefined = await loadSource(target);
  let appearance: Appearance = loadAppearance(target);

  let home: HomeView | undefined;
  let presentation: Presentation | undefined;
  let bindings: AssetBindings | undefined;
  /** 読み直しが走っている間だけ true。二重に走らせない（設計 16.3） */
  let reloading = false;
  /** 更新を見つけた印が出ているか。取り消しや失敗で消してしまわないため（FR-41） */
  let updateFound = false;

  /** 発表画面と、そこで使っていた blob URL を捨てる（設計 15.2） */
  const stop = (): void => {
    presentation?.stop();
    presentation = undefined;
    bindings?.release();
    bindings = undefined;
  };

  const showHome = (): void => {
    stop();

    if (home) {
      return;
    }

    target.document.title = "menma";
    target.document.documentElement.lang = "ja";

    home = createHome({
      onSource: (next, notice) => {
        void open(next, notice);
      },
      onResume: source
        ? () => {
            void open(source as DeckSource);
          }
        : undefined,
      onClearStored: source
        ? () => {
            void clearSource(target);
            source = undefined;
          }
        : undefined,
      appearance,
      onAppearanceChange: (next) => {
        appearance = next;
        saveAppearance(target, next);
      },
    });
    mount.append(home.root);
  };

  const showPresentation = (deck: Deck, next: DeckSource, message?: string): void => {
    home?.destroy();
    home = undefined;

    target.document.title = deck.meta.title;
    target.document.documentElement.lang = deck.meta.lang;

    stop();
    bindings = createAssetBindings(sourceAssets(next));
    presentation = startPresentation(
      deck,
      bindings,
      appearance,
      mount,
      target,
      exitToHome,
      // 読み直せる取得元のときだけ 🔄 を出す（FR-40）
      canReloadSource(next) ? requestReload : undefined,
    );

    if (message !== undefined) {
      presentation.setReload({ status: "idle", message });
    }
  };

  /** 原稿を受け取って発表へ移る。読めなければ入口へ理由を出す（FR-29） */
  const open = async (next: DeckSource, notice?: string, force = false): Promise<void> => {
    let deck: Deck;

    try {
      deck = parseDeck(readSourceText(next, bundled));
    } catch (error) {
      showHome();
      home?.showError(
        error instanceof DeckError ? error.userMessage : "原稿を読み込めませんでした。",
      );
      return;
    }

    // 取り込めなかったファイル（FR-33）と、参照されているのに選ばれていない画像（FR-34）を
    // 開く前にまとめて知らせる。画像が無くても発表はできるので、そのまま進む手段を添える
    if (!force) {
      const missing = findMissing(deck, next);
      const messages = [
        notice,
        missing.length > 0 ? `次の画像が選ばれていません: ${missing.join(" / ")}` : undefined,
      ].filter((message): message is string => message !== undefined);

      if (messages.length > 0) {
        showHome();
        home?.showWarning(messages.join(" "), () => {
          void open(next, undefined, true);
        });
        return;
      }
    }

    source = next;
    await saveSource(target, next);

    // 履歴へ積む。ブラウザの戻るで入口へ帰れるようにするため（FR-28）
    if (target.location.hash === "") {
      target.history.pushState(null, "", "#/1");
    }

    showPresentation(deck, next);
  };

  /**
   * 元ファイルを読み直す（FR-40、FR-42、設計 16.3）。
   *
   * **失敗しても表示中のデッキを捨てない。** 発表の最中に押される操作なので、
   * 読めなかった・解釈できなかったときは理由を操作 UI へ出すだけにする。
   */
  const reload = async (includeAssets: boolean): Promise<void> => {
    const current = source;

    if (reloading || !current || !canReloadSource(current)) {
      return;
    }

    reloading = true;
    presentation?.setReload({ status: "busy" });

    try {
      const outcome = await reloadFileSource(current, { target, includeAssets });

      // 取り消し・失敗では更新の印を消さない。ファイルはまだ新しいままなので、
      // 印を落とすと「更新に気付けない」状態へ戻ってしまう（FR-41）
      const settled: ReloadState["status"] = updateFound ? "updated" : "idle";

      if (outcome.status === "cancelled") {
        presentation?.setReload({ status: settled });
        return;
      }

      if (outcome.status === "failed") {
        presentation?.setReload({ status: settled, message: outcome.message });
        return;
      }

      let deck: Deck;

      try {
        deck = parseDeck(outcome.source.text);
      } catch (error) {
        presentation?.setReload({
          status: settled,
          message: error instanceof DeckError ? error.userMessage : "原稿を読み直せませんでした。",
        });
        return;
      }

      // 待っている間に別の原稿へ切り替わっていたら、この結果は捨てる。
      // 上書きすると、利用者が選び直した原稿を勝手に差し替えることになる
      if (source !== current) {
        return;
      }

      source = outcome.source;
      updateFound = false;
      // 参照と更新時刻も含めて保存し直す。リロードしても最新の内容で再開できる（FR-27）
      await saveSource(target, outcome.source);

      if (outcome.status === "unchanged") {
        presentation?.setReload({ status: "idle", message: outcome.note ?? "変更はありません。" });
        return;
      }

      // 待っている間に入口へ戻っていることがある（設計 16.3）。そこで画面を作り直すと
      // 「戻る」を取り消してしまうので、保存だけで終える
      if (!presentation) {
        return;
      }

      // ページ位置はハッシュが持っている。作り直した controller が読み直す（設計 16.3）
      showPresentation(deck, outcome.source, outcome.note ?? "読み直しました。");
    } finally {
      reloading = false;
    }
  };

  const requestReload = (options: { includeAssets: boolean }): void => {
    void reload(options.includeAssets);
  };

  /**
   * 原稿が更新されていないか調べる（FR-41）。
   *
   * 見つけても**印を付けるだけ**で、画面は変えない（D-27）。権限も求めない。
   */
  const checkUpdate = (): void => {
    const current = source;

    if (!presentation || reloading || !current || !canReloadSource(current)) {
      return;
    }

    void hasFileUpdate(current).then((updated) => {
      // 調べている間に画面が変わっていることがある。いまの状態だけを見て決める
      if (updated && presentation && !reloading && source === current) {
        updateFound = true;
        presentation.setReload({ status: "updated" });
      }
    });
  };

  const onVisibilityChange = (): void => {
    if (target.document.visibilityState === "visible") {
      checkUpdate();
    }
  };

  /** 未解決の画像を調べるためだけに blob URL を作り、すぐ捨てる */
  const findMissing = (deck: Deck, next: DeckSource): string[] => {
    const probe = createAssetBindings(sourceAssets(next));

    try {
      return findMissingAssets(deck, probe);
    } finally {
      probe.release();
    }
  };

  /**
   * 発表画面から入口へ戻る（FR-28、D-22）。
   *
   * ハッシュを外して入口を出す。`pushState` は `popstate` を起こさないので、
   * 画面の切り替えはここで明示的に行う。
   */
  const exitToHome = (): void => {
    if (target.location.hash !== "") {
      const { pathname, search } = target.location;
      target.history.pushState(null, "", `${pathname}${search}`);
    }
    showHome();
  };

  /** URL と手持ちの原稿から、いま出すべき画面を決める */
  const sync = (): void => {
    if (target.location.hash === "" || !source) {
      showHome();
      return;
    }

    if (presentation) {
      return;
    }

    try {
      showPresentation(parseDeck(readSourceText(source, bundled)), source);
    } catch {
      showHome();
      home?.showError("保存されていた原稿を読み込めませんでした。");
    }
  };

  sync();
  target.addEventListener("popstate", sync);
  // 戻ってきたときに原稿の更新を調べる（FR-41）
  target.addEventListener("focus", checkUpdate);
  target.document.addEventListener("visibilitychange", onVisibilityChange);

  return () => {
    target.removeEventListener("popstate", sync);
    target.removeEventListener("focus", checkUpdate);
    target.document.removeEventListener("visibilitychange", onVisibilityChange);
    stop();
    home?.destroy();
  };
}
