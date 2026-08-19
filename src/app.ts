import sampleText from "../slides.md?raw";

import { DeckError } from "./deck/errors";
import { parseDeck } from "./deck/parseDeck";
import { readSourceText, sourceAssets, type DeckSource } from "./deck/source";
import { loadAppearance, saveAppearance, type Appearance } from "./storage/appearance";
import { clearSource, loadSource, saveSource } from "./storage/deckStore";
import type { Deck } from "./deck/types";
import { createAssetBindings, findMissingAssets, type AssetBindings } from "./view/assets";
import { createHome, type HomeView } from "./view/home";
import { startPresentation } from "./view/presentation";

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
  let stopPresentation: (() => void) | undefined;
  let bindings: AssetBindings | undefined;

  /** 発表画面と、そこで使っていた blob URL を捨てる（設計 15.2） */
  const stop = (): void => {
    stopPresentation?.();
    stopPresentation = undefined;
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

  const showPresentation = (deck: Deck, next: DeckSource): void => {
    home?.destroy();
    home = undefined;

    target.document.title = deck.meta.title;
    target.document.documentElement.lang = deck.meta.lang;

    stop();
    bindings = createAssetBindings(sourceAssets(next));
    stopPresentation = startPresentation(deck, bindings, appearance, mount, target, exitToHome);
  };

  /** 原稿を受け取って発表へ移る。読めなければ入口へ理由を出す（FR-29） */
  const open = async (next: DeckSource, notice?: string, force = false): Promise<void> => {
    let deck: Deck;

    try {
      deck = parseDeck(readSourceText(next, sampleText));
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

    if (stopPresentation) {
      return;
    }

    try {
      showPresentation(parseDeck(readSourceText(source, sampleText)), source);
    } catch {
      showHome();
      home?.showError("保存されていた原稿を読み込めませんでした。");
    }
  };

  sync();
  target.addEventListener("popstate", sync);

  return () => {
    target.removeEventListener("popstate", sync);
    stop();
    home?.destroy();
  };
}
