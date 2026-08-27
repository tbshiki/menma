import type { Appearance } from "../storage/appearance";
import type { DeckMeta } from "../deck/types";
import { computeColor, isDarkBackground, resolveColor } from "./colors";

/**
 * 見た目の指定をデッキの DOM へ当てる（FR-36、FR-37、FR-43、FR-44）。
 *
 * 描画時（`renderDeck`）、発表中に設定が変わったとき、ページを移ったときの**すべてから呼ぶ**。
 * そのため**必ず前の指定を消してから当て直す**。足すだけにすると、暗い色から明るい色へ
 * 戻したときに操作 UI の文字色が暗いままになり、外側の色を指定したページから指定の無い
 * ページへ移ったときにも前の色が残る。
 *
 * 値は CSS Custom Property として渡す。解釈できない値は無視されるだけで済む（NFR-07）。
 */

const PROPERTIES = ["--mn-page-bg", "--mn-progress-color", "--mn-hud-fg", "--mn-hud-bg"] as const;

export function applyAppearance(
  root: HTMLElement,
  meta: DeckMeta,
  appearance: Appearance,
  /** いま出しているページの `@slide pageBackground=`（FR-44、D-29） */
  slidePageBackground?: string,
): void {
  for (const property of PROPERTIES) {
    root.style.removeProperty(property);
  }

  // 色は UI の指定 → @slide の指定 → 原稿全体の指定 → テーマ の順で決める（D-21、D-29）
  const pageBackground = resolveColor(
    appearance.pageBackground,
    slidePageBackground ?? meta.pageBackground,
  );
  const progressColor = resolveColor(appearance.progressColor, meta.progressColor);

  applyColor(root, "--mn-page-bg", pageBackground);
  applyColor(root, "--mn-progress-color", progressColor);
  applyHudContrast(root, pageBackground);
}

/** 進み具合のバーを出すか。UI の指定が無ければ原稿に従う（FR-35、FR-43） */
export function resolveShowProgress(meta: DeckMeta, appearance: Appearance): boolean {
  return appearance.showProgress ?? meta.showProgress;
}

/** 指定があるときだけテーマの色を上書きする */
function applyColor(root: HTMLElement, property: string, value: string | undefined): void {
  if (value !== undefined && value !== "") {
    root.style.setProperty(property, value);
  }
}

/**
 * 操作 UI は画面の隅（スライドの外）に出るため、背景が濃いと文字が埋もれる。
 * 背景の明るさを見て読める色を決める（D-21）。
 */
function applyHudContrast(root: HTMLElement, pageBackground: string | undefined): void {
  if (pageBackground === undefined) {
    return;
  }

  const computed = computeColor(pageBackground, root.ownerDocument);

  if (computed === undefined) {
    return;
  }

  if (isDarkBackground(computed)) {
    root.style.setProperty("--mn-hud-fg", "#f4f6f8");
    root.style.setProperty("--mn-hud-bg", "rgb(0 0 0 / 0.55)");
  }
}
