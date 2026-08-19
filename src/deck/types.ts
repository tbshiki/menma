/**
 * デッキの内部モデル。
 *
 * この層は DOM に依存しない純粋なデータで、パースの結果だけを表す。
 * 描画に関する判断（レイアウトごとの DOM 構造など）は view 層が行う。
 */

export const SLIDE_LAYOUTS = [
  "default",
  "center",
  "cover",
  "split",
  "image-left",
  "image-right",
  "quote",
  "blank",
] as const;

export type SlideLayout = (typeof SLIDE_LAYOUTS)[number];

/**
 * 用意してあるテーマ。`styles/themes/<名前>.css` と 1 対 1 で対応する。
 *
 * ここに無い名前を通すと、テーマの CSS 変数がどれも定義されないまま描画され、
 * 背景も文字も既定値のない状態（黒地に黒）になって読めなくなる。
 */
export const THEMES = ["default"] as const;

export type Theme = (typeof THEMES)[number];

export type DeckMeta = {
  title: string;
  author: string;
  lang: string;
  theme: string;
  aspectRatio: string;
  showPageNumber: boolean;
  showControls: boolean;
  showProgress: boolean;
  transition: "none";
  externalLinksNewTab: boolean;
};

export type Slide = {
  /** 0 始まりの内部インデックス。URL とページ番号は 1 始まりで表す */
  index: number;
  source: string;
  html: string;
  asideHtml?: string;
  notes?: string;
  layout: SlideLayout;
  classes: readonly string[];
  background?: string;
  backgroundColor?: string;
  foreground?: string;
};

export type DeckWarningKind =
  | "unknown-key"
  | "unknown-theme"
  | "unknown-layout"
  | "unknown-attribute"
  | "invalid-type"
  | "duplicate-directive";

export type DeckWarning = {
  kind: DeckWarningKind;
  message: string;
  /** slides.md の行番号（1 始まり） */
  line?: number;
};

export type Deck = {
  meta: DeckMeta;
  slides: readonly Slide[];
  warnings: readonly DeckWarning[];
};

/**
 * 分割直後のスライド。まだ Markdown もディレクティブも解釈していない。
 *
 * `startLine` は警告に元原稿の行番号を添えるために持つ。
 */
export type RawSlide = {
  source: string;
  /** slides.md における source 1 行目の行番号（1 始まり） */
  startLine: number;
};

/** 既定値そのものを書き換えられないよう凍結する。利用側は展開してコピーを作る */
export const DEFAULT_DECK_META: Readonly<DeckMeta> = Object.freeze({
  title: "menma",
  author: "",
  lang: "ja",
  theme: "default",
  aspectRatio: "16/9",
  showPageNumber: true,
  showControls: true,
  showProgress: true,
  transition: "none",
  externalLinksNewTab: true,
});
