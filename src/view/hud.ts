import type { PresentationState } from "../navigation/controller";

/**
 * 発表中に出す最小限の情報（FR-18）。
 *
 * M2 ではページ番号だけ。操作ボタンと減光は M3 で追加する。
 */

export type Hud = {
  root: HTMLElement;
  update(state: PresentationState): void;
};

export function createHud(options: { showPageNumber: boolean }): Hud {
  const root = document.createElement("div");
  root.className = "mn-hud";
  root.hidden = !options.showPageNumber;

  const counter = document.createElement("p");
  counter.className = "mn-hud__counter";
  root.append(counter);

  return {
    root,
    update(state: PresentationState): void {
      counter.textContent = `${String(state.current + 1)} / ${String(state.total)}`;
    },
  };
}
