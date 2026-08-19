> **この文書は正典ではありません。**
>
> 2026-08-19 時点の構想メモです。現在の正典は [`docs/requirements.md`](../requirements.md)（要件） / [`docs/spec-markdown.md`](../spec-markdown.md)（記法） / [`docs/architecture.md`](../architecture.md)（設計） / [`docs/roadmap.md`](../roadmap.md)（計画） / [`docs/decisions.md`](../decisions.md)（決定）です。
>
> 本文には、その後の検討で変更・確定した箇所（ハッシュの範囲外の扱い、ドキュメント構成、プロジェクト名など）が古いまま残っています。実装の根拠には使わず、経緯を確認する目的でのみ参照してください。

---

# Markdown Web Slides — 要件定義・設計書

> 文書種別: 新規リポジトリ向け要件定義 / 基本設計 / 実装計画  
> プロジェクト名: 未定（本書では便宜上「Markdown Web Slides」と表記）  
> 想定実装: Vite + TypeScript + markdown-it + CSS  
> 方針: 特定の既存スライド実装を複製せず、Markdownから軽量なWebプレゼンテーションを生成する仕組みを独立設計・独立実装する

---

## 1. このプロジェクトの目的

Markdownファイルを編集するだけで、ブラウザ上でそのまま発表できる軽量なWebスライドシステムを作る。

PowerPoint、Google Slides、KeynoteのようなGUI型プレゼンテーションツールではなく、次の価値を重視する。

- Markdownを中心に資料を書ける
- Gitで履歴管理できる
- コードレビューしやすい
- Webサイトとしてそのまま公開できる
- キーボードだけで発表できる
- 依存関係を少なく保つ
- HTML/CSSの知識があれば自由にデザインを拡張できる
- 特定のSaaSや外部サービスに依存しない
- 将来的に複数の資料を同一リポジトリで管理できる
- AIによるMarkdown生成との相性を良くする

このプロジェクトでは、巨大なプレゼンテーションフレームワークを作ることよりも、**「Markdownを書き、URLを開けばすぐ発表できる」こと**を最優先する。

---

## 2. 独立実装の原則

本プロジェクトは、一般的なWebスライドのアイデアを利用しつつ、コード・CSS・DOM構造・文言・アセット・独自記法は新しく設計する。

### 2.1 利用してよい一般的なアイデア

以下はWebプレゼンテーションとして一般的な機能であり、本プロジェクトでも採用する。

- MarkdownからHTMLへの変換
- `---` を利用したスライド分割
- 左右キーによるページ移動
- Spaceキーによる次ページ移動
- 全画面表示
- URLから特定ページを直接開く機能
- 16:9を基準としたスライド表示
- CSSによるテーマ変更
- コードブロック表示
- 画像、表、引用、リンクの利用

### 2.2 独自に設計するもの

以下は本プロジェクト固有の仕様として設計する。

- Markdown拡張記法
- URLルーティング形式
- 操作UI
- フッター
- レイアウトシステム
- CSSクラス名
- DOM構造
- テーマ変数
- トランジション
- エラーメッセージ
- READMEの説明
- サンプルスライド

### 2.3 実装上の禁止事項

- 他のスライドツールのソースコードをコピーしない
- 他サイトのCSSをコピーしない
- 特徴的な文言やUIをそのまま再現しない
- 他サイト固有の画像やフォントを無断利用しない
- DOM構造を意図的に同一にしない

「似た体験」ではなく、**同じ問題に対する別実装**を目標とする。

---

## 3. 想定ユーザー

### 3.1 主なユーザー

- エンジニア
- 技術イベント登壇者
- 社内勉強会の発表者
- Markdownで文章を書くことに慣れている人
- GitHubで資料を管理したい人

### 3.2 想定利用シーン

- Meetup
- WordCamp等のコミュニティイベント
- LT
- 社内勉強会
- ワークショップ
- 技術説明
- 営業・提案資料
- オンライン配信用スライド

---

## 4. プロジェクトの基本方針

### 4.1 MVPでは「軽さ」を優先する

