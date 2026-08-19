import type { NavigationController } from "./controller";

/**
 * キーボード操作（FR-13、FR-14）。
 *
 * ここは入力を解釈するだけで、状態は controller が持つ。
 */

/** フォーカスがあるときはページ移動より入力を優先する要素 */
const EDITABLE_TAGS = new Set(["INPUT", "TEXTAREA", "SELECT", "BUTTON"]);

export function connectKeyboard(controller: NavigationController, target: Window): () => void {
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
    action(controller);
  };

  target.addEventListener("keydown", onKeyDown);

  return () => {
    target.removeEventListener("keydown", onKeyDown);
  };
}

type Action = (controller: NavigationController) => void;

function resolveAction(event: KeyboardEvent): Action | undefined {
  switch (event.key) {
    case "ArrowRight":
    case "ArrowDown":
    case "PageDown":
      return (controller) => {
        controller.next();
      };
    case "ArrowLeft":
    case "ArrowUp":
    case "PageUp":
      return (controller) => {
        controller.previous();
      };
    case " ":
      return event.shiftKey
        ? (controller) => {
            controller.previous();
          }
        : (controller) => {
            controller.next();
          };
    case "Home":
      return (controller) => {
        controller.first();
      };
    case "End":
      return (controller) => {
        controller.last();
      };
    default:
      return undefined;
  }
}

function isEditable(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return target.isContentEditable || EDITABLE_TAGS.has(target.tagName);
}
