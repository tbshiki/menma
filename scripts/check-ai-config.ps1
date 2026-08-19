#Requires -Version 5.1

# AI 開発基盤のヘルスチェック。AI 設定を変更したら実行する。
# VS Code では "AI: Check config" タスクからも実行できる。
# hook が powershell.exe 決め打ちのため Windows 専用。PowerShell 5.1 / 7 の両方で動く。

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version 2.0
$script:Failed = $false
$root = Split-Path -Parent $PSScriptRoot

function Write-CheckResult {
    param([bool]$Success, [string]$Message)
    if ($Success) {
        Write-Host "[OK] $Message"
    }
    else {
        Write-Host "[FAIL] $Message" -ForegroundColor Red
        $script:Failed = $true
    }
}

function Read-Utf8Text {
    # Windows PowerShell 5.1 の既定はレガシーコードページ。BOM なし UTF-8 を既定で読むと、
    # 日本語が化けるだけでなく、化けたバイト列が改行を飲み込んで行が結合する。
    # その結果、行頭一致の判定が FAIL も出さずに空振りする。読み取りでも UTF-8 を明示する。
    param([string]$Path)

    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { return '' }
    return [string](Get-Content -LiteralPath $Path -Raw -Encoding UTF8)
}

function Get-JsonProperty {
    # Set-StrictMode 下では存在しないプロパティの参照が例外になるため、明示的に確認する。
    param($Object, [string]$Name)

    if ($null -eq $Object) { return $null }
    if ($Object.PSObject.Properties.Name -notcontains $Name) { return $null }
    return $Object.$Name
}

function ConvertTo-CheckArray {
    param($Value)

    if ($null -eq $Value) { return @() }
    return @($Value)
}

# --- 正典ファイル ---------------------------------------------------------

$agentsPath = Join-Path $root 'AGENTS.md'
Write-CheckResult (Test-Path -LiteralPath $agentsPath -PathType Leaf) 'AGENTS.md が存在する'

$agentsText = Read-Utf8Text -Path $agentsPath
$agentsLines = @($agentsText -split "`r?`n")
# 誤読すると行が結合して 1 行に潰れる。行数で誤読を検出する。
Write-CheckResult ($agentsLines.Count -gt 1) 'AGENTS.md を UTF-8 として読める'

$claudeText = Read-Utf8Text -Path (Join-Path $root 'CLAUDE.md')
Write-CheckResult ($claudeText -match '(?m)^\s*@AGENTS\.md\s*$') 'CLAUDE.md が @AGENTS.md を import している'

# --- Claude Code の権限 ---------------------------------------------------

$settingsPath = Join-Path $root '.claude\settings.json'
$validJson = $false
$settings = $null
$settingsText = ''
$denyRuleText = ''
try {
    $settingsText = Read-Utf8Text -Path $settingsPath
    if (-not [string]::IsNullOrWhiteSpace($settingsText)) {
        $settings = $settingsText | ConvertFrom-Json
        $validJson = $true
    }
}
catch { }
Write-CheckResult $validJson '.claude/settings.json が正しい JSON である'

$hookCommandLines = New-Object System.Collections.Generic.List[string]