初期バージョンではReact、Vue、Svelte等のUIフレームワークは使用しない。

構成は以下を基本とする。

```text
Markdown
    ↓
markdown-it
    ↓
内部Slideモデル
    ↓
HTML
    ↓
TypeScriptによるナビゲーション
    ↓
CSSによる表示
```

推奨スタック:

```text
Vite
TypeScript
markdown-it
CSS
Playwright
```

必要になった場合のみ追加する。

### 4.2 JavaScriptが担う責務

JavaScript / TypeScriptは以下に限定する。

- Markdown読み込み
- Markdown解析
- スライド生成
- ページ切り替え
- URL同期
- キーボードイベント
- Fullscreen API制御
- viewportに合わせたスケーリング
- オプションUI
- エラー表示

デザインは可能な限りCSSで行う。

---

## 5. MVPのスコープ

初回リリースでは以下を実装する。

### 必須

- Markdownファイルからスライド生成
- `---` によるページ分割
- 見出し
- 段落
- リスト
- 強調
- リンク
- 画像
- 引用
- コードブロック
- 表
- 左右キーによる移動
- Spaceキーによる次ページ移動
- URLによるページ指定
- ページ番号
- 全画面表示
- 16:9表示
- ウィンドウサイズへの自動フィット
- 基本テーマ
- レスポンシブ表示
- 印刷用CSS
- 404相当のデッキ読み込みエラー表示

### 初回では実装しない

- WYSIWYG編集
- リアルタイム共同編集
- クラウド保存
- ユーザー認証
- コメント
- アニメーション編集GUI
- PowerPoint互換
- Google Slidesインポート
- Keynoteインポート
- 動画編集
- 発表者間同期

---

## 6. Markdown仕様

## 6.1 基本

通常のMarkdownをそのまま利用できる。

```md
# タイトル

本文です。

- 項目A
- 項目B
- 項目C
```

---

## 6.2 スライド分割

トップレベルの `---` をスライド区切りとする。

```md
# Slide 1

Hello.

---

# Slide 2

Next slide.
```

ただしファイル先頭のFront Matterは例外として扱う。

---

## 6.3 Front Matter

ファイル先頭にYAML形式のメタデータを記述できる。

```md
---
title: My Presentation
author: Your Name
lang: ja
theme: default
aspectRatio: 16/9
showPageNumber: true
---

# My Presentation
```

想定フィールド:

| キー | 型 | 初期値 | 内容 |
|---|---|---|---|
| `title` | string | ファイル名 | ページタイトル |
| `author` | string | `""` | 作者 |
| `lang` | string | `ja` | HTML lang |
| `theme` | string | `default` | テーマ |
| `aspectRatio` | string | `16/9` | 比率 |
| `showPageNumber` | boolean | `true` | ページ番号 |
| `showControls` | boolean | `true` | 操作ヒント |
| `transition` | string | `none` | ページ遷移 |
| `codeTheme` | string | `default` | コードテーマ |

未知のキーは無視し、警告のみ出す。

---

## 6.4 レイアウト指定

独自拡張として、スライド先頭に `@slide` ディレクティブを置けるようにする。

```md
@slide layout=split

# 左側の内容

通常本文。

@aside

![image](./assets/sample.jpg)
```

この場合、

```text
slide
├── main
└── aside
```

として描画する。

この記法は本プロジェクト固有のものとする。

### 対応予定レイアウト

```text
default
center
cover
split
image-left
image-right
quote
blank
```

例:

```md
@slide layout=center

# 大事なこと

これだけ覚えてください。
```

```md
@slide layout=cover background="./assets/cover.jpg"

# Presentation Title
```

---

## 6.5 スライド単位のオプション

```md
@slide layout=center class=important
```

許可する属性:

```text
layout
class
background
backgroundColor
foreground
```

任意のHTML属性を直接注入する方式にはしない。

---

## 6.6 発表者ノート

MVP後に追加する。

候補記法:

```md
@notes

ここは発表者だけに見えるメモ。
説明時間は2分程度。
```

通常のプレゼン表示には出さない。

---

## 6.7 エスケープ

