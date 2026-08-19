/**
 * 回復不能なパースエラー。
 *
 * 記法の間違いは原則として警告（`Deck.warnings`）に留め、発表中に 1 か所の誤りで
 * 全体が落ちないようにする。ここで投げるのは、そもそもスライドを 1 枚も表示できない場合だけ。
 */
export class DeckError extends Error {
  /** 利用者向けの短い説明。本番のエラー画面はこちらを出す */
  readonly userMessage: string;
  /** slides.md の行番号（1 始まり）。特定できない場合は undefined */
  readonly line: number | undefined;

  constructor(message: string, options: { userMessage: string; line?: number }) {
    super(message);
    this.name = "DeckError";
    this.userMessage = options.userMessage;
    this.line = options.line;
  }
}
