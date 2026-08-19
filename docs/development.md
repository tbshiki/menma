# menma 開発環境

> 文書種別: 開発手順（正典ではなく手順書）
> 進捗と次にやることは [ロードマップ](./roadmap.md) を見る。ここには書かない。

## 1. 必要なもの

| 対象 | 条件 |
| --- | --- |
| Node.js | 20 以上（開発・ビルド時のみ必要。実行環境には不要） |
| pnpm | `package.json` の `packageManager` に固定。他のパッケージマネージャーを使わない |
| OS | AI 開発基盤のスクリプトが PowerShell のため Windows 前提（6 章） |

## 2. セットアップ

```powershell
# 1. AI スキルの symlink を作る（Git 管理外の生成物。クローンごとに必要）
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\sync-ai-symlinks.ps1

# 2. 依存をインストール
pnpm install

# 3. 開発サーバ
pnpm dev
```

`slides.md` を編集して保存すると画面へ反映される。

## 3. コマンド

| コマンド | 内容 |
| --- | --- |
| `pnpm dev` | 開発サーバ |
| `pnpm build` | 本番ビルド（`dist/`） |
| `pnpm preview` | ビルド結果の確認 |
| `pnpm typecheck` | 型検査（`tsc --noEmit`） |
| `pnpm lint` | ESLint |
| `pnpm format` / `pnpm format:check` | Prettier（対象はコードのみ。`*.md` と `.claude/` は除外） |
| `pnpm test` / `pnpm test:watch` | 単体テスト（Vitest） |

サブディレクトリ配信を試すときはベースパスを環境変数で渡す。

```powershell
$env:MENMA_BASE = "/slides/"; pnpm build
```

E2E（`pnpm test:e2e`）はロードマップ M2 で追加する。

## 4. 変更するときの流れ

1. 仕様に関わる変更は、コードより先に `docs/` を更新する
2. 実装する
3. 影響範囲に応じて `pnpm typecheck` → `pnpm test` → `pnpm lint` → `pnpm build` の順に検証する
4. AI 設定（`AGENTS.md`、`.claude/`、`skills/`、`scripts/`）を触ったら `scripts/check-ai-config.ps1` を実行する

## 5. 生成物

`node_modules/`、`dist/`、`.vite/`、Playwright の出力は生成物。直接編集せず、入力を直して再生成する。すべて `.gitignore` 済み。

## 6. AI 開発基盤

Codex と Claude Code の両方で使う共通基盤を導入している。構成は `ai-dev-workspace-template` を参照元として導入したもの。

| 対象 | 役割 |
| --- | --- |
| `AGENTS.md` | AI への共通指示の正典。プロジェクト固有規約もここに書く |
| `CLAUDE.md` | Claude Code の入口。`@AGENTS.md` を import するだけ |
| `skills/` | 再利用可能な手順の正典（`ai-config` / `dev-workflow` / `qa`） |
| `.agents/skills` | Codex のスキル探索場所。`../skills` への生成 symlink |
| `.claude/skills` | Claude Code のスキル探索場所。`../skills` への生成 symlink |
| `.claude/settings.json` | Claude Code の権限。読み取り中心で、commit / push は確認対象 |
| `.claude/hooks/` | 実行時のガードレール（秘密情報のアクセス拒否、追跡済みファイルの自動許可） |
| `scripts/` | symlink 同期とヘルスチェック |

### 6.1 Windows 専用

**この基盤は Windows 専用。** PowerShell 5.1 と 7 の双方で動作する。`.claude/settings.json` の hook は `powershell.exe` を決め打ちで起動し、スクリプトはすべて `*.ps1`、symlink 生成に Win32 API を直接呼び出す。

macOS / Linux では hook が起動しないため、秘密情報のアクセス拒否も自動許可の除外も効かない。他プラットフォームで使う場合は hook をシェルスクリプトへ移植し、`settings.json` の `command` を書き換える。symlink は `ln -s ../skills .agents/skills` と `ln -s ../skills .claude/skills` で代替できる。

### 6.2 symlink の作成

`.agents/skills` と `.claude/skills` は Git 管理しない生成 symlink。クローン後や新しい端末では作り直す。

Windows では、管理者権限なしで symlink を作れるように「設定 > システム > 開発者向け」で**開発者モードを有効**にする。組織管理端末では管理者または管理部門の許可が必要な場合がある。

VS Code でフォルダを開くと `AI: Sync skill symlinks` タスクが自動実行される。初回に自動タスクの許可を尋ねられたら、内容を確認して許可する。同じタスクと `AI: Check config` は、コマンドパレットの「Tasks: Run Task」からも実行できる。

リンク作成に失敗しても、実ディレクトリのコピーや junction には置き換えない。正典が二重化するため。失敗時は理由と対処を示すアラートを表示し、終了コード 1 で停止する（最も多い原因は開発者モードが無効なこと）。

### 6.3 ヘルスチェック

AI 設定を変更したら `scripts/check-ai-config.ps1` を実行する。正典ファイル、権限、hook の実挙動、秘密情報保護の3箇所同期、スキル表と実体の双方向一致、symlink のリンク先、`*.ps1` の UTF-8 BOM などを検証し、失敗時は `[FAIL]` と理由を表示して終了コード 1 を返す。

### 6.4 秘密情報の扱い

`.env` 系、`.dev.vars` 系、鍵・証明書、SSH 秘密鍵、レジストリ認証情報、`secrets.*` などは Git 対象外で、AI からの読み取りも拒否している。

保護は **`.gitignore`（コミット防止）、`.claude/settings.json` の `permissions.deny`（Read ツール）、`.claude/hooks/deny-secret-file-access.ps1`（シェルコマンド）の3箇所に重複して定義**してある。片方だけ変更すると経路によって守られたり守られなかったりするため、対象を変えるときは3箇所を揃える。`*.example` / `*.sample` と SSH 公開鍵（`*.pub`）は誤検知を避けるため除外している。

### 6.5 ファイルエンコーディング

`*.ps1` は **UTF-8 BOM 付き・CRLF**、通常のテキストは UTF-8・LF で保存する。Windows PowerShell 5.1 は BOM なし UTF-8 をレガシーコードページとして読むため、日本語を含むスクリプトは BOM がないと壊れる。`.editorconfig` と `.gitattributes` に規則を定義しているが、AI やツールの書き込みには適用されないため、ヘルスチェックで機械的に検証している。