Markdown本文として `@slide` や `@aside` を表示したい場合はコードブロックまたはバックスラッシュで扱えるようにする。

---

## 7. URL設計

### 7.1 単一デッキ

最初のMVPでは1リポジトリ1デッキを基本とする。

```text
https://example.com/
```

ページ指定:

```text
https://example.com/#/1
https://example.com/#/2
https://example.com/#/15
```

ページ番号は1始まりとする。

### 7.2 理由

`#/N` とすることで、静的ホスティングでもサーバー側のrewrite設定なしでページ位置を保持できる。

### 7.3 不正値

以下の場合は1ページ目へ戻す。

```text
#/0
#/-1
#/abc
#/9999
```

ただし最大ページを超えた場合は最後のページへ丸める案も検討できる。

MVPでは「1ページ目へ戻す」で仕様を統一する。

---

## 8. 操作仕様

### 8.1 キーボード

| キー | 動作 |
|---|---|
| `ArrowRight` | 次へ |
| `ArrowDown` | 次へ |
| `Space` | 次へ |
| `PageDown` | 次へ |
| `ArrowLeft` | 前へ |
| `ArrowUp` | 前へ |
| `PageUp` | 前へ |
| `Home` | 最初 |
| `End` | 最後 |
| `F` | 全画面 |
| `O` | Overview（将来） |
| `?` | 操作ヘルプ（将来） |

### 8.2 Spaceキー

`Shift + Space` は前ページとする。

### 8.3 キー入力を無視するケース

以下の要素にフォーカス中はページ移動しない。

```text
INPUT
TEXTAREA
SELECT
BUTTON
contenteditable
```

---

## 9. マウス・タッチ操作

MVPではクリックによるページ送りを必須にしない。

理由:

- リンクをクリックした際の誤操作を避ける
- コード選択を妨げない
- UIを単純にする

スマートフォン向けにはスワイプ操作を将来的に追加する。

```text
swipe left  → next
swipe right → previous
```

---

## 10. 全画面表示

ブラウザのFullscreen APIを使用する。

`F` キー:

```text
通常表示
  ↓
requestFullscreen()
  ↓
全画面表示
```

全画面中に再度 `F`:

```text
document.exitFullscreen()
```

ただしブラウザがAPIをサポートしない場合でも、プレゼン自体は利用できるようにする。

全画面機能は「必須機能」ではなく「Progressive Enhancement」として扱う。

---

## 11. 画面構成

基本DOMイメージ:

```html
<body>
  <main id="app">
    <div class="deck">
      <section class="slide">
        <div class="slide__canvas">
          <div class="slide__content"></div>
        </div>
      </section>

      <nav class="deck-ui"></nav>
    </div>
  </main>
</body>
```

実際のクラス名は実装時に確定する。

DOMは可能な限り浅く保つ。

---

## 12. 16:9表示

基準キャンバス:

```text
width: 1600
height: 900
```

またはCSS上で:

```css
aspect-ratio: 16 / 9;
```

を利用する。

### 12.1 表示アルゴリズム

ブラウザ表示領域:

```text
viewportWidth
viewportHeight
```

スライド基準:

```text
slideWidth
slideHeight
```

スケール:

```text
scale = min(
  viewportWidth / slideWidth,
  viewportHeight / slideHeight
)
```

必要に応じて上下左右に余白を作る。

ResizeObserverまたはwindow resizeイベントで再計算する。

---

## 13. テーマ設計

テーマはCSS Custom Propertiesを中心に実装する。

```css
:root {
  --slide-bg: #fff;
  --slide-fg: #111;
  --slide-muted: #666;

  --slide-font-sans: system-ui, sans-serif;
  --slide-font-mono: ui-monospace, monospace;

  --slide-title-size: 4rem;
  --slide-heading-size: 2.5rem;
  --slide-body-size: 1.75rem;

  --slide-space: 4rem;
  --slide-radius: 0;
}
```

テーマ側でDOM構造を変更しない。

---

## 14. デフォルトデザイン

デフォルトテーマは意図的にシンプルにする。

方針:

