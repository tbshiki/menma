# menma 設計

> 文書種別: 基本設計（正典）
> 対象バージョン: MVP（v1.0）
> 関連: [要件定義](./requirements.md) / [記法仕様](./spec-markdown.md) / [ロードマップ](./roadmap.md) / [決定記録](./decisions.md)

## 1. 全体像

```text
slides.md
   │  ①読み込み（ビルド時 raw import）
   ▼
Front Matter 分離 ──► DeckMeta
   │  ②
   ▼
スライド分割（トップレベルの ---）
   │  ③
   ▼
ディレクティブ解析（@slide / @aside / @notes）
   │  ④
   ▼
Markdown → HTML（markdown-it）
   │  ⑤
   ▼
Deck（純粋なデータ）
   │  ⑥描画
   ▼
DOM（deck / stage / slide / hud）
   │
   ▼
NavigationController ◄── keyboard / hashchange / UI ボタン
   │
   ▼
location.hash
```

①〜⑤は副作用のない純粋関数として実装し、DOM に触れない。⑥以降だけが DOM を扱う。この境界が単体テスト容易性の要（NFR-05）。

## 2. 内部モデル

```ts
export type SlideLayout =
  | "default"
  | "center"
  | "cover"
  | "split"
  | "image-left"
  | "image-right"
  | "quote"
  | "blank";

export type DeckMeta = {
  title: string;
  author: string;
  lang: string;
  theme: string;
  aspectRatio: string;
  showPageNumber: boolean;
  showControls: boolean;
  transition: "none";
  externalLinksNewTab: boolean;
};

export type Slide = {
  /** 0 始まりの内部インデックス。URL は 1 始まりで表す */
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

export type DeckWarning = {
  kind:
    | "unknown-key"
    | "unknown-layout"
    | "unknown-attribute"
    | "invalid-type"
    | "duplicate-directive";
  message: string;
  /** slides.md の行番号（1 始まり） */
  line?: number;
};

export type Deck = {
  meta: DeckMeta;
  slides: readonly Slide[];
  warnings: readonly DeckWarning[];
};
```

**警告は例外を投げずに `Deck.warnings` へ集める。** 発表中に 1 つの記法ミスで全体が落ちるのを防ぐため（判断基準「発表時に壊れにくいか」）。回復不能なもの（スライド 0 枚、Front Matter が閉じない）だけを `DeckError` として投げる。

インデックスは内部 0 始まり、URL とページ番号表示は 1 始まり。変換は 1 か所（`navigation/hash.ts`）に閉じる。

## 3. モジュール構成

```text
src/
├── main.ts                    # エントリ。組み立てのみ
│
├── deck/                      # 純粋層。DOM を import しない
│   ├── types.ts
│   ├── parseDeck.ts           # 下の 4 つを束ねる
│   ├── parseFrontMatter.ts
│   ├── splitSlides.ts
│   ├── parseDirectives.ts
│   └── markdown.ts            # markdown-it の設定とレンダリング
│
├── view/                      # DOM 層
│   ├── renderDeck.ts          # Deck → DOM
│   ├── renderSlide.ts
│   ├── hud.ts                 # ページ番号・操作 UI
│   ├── errorScreen.ts
│   └── scaler.ts              # 16:9 フィット
│
├── navigation/
│   ├── controller.ts          # 状態を変更する唯一の場所
│   ├── keyboard.ts
│   ├── hash.ts
│   └── fullscreen.ts
│
├── styles/
│   ├── reset.css
│   ├── deck.css               # 構造
│   ├── layouts.css            # レイアウト別
│   ├── print.css
│   └── themes/default.css     # テーマ変数のみ
│
└── utils/
    ├── clamp.ts
    └── log.ts                 # 開発時のみ出力
```

依存方向の規則。

- `deck/` は `view/` と `navigation/` を import しない
- `view/` は `navigation/` を import しない。操作は `main.ts` が渡すコールバック経由
- `navigation/` は DOM イベントを購読するが、描画は行わない（購読者へ通知するだけ）
- グローバル変数を作らない。状態は `NavigationController` のインスタンスに閉じる

## 4. DOM 構造とクラス名

menma 独自の命名として、接頭辞 `mn-` を使う（[D-05](./decisions.md)）。

