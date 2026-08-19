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
  showProgress: boolean;
  transition: "none";
  externalLinksNewTab: boolean;
  /** 空ならテーマの値を使う。UI の指定があればそちらが優先される（D-21） */
  pageBackground: string;
  progressColor: string;
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
    | "unknown-theme"
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
├── main.ts                    # エントリ。起動して app へ渡すだけ
├── app.ts                     # 画面の切り替え（入口 ⇄ スライド）とデッキの差し替え（14 章）
│
├── deck/                      # 純粋層。DOM を import しない
│   ├── types.ts
│   ├── source.ts              # 原稿の取得元と localStorage への保存・復元（14 章）
│   ├── errors.ts              # DeckError（回復不能なエラーだけを投げる）
│   ├── parseDeck.ts           # 下の 4 つを束ねる
│   ├── parseFrontMatter.ts
│   ├── splitSlides.ts
│   ├── parseDirectives.ts
│   ├── fence.ts               # コードフェンスの追跡（分割とディレクティブ検出で共有）
│   └── markdown.ts            # markdown-it の設定とレンダリング
│
├── view/                      # DOM 層
│   ├── home.ts                # 入口画面（ファイル選択・貼り付け・サンプル）
│   ├── presentation.ts        # 発表画面の組み立てと後始末（14.2）
│   ├── renderDeck.ts          # Deck → DOM
│   ├── renderSlide.ts
│   ├── cssValue.ts            # 原稿由来の値を CSS へ渡す前の検査
│   ├── colors.ts              # 色の決め方と明暗の判定（D-21）
│   ├── progress.ts            # 進み具合のバー
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
├── storage/                   # ブラウザへの保存。原稿は IndexedDB、設定は localStorage
│   ├── deckStore.ts           # 原稿と画像（15.3）
│   └── appearance.ts          # 見た目の指定（D-21）
│
├── styles/
│   ├── reset.css
│   ├── home.css               # 入口画面
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
      <section class="mn-slide" data-layout="split" data-index="2">
        <div class="mn-slide__main">...</div>
        <div class="mn-slide__aside">...</div>
      </section>
      <!-- 表示していないスライドは hidden 属性を持つ -->
    </div>

    <!-- 操作 UI と進み具合のバーは画面基準（キャンバスの外）。ページ番号が左下、ボタンが右下 -->
    <div class="mn-hud">
      <p class="mn-hud__counter">3 / 24</p>
      <div class="mn-hud__actions">
        <button type="button" class="mn-hud__button" aria-label="前のスライド"></button>
        <button type="button" class="mn-hud__button" aria-label="次のスライド"></button>
        <button type="button" class="mn-hud__button" aria-label="全画面表示"></button>
      </div>
    </div>

    <div class="mn-progress"><div class="mn-progress__bar"></div></div>

    <!-- ページ切り替えの読み上げ通知 -->
    <p class="mn-live" aria-live="polite" role="status"></p>
  </div>
