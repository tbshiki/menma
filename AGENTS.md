# AI 開発ガイドライン

このファイルは、このリポジトリで作業する AI への共通指示の正典です。

## コミュニケーション

- ユーザーへの応答、進捗、検証結果は日本語で記述する。
- 不明点が軽微なら安全な仮定を明示して進め、結果に影響する判断だけを確認する。

## 作業規約

- 作業開始時に `git status --short` を確認し、既存の未コミット変更を保持する。
- ファイル探索には `rg` と `rg --files` を優先する。
- ユーザーの明示的な依頼なしに commit、tag、push を行わない。
- `.env`、`.dev.vars`、鍵、証明書、トークンなどの秘密情報を読み取ったり、表示したり、コミットしたりしない。
- ビルド成果物、生成コード、依存関係などの生成物を直接編集しない。正典となる入力を変更して再生成する。
- 既存の設計と設定を尊重し、タスクに無関係な変更を混ぜない。

## スキル

作業を始める前に、次の表から該当するスキルを確認し、その手順に従う。実体は `skills/<名前>/SKILL.md`。

<!-- skills:table:start -->
| スキル | 使うとき |
| --- | --- |
| `ai-config` | 共通指示、スキル、権限、hook、symlink など AI 設定を変更・点検するとき |
| `dev-workflow` | 複数ファイルにまたがる実装や大きな変更を行うとき |
| `qa` | 利用可能な検証コマンドが不明なとき、または検証手段を追記するとき |
<!-- skills:table:end -->

この表と `skills/` の実体は `scripts/check-ai-config.ps1` が双方向に突き合わせる。スキルを追加・削除したら表も同時に更新する。表を囲む `skills:table` マーカーは検査対象の範囲を示すため、削除しない。

## 自分のガードレールを扱うとき

`.claude/`、`.codex/`、`.agents/`、`.github/workflows/`、`AGENTS.md`、`CLAUDE.md`、`.mcp.json`、`.gitignore`、`.gitattributes`、`scripts/check-ai-config.ps1` は、AI 自身の権限と禁止事項を定義するファイルです。

- これらは Git 管理下でも自動許可の対象外で、編集には必ず人間の承認が要る（`.claude/hooks/auto-allow-git-tracked-edit.ps1`）。
- 権限の緩和、秘密情報の deny 削除、hook の無効化を、依頼された作業の副作用として行わない。必要なら理由を示して個別に確認する。
- 秘密情報の保護対象は `.gitignore`、`.claude/settings.json` の `permissions.deny`、`.claude/hooks/deny-secret-file-access.ps1` の3箇所に重複して定義してある。片方だけ変更すると守られる経路に穴が空くため、変更するときは3箇所を揃える。`scripts/check-ai-config.ps1` が主要な保護対象について3箇所の一致を検査し、不足している箇所を名指しする。

## ファイルエンコーディング

- PowerShell スクリプト（`*.ps1`）は UTF-8 BOM 付き・CRLF で保存する。通常のテキストは UTF-8・LF とする。
- Windows PowerShell 5.1 は BOM なし UTF-8 をレガシーコードページとして読む。そのため日本語を含む `*.ps1` は BOM がないと文字化けし、構文エラーや誤動作になる。PowerShell 7 では再現しないため、7 で動いても 5.1 で壊れる。
- この規約は `.editorconfig` と `.gitattributes` に定義してあるが、**AI やツールのファイル書き込みはこれらを適用しない**。設定があるから安全とみなさず、`*.ps1` を新規作成・編集したら必ず BOM を自分で確認して直す。
- 確認と修正には次を使う。

```powershell
# [IO.File] は相対パスをプロセスのカレントで解決するため、絶対パスへ変換する。
$path = (Resolve-Path '.\scripts\example.ps1').ProviderPath
$bytes = [IO.File]::ReadAllBytes($path)
$hasBom = $bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF
if (-not $hasBom) {
    $text = [IO.File]::ReadAllText($path) -replace "`r`n", "`n" -replace "`n", "`r`n"
    [IO.File]::WriteAllText($path, $text, (New-Object System.Text.UTF8Encoding($true)))
}
```

- **書くときだけでなく読むときも規約がある。** PowerShell からテキストを読む処理は `Get-Content` / `Select-String` に必ず `-Encoding UTF8` を明示する。`AGENTS.md` や `CLAUDE.md` は規約上 BOM なし UTF-8 のため、Windows PowerShell 5.1 の既定エンコーディングでは誤読される。
- 誤読は文字化けだけでは済まない。化けたバイト列が改行を飲み込んで**行が結合する**ため、行単位の判定（行頭が `|` か、行頭が `@AGENTS.md` か）が静かに外れる。検査が空振りしても FAIL が出ないので気づけない。
- `scripts/check-ai-config.ps1` が Git 管理対象と未追跡の `*.ps1` の BOM を検証する。未追跡を含めるのは、新規作成直後が最も BOM の落ちやすい瞬間だから。
- 日本語を含まない `*.ps1` でも同じ規約を守る。後からメッセージへ非 ASCII 文字が入った時点で壊れるため。

