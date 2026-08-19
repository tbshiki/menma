#Requires -Version 5.1

# PreToolUse hook: Git 管理下(追跡済み)のファイルへの Edit/Write を自動許可する。
# 未追跡・無視対象・リポジトリ外のファイルは判定を返さず、通常の許可フローに委ねる。
#
# ただし AI 自身の権限と禁止事項を定義するファイルは、Git 管理下でも自動許可しない。
# 「Git 管理下だから安全」という前提は、ガードレールが Git 管理下に置かれている以上そのままでは
# 成り立たない。自動許可すると、AI が確認なしに permissions.deny から秘密情報を外したり、
# git push を ask から allow へ移したり、deny hook を空にしたりできてしまう。
# deny ではなく「判定なし」にするのは、人間が承認すれば編集できるべきだから。

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version 2.0
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

# リポジトリルートからの相対パス(スラッシュ区切り)に対する正規表現。
# AGENTS.md の「自分のガードレールを扱うとき」と対応させること。
$selfGoverningPatterns = @(
    '^\.claude/',                      # 権限、hook、エージェント定義
    '^\.codex/',                       # Codex 固有設定
    '^\.agents/',                      # Codex のスキル探索場所
    '^\.github/workflows/',            # CI から自動実行される処理
    '^AGENTS\.md$',                    # AI 共通指示の正典
    '^CLAUDE\.md$',
    '^\.mcp\.json$',                   # MCP サーバー定義
    '^\.gitignore$',                   # 秘密情報の除外規則
    '^\.gitattributes$',
    '^scripts/check-ai-config\.ps1$'   # ガードレールの検証スクリプト
)

try {
    $payload = [Console]::In.ReadToEnd() | ConvertFrom-Json
    $filePath = [string]$payload.tool_input.file_path
    if ([string]::IsNullOrWhiteSpace($filePath)) { exit 0 }

    $root = $env:CLAUDE_PROJECT_DIR
    if ([string]::IsNullOrWhiteSpace($root)) {
        $root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
    }
    $rootFull = [IO.Path]::GetFullPath($root).TrimEnd('\', '/')

    # 相対パスはプロセスのカレントではなくリポジトリルートを基準に解決する。
    if (-not [IO.Path]::IsPathRooted($filePath)) {
        $filePath = Join-Path $rootFull $filePath
    }
    $fileFull = [IO.Path]::GetFullPath($filePath)

    # リポジトリ外は判定しない。
    if (-not $fileFull.StartsWith("$rootFull\", [StringComparison]::OrdinalIgnoreCase)) { exit 0 }

    $relative = $fileFull.Substring($rootFull.Length + 1) -replace '\\', '/'
    foreach ($pattern in $selfGoverningPatterns) {
        if ($relative -imatch $pattern) { exit 0 }
    }

    $previousPreference = $ErrorActionPreference
    $ErrorActionPreference = 'SilentlyContinue'
    $null = & git -C $rootFull ls-files --error-unmatch -- $fileFull 2>&1
    $isTracked = $LASTEXITCODE -eq 0
    $ErrorActionPreference = $previousPreference

    if ($isTracked) {
        @{
            hookSpecificOutput = @{
                hookEventName            = 'PreToolUse'
                permissionDecision       = 'allow'
                permissionDecisionReason = 'Git 管理下のファイルのため自動許可'
            }
        } | ConvertTo-Json -Compress -Depth 4
    }
    exit 0
}
catch {
    exit 0
}