if ($validJson) {
    $permissions = Get-JsonProperty -Object $settings -Name 'permissions'
    Write-CheckResult ((Get-JsonProperty -Object $permissions -Name 'disableBypassPermissionsMode') -eq 'disable') 'Claude Code の権限バイパスが無効である'

    $askRules = ConvertTo-CheckArray (Get-JsonProperty -Object $permissions -Name 'ask')
    $requiredAskRules = @(
        'PowerShell(git commit:*)',
        'PowerShell(git tag:*)',
        'PowerShell(git push:*)',
        'Bash(git commit:*)',
        'Bash(git tag:*)',
        'Bash(git push:*)'
    )
    foreach ($rule in $requiredAskRules) {
        Write-CheckResult ($askRules -contains $rule) "Claude Code が $rule を確認対象にしている"
    }

    # .gitignore と .claude/hooks/deny-secret-file-access.ps1 と対象を揃えること。
    # 3 箇所が食い違うと、経路によって守られたり守られなかったりする。
    $denyRules = ConvertTo-CheckArray (Get-JsonProperty -Object $permissions -Name 'deny')
    $denyRuleText = ($denyRules -join ' ')
    $requiredDenyRules = @(
        'Read(.env)',
        'Read(.env.*)',
        'Read(**/.env)',
        'Read(**/.env.*)',
        'Read(.dev.vars)',
        'Read(.dev.vars.*)',
        'Read(**/.dev.vars)',
        'Read(**/.dev.vars.*)',
        'Read(**/*.key)',
        'Read(**/*.pem)',
        'Read(**/*.p12)',
        'Read(**/*.pfx)',
        'Read(**/*.jks)',
        'Read(**/*.keystore)',
        'Read(**/id_rsa)',
        'Read(**/id_dsa)',
        'Read(**/id_ecdsa)',
        'Read(**/id_ed25519)',
        'Read(**/.npmrc)',
        'Read(**/.pypirc)',
        'Read(**/.aws/credentials)',
        'Read(**/.git-credentials)',
        'Read(**/secrets.*)'
    )
    foreach ($rule in $requiredDenyRules) {
        Write-CheckResult ($denyRules -contains $rule) "Claude Code が $rule を拒否している"
    }

    $hooksNode = Get-JsonProperty -Object $settings -Name 'hooks'
    foreach ($entry in (ConvertTo-CheckArray (Get-JsonProperty -Object $hooksNode -Name 'PreToolUse'))) {
        foreach ($hook in (ConvertTo-CheckArray (Get-JsonProperty -Object $entry -Name 'hooks'))) {
            $parts = @([string](Get-JsonProperty -Object $hook -Name 'command'))
            $parts += (ConvertTo-CheckArray (Get-JsonProperty -Object $hook -Name 'args'))
            $hookCommandLines.Add(($parts -join ' '))
        }
    }
}

# --- hook 本体 ------------------------------------------------------------

foreach ($hookFile in @('deny-secret-file-access.ps1', 'auto-allow-git-tracked-edit.ps1')) {
    $hookPath = Join-Path $root ".claude\hooks\$hookFile"
    Write-CheckResult (Test-Path -LiteralPath $hookPath -PathType Leaf) ".claude/hooks/$hookFile が存在する"

    if ($validJson) {
        $registered = @($hookCommandLines | Where-Object { $_ -like "*$hookFile*" }).Count -gt 0
        Write-CheckResult $registered "PreToolUse hook に $hookFile が登録されている"
    }
}

# 自動許可 hook を実際に起動して判定を確かめる。除外リストの有無を文字列で調べるだけでは、
# リストが残ったまま参照が消えた場合に空振りする。
$autoAllowHookPath = Join-Path $root '.claude\hooks\auto-allow-git-tracked-edit.ps1'
$powerShellExe = Get-Command powershell.exe -ErrorAction SilentlyContinue

function Get-AutoAllowDecision {
    param([string]$RelativePath)

    $payload = @{ tool_input = @{ file_path = (Join-Path $root $RelativePath) } } | ConvertTo-Json -Compress -Depth 4
    $output = $payload | & $powerShellExe.Source -NoLogo -NoProfile -ExecutionPolicy Bypass -File $autoAllowHookPath 2>$null
    $text = (@($output) -join '').Trim()
    if ([string]::IsNullOrWhiteSpace($text)) { return '' }

    try {
        return [string]((($text | ConvertFrom-Json).hookSpecificOutput).permissionDecision)
    }
    catch {
        return 'parse-error'
    }
}

