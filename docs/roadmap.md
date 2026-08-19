# menma ロードマップ

> 文書種別: 実装計画（正典）
> 関連: [要件定義](./requirements.md) / [記法仕様](./spec-markdown.md) / [設計](./architecture.md) / [決定記録](./decisions.md)

## 0. 進め方の原則

- **各マイルストーンは単体で「動く状態」で終える。** 途中で中断しても壊れたまま残さない
- 1 マイルストーンは 1 ブランチ・1 Pull Request を基本単位とする
- タスクは要件 ID（FR-xx / NFR-xx）を参照する。要件に無い実装を先回りしない
- 仕様を変える必要が出たら、**コードより先に `docs/` を更新する**。docs とコードが食い違ったまま進めない
- 見た目や機能を増やす前に、[実装判断の優先順位](./decisions.md#実装判断の優先順位)へ照らす

### マイルストーン共通の完了手順

1. `pnpm typecheck` / `pnpm lint` / `pnpm test` / `pnpm build` が通る（M0 以降）。E2E がある変更では `pnpm test:e2e` も通す（M2 以降）
2. 新しく使えるようになった検証コマンドを `skills/qa/SKILL.md` の表へ追記する
3. 仕様変更があれば `docs/` を更新し、決定は `docs/decisions.md` へ追記する
4. 変更点・実施した検証・検証できなかった項目を報告する

## 1. マイルストーン一覧と現在地

**進捗はこの表だけで管理する。** README や他の文書へ進捗を書かない（複数箇所に散らすと必ず古くなるため）。

| ID | 名前 | 目的 | 主な要件 | 状態 |
| --- | --- | --- | --- | --- |
| M0 | プロジェクト基盤 | ビルドと検証の土台を作る | NFR-01, NFR-09 | 完了 |
| M1 | パーサ | Markdown を Deck モデルへ変換する | FR-01〜FR-07 | 完了 |
| M2 | 発表コア | 実際の LT で最低限使える状態にする | FR-13〜FR-16, FR-18 | 完了 |
| M3 | 表示品質 | 会場のプロジェクタで安定して見せられる | FR-08〜FR-11, FR-17 | 完了 |
| — | ゲート | 実際の発表で 1 回使って評価する（6 章） | — | **次はここ** |
| M4 | 原稿の読み込み | 手元の Markdown をその場でスライドにする | FR-24〜FR-29 | 完了 |
| M5 | 堅牢性と検証 | 壊れ方を設計し、CI で守る | FR-19〜FR-23, NFR-09 | 未着手 |
| M6 | リリース準備 | 他人が使い始められる状態にする | 受け入れ条件全項目 | 未着手 |

現時点で動くこと: トップページから手元の Markdown（ファイル / 貼り付け）とサンプルを開ける。開いた原稿は 16:9 のスライドになり、キーボード・操作ボタン・`#/N` の URL で移動でき、8 レイアウトとテーマ、全画面（`F` キー）が効く。読み込んだ原稿はブラウザに保存され、リロードで同じページから再開できる。エラー画面・印刷・CI は M5。

M0〜M3 を **v0.1.0** として公開済み（[D-18](./decisions.md)）。M4 を加えたものが v0.2.0 になる。

**次は機能追加ではなく、6 章のゲート（実際に 1 回発表して評価する）。**

## 2. M0 — プロジェクト基盤

**目的**: `slides.md` の中身を画面へ出せる最小構成と、検証コマンド一式を用意する。

タスク

- [x] pnpm で Vite + TypeScript プロジェクトを初期化する（`strict: true`）
- [x] `index.html` / `src/main.ts` / `src/styles/reset.css` を作る
- [x] `slides.md` を `?raw` インポートして本文をそのまま画面へ表示する（FR-01）
- [x] Vitest を導入し、`utils/clamp.ts` の単体テストを通す（テスト土台の疎通確認を兼ねる）
- [x] ESLint（flat config・typescript-eslint）と Prettier を導入する
- [x] `package.json` に `dev` / `build` / `preview` / `typecheck` / `lint` / `format:check` / `test` を定義する
- [x] `.gitignore` へ `node_modules/` `dist/` を追加する（既存の記述で充足済み。Vite / Playwright の出力も定義済み）
- [x] `skills/qa/SKILL.md` の表へ実在するコマンドを追記する

完了条件

- `pnpm dev` で `slides.md` の中身が画面に出る
- `pnpm typecheck` / `pnpm lint` / `pnpm test` / `pnpm build` がすべて成功する

## 3. M1 — パーサ

**目的**: Markdown を副作用のない `Deck` データへ変換する。ここは全部単体テストで守る。

タスク

- [x] `deck/types.ts` に `Deck` / `Slide` / `DeckMeta` / `DeckWarning` を定義する
- [x] `parseFrontMatter.ts`（FR-02、[記法仕様 3 章](./spec-markdown.md#3-front-matter)）
- [x] `splitSlides.ts`（FR-03、コードフェンス内の `---` を分割しない）
- [x] `parseDirectives.ts`（FR-05〜FR-07、`@slide` / `@aside` / `@notes`）
- [x] `markdown.ts`（markdown-it の設定、外部リンクの `target` / `rel`）
- [x] `parseDeck.ts` で束ね、警告を `Deck.warnings` へ集約する
- [x] 単体テスト: 正常系に加え、閉じない Front Matter、型不一致、未知キー、未知 layout、フェンス内 `---`、`@aside` の重複、エスケープ

完了条件

- サンプル原稿から想定どおりの `Deck` が得られ、単体テストが通る
- パーサ層が DOM API を一切参照しない（import の確認）

## 4. M2 — 発表コア

**目的**: キーボードと URL で発表できる状態。ここまでで実際の LT に使える。

タスク

- [x] `view/renderDeck.ts` / `renderSlide.ts`（全スライドを生成し `hidden` で切り替え）
- [x] `navigation/controller.ts`（`goTo()` を唯一の変更点にする）
- [x] `navigation/keyboard.ts`（FR-13、FR-14 の入力要素判定を含む）
- [x] `navigation/hash.ts`（FR-15、FR-16 の正規化、`hashchange` 対応）
- [x] `view/hud.ts` のページ番号表示（FR-18）
- [x] 最小限の構造 CSS（`deck.css`）
- [x] E2E の基本シナリオ 1〜8（Playwright 導入を含む）（[設計 11 章](./architecture.md#11-テスト戦略)）

完了条件

- 矢印キー・Space・Home・End で移動でき、端でループしない
- `#/N` で直接開け、移動でハッシュが更新され、ブラウザの戻る／進むが機能する
- 不正なハッシュでも壊れない

## 5. M3 — 表示品質

**目的**: プロジェクタ投影に耐える見た目とレイアウト。

タスク

- [x] `view/scaler.ts` の 16:9 フィット（FR-09、`ResizeObserver`）
- [x] `navigation/fullscreen.ts`（FR-17、非対応環境のフォールバック）
- [x] デフォルトテーマ `themes/default.css`（FR-11、CSS 変数のみ）
- [x] 8 レイアウトの `layouts.css`（FR-08）
- [x] `@slide` の `background` / `backgroundColor` / `foreground` の適用。値は `element.style.setProperty()` で CSS 変数として渡し、HTML 文字列や CSS テキストへ連結しない（NFR-07）
- [x] 画像・コードブロック・表・引用のスタイル（FR-04、FR-10）
- [x] HUD の減光・`showControls` / `showPageNumber` 対応（FR-18）
- [x] E2E シナリオ 9（リサイズ）
- [x] サンプル `slides.md` を全レイアウト網羅へ更新する

完了条件

- ウィンドウ比率を変えてもスライドが切れず、16:9 を維持する
- 8 レイアウトがすべて描画契約どおりに見える
- `F` キーで全画面へ入り、全画面でもスケーリングが正しい

## 6. ゲート — 実際に 1 回発表する

**実際の登壇か社内勉強会で 1 回使う。** 当初は M3 の直後に置いたが、自分の原稿で試せたほうが評価しやすいため M4（原稿の読み込み）の完了後に実施する（[D-19](./decisions.md)）。機能追加はそこで止め、次を評価してから M5 へ進む。

- UI が発表の邪魔になっていないか
- Markdown が書きやすいか、`@slide` の記法が煩わしくないか
- `split` レイアウトで足りるか
- 文字サイズと余白が会場で読めるか
- 操作で迷う場面がなかったか

評価の結果は `docs/decisions.md` へ追記し、必要なら要件を見直す。**この評価より前に発表者モードや複数デッキへ着手しない。**

## 7. M4 — 原稿の読み込み

**目的**: リポジトリを触らなくても、手元の Markdown をその場でスライドにできるようにする。

MVP の受け入れ条件には含まれない機能追加だが、**自分の原稿で試せないと発表での評価がしづらい**ため、ゲートより先に実施する（[D-19](./decisions.md)）。

タスク

- [x] `main.ts` を分解し、デッキを差し替えられる構成にする（古い DOM と購読を捨てる）
- [x] `view/home.ts`: 入口画面（ファイル選択・ドラッグ&ドロップ・貼り付け・サンプルを見る）（FR-24〜FR-26）
- [x] `deck/source.ts`: 原稿の取得元の管理と `localStorage` への保存・復元（FR-27）
- [x] 入口とスライドの行き来。デッキを開くとき履歴へ積み、ブラウザの戻るで入口へ戻れるようにする（FR-28）
- [x] 読み込みに失敗したときの表示（対応外の拡張子、空、パースエラー）
- [x] E2E: 3 つの入力経路、リロード復元、戻るで入口

完了条件

- `.md` を選ぶ / 落とすとその場でスライドになる
- 貼り付けた原稿がスライドになり、リロードしても同じページから再開できる
- サンプル（`slides.md`）を開ける
- ブラウザの戻るで入口へ戻れる
- 原稿が URL へ載らない（[D-19](./decisions.md)）

## 8. M5 — 堅牢性と検証

**目的**: 想定外の入力と環境で「安全に失敗する」ことを保証し、CI で守る。

タスク

- [ ] `view/errorScreen.ts`（FR-21、開発時と本番の文言を分ける）
- [ ] `utils/log.ts`（FR-23、`import.meta.env.DEV` で出し分け）
- [ ] 印刷 CSS（FR-12、1 ページ 1 スライド、UI 非表示、transform 無効化）
- [ ] アクセシビリティ（FR-22、`lang`、`aria-live`、フォーカス可視、`prefers-reduced-motion`）
- [ ] raw HTML 無効と外部リンク `rel` の確認テスト（FR-19、FR-20）
- [ ] E2E シナリオ 10（エラー画面）
- [ ] GitHub Actions の CI（install → typecheck → lint → format:check → unit → build → e2e）

完了条件

- 空デッキ・不正 Front Matter で専用エラー画面が出る
- 印刷プレビューが 1 ページ 1 スライドになる
- Pull Request で CI が通る

## 9. M6 — リリース準備

**目的**: 自分以外が clone して使い始められる状態にする。

タスク

- [ ] README を書く（Features / Quick Start / 記法 / レイアウト / キー操作 / ビルド / デプロイ / ドキュメント / ライセンス）
- [ ] `docs/` の記述を実装と突き合わせて更新する
- [ ] LICENSE を追加する（[未決事項](./decisions.md#未決事項)の確定が必要）
- [x] デプロイ手順を用意する（Cloudflare Workers。[開発環境 5 章](./development.md#5-デプロイcloudflare-workers)。ゲートの評価を公開 URL で行うため前倒しで実施）
- [ ] サブディレクトリ配信での画像パスを確認する。原稿の `/assets/...` はベースパスを見ないため、`MENMA_BASE` を設定した配信では解決できない（`import.meta.env.BASE_URL` を使って原稿のパスを解決するか、相対パスの扱いを決める）
- [ ] [MVP 受け入れ条件](./requirements.md#9-mvp-受け入れ条件) 14 項目を 1 つずつ確認する
- [ ] v1.0 としてタグを打つ（ユーザーの明示的な依頼を受けてから）

完了条件

- 受け入れ条件 14 項目をすべて満たす
- README だけで新しい資料を書き始められる

## 10. MVP 後の候補

MVP と 6 章の評価を終えてから着手する。優先度は評価結果で入れ替えてよい。

| 優先 | 項目 | 備考 |
| --- | --- | --- |
| 高 | シンタックスハイライト | 別モジュール + 遅延読み込み（[D-06](./decisions.md)） |
| 高 | 発表者モード | `@notes` は MVP でパース済み。同期は BroadcastChannel を検討 |
| 高 | 一覧表示（`O` キー） | 全スライド DOM を持つ MVP 方式と相性が良い |
| 高 | PDF 出力 | まずは印刷 CSS で足りるか確認してから |
| 中 | テーマ追加（ダーク） | 変数の差し替えのみで実現する |
| 中 | 複数デッキ | URL 設計とビルド構成の変更を伴うため要設計 |
| 中 | スワイプ操作 | スマートフォン閲覧の改善 |
| 中 | Visual Regression Test | Playwright のスクリーンショット比較 |
| 中 | プログレスバー / 経過時間表示 | 発表中の情報量とのバランスを見る |
| 中 | バンドルサイズの削減 | gzip 54KB → NFR-02 の目標 40KB へ。記法の互換性を崩さない範囲で（[D-16](./decisions.md)） |
| 中 | 読み込んだ原稿の画像対応（v0.3.0） | フォルダのドラッグ&ドロップで `.md` と画像をまとめて取り込み、相対パスを blob URL へ解決する。保存は容量の都合で IndexedDB が必要。1 枚と合計のサイズ上限を設ける（[D-19](./decisions.md)） |
| 低 | Mermaid / 数式 | 依存が大きい。遅延読み込み前提 |
| 低 | CLI 化・パッケージ分割 | 利用者が増えた場合のみ検討 |
| 低 | リモート操作 / 同期 | 現時点では対象外 |

## 11. 将来像

```bash
git clone ...
pnpm install
pnpm dev
```

以降は `slides.md` を書き、ブラウザで確認して commit・push すると静的ホスティングへ配信され、その URL のまま登壇できる。この流れが成立することが完成形であり、多機能化は目的ではない。
