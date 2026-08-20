import type { PresentationState } from "../navigation/controller";

/**
 * ページ番号。**2 段階で「入口へ戻る」に変わる**（FR-28、[D-22](../../docs/decisions.md)）。
 *
 * 発表中に押してしまうと話が止まるので、1 クリックでは戻らない。
 * ポインタを乗せ続けるかダブルクリックすると役割が変わり、そこでクリックすると戻る。
 */

/**
 * ポインタを乗せ続けて役割が変わるまでの時間。
 * 送るボタンへ向かう途中で通り過ぎただけでは変わらない長さにする
 */
const ARM_DELAY_MS = 1500;

export type Counter = {
  root: HTMLButtonElement;
  update(state: PresentationState): void;
  /** タイマーを止める。発表画面を捨てるときに呼ぶ */
  destroy(): void;
};

export function createCounter(onExit: () => void): Counter {
  const root = document.createElement("button");
  root.type = "button";
  root.className = "mn-hud__counter";

  let label = "";
  let armed = false;
  let armTimer = 0;

  const render = (): void => {
    root.textContent = armed ? "原稿を選ぶ" : label;
    root.dataset.armed = armed ? "true" : "false";
    root.setAttribute(
      "aria-label",
      armed ? "入口画面へ戻る" : `${label}。押し続けると入口画面へ戻れます`,
    );
  };

  const clearArmTimer = (): void => {
    clearTimeout(armTimer);
    armTimer = 0;
  };

  const arm = (): void => {
    clearArmTimer();
    if (!armed) {
      armed = true;
      render();
    }
  };

  const disarm = (): void => {
    clearArmTimer();
    if (armed) {
      armed = false;
      render();
    }
  };

  root.addEventListener("pointerenter", () => {
    armTimer = window.setTimeout(arm, ARM_DELAY_MS);
  });

  // 離れたら待たずに戻す。残ったままだと、戻ってきて押したときに入口へ飛んでしまう
  root.addEventListener("pointerleave", disarm);

  // ダブルクリックなら待たずに役割を変える
  root.addEventListener("dblclick", arm);

  // キーボードで辿り着くのは意図的な操作なので、待たせない。
  // ポインタで押したときのフォーカスでは反応させない（それでは 1 クリックで戻ってしまう）
  root.addEventListener("focus", () => {
    if (root.matches(":focus-visible")) {
      arm();
    }
  });
  root.addEventListener("blur", disarm);

  root.addEventListener("click", (event) => {
    const wasArmed = armed;

    // ポインタ操作ではフォーカスを残さない。
    // 残ると Space でこのボタンが再び押され、送ったつもりが入口へ戻ってしまう
    if (event.detail > 0) {
      root.blur();
    }

    if (!wasArmed) {
      return;
    }

    disarm();
    onExit();
  });

  return {
    root,

    update(state: PresentationState): void {
      label = `${String(state.current + 1)} / ${String(state.total)}`;
      render();
    },

    destroy(): void {
      clearArmTimer();
    },
  };
}