- 白背景
- 黒系文字
- 大きな余白
- 装飾を少なくする
- 1スライド1メッセージを想定
- コードは読みやすさ優先
- リンクは識別可能にする
- 小さすぎる文字を許容しない

デザイン上の主役はテーマではなく、発表内容とする。

---

## 15. 画像

通常Markdown:

```md
![alt](./assets/image.jpg)
```

を利用する。

画像には以下を適用する。

```css
max-width: 100%;
max-height: 100%;
object-fit: contain;
```

### 15.1 cover背景

```md
@slide layout=cover background="./assets/hero.jpg"

# TITLE
```

背景画像はCSS `background-image` を使用する。

---

## 16. コードブロック

Markdown:

````md
```ts
const message = "Hello";
console.log(message);
```
````

MVPではMarkdownパーサーの標準的なコードブロック出力を利用する。

Syntax Highlightは別モジュールとして切り離す。

### MVP

```text
plain code block
```

### v1.x

```text
Shiki等のsyntax highlighter
```

コードハイライトライブラリが大きい場合は遅延読み込みを検討する。

---

## 17. リンク

通常リンク:

```md
[Example](https://example.com)
```

外部リンクは新しいタブで開くかどうかを設定可能にする。

デフォルト:

```text
externalLinksNewTab = true
```

外部リンクには適切な `rel` 属性を付与する。

---

## 18. Markdownの安全性

初期設定ではMarkdown内のraw HTMLを無効にする。

理由:

- 外部Markdownを読み込む拡張を将来行った際の安全性
- DOM構造の破壊防止
- 独自記法との競合防止

将来 `allowHtml: true` を用意する場合は明示的なopt-inとする。

---

## 19. アプリケーション内部モデル

Markdownを直接DOMへ流し込まず、一度内部モデルへ変換する。

```ts
type Deck = {
  meta: DeckMeta
  slides: Slide[]
}

type DeckMeta = {
  title: string
  author?: string
  lang: string
  theme: string
  aspectRatio: string
  showPageNumber: boolean
  showControls: boolean
}

type Slide = {
  index: number
  source: string
  html: string
  layout: SlideLayout
  classes: string[]
  background?: string
  asideHtml?: string
  notes?: string
}
```

メリット:

- parserとrendererを分離できる
- テストしやすい
- presenter modeを追加しやすい
- PDF生成に転用しやすい
- 将来的にJSON出力できる

---

## 20. アーキテクチャ

```text
                  slides.md
                      │
                      ▼
              ┌──────────────┐
              │ source loader│
              └──────────────┘
                      │
                      ▼
              ┌──────────────┐
              │ front matter │
              └──────────────┘
                      │
                      ▼
              ┌──────────────┐
              │ slide splitter│
              └──────────────┘
                      │
                      ▼
              ┌──────────────┐
              │ directive parser
              └──────────────┘
                      │
                      ▼
              ┌──────────────┐
              │ markdown-it  │
              └──────────────┘
                      │
                      ▼
                    Deck
                      │
                      ▼
              ┌──────────────┐
              │   renderer   │
              └──────────────┘
                      │
             ┌────────┴────────┐
             ▼                 ▼
         slide DOM           deck UI
             │                 │
             └────────┬────────┘
                      ▼
                navigation
                      │
                      ▼
                 location.hash
```

---

## 21. モジュール分割

```text
src/
├── main.ts
├── app.ts
│
├── deck/
│   ├── loadDeck.ts
│   ├── parseDeck.ts
│   ├── parseFrontMatter.ts
│   ├── splitSlides.ts
│   ├── parseDirectives.ts
│   ├── renderDeck.ts
│   └── types.ts
│
├── navigation/
│   ├── controller.ts
│   ├── keyboard.ts
│   ├── hash.ts
│   └── fullscreen.ts
│
├── ui/
│   ├── controls.ts
│   ├── progress.ts
│   └── error.ts
│
├── styles/
│   ├── base.css
│   ├── deck.css
│   ├── print.css
│   └── themes/
│       └── default.css
│
└── utils/
    ├── clamp.ts
    └── dom.ts
```

