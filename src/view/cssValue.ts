/**
 * 原稿由来の値を CSS へ渡す前の検査（NFR-07）。
 *
 * 色は CSS Custom Property へそのまま渡してよい。`var()` で展開されるときに構文検査を受け、
 * 壊れた値なら宣言が無効になるだけで、別の宣言を差し込むことはできないため。
 * 画像パスだけは `url()` の括りを自分で組み立てる必要があるので、ここで確認する。
 */

/** `url()` の括りを抜け出せる文字。これらを含むパスは使わない */
const UNSAFE_IN_URL = /["'()\\\r\n]/;

/**
 * 画像パスを `url("...")` へ包む。
 *
 * @returns 安全に包めない場合は undefined
 */
export function toCssUrl(path: string): string | undefined {
  if (path === "" || UNSAFE_IN_URL.test(path)) {
    return undefined;
  }

  return `url("${path}")`;
}