if (Test-Path -LiteralPath $autoAllowHookPath -PathType Leaf) {
    # settings.json の hook は powershell.exe 決め打ちのため、無ければ hook 自体が動かない。
    Write-CheckResult ($null -ne $powerShellExe) 'hook を起動する powershell.exe が使える'

    if ($null -ne $powerShellExe) {
        $previousProjectDir = $env:CLAUDE_PROJECT_DIR
        $env:CLAUDE_PROJECT_DIR = $root
        try {
            # 自己統治ファイルは判定を返さず、人間の承認へ落ちること。
            $guardedPaths = @(
                '.claude\settings.json',
                '.claude\hooks\auto-allow-git-tracked-edit.ps1',
                'AGENTS.md',
                '.gitignore',
                'scripts\check-ai-config.ps1'
            )
            foreach ($guardedPath in $guardedPaths) {
                $decision = Get-AutoAllowDecision -RelativePath $guardedPath
                Write-CheckResult ($decision -ne 'allow') "$($guardedPath.Replace('\', '/')) が自動許可されない"
            }

            # 除外が広すぎると自動許可の利点が消えるため、通常ファイルの allow も確認する。
            # 対象はハードコードせず、追跡済みファイルから自己統治ファイル以外を選ぶ。
            # 特定のファイル名（README.md など）を前提にすると、導入先で無い場合に誤 FAIL になる。
            $ordinaryFile = @(& git -C $root ls-files | Where-Object {
                    $_ -notmatch '^\.' -and $_ -notin @('AGENTS.md', 'CLAUDE.md', 'scripts/check-ai-config.ps1')
                })[0]
            if ([string]::IsNullOrWhiteSpace($ordinaryFile)) {
                Write-CheckResult $false '自動許可の確認に使える通常の追跡済みファイルがある'
            }
            else {
                Write-CheckResult ((Get-AutoAllowDecision -RelativePath $ordinaryFile) -eq 'allow') "$ordinaryFile（通常の追跡済みファイル）は自動許可される"
            }
        }
        finally {
            $env:CLAUDE_PROJECT_DIR = $previousProjectDir
        }
    }
}

# --- 秘密情報の3箇所同期 --------------------------------------------------

# 秘密情報の保護は .gitignore(コミット防止)、permissions.deny(Read ツール)、
# deny hook(シェルコマンド)の3箇所に重複して定義する。1箇所だけ足すと、経路によって
# 守られたり守られなかったりする。実際にこの検査を入れる前、.aws/credentials が
# deny hook にしか無い状態になっていた。
# hook 側は正規表現なのでエスケープの \ を落としてから照合する。
$gitignoreText = Read-Utf8Text -Path (Join-Path $root '.gitignore')
$denyHookText = (Read-Utf8Text -Path (Join-Path $root '.claude\hooks\deny-secret-file-access.ps1')) -replace '\\', ''

$protectedTokens = @('.env', '.dev.vars', 'key', 'pem', 'p12', 'pfx', 'jks', 'keystore',
    'id_', 'npmrc', 'pypirc', '.aws', 'git-credentials', 'secrets')

foreach ($token in $protectedTokens) {
    $missing = @()
    if ($gitignoreText -notlike "*$token*") { $missing += '.gitignore' }
    if ($denyRuleText -notlike "*$token*") { $missing += 'permissions.deny' }
    if ($denyHookText -notlike "*$token*") { $missing += 'deny hook' }

    $label = "秘密情報 $token が3箇所すべてで保護されている"
    if ($missing.Count -gt 0) { $label += "（不足: $($missing -join ' / ')）" }
    Write-CheckResult ($missing.Count -eq 0) $label
}

# --- スキル ---------------------------------------------------------------

$skillsPath = Join-Path $root 'skills'
$skillsItem = Get-Item -LiteralPath $skillsPath -Force -ErrorAction SilentlyContinue
$skillsHasLinkType = $null -ne $skillsItem -and $skillsItem.PSObject.Properties.Name -contains 'LinkType'
$skillsIsLink = $skillsHasLinkType -and -not [string]::IsNullOrEmpty([string]$skillsItem.LinkType)
$skillsIsRealDirectory = $null -ne $skillsItem -and $skillsItem.PSIsContainer -and -not $skillsIsLink
Write-CheckResult $skillsIsRealDirectory 'skills が実ディレクトリである'

# 導入先でも必ず残すコアスキル。これ以外の増減は AGENTS.md の表との突き合わせで検出する。
foreach ($skillName in @('ai-config', 'dev-workflow', 'qa')) {
    $skillFile = Join-Path $skillsPath "$skillName\SKILL.md"
    Write-CheckResult (Test-Path -LiteralPath $skillFile -PathType Leaf) "skills/$skillName/SKILL.md が存在する"
}

$skillsOnDisk = @(Get-ChildItem -LiteralPath $skillsPath -Directory -ErrorAction SilentlyContinue |
    Where-Object { Test-Path -LiteralPath (Join-Path $_.FullName 'SKILL.md') -PathType Leaf } |
    ForEach-Object { $_.Name })
