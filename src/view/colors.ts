/**
 * 色の解決と明暗の判定（FR-36、FR-37、[D-21](../../docs/decisions.md)）。
 *
 * 任意の書き方（`#fff` / `tomato` / `hsl()`）を自前で解析せず、ブラウザに算出させた
 * `rgb()` を読む。解析の網羅性を持ち込まずに済む。
 */

/** 選ばれた色と、その算出結果（`rgb()`）。算出結果は操作 UI の文字色を決めるのに使う */
export type ResolvedColor = {
  /** 原稿や UI に書かれたままの値。CSS へはこちらを渡す */
  value: string;
  /** ブラウザが解釈した `rgb()` */
  computed: string;
};

/**
 * 候補を上から順に見て、**ブラウザが解釈できる最初の色**を選ぶ（[D-21](../../docs/decisions.md)、D-29、D-30）。
 *
 * 空の指定と解釈できない指定は「無かったこと」にして次の候補へ落ちる。落とさずに当てると、
 * `var()` の展開に失敗して外側が透明になり、テーマの色にも 1 つ下の指定にも戻らない。
 *
 * 解釈できるかの判定（`compute`）は DOM に依存するため、呼び出し側から渡してもらう。
 * この関数自体は候補の順番だけを決める。
 */
export function resolveColor(
  candidates: readonly (string | undefined)[],
  compute: (value: string) => string | undefined,
): ResolvedColor | undefined {
  for (const candidate of candidates) {
    if (candidate === undefined || candidate === "") {
      continue;
    }

    const computed = compute(candidate);

    if (computed !== undefined) {
      return { value: candidate, computed };
    }
  }

  return undefined;
}

/**
 * 算出済みの色を `<input type="color">` が読める `#rrggbb` へ直す（FR-43）。
 *
 * 透明度は落ちる。設定パネルの初期値を出すためだけに使うので、これで足りる。
 */
export function toHexColor(computed: string): string | undefined {
  const numbers = computed.match(/\d+(\.\d+)?/g);

  // 完全に透明（rgba(0, 0, 0, 0)）は「色が無い」状態。黒として扱わない
  if (numbers && numbers.length >= 4 && Number(numbers[3]) === 0) {
    return undefined;
  }

  const rgb = parseRgb(computed);

  if (!rgb) {
    return undefined;
  }

  return `#${rgb.map((part) => Math.round(part).toString(16).padStart(2, "0")).join("")}`;
}

/** `rgb(16, 20, 24)` や `rgb(16 20 24 / 0.5)` から成分を取り出す */
export function parseRgb(value: string): [number, number, number] | undefined {
  const numbers = value.match(/\d+(\.\d+)?/g);

  if (!numbers || numbers.length < 3) {
    return undefined;
  }

  const [r, g, b] = numbers.map(Number) as [number, number, number];

  if (![r, g, b].every((part) => Number.isFinite(part) && part >= 0 && part <= 255)) {
    return undefined;
  }

  return [r, g, b];
}

/**
 * 相対輝度（WCAG の式）。0 が黒、1 が白。
 */
export function relativeLuminance([r, g, b]: [number, number, number]): number {
  const channel = (value: number): number => {
    const ratio = value / 255;
    return ratio <= 0.03928 ? ratio / 12.92 : ((ratio + 0.055) / 1.055) ** 2.4;
  };

  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/**
 * 白と黒のどちらを重ねてもコントラスト比が等しくなる輝度。
 *
 * `(1.05) / (L + 0.05) === (L + 0.05) / 0.05` を解いた値。
 * これより暗ければ白文字、明るければ黒文字のほうが読める。
 */
const CONTRAST_PIVOT = 0.179;

/** 背景が暗いか。判定できない場合は「暗くない」として明るい前提で扱う */
export function isDarkBackground(computedColor: string): boolean {
  const rgb = parseRgb(computedColor);

  if (!rgb) {
    return false;
  }

  return relativeLuminance(rgb) < CONTRAST_PIVOT;
}

/**
 * 実際に算出される色を得る。
 *
 * 一時的な要素へ設定してブラウザに解決させるので、どの書き方でも `rgb()` で返る。
 * 解釈できない値のときは undefined。
 */
export function computeColor(value: string, target: Document): string | undefined {
  if (value === "") {
    return undefined;
  }

  const probe = target.createElement("span");
  probe.style.display = "none";
  probe.style.color = value;

  // 未対応の書き方だと color が空のままになる
  if (probe.style.color === "") {
    return undefined;
  }

  target.body.append(probe);
  const computed = target.defaultView?.getComputedStyle(probe).color;
  probe.remove();

  return computed;
}
