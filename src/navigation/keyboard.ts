import type { NavigationController } from "./controller";

/**
 * キーボード操作（FR-13、FR-14、FR-17）。
 *
 * ここは入力を解釈するだけで、状態は controller が持つ。
 * ナビゲーション以外の動作は `actions` で受け取り、キー割り当てをこの 1 か所へ集める。
 */

export type KeyboardActions = {
  /** `F` キーで呼ぶ。渡さなければそのキーは無視する */
  toggleFullscreen?: (() => void) | undefined;
};

/** フォーカスがあるときはページ移動より入力を優先する要素 */
const EDITABLE_TAGS = new Set(["INPUT", "TEXTAREA", "SELECT", "BUTTON"]);

export function connectKeyboard(
  controller: NavigationController,
  target: Window,
  actions: KeyboardActions = {},
): () => void {
  const resolveAction = (event: KeyboardEvent): (() => void) | undefined => {
    switch (event.key) {
      case "ArrowRight":
      case "ArrowDown":
      case "PageDown":
        return () => {
          controller.next();
        };
      case "ArrowLeft":
      case "ArrowUp":
      case "PageUp":
        return () => {
          controller.previous();
        };
      case " ":
        return event.shiftKey
          ? () => {
              controller.previous();
            }
          : () => {
              controller.next();
            };
      case "Home":
        return () => {
          controller.first();
        };
      case "End":
        return () => {
          controller.last();
        };
      case "f":
      case "F":
        return actions.toggleFullscreen;
      default:
        return undefined;
    }
  };

  const onKeyDown = (event: KeyboardEvent): void => {
    // ブラウザ側のショートカットを奪わない
    if (event.ctrlKey || event.altKey || event.metaKey || event.isComposing) {
      return;
    }

    if (isEditable(event.target)) {
      return;
    }

    const action = resolveAction(event);

    if (!action) {
      return;
    }

    // 矢印や Space による画面スクロールを止める
    event.preventDefault();
    action();
  };

  target.addEventListener("keydown", onKeyDown);

  return () => {
    target.removeEventListener("keydown", onKeyDown);
  };
}

function isEditable(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return target.isContentEditable || EDITABLE_TAGS.has(target.tagName);
}