Write-CheckResult ($skillsOnDisk.Count -gt 0) 'skills/*/SKILL.md が 1 件以上ある'

# 実体と AGENTS.md のスキル表を双方向に突き合わせる。固定配列では、
# 表にあるのに実体が無いスキルも、実体があるのに表に無いスキルも検出できない。
$tableStartMarker = '<!-- skills:table:start -->'
$tableEndMarker = '<!-- skills:table:end -->'
$tableFound = $false
$inTable = $false
$skillsInTable = New-Object System.Collections.Generic.List[string]

foreach ($line in $agentsLines) {
    if ($line.Contains($tableStartMarker)) {
        $inTable = $true
        $tableFound = $true
        continue
    }
    if ($line.Contains($tableEndMarker)) {
        $inTable = $false
        continue
    }
    if (-not $inTable -or $line -notmatch '^\s*\|') { continue }

    # 説明列に出てくるコマンド名をスキル名と誤認しないよう、1 列目のセルだけを見る。
    # 1 セルに複数のスキル名が並ぶ書式にも対応する。
    $cells = @($line -split '\|')
    if ($cells.Count -lt 2) { continue }
    foreach ($nameMatch in [regex]::Matches($cells[1], '`([^`]+)`')) {
        $name = $nameMatch.Groups[1].Value.Trim()
        if (-not [string]::IsNullOrWhiteSpace($name) -and -not $skillsInTable.Contains($name)) {
            $skillsInTable.Add($name)
        }
    }
}

Write-CheckResult $tableFound 'AGENTS.md に skills:table マーカーがある'

foreach ($skillName in $skillsOnDisk) {
    Write-CheckResult ($skillsInTable.Contains($skillName)) "skills/$skillName が AGENTS.md のスキル表に載っている"
}
foreach ($skillName in $skillsInTable) {
    $skillFile = Join-Path $skillsPath "$skillName\SKILL.md"
    Write-CheckResult (Test-Path -LiteralPath $skillFile -PathType Leaf) "AGENTS.md の表にある $skillName の実体が存在する"
}

# --- 生成 symlink ---------------------------------------------------------

$expectedSkillsPath = [IO.Path]::GetFullPath($skillsPath)
foreach ($relativeLink in @('.agents\skills', '.claude\skills')) {
    $linkPath = Join-Path $root $relativeLink
    $linkItem = Get-Item -LiteralPath $linkPath -Force -ErrorAction SilentlyContinue
    $hasLinkType = $null -ne $linkItem -and $linkItem.PSObject.Properties.Name -contains 'LinkType'
    $isLink = $hasLinkType -and $linkItem.LinkType -eq 'SymbolicLink'
    $pointsToSkills = $false
    if ($isLink) {
        $targetValue = [string](@($linkItem.Target)[0])
        $linkParent = Split-Path -Parent $linkPath
        $actualTargetPath = [IO.Path]::GetFullPath((Join-Path $linkParent $targetValue))
        $pointsToSkills = $actualTargetPath -eq $expectedSkillsPath
    }
    Write-CheckResult $pointsToSkills "$($relativeLink.Replace('\', '/')) が skills を指す symlink である"
}

# --- Git 管理対象の秘密情報 -----------------------------------------------

$secretPathspecs = @(
    '.env', '.env.*', '**/.env', '**/.env.*',
    '.dev.vars', '.dev.vars.*', '**/.dev.vars', '**/.dev.vars.*',
    '*.key', '*.pem', '*.p12', '*.pfx', '*.jks', '*.keystore',
    '**/*.key', '**/*.pem', '**/*.p12', '**/*.pfx', '**/*.jks', '**/*.keystore',
    'secrets.*', '**/secrets.*',
    'id_rsa', 'id_dsa', 'id_ecdsa', 'id_ed25519',
    '**/id_rsa', '**/id_dsa', '**/id_ecdsa', '**/id_ed25519',
    '.aws/credentials', '**/.aws/credentials',
    '.git-credentials', '**/.git-credentials'
)
$trackedSecretsRaw = @(& git -C $root ls-files -- @secretPathspecs)
$gitSucceeded = $LASTEXITCODE -eq 0
# 例示ファイルは秘密情報ではない。.gitignore も !.env.example などで追跡を許している。
$trackedSecrets = @($trackedSecretsRaw | Where-Object { $_ -notmatch '\.(example|sample|template|dist)$' })
Write-CheckResult $gitSucceeded 'Git 管理対象を検査できる'
Write-CheckResult ($gitSucceeded -and $trackedSecrets.Count -eq 0) '.env、鍵、秘密情報が Git 管理対象に含まれない'