---

## 22. リポジトリ構成

推奨:

```text
project/
├── .github/
│   └── workflows/
│       └── ci.yml
│
├── docs/
│   ├── PROJECT_SPEC.md
│   ├── MARKDOWN_SYNTAX.md
│   └── ARCHITECTURE.md
│
├── public/
│   └── assets/
│
├── src/
│   └── ...
│
├── slides.md
│
├── tests/
│   ├── parser/
│   └── e2e/
│
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── README.md
└── LICENSE
```

MVPでは文書を1つにまとめても構わない。

---

## 23. 開発時の体験

### 起動

```bash
pnpm install
pnpm dev
```

### ビルド

```bash
pnpm build
```

### Preview

```bash
pnpm preview
```

### テスト

```bash
pnpm test
```

E2E:

```bash
pnpm test:e2e
```

---

## 24. Markdownの読み込み方法

MVPではViteのraw importを利用する方式を推奨する。

概念:

```ts
import source from "../slides.md?raw";
```

メリット:

- fetch不要
- build時にファイル存在を検証できる
- CORSを考慮しなくてよい
- 静的サイトとして完結する

将来的に複数デッキを実装する場合は別方式へ拡張する。

---

## 25. 複数デッキ対応

v1.x以降の候補。

```text
decks/
├── meetup/
│   ├── slides.md
│   └── assets/
├── workshop/
│   ├── slides.md
│   └── assets/
└── company/
    ├── slides.md
    └── assets/
```

URL:

```text
/deck/meetup/#/1
/deck/workshop/#/1
```

ビルド時に `decks/*/slides.md` を検索し、デッキ一覧を生成する。

---

## 26. ページ遷移

MVP:

```text
transition: none
```

を推奨する。

必要になった段階で、

```text
fade
slide
```

のみ追加する。

派手なアニメーションを大量に実装しない。

`prefers-reduced-motion` が有効な環境ではアニメーションを無効化する。

---

## 27. UI

通常表示では画面下部に最小限のUIを配置する。

例:

```text
3 / 24                       ←  →    Fullscreen
```

ただし発表中に邪魔にならないよう、以下のいずれかとする。

- 低コントラスト
- マウス停止後に薄くする
- 数秒後に非表示
- Front Matterで完全非表示

UIの文章・記号・配置は本プロジェクト独自に設計する。

---

## 28. ページ番号

```text
current / total
```

形式を基本とする。

例:

```text
12 / 38
```

Front Matter:

```yaml
showPageNumber: false
```

で非表示。

---

## 29. Progress

v1.xではページ進行状況を細いバーとして表示可能にする。

```text
[===================---------------------]
```

計算:

```ts
progress = currentSlide / totalSlides
```

---

## 30. 印刷 / PDF

ブラウザ印刷で全スライドを印刷できるよう、`@media print` を用意する。

印刷時:

- 1ページ = 1スライド
- UI非表示
- transform無効
- 16:9を維持
- 背景色・背景画像に配慮
- page-breakを強制

PlaywrightによるPDF生成CLIは将来機能とする。

---

## 31. アクセシビリティ

最低限以下を守る。

- `lang` を指定
- キーボード操作可能
- 画像altを利用
- コントラストを確保
- フォーカスを視認可能にする
- reduced motionに対応
- ページ切り替え時に適切なARIA情報を更新
- 操作UIをボタン要素として実装
- アイコンだけの場合はaria-labelを設定

---

## 32. エラー処理

### Markdownが空

```text
No slides found.
```

相当の専用エラー画面を表示する。

### Front Matter不正

開発時:

```text
Invalid front matter: line N
```

Production:

```text
This presentation could not be loaded.
```

### 不明なlayout

開発時にconsole warning。

表示は `default` へフォールバックする。

---

## 33. ログ

Productionでは不要なconsole出力を抑える。

開発時:

```text
[deck] 24 slides loaded
[deck] theme: default
[deck] unknown directive: ...
```

程度のデバッグ情報を出せる。

---

## 34. テスト方針

### Unit Test

重点:

