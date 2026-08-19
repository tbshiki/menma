/**
 * コードフェンス（``` / ~~~）の内側かどうかを行単位で追跡する。
 *
 * スライドの区切り（`---`）もディレクティブ（`@slide` など）も、コードフェンスの中では
 * ただの文字列として扱う。記法そのものを原稿で説明できるようにするため（記法仕様 8 章）。
 */

const FENCE_PATTERN = /^ {0,3}(`{3,}|~{3,})(.*)$/;

type OpenFence = {
  marker: "`" | "~";
  length: number;
};

export class FenceTracker {
  #open: OpenFence | undefined;

  /** 直前に読んだ行の時点でフェンスの内側にいるか */
  get isOpen(): boolean {
    return this.#open !== undefined;
  }

  /**
   * 1 行読み進める。
   *
   * @returns その行がコードフェンスに属する（開始行・内容・終了行のいずれか）なら true
   */
  read(line: string): boolean {
    const match = FENCE_PATTERN.exec(line);

    if (!match) {
      return this.isOpen;
    }

    const fence = match[1] ?? "";
    const info = match[2] ?? "";
    const marker = fence.startsWith("`") ? "`" : "~";

    if (!this.#open) {
      // 開始フェンス。``` の情報文字列にはバッククォートを含められない（CommonMark）
      if (marker === "`" && info.includes("`")) {
        return false;
      }
      this.#open = { marker, length: fence.length };
      return true;
    }

    // 終了フェンスは、開始と同じ記号で同じ長さ以上、かつ情報文字列を持たないもの
    if (marker === this.#open.marker && fence.length >= this.#open.length && info.trim() === "") {
      this.#open = undefined;
    }
    return true;
  }
}