if ($gitSucceeded) {
    $ignoredLocalSettings = @(& git -C $root check-ignore --no-index -- 'CLAUDE.local.md' '.claude/settings.local.json')
    $ignoreCheckSucceeded = $LASTEXITCODE -eq 0
    Write-CheckResult ($ignoreCheckSucceeded -and $ignoredLocalSettings.Count -eq 2) 'Claude Code のローカル専用設定が Git 除外されている'
}

# --- エンコーディング規約 -------------------------------------------------

$gitattributesPath = Join-Path $root '.gitattributes'
Write-CheckResult (Test-Path -LiteralPath $gitattributesPath -PathType Leaf) '.gitattributes が存在する'
$gitattributesText = Read-Utf8Text -Path $gitattributesPath
Write-CheckResult ($gitattributesText -match '(?m)^\s*\*\.ps1\s+text\s+eol=crlf\s*$') '.gitattributes が *.ps1 を CRLF に固定している'

# [*.ps1] セクションの中だけを見る。ファイル全体を検索すると、別セクションの指定でも
# 通ってしまい、*.ps1 の規則が消えていても FAIL が出ない。
$editorconfigText = Read-Utf8Text -Path (Join-Path $root '.editorconfig')
$inPs1Section = $false
$ps1Charset = $false
$ps1Eol = $false
foreach ($line in @($editorconfigText -split "`r?`n")) {
    if ($line -match '^\s*\[(.+)\]\s*$') {
        $inPs1Section = ($matches[1].Trim() -eq '*.ps1')
        continue
    }
    if (-not $inPs1Section) { continue }
    if ($line -match '^\s*charset\s*=\s*utf-8-bom\s*$') { $ps1Charset = $true }
    if ($line -match '^\s*end_of_line\s*=\s*crlf\s*$') { $ps1Eol = $true }
}
Write-CheckResult $ps1Charset '.editorconfig の [*.ps1] が charset = utf-8-bom を指定している'
Write-CheckResult $ps1Eol '.editorconfig の [*.ps1] が end_of_line = crlf を指定している'

# Windows PowerShell 5.1 は BOM なし UTF-8 をレガシーコードページとして読むため、日本語を含む
# スクリプトが文字化けして壊れる。.editorconfig はAIやツールの書き込みに適用されないので実ファイルを検査する。
# --others を付けて未追跡も対象にする。新規作成直後こそ BOM が落ちやすく、コミット前に捕まえたい。
$scriptFiles = @(& git -C $root ls-files --cached --others --exclude-standard -- '*.ps1' | Sort-Object -Unique)
$scriptListSucceeded = $LASTEXITCODE -eq 0
Write-CheckResult $scriptListSucceeded 'PowerShell スクリプトを列挙できる'
Write-CheckResult ($scriptListSucceeded -and $scriptFiles.Count -gt 0) 'PowerShell スクリプトが 1 件以上見つかる'

if ($scriptListSucceeded) {
    foreach ($relativePath in $scriptFiles) {
        $scriptPath = Join-Path $root $relativePath
        if (-not (Test-Path -LiteralPath $scriptPath -PathType Leaf)) {
            continue
        }

        $header = New-Object byte[] 3
        $stream = [IO.File]::OpenRead($scriptPath)
        try {
            $readCount = $stream.Read($header, 0, 3)
        }
        finally {
            $stream.Dispose()
        }

        $hasBom = $readCount -eq 3 -and $header[0] -eq 0xEF -and $header[1] -eq 0xBB -and $header[2] -eq 0xBF
        Write-CheckResult $hasBom "$relativePath が UTF-8 BOM で保存されている"
    }
}

if ($script:Failed) { exit 1 }
exit 0