- Front Matter解析
- スライド分割
- directive解析
- ページ番号の正規化
- hash parser
- layout fallback

### E2E

Playwrightで以下を確認する。

1. 初期表示が1ページ目
2. `ArrowRight` で2ページ目
3. `ArrowLeft` で1ページ目
4. `Space` で次ページ
5. URL hashが更新される
6. `#/5` を直接開くと5ページ目
7. 最終ページ以降へ進めない
8. 先頭より前へ戻れない
9. 外部リンクをクリックできる
10. ウィンドウサイズ変更で崩れない

---

## 35. Visual Regression Test

将来的にはPlaywrightで代表的なスライドのスクリーンショットを保存し、CSS変更による意図しないレイアウト崩れを検知する。

対象:

```text
cover
default
split
image
code
table
quote
```

---

## 36. パフォーマンス目標

数値は「要件」ではなく開発目標として扱う。

- 初期JavaScriptを小さく保つ
- UIフレームワークをMVPに導入しない
- 画像を除いたアプリ本体を軽量にする
- 不要な依存を追加しない
- syntax highlighter等の大きな依存は遅延読み込みを検討
- デッキ切り替え時の全ページ再生成を避ける余地を残す

---

## 37. ブラウザ対応

MVPの対象:

- 最新Chrome
- 最新Edge
- 最新Firefox
- 最新Safari

Internet Explorerは対象外。

モバイルは「閲覧可能」をMVP目標とし、スマートフォンからの本格的なプレゼン操作はv1.x以降とする。

---

## 38. セキュリティ

### 原則

- raw HTMLはdefault off
- `innerHTML` に渡すHTMLはMarkdown parserが生成したものに限定
- 外部Markdown取得をMVPでは行わない
- URL queryからHTMLを生成しない
- 不要な外部スクリプトを読み込まない
- CDN依存を極力避ける

将来ユーザー入力やリモートMarkdownに対応する場合はsanitize層を追加する。

---

## 39. CI

GitHub Actions等で以下を実行する。

```text
install
↓
typecheck
↓
lint
↓
unit test
↓
build
↓
e2e
```

Pull RequestごとにCIを実行する。

---

## 40. デプロイ

成果物は静的ファイルとする。

```text
dist/
├── index.html
└── assets/
```

そのため以下へデプロイできる。

- Cloudflare Pages
- GitHub Pages
- Netlify
- Vercel
- 任意の静的Webサーバー
- nginx
- Apache

サーバーサイド処理はMVPでは不要。

---

## 41. READMEに記載する内容

READMEは以下の構成を推奨する。

```text
# Project Name

1行説明

## Features

## Quick Start

## Writing Slides

## Slide Layouts

## Keyboard Controls

## Build

## Deploy

## Documentation

## License
```

README自体を巨大な仕様書にせず、詳細は `docs/` に分離する。

---

## 42. コーディング方針

### TypeScript

- `strict: true`
- 型のないデータをそのまま利用しない
- parserとDOM処理を分離
- グローバル状態を極力作らない

### CSS

- BEMを厳密採用する必要はない
- クラス名に意味を持たせる
- CSS Custom Propertiesを利用
- `!important` を原則使用しない
- テーマCSSと構造CSSを分離

### JavaScript

DOMイベントを各所に散らさない。

NavigationControllerのような1つの責務へまとめる。

---

## 43. 状態管理

Redux等は使用しない。

最低限の状態:

```ts
type PresentationState = {
  current: number
  total: number
  fullscreen: boolean
}
```

単純なControllerクラスまたは関数群で管理する。

---

## 44. NavigationController

概念:

```ts
class NavigationController {
  next(): void
  previous(): void
  first(): void
  last(): void
  goTo(index: number): void
}
```

`goTo()` のみが状態変更を担当し、

```text
keyboard
hash
UI buttons
```

はすべて `goTo()` を経由する。

これにより挙動の不一致を防ぐ。

---

## 45. Hash同期

ページ変更:

```ts
goTo(5)
```

↓

```text
state.current = 5
render()
location.hash = "/5"
```

ブラウザの戻る・進む操作も考慮し `hashchange` を監視する。

