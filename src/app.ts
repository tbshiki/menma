import sampleText from "../slides.md?raw";

import { DeckError } from "./deck/errors";
import { parseDeck } from "./deck/parseDeck";
import {
  clearStoredSource,
  loadStoredSource,
  readSourceText,
  saveSource,
  type DeckSource,
} from "./deck/source";
import { createHome, type HomeView } from "./view/home";
import { startPresentation } from "./view/presentation";

/**
 * 画面の切り替え（設計 14 章）。
 *
 * 出す画面はハッシュの有無で決まる。
 * - ハッシュ無し → 入口画面
 * - `#/N` かつ原稿がある → 発表画面
 *
 * 原稿は URL へ載せない（D-19）。保存先はこのブラウザだけ。
 */
export function startApp(mount: HTMLElement, target: Window): () => void {
  const storage = getStorage(target);
  let source: DeckSource | undefined = storage ? loadStoredSource(storage) : undefined;

  let home: HomeView | undefined;
  let stopPresentation: (() => void) | undefined;

  const showHome = (): void => {
    stopPresentation?.();
    stopPresentation = undefined;

    if (home) {
      return;
    }

    target.document.title = "menma";
    target.document.documentElement.lang = "ja";

    home = createHome({
      onSource: (next) => {
        open(next);
      },
      onResume: source
        ? () => {
            open(source as DeckSource);
          }
        : undefined,
      onClearStored: source
        ? () => {
            if (storage) {
              clearStoredSource(storage);
            }
            source = undefined;
          }
        : undefined,
    });
    mount.append(home.root);
  };

  const showPresentation = (deck: ReturnType<typeof parseDeck>): void => {
    home?.destroy();
    home = undefined;

    target.document.title = deck.meta.title;
    target.document.documentElement.lang = deck.meta.lang;

    stopPresentation?.();
    stopPresentation = startPresentation(deck, mount, target);
  };

  /** 原稿を受け取って発表へ移る。読めなければ入口へ理由を出す（FR-29） */
  const open = (next: DeckSource): void => {
    let deck: ReturnType<typeof parseDeck>;

    try {
      deck = parseDeck(readSourceText(next, sampleText));
    } catch (error) {
      showHome();
      home?.showError(
        error instanceof DeckError ? error.userMessage : "原稿を読み込めませんでした。",
      );
      return;
    }

    source = next;
    if (storage) {
      saveSource(storage, next);
    }

    // 履歴へ積む。ブラウザの戻るで入口へ帰れるようにするため（FR-28）
    if (target.location.hash === "") {
      target.history.pushState(null, "", "#/1");
    }

    showPresentation(deck);
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
      showPresentation(parseDeck(readSourceText(source, sampleText)));
    } catch {
      showHome();
      home?.showError("保存されていた原稿を読み込めませんでした。");
    }
  };

  sync();
  target.addEventListener("popstate", sync);

  return () => {
    target.removeEventListener("popstate", sync);
    stopPresentation?.();
    home?.destroy();
  };
}

/** プライベートモードなどで localStorage を触れない環境がある */
function getStorage(target: Window): Storage | undefined {
  try {
    return target.localStorage;
  } catch {
    return undefined;
  }
}