```html
<body>
  <div class="mn-deck" data-theme="default">
    <!-- mn-stage は 16:9 の基準キャンバス。ここへ transform: scale を当てる -->
    <div class="mn-stage">
      <section class="mn-slide" data-layout="split">
        <div class="mn-slide__main">...</div>
        <div class="mn-slide__aside">...</div>
      </section>
      <!-- 表示していないスライドは hidden 属性を持つ -->
    </div>

    <div class="mn-hud">
      <p class="mn-hud__counter">3 / 24</p>
      <div class="mn-hud__actions">
        <button type="button" class="mn-hud__button" aria-label="前のスライド"></button>
        <button type="button" class="mn-hud__button" aria-label="次のスライド"></button>
        <button type="button" class="mn-hud__button" aria-label="全画面表示"></button>
      </div>
    </div>

    <!-- ページ切り替えの読み上げ通知 -->
    <p class="mn-live" aria-live="polite" role="status"></p>
  </div>
</body>
```

- DOM は浅く保つ。テーマ CSS は DOM 構造を変更しない（要素の追加・削除をしない）
- レイアウトの差はクラスではなく `data-layout` 属性で表す。利用者が `@slide class=...` で付けるクラスと衝突させないため
- 操作 UI は必ず `button` 要素で実装し、アイコンのみの場合は `aria-label` を付ける（FR-22）

## 5. スタイル設計

### 5.1 トークン

テーマは CSS Custom Properties のみで表現する。接頭辞は `--mn-`。

```css
:root {
  /* 色 */
  --mn-bg: #ffffff;
  --mn-fg: #14181d;
  --mn-muted: #5b6570;
  --mn-accent: #2b6cb0;
  --mn-code-bg: #f4f6f8;
  --mn-rule: #d8dee4;

  /* 書体 */
  --mn-font-sans: system-ui, "Segoe UI", "Hiragino Sans", "Noto Sans JP", sans-serif;
  --mn-font-mono: ui-monospace, "Cascadia Mono", Consolas, monospace;

  /* 文字サイズ・余白（基準キャンバス 1600x900 px 上の値） */
  --mn-size-title: 96px;
  --mn-size-heading: 64px;
  --mn-size-body: 34px;
  --mn-size-code: 28px;
  --mn-space: 72px;
  --mn-radius: 8px;
}
```

- 構造 CSS（`deck.css` / `layouts.css`）とテーマ CSS（`themes/*.css`）を分離する
- `!important` を原則使わない
- クラス名は役割を表す。見た目を表す名前（`.red`、`.big`）を作らない
- ダークテーマは v1.1。ただし変数構成は最初からテーマ差し替えだけで済む形にする

### 5.2 16:9 フィット

基準キャンバスは 1600x900 px 固定。表示領域に合わせて `transform: scale()` で拡縮する。

```ts
const scale = Math.min(viewportWidth / canvasWidth, viewportHeight / canvasHeight);
```

- `.mn-stage` は固定 px サイズを持ち、`transform: scale(var(--mn-scale))` と `transform-origin: center` で中央へ配置する
- 再計算は `ResizeObserver` で行う。全画面への遷移でも発火する
- 再計算は次フレームへまとめ、連続リサイズで描画が詰まらないようにする
- 基準キャンバスを固定にすることで、文字サイズと余白を px で決め打ちでき、どの画面でも見た目が一致する（発表時の再現性を優先）

## 6. ナビゲーション

状態はこれだけ。

```ts
type PresentationState = {
  current: number; // 0 始まり
  total: number;
};
```

`NavigationController` の契約。

```ts
class NavigationController {
  goTo(index: number): void; // 状態を変更する唯一のメソッド
  next(): void;
  previous(): void;
  first(): void;
  last(): void;
  subscribe(listener: (state: PresentationState) => void): () => void;
}
```

- キーボード、ハッシュ、UI ボタンは**すべて `goTo()` を経由する**。経路ごとの挙動差を作らないため
- `goTo()` は範囲外の値を clamp し、現在と同じインデックスなら何もしない（再描画もハッシュ更新もしない）
- ハッシュ同期は `goTo()` の後段で行う。`hashchange` から入ってきた場合も同じ経路を通り、「同じ値なら何もしない」ことで無限ループを防ぐ
- 全画面は Progressive Enhancement。`document.fullscreenEnabled` が false ならボタンを出さず、キーも無視する