無限ループにならないよう、同じページへの更新は無視する。

---

## 46. スライド描画

MVPでは全スライドのDOMを生成して、

```text
active
hidden
```

を切り替える方法でもよい。

ただし数百枚の資料まで考慮する場合は、

```text
current
previous
next
```

のみDOMに保持する仮想化方式へ変更できるよう、rendererを独立モジュールにする。

初期は単純さを優先する。

---

## 47. Presenter Mode

v2候補。

```text
/presenter
```

表示内容:

```text
現在のスライド
次のスライド
発表者ノート
現在時刻
経過時間
ページ番号
```

Presentation画面との同期にはBroadcastChannel API等を利用する案を検討する。

---

## 48. Overview Mode

`O` キーで全スライドを一覧表示する機能。

```text
[1] [2] [3] [4]
[5] [6] [7] [8]
```

クリックするとそのページへ移動。

MVP後に追加する。

---

## 49. 将来的なCLI

将来的にツールとして独立させる場合:

```bash
npm create <project-name>
```

または:

```bash
npx <project-name> dev slides.md
npx <project-name> build slides.md
npx <project-name> pdf slides.md
```

まで発展できる。

ただし最初からCLIパッケージ化はしない。

まず「1つのリポジトリで確実に動くもの」を作る。

---

## 50. 将来的なパッケージ分割

利用者が増えた場合のみ検討する。

```text
packages/
├── core
├── parser
├── runtime
├── theme-default
└── cli
```

初期段階ではmonorepoにしない。

---

## 51. AIとの連携

Markdownベースであることを活かし、AIに以下を依頼しやすい形式にする。

```text
「このアウトラインから15枚のスライドを作って」
「5ページ目をもっと簡潔に」
「コード例を追加して」
「splitレイアウトを使って」
```

独自記法は複雑にしすぎず、LLMが容易に生成できる形を保つ。

この観点からも、独自DSLを大量に増やさない。

---

## 52. MVPの実装順序

### Phase 1 — Skeleton

- Vite
- TypeScript
- CSS
- `slides.md`
- raw import

完成条件:

ブラウザにMarkdown文字列を表示できる。

### Phase 2 — Parser

- Front Matter
- `---` 分割
- markdown-it
- Deckモデル

完成条件:

Markdownから複数ページを生成できる。

### Phase 3 — Presentation

- 1ページ表示
- next / previous
- keyboard
- hash
- page number

完成条件:

実際のLTで最低限使える。

### Phase 4 — Layout

- default
- center
- cover
- split
- `@slide`
- `@aside`

完成条件:

一般的な技術プレゼンを作成できる。

### Phase 5 — Presentation UX

- Fullscreen
- viewport scaling
- print CSS
- error handling

完成条件:

会場投影でも安定利用できる。

### Phase 6 — Quality

- unit test
- Playwright
- lint
- CI
- sample deck
- documentation

完成条件:

GitHub上で公開できる品質になる。

---

## 53. 初期Issue案

GitHub Issuesへそのまま分割できる単位。

### Core

1. Initialize Vite + TypeScript project
2. Add Markdown raw loading
3. Implement front matter parser
4. Implement slide splitter
5. Add markdown-it renderer
6. Introduce Deck / Slide types

### Presentation

7. Implement slide renderer
8. Implement next / previous navigation
9. Add keyboard shortcuts
10. Add hash routing
11. Add page counter
12. Implement fullscreen
13. Add viewport scaling

### Markdown extensions

14. Implement `@slide` parser
15. Implement `@aside`
16. Add center layout
17. Add cover layout
18. Add split layout

### Styling

19. Add default theme
20. Add code block styles
21. Add table styles
22. Add print stylesheet
23. Add reduced-motion support

### Quality

24. Add unit tests
25. Add Playwright E2E
26. Add GitHub Actions CI
27. Add example presentation
28. Write README
29. Write Markdown syntax documentation

---

## 54. MVP受け入れ条件

以下をすべて満たしたらMVP完成とする。

