# menma

Markdown を書いてブラウザでそのまま発表できる、軽量な Web スライドシステム。

- Markdown を中心に資料を書き、Git で履歴管理できる
- Web サイトとしてそのまま公開でき、キーボードだけで発表できる
- 依存関係を少なく保ち、HTML / CSS の知識があればデザインを拡張できる

要件定義・基本設計・実装計画は [`markdown-web-slides-project-spec.md`](markdown-web-slides-project-spec.md) が正典です。実装方針で迷ったら、まずこの仕様書を参照してください。

想定スタックは Vite + TypeScript + markdown-it + CSS + Playwright（パッケージマネージャーは pnpm）です。

## 現在の状態

**実装前です。** 現時点でこのリポジトリにあるのは、仕様書と AI 開発基盤だけです。`package.json` はまだありません。

## AI 開発基盤

このリポジトリには Codex と Claude Code の両方で使う AI 開発基盤を導入しています。構成は `ai-dev-workspace-template` を参照元として導入したものです。

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

### Windows 専用

**この基盤は Windows 専用です。** PowerShell 5.1 と 7 の双方で動作します。`.claude/settings.json` の hook は `powershell.exe` を決め打ちで起動し、スクリプトはすべて `*.ps1`、symlink 生成に Win32 API を直接呼び出します。

macOS / Linux では hook が起動しないため、秘密情報のアクセス拒否も自動許可の除外も効きません。他プラットフォームで使う場合は hook をシェルスクリプトへ移植し、`settings.json` の `command` を書き換えてください。symlink は `ln -s ../skills .agents/skills` と `ln -s ../skills .claude/skills` で代替できます。

### クローン直後のセットアップ

`.agents/skills` と `.claude/skills` は Git 管理しない生成 symlink です。クローン後や新しい端末では作り直します。

Windows では、管理者権限なしで symlink を作れるように「設定 > システム > 開発者向け」で**開発者モードを有効**にしてください。組織管理端末では管理者または管理部門の許可が必要な場合があります。

リポジトリのルートから PowerShell で実行します。

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\sync-ai-symlinks.ps1
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\check-ai-config.ps1
```

VS Code でフォルダを開くと `AI: Sync skill symlinks` タスクが自動実行されます。初回に自動タスクの許可を尋ねられたら、内容を確認して許可してください。同じタスクと `AI: Check config` は、コマンドパレットの「Tasks: Run Task」からも実行できます。

リンク作成に失敗しても、実ディレクトリのコピーや junction には置き換えません。正典が二重化するためです。失敗時は理由と対処を示すアラートを表示し、終了コード 1 で停止します（最も多い原因は開発者モードが無効なことです）。

### ヘルスチェック

AI 設定を変更したら `scripts/check-ai-config.ps1` を実行します。正典ファイル、権限、hook の実挙動、秘密情報保護の3箇所同期、スキル表と実体の双方向一致、symlink のリンク先、`*.ps1` の UTF-8 BOM などを検証し、失敗時は `[FAIL]` と理由を表示して終了コード 1 を返します。

### 秘密情報の扱い

`.env` 系、`.dev.vars` 系、鍵・証明書、SSH 秘密鍵、レジストリ認証情報、`secrets.*` などは Git 対象外で、AI からの読み取りも拒否しています。

保護は **`.gitignore`（コミット防止）、`.claude/settings.json` の `permissions.deny`（Read ツール）、`.claude/hooks/deny-secret-file-access.ps1`（シェルコマンド）の3箇所に重複して定義**してあります。片方だけ変更すると経路によって守られたり守られなかったりするため、対象を変えるときは3箇所を揃えてください。`*.example` / `*.sample` と SSH 公開鍵（`*.pub`）は誤検知を避けるため除外しています。

### ファイルエンコーディング

`*.ps1` は **UTF-8 BOM 付き・CRLF**、通常のテキストは UTF-8・LF で保存します。Windows PowerShell 5.1 は BOM なし UTF-8 をレガシーコードページとして読むため、日本語を含むスクリプトは BOM がないと壊れます。`.editorconfig` と `.gitattributes` に規則を定義していますが、AI やツールの書き込みには適用されないため、ヘルスチェックで機械的に検証しています。