</body>
```

- DOM は浅く保つ。テーマ CSS は DOM 構造を変更しない（要素の追加・削除をしない）
- レイアウトの差はクラスではなく `data-layout` 属性で表す。利用者が `@slide class=...` で付けるクラスと衝突させないため
- `data-index` は 0 始まりのスライド位置。E2E とデバッグが「いま何枚目か」を DOM から判定するための契約なので外さない
- 操作 UI は必ず `button` 要素で実装し、アイコンのみの場合は `aria-label` を付ける（FR-22）
- `.mn-hud` は本文の上に重なる。`pointer-events: none` で選択を妨げず、ボタン側だけ `auto` に戻す
- **`.mn-hud` と `.mn-progress` はキャンバスの外に置き、画面基準（`position: fixed`）で配置する。** 拡縮の影響を受けず、いつも同じ場所にある
- 画面の隅は、比率によって「余白の上」にも「スライドの上」にもなる。**どちらでも読めるよう、文字色を背景の明るさで切り替え、うっすら地を敷く**（[D-21](./decisions.md)）。片方だけの対策では、もう片方で埋もれる

## 5. スタイル設計

### 5.1 トークン

テーマは CSS Custom Properties のみで表現する。接頭辞は `--mn-`。

```css
:root {
  /* 色 */
  --mn-page-bg: #ffffff; /* キャンバスの外側（レターボックス） */
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
- **レイアウト CSS で `display` を指定しない。** 表示・非表示は `.mn-slide[hidden] { display: none }` が担い、`.mn-slide[data-layout="..."]` と詳細度が同じため、後から読まれるレイアウト側が勝って「隠したはずのスライドが重なって見える」不具合になる。2 カラムは flex の向きと配分で表す
- クラス名は役割を表す。見た目を表す名前（`.red`、`.big`）を作らない
- ダークテーマは v1.1。ただし変数構成は最初からテーマ差し替えだけで済む形にする

### 5.2 表示領域へのフィット

基準キャンバスは 1600x900（16:9）。**16:9 を崩さずに、縦か横のどちらかを画面いっぱいにする**（[D-11](./decisions.md)）。

```ts
// 小さいほうの比率を採る。はみ出さずに、片方はぴったり埋まる
const scale = Math.min(containerWidth / canvasWidth, containerHeight / canvasHeight);
```

- 普通の横長画面 → 高さいっぱい、左右に余白
- 縦長すぎる画面 → 幅いっぱい、上下に余白

余白は白（`--mn-page-bg`）なので、スライドとの境目はほとんど見えない。

- `.mn-stage` は固定 px サイズを持ち、`transform: scale(var(--mn-scale))` と `transform-origin: center` で中央へ配置する
- 再計算は `ResizeObserver` で行う。全画面への遷移でも発火する
- 再計算は次フレームへまとめ、連続リサイズで描画が詰まらないようにする
- 基準を固定することで、テーマの px 値をそのまま使え、**どの画面でも 1 枚に入る情報量が変わらない**

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
- ハッシュの正規化（`#/0` や `#/abc` を `#/1` へ直す）は `goTo()` の通知に頼らず、ハッシュを読んだ直後に必ず行う。位置が変わらない不正値では通知が起きないため、通知任せだと URL だけ古い表記で残る
- 履歴の積み方は起点で変える。操作（キーや UI）で移動したときは履歴へ積み、ハッシュ側から来た変更（初期表示・戻る／進む・アドレスバー編集）は `replaceState` で置き換える。不正値を履歴に残すと、戻るたびに正規化が繰り返されて前へ戻れなくなる
- 初期同期は購読の登録より**前**に行う。`subscribe()` は登録時に現在状態を 1 度渡すため、順序を逆にすると URL のページ指定を読む前に `#/1` で上書きしてしまう
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
- 型は markdown-it 同梱のもの（`RendererRule` など）を使う。`@types/markdown-it` は入れない — markdown-it 15 では同梱型が正で、`@types` を併用すると型名が食い違う
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
| 単体 | Vitest | Front Matter 解析、スライド分割、ディレクティブ解析、レイアウトのフォールバック、ハッシュの解釈と正規化、clamp、倍率計算（`view/scaler.ts`）、CSS 値の検査（`view/cssValue.ts`） |
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

## 14. 原稿の入力と画面の切り替え（v0.2.0）

画面は 2 つだけ。**どちらを出すかはハッシュの有無で決まる。**

| URL | 画面 |
| --- | --- |
| `/`（ハッシュ無し） | 入口画面。ファイル選択・貼り付け・サンプルの 3 つの入口 |
| `/#/N` | スライド。原稿が読み込まれていなければ入口へ戻す |

### 14.1 原稿の取得元

```ts
export type DeckSource =
  | { kind: "sample" }
  | { kind: "file"; name: string; text: string }
  | { kind: "text"; text: string };
```

`sample` は本文を持たない。バンドル済みの `slides.md` を使うため、保存する必要がないため。

保存は `localStorage` の 1 キー（`menma:source`）へ、形式の版を付けて置く。

```ts
type StoredSource = { version: 1; source: DeckSource };
```

版を付けるのは、後で形式を変えたときに古い値を捨てられるようにするため。読み込みで形が合わなければ黙って捨て、入口画面から始める。

**原稿は URL へ載せない（[D-19](./decisions.md)）。** 共有リンクから任意の内容を表示できると、menma のドメインで偽の資料を見せられるため。12 章の「URL からの HTML 生成を行わない」と同じ理由。

### 14.2 デッキの差し替え

`app.ts` が画面の生存期間を持つ。スライド画面を作る処理は**後始末の関数を返す**。

```ts
function startPresentation(deck: Deck, mount: HTMLElement): () => void;
```

後始末で解くもの。

- `renderDeck` が作った DOM（`root.remove()`）
- `controller.subscribe()` の購読
- `connectHash` / `connectKeyboard` / `connectScaler` / `onFullscreenChange` の解除関数

`NavigationController` は総ページ数を固定で持つため、デッキが変わったら**作り直す**。古いインスタンスを使い回さない。

### 14.3 画面の行き来

- 入口でデッキを選ぶ → `history.pushState` で `#/1` を積み、スライドを構築する
- ブラウザの戻る → `popstate` でハッシュが消える → スライドを後始末して入口へ戻す
- 発表画面に「戻る」ボタンは置かない（[D-19](./decisions.md)）

`connectHash` はスライド表示中だけ有効にする。入口画面では解除しておき、ハッシュの正規化が走らないようにする。

ハッシュを正規形（`#/N`）に保つ仕組みが、結果として**ハッシュへ余計な情報を残せない**ようにもしている。パラメータを付け足しても次の正規化で消えるため、原稿が URL に残るとしたらクエリ側（`?`）になる。E2E はそちらを見る。

### 14.4 読み込みの失敗

失敗は入口画面へ理由を出し、**直前の状態を壊さない**（表示中のデッキがあればそのまま）。

| 状況 | 扱い |
| --- | --- |
| 対応外の拡張子 | 受け付けず、対応する拡張子を伝える |
| 空、または空白だけ | 受け付けず、原稿が空であることを伝える |
| `DeckError`（スライド 0 枚、Front Matter が閉じない） | 理由を伝える。保存もしない |

### 14.5 画像の扱い

読み込んだ原稿の**相対パス画像は表示できない**。ブラウザはファイルの隣にあるファイルを読めないため。絶対 URL の画像は表示できる。フォルダごと取り込む対応は v0.3.0（ロードマップ 10 章）。

## 15. 画像の取り込み（v0.3.0）

原稿と一緒に選ばれた画像を、相対パスの参照へ結び付ける（FR-30〜FR-34）。

### 15.1 照合

ファイル選択からはフォルダ構造が得られないため、**ファイル名（最後の `/` より後ろ）だけで照合する**（[D-20](./decisions.md)）。

```text
原稿:   ![図](./img/flow.png)   →  flow.png
選択:   flow.png                →  一致 → blob URL へ差し替え
```

- 絶対 URL（`https:` / `http:` / `//` / `data:` / `blob:`）は対象外。そのまま読み込む
- 同名が複数選ばれたら最初の 1 つを使い、警告する
- 原稿が参照しているのに選ばれていない名前は、入口画面で知らせる（FR-34）

差し替えの対象は本文の `<img src>` と、`@slide background=` で指定された背景画像。

### 15.2 blob URL の生存期間

画像 1 つにつき `URL.createObjectURL()` を 1 回だけ呼び、デッキの差し替え時にまとめて `revokeObjectURL()` する。発表画面の後始末（14.2）と同じ流れに乗せる。

### 15.3 保存

保存は IndexedDB に一本化する。`localStorage` は 5MB 前後で画像が入らないため。

```text
DB:     menma
store:  decks
key:    "current"
value:  { version: 1, source: DeckSource }
```

`DeckSource` は Blob をそのまま持つ（IndexedDB は構造化クローンで Blob を保存できるので、data URI へ変換しない）。

v0.2.0 で `localStorage` に保存された原稿は、起動時に IndexedDB へ移してから `localStorage` の値を消す。

保存層は非同期になるため、起動処理（`app.ts`）も非同期で始まる。読み書きに失敗しても発表は続けられるようにし、失敗は握って入口画面から始める。

### 15.4 上限

| 対象 | 上限 |
| --- | --- |
| 画像 1 枚 | 10MB |
| 画像の合計 | 50MB |

超えた分は取り込まず、入口画面でファイル名を挙げて伝える。原稿そのものは開ける。

### 15.5 安全性

- 画像は `<img>` として表示する。SVG に script が含まれていても `<img>` 経由では実行されない
- blob URL は同一オリジンに閉じる。外部へは出さない
- 取り込んだ画像もブラウザの外へ送信しない（12 章の方針と同じ）