- `slides.md` を変更すると画面へ反映される
- `---` でスライドを分割できる
- Markdown基本記法が表示できる
- 画像が表示できる
- コードブロックが表示できる
- 左右キーで移動できる
- Spaceで次ページへ進める
- URLから指定ページを開ける
- URLを共有すると同じページを開ける
- 全画面表示できるブラウザではFキーで全画面へ移行できる
- 16:9を維持してウィンドウ内に収まる
- 画面サイズを変更しても破綻しない
- 印刷時に1ページ1スライドになる
- build後は静的ファイルだけで動作する
- Playwrightの主要E2Eテストが通る
- READMEを読めば新しい資料を書き始められる

---

## 55. 最初のサンプルスライド

実装確認用として、以下を網羅した `slides.md` を用意する。

```md
---
title: Markdown Web Slides
author: Example
theme: default
---

@slide layout=cover

# Markdown Web Slides

Write. Build. Present.

---

# Normal Slide

- Markdown
- Keyboard navigation
- Static hosting

---

@slide layout=center

# One message.

---

@slide layout=split

# Split Layout

Left side content.

@aside

![Sample image](./assets/sample.jpg)

---

# Code

```ts
function hello(name: string) {
  return `Hello ${name}`;
}
```

---

# Table

| Feature | Status |
|---|---|
| Markdown | Ready |
| Keyboard | Ready |
| Fullscreen | Ready |

---

# Thank you
```

このサンプルをE2EとVisual Regression Testのfixtureとしても利用する。

---

## 56. 今後の追加候補

優先度順:

### High

- Syntax Highlight
- Presenter Mode
- Overview
- PDF export
- 複数デッキ
- テーマ追加

### Medium

- スワイプ
- Speaker timer
- Mermaid
- 数式
- QRコード
- Progress bar

### Low

- Remote control
- WebSocket同期
- Live reload共有
- GUI editor
- Plugin API

---

## 57. 非機能要件

### 保守性

- 主要モジュールを小さく保つ
- parserとrendererを分離する
- ビジネスロジックをDOMから分離する
- テスト可能な純粋関数を優先する

### 可搬性

- 静的ホスティングで動作
- 特定クラウドに依存しない
- Nodeは開発・build時のみ必要

### 可読性

- Markdown原稿自体がレンダリングしなくても読める
- 独自記法を最小限にする

### 後方互換

独自Markdown構文は一度公開した後に安易に変更しない。

---

## 58. 実装判断で迷った場合の優先順位

判断基準は次の順番とする。

1. Markdownが読みやすいか
2. 発表時に壊れにくいか
3. 実装が単純か
4. 依存が少ないか
5. Gitで管理しやすいか
6. 拡張できるか
7. 見た目が派手か

「できることを増やす」より「迷わず使える」ことを優先する。

---

## 59. プロジェクトとしての完成形

最終的には次の体験を目指す。

```bash
git clone ...
pnpm install
pnpm dev
```

その後、

```text
slides.md
```

だけを書けば、

```text
ブラウザで確認
↓
Git commit
↓
push
↓
静的ホスティングへ自動deploy
↓
URLを共有
↓
そのURLのまま登壇
```

という流れが成立する。

このプロジェクトの価値は、多機能なプレゼンテーションソフトを再現することではない。

**MarkdownとWebブラウザの間に、必要最小限のプレゼンテーション層を置くこと**を目的とする。

---

## 60. 初回開発時の推奨方針

最初の実装では、次の機能だけに集中する。

```text
slides.md
    ↓
slide split
    ↓
markdown render
    ↓
1 slide display
    ↓
keyboard navigation
    ↓
hash routing
    ↓
fullscreen
```

ここまで完成した段階で一度実際のプレゼンテーションに使用する。

その利用経験から、

- UIが邪魔か
- Markdown記法が書きやすいか
- splitレイアウトが十分か
- ページ切り替えが自然か
- 文字サイズが適切か

を評価し、その後にPresenter Modeや複数デッキなどを追加する。

最初から「完成されたスライドフレームワーク」を目指さず、**実際の登壇で使える最小ツールを完成させること**を第一目標とする。