## 実装と検証

- 変更後は影響範囲に応じ、軽量な確認からテスト、静的解析、ビルドへ段階的に検証する。利用できる QA コマンドは `skills/qa/SKILL.md` の表を見る。
- AI 設定を変更した後は `scripts/check-ai-config.ps1` を実行する。VS Code では `AI: Check config` タスクからも実行できる。
- 検査を追加・変更したときは、**意図的に壊して FAIL が出ることまで確認する。** 全項目 OK は、検査が通ったのか空振りしたのかを区別しない。
- 最終報告には変更内容、実施した検証、検証できなかった項目と残るリスクを含める。

## このプロジェクト固有の規約

### 何を作るリポジトリか

Markdown を書いてブラウザで発表できる、軽量な Web スライドシステム **menma** を作る。実装の正典は `docs/`。作業を始める前に、該当する文書を読む。

| 文書 | 参照するとき |
| --- | --- |
| `docs/requirements.md` | 作るもの・作らないものを判断するとき（FR-xx / NFR-xx） |
| `docs/spec-markdown.md` | 原稿の記法に関わる実装をするとき |
| `docs/architecture.md` | コードを書く直前（モジュール境界、DOM、命名、テスト方針） |
| `docs/roadmap.md` | 次に何をやるか決めるとき（M0〜M6） |
| `docs/decisions.md` | 「なぜそうなっているか」と未決事項を確認するとき |
| `docs/development.md` | セットアップ、コマンド、AI 開発基盤の構成を確認するとき（手順書） |

### ドキュメントの扱い

- 仕様を変える必要が出たら、**コードより先に `docs/` を更新する。** docs とコードが食い違ったまま進めない。
- 判断を変えたら `docs/decisions.md` へ理由ごと追記する。既存の決定の記録を消さない。
- 進捗（どこまで実装したか）は `docs/roadmap.md` の一覧表だけで管理する。README や他の文書へ書かない。
- `docs/decisions.md` の未決事項（Q-xx: ライセンス、デプロイ先など）を勝手に確定しない。必要になったらユーザーへ確認する。
- `docs/archive/` は構想段階の記録で正典ではない。実装の根拠にしない。
- 要件に無い機能を先回りして実装しない。ロードマップの現在のマイルストーンの範囲で終える。

### 独立実装の原則（最重要）

このプロジェクトは、既存のスライドツールの「別実装」であって複製ではない。`docs/requirements.md` 2 章の禁止事項を必ず守る。

- 他のスライドツールのソースコード、CSS、DOM 構造、特徴的な文言や UI をコピーしない。
- 他サイト固有の画像やフォントを無断利用しない。
- 参考にしてよいのは「Markdown からスライドを作る」といった一般的なアイデアまで。記法、URL 形式、クラス名、テーマ変数、エラーメッセージ、README は自分で設計する。

コードや文言を外部から持ち込むときは、出所とライセンスを確認し、その旨を報告に含める。

### 実装判断の優先順位

迷ったら次の順に優先する（`docs/decisions.md`）。

1. Markdown が読みやすいか
2. 発表時に壊れにくいか
3. 実装が単純か
4. 依存が少ないか
5. Git で管理しやすいか
6. 拡張できるか
7. 見た目が派手か

### 技術スタックと依存

- Vite + TypeScript + markdown-it + CSS、テストは Vitest と Playwright。MVP では React / Vue / Svelte などの UI フレームワークを使わない。
- 実行時依存は Markdown パーサ 1 つに限る（NFR-01）。依存を増やす変更は、要件と `docs/decisions.md` に照らして理由を示してから行う。
- パッケージマネージャーは pnpm を使う。`package-lock.json` や `yarn.lock` を作らない。
- `node_modules/`、`dist/`、Playwright のレポートや実行結果は生成物。直接編集せず、入力を直して再生成する。

### コーディング方針

詳細は `docs/architecture.md`。常に守る要点は次のとおり。

- TypeScript は `strict: true`。型のないデータをそのまま扱わない。
- `deck/`（パース層）は DOM を触らない純粋関数に保ち、`view/`（DOM 層）と分離する。グローバル状態を作らない。
- ナビゲーションの状態変更は `NavigationController.goTo()` の 1 か所に集約する。キー操作、ハッシュ、UI ボタンはすべてそこを経由する。
- CSS は Custom Properties を使い、構造 CSS とテーマ CSS を分離する。`!important` は原則使わない。接頭辞は `mn-` / `--mn-`。
- 一度公開した独自記法を安易に変更しない（NFR-06）。変える場合は `docs/spec-markdown.md` の改訂と移行手順をセットにする。

### 検証

- 利用できる検証コマンドは `skills/qa/SKILL.md` の表を見る。`package.json` にスクリプトを追加したら同じ表へ追記する。
- マイルストーンを終える前に、`docs/roadmap.md` の「マイルストーン共通の完了手順」を実施する。