## 7. 描画方式

MVP は**全スライドの DOM を初回に生成し、`hidden` 属性で表示を切り替える**。単純で、印刷（FR-12）や将来の一覧表示にもそのまま使える。

将来、数百枚規模を扱う場合に備えて `renderDeck.ts` は「Deck を受け取り DOM を返す」独立モジュールにしておき、前後 1 枚だけ保持する方式へ差し替えられるようにする。MVP では最適化しない。

## 8. Markdown レンダリング設定

```ts
const md = new MarkdownIt({
  html: false, // FR-19
  linkify: true,
  typographer: false,
  breaks: false,
});
```

- 外部リンクへの `target` / `rel` 付与は `renderer.rules.link_open` の上書きで行う（FR-20）
- シンタックスハイライトは MVP では行わない。v1.1 で別モジュールとして遅延読み込みで追加する（[D-06](./decisions.md)）

## 9. エラー処理とログ

- 回復不能なエラーは `view/errorScreen.ts` が専用画面を描画する。開発時は原因と行番号、本番は利用者向けの簡潔な文言（記法仕様 7 章）
- `Deck.warnings` は開発時のみ `console.warn` へ出す。本番ビルドでは出力しない
- ログの接頭辞は `[menma]` に統一する
- 出し分けは `utils/log.ts` が `import.meta.env.DEV` を見て行う。呼び出し側で分岐しない

## 10. ビルドとデプロイ

- Vite + TypeScript（`strict: true`）。ESM のみ
- `slides.md` は `?raw` インポートでバンドルする。fetch も CORS も不要で、ファイルの存在をビルド時に検証できる（[D-02](./decisions.md)）
- 成果物は `dist/` の静的ファイル。任意の静的ホスティングへ配置できる
- サブディレクトリ配信に備え、ベースパスは `vite.config.ts` の `base` で切り替えられるようにする

## 11. テスト戦略

| 層 | ツール | 対象 |
| --- | --- | --- |
| 単体 | Vitest | Front Matter 解析、スライド分割、ディレクティブ解析、レイアウトのフォールバック、ハッシュの解釈と正規化、clamp |
| E2E | Playwright（Chromium） | 初期表示、キー操作、ハッシュ同期、直接アクセス、端での停止、リサイズ、外部リンク、エラー画面 |
| 目視 | サンプルデッキ | 各レイアウト、印刷プレビュー、全画面 |

E2E の必須シナリオ。

1. 初期表示が 1 ページ目で、ハッシュが `#/1` になる
2. `ArrowRight` で 2 ページ目、`ArrowLeft` で 1 ページ目へ戻る
3. `Space` で次、`Shift + Space` で前へ移動する
4. ページ移動でハッシュが更新される
5. `#/5` を直接開くと 5 ページ目が表示される
6. 最終ページで次へ進めない、先頭ページで前へ戻れない
7. `#/0` と `#/abc` は 1 ページ目、`#/9999` は最終ページになる
8. `input` へフォーカスしている間は矢印キーでページが動かない
9. ウィンドウサイズを変えてもスライドが表示領域からはみ出さない
10. スライドが 0 枚のときエラー画面が出る

Visual Regression Test は v1.1。対象は cover / default / center / split / code / table / quote。

## 12. セキュリティ

- raw HTML 無効（FR-19）
- `innerHTML` へ渡すのは Markdown パーサの出力に限る。利用者が指定した色やクラスは属性値・CSS 変数として設定し、HTML 文字列へ連結しない
- URL クエリ・ハッシュから HTML を生成しない
- 外部 CDN、外部フォント、外部スクリプトを読み込まない
- 将来リモート Markdown へ対応する場合は sanitize 層を追加してから

## 13. リポジトリ構成（目標）

```text
menma/
├── .github/workflows/ci.yml
├── docs/                 # 本ドキュメント群
├── public/assets/        # 画像などの静的アセット
├── src/                  # 3 章の構成
├── tests/
│   ├── unit/
│   └── e2e/
├── slides.md             # サンプル兼フィクスチャ
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── README.md
└── LICENSE
```

AI 開発基盤（`AGENTS.md` / `CLAUDE.md` / `skills/` / `scripts/` / `.claude/` / `.agents/`）は既存の構成を維持する。
