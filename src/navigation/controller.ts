import { clamp } from "../utils/clamp";

/**
 * 表示位置の唯一の持ち主（設計 6 章）。
 *
 * キー操作・ハッシュ・UI ボタンはすべて `goTo()` を通す。経路ごとに挙動が食い違わないようにするため。
 * DOM には触らない。状態が変わったことを購読者へ伝えるだけ。
 */

export type PresentationState = {
  /** 0 始まり。URL とページ番号は 1 始まりで表す */
  current: number;
  total: number;
};

export type StateListener = (state: PresentationState) => void;

export class NavigationController {
  readonly #total: number;
  #current: number;
  readonly #listeners = new Set<StateListener>();

  constructor(total: number, initial = 0) {
    if (!Number.isInteger(total) || total < 1) {
      throw new Error(`[menma] スライドは 1 枚以上必要です（指定値: ${String(total)}）。`);
    }

    this.#total = total;
    this.#current = clamp(Math.trunc(initial), 0, total - 1);
  }

  get state(): PresentationState {
    return { current: this.#current, total: this.#total };
  }

  /** 状態を変更する唯一のメソッド。範囲外は端へ丸め、同じ位置なら何もしない */
  goTo(index: number): void {
    const next = clamp(Math.trunc(index), 0, this.#total - 1);

    if (next === this.#current) {
      return;
    }

    this.#current = next;
    const state = this.state;
    for (const listener of this.#listeners) {
      listener(state);
    }
  }

  next(): void {
    this.goTo(this.#current + 1);
  }

  previous(): void {
    this.goTo(this.#current - 1);
  }

  first(): void {
    this.goTo(0);
  }

  last(): void {
    this.goTo(this.#total - 1);
  }

  /**
   * 状態の変化を購読する。購読した時点で現在の状態を 1 度渡すので、
   * 初期描画と以降の更新を同じ処理で書ける。
   *
   * @returns 購読を解除する関数
   */
  subscribe(listener: StateListener): () => void {
    this.#listeners.add(listener);
    listener(this.state);

    return () => {
      this.#listeners.delete(listener);
    };
  }
}
