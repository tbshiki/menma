#Requires -Version 5.1

# PreToolUse hook: シェルコマンド(Bash / PowerShell)が秘密情報ファイルを参照している場合にブロックする。
#
# 対象は .gitignore と .claude/settings.json の permissions.deny と揃えること。
# 3 箇所が食い違うと、経路によって守られたり守られなかったりする。
#
# 誤検知を避けるため、判定の前に「秘密情報ではない表記」を取り除く。
#   - *.example / *.sample の例示ファイル
#   - SSH 公開鍵 (id_rsa.pub など)
# また ".env" の直前が単語文字なら パスと見なさないため、process.env は誤検知しない。

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version 2.0
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

# 判定前に取り除く表記。順序は結果に影響しない。
$allowedPatterns = @(
    '\.env\.example',
    '\.env\.sample',
    '\.dev\.vars\.example',
    '\.dev\.vars\.sample',
    '\.npmrc\.example',
    '\.pypirc\.example',
    'secrets\.example',
    'secrets\.sample',
    'id_(rsa|dsa|ecdsa|ed25519)\.pub'
)

# 上から順に判定し、最初に一致したものを拒否理由にする。
$denyRules = @(
    @{ Pattern = '(^|[^\w-])\.env(\.|\b)'; Target = '.env ファイル' },
    @{ Pattern = '(^|[^\w-])\.dev\.vars(\.|\b)'; Target = '.dev.vars(wrangler のローカル秘密変数)' },
    @{ Pattern = '\.(key|pem)(\b|$)'; Target = '鍵ファイル(*.key / *.pem)' },
    @{ Pattern = '\.(p12|pfx|jks|keystore)(\b|$)'; Target = '証明書・鍵ストア(*.p12 / *.pfx / *.jks / *.keystore)' },
    @{ Pattern = '(^|[^\w-])id_(rsa|dsa|ecdsa|ed25519)(\b|$)'; Target = 'SSH 秘密鍵' },
    @{ Pattern = '(^|[^\w-])\.(npmrc|pypirc)(\b|$)'; Target = 'レジストリ認証情報(.npmrc / .pypirc)' },
    @{ Pattern = '(^|[^\w-])\.aws[\\/]credentials(\b|$)'; Target = 'AWS 資格情報' },
    @{ Pattern = '(^|[^\w-])\.git-credentials(\b|$)'; Target = 'Git 資格情報' },
    @{ Pattern = '(^|[^\w-])secrets\.\w'; Target = 'secrets.* ファイル' }
)

function Deny([string]$target) {
    @{
        hookSpecificOutput = @{
            hookEventName            = 'PreToolUse'
            permissionDecision       = 'deny'
            permissionDecisionReason = "$target へのアクセスは禁止されています(AGENTS.md の秘密情報保護ルール)"
        }
    } | ConvertTo-Json -Compress -Depth 4
    exit 0
}

try {
    $payload = [Console]::In.ReadToEnd() | ConvertFrom-Json
    $command = [string]$payload.tool_input.command
    if ([string]::IsNullOrWhiteSpace($command)) { exit 0 }

    $scrubbed = $command
    foreach ($pattern in $allowedPatterns) {
        $scrubbed = $scrubbed -ireplace $pattern, ''
    }

    foreach ($rule in $denyRules) {
        if ($scrubbed -imatch $rule.Pattern) {
            Deny $rule.Target
        }
    }
    exit 0
}
catch {
    exit 0
}
