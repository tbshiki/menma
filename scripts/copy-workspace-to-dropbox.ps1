#Requires -Version 5.1

# 現在のワークスペースを、Documents 配下の階層のまま Dropbox 配下の同じ相対パスへコピーする。
#   例: <Documents>\Git\ai\my-project -> <Dropbox>\Git\ai\my-project
# Documents と Dropbox のルートは実行環境から解決するため、ユーザー名や端末構成に依存しない。

[CmdletBinding()]
param(
    [string]$DestinationRoot = '',

    [switch]$Clean
)

Set-StrictMode -Version 2.0
$ErrorActionPreference = 'Stop'

function Get-NormalizedFullPath {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path
    )

    return [IO.Path]::GetFullPath($Path).TrimEnd('\', '/')
}

function Test-IsChildPath {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Candidate,

        [Parameter(Mandatory = $true)]
        [string]$Parent
    )

    return $Candidate.StartsWith("$Parent\", [StringComparison]::OrdinalIgnoreCase)
}

function Stop-ScriptWithAlert {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Reason,

        [string[]]$Detail = @(),

        [string[]]$Action = @()
    )

    $border = '=' * 70

    Write-Host ''
    Write-Host $border -ForegroundColor Red
    Write-Host ' [NG] Dropbox へのコピーを中止しました' -ForegroundColor Red
    Write-Host $border -ForegroundColor Red
    Write-Host ''
    Write-Host " 理由: $Reason" -ForegroundColor Red

    if ($Detail.Count -gt 0) {
        Write-Host ''
        foreach ($line in $Detail) {
            Write-Host "   $line"
        }
    }

    if ($Action.Count -gt 0) {
        Write-Host ''
        Write-Host ' 対処:' -ForegroundColor Yellow
        foreach ($line in $Action) {
            Write-Host "   $line" -ForegroundColor Yellow
        }
    }

    Write-Host ''
    Write-Host $border -ForegroundColor Red
    Write-Host ''

    exit 1
}

function Add-UniquePath {
    param(
        # Mandatory は空のコレクションを拒否するため、ここでは指定しない。
        [System.Collections.Generic.List[string]]$List,

        [string]$Path
    )

    if ([string]::IsNullOrWhiteSpace($Path)) {
        return
    }

    $normalized = Get-NormalizedFullPath -Path $Path
    foreach ($existing in $List) {
        if ($existing -ieq $normalized) {
            return
        }
    }

    $List.Add($normalized)
}

function Get-DocumentsRootCandidate {
    # 既知フォルダーのリダイレクト（OneDrive など）と、素の %USERPROFILE%\Documents の両方を候補にする。
    $candidates = New-Object System.Collections.Generic.List[string]

    Add-UniquePath -List $candidates -Path ([Environment]::GetFolderPath('MyDocuments'))

    if (-not [string]::IsNullOrWhiteSpace($env:USERPROFILE)) {
        Add-UniquePath -List $candidates -Path (Join-Path $env:USERPROFILE 'Documents')
    }

    return $candidates
}

function Get-DropboxRootFromInfoJson {
    # Dropbox クライアントが記録する同期フォルダーの実際の場所を読む。
    $infoPaths = New-Object System.Collections.Generic.List[string]

    if (-not [string]::IsNullOrWhiteSpace($env:LOCALAPPDATA)) {
        Add-UniquePath -List $infoPaths -Path (Join-Path $env:LOCALAPPDATA 'Dropbox\info.json')
    }

    if (-not [string]::IsNullOrWhiteSpace($env:APPDATA)) {
        Add-UniquePath -List $infoPaths -Path (Join-Path $env:APPDATA 'Dropbox\info.json')
    }

    foreach ($infoPath in $infoPaths) {
        if (-not (Test-Path -LiteralPath $infoPath -PathType Leaf)) {
            continue
        }

        try {
            $info = Get-Content -LiteralPath $infoPath -Raw -Encoding UTF8 | ConvertFrom-Json
        }
        catch {
            continue
        }

        if ($null -eq $info) {
            continue
        }

        foreach ($accountType in @('personal', 'business')) {
            if ($info.PSObject.Properties.Name -notcontains $accountType) {
                continue
            }

            $account = $info.$accountType
            if ($null -eq $account -or $account.PSObject.Properties.Name -notcontains 'path') {
                continue
            }

            $path = [string]$account.path
            if (-not [string]::IsNullOrWhiteSpace($path)) {
                return (Get-NormalizedFullPath -Path $path)
            }
        }
    }

    return $null
}

if (-not (Get-Command robocopy.exe -ErrorAction SilentlyContinue)) {
    Stop-ScriptWithAlert -Reason 'robocopy.exe が見つかりません。' -Action @(
        'このスクリプトは Windows 専用です。Windows 上で実行してください。'
    )
}

$sourceRoot = Get-NormalizedFullPath -Path (Split-Path -Parent $PSScriptRoot)

# 1. コピー元が Documents 配下にあることを確認する。
# 関数の戻り値は展開されるため、@() で必ず配列として受け取る。
$documentsCandidates = @(Get-DocumentsRootCandidate)
$documentsRoot = $null
foreach ($candidate in $documentsCandidates) {
    if (-not (Test-IsChildPath -Candidate $sourceRoot -Parent $candidate)) {
        continue
    }

    # Documents 候補が入れ子の場合は、より深く一致した方を採用する。
    if ($null -eq $documentsRoot -or $candidate.Length -gt $documentsRoot.Length) {
        $documentsRoot = $candidate
    }
}

if ($null -eq $documentsRoot) {
    $detail = @("ワークスペース: $sourceRoot", '', 'この環境で認識した Documents:')
    if ($documentsCandidates.Count -gt 0) {
        foreach ($candidate in $documentsCandidates) {
            $detail += "  - $candidate"
        }
    }
    else {
        $detail += '  - （検出できませんでした）'
    }

    Stop-ScriptWithAlert -Reason 'ワークスペースが Documents 配下にありません。' -Detail $detail -Action @(
        'このコピーは Documents 配下の階層を Dropbox 側にそのまま再現するため、',
        'Documents 配下にないワークスペースからは実行できません。',
        '',
        "ワークスペースを Documents 配下（例: $(if ($documentsCandidates.Count -gt 0) { $documentsCandidates[0] } else { '<Documents>' })\Git\my-project）へ",
        '移してから、もう一度実行してください。'
    )
}

# 2. Dropbox ルートを決める。明示指定 > %USERPROFILE%\Dropbox > Dropbox クライアントの info.json。
$dropboxRootSource = ''
if (-not [string]::IsNullOrWhiteSpace($DestinationRoot)) {
    $dropboxRoot = Get-NormalizedFullPath -Path $DestinationRoot
    $dropboxRootSource = '-DestinationRoot で指定'
}
else {
    $dropboxRoot = $null

    if (-not [string]::IsNullOrWhiteSpace($env:USERPROFILE)) {
        $defaultDropboxRoot = Get-NormalizedFullPath -Path (Join-Path $env:USERPROFILE 'Dropbox')
        if (Test-Path -LiteralPath $defaultDropboxRoot -PathType Container) {
            $dropboxRoot = $defaultDropboxRoot
            $dropboxRootSource = '%USERPROFILE%\Dropbox'
        }
    }

    if ($null -eq $dropboxRoot) {
        $dropboxRoot = Get-DropboxRootFromInfoJson
        if ($null -ne $dropboxRoot) {
            $dropboxRootSource = 'Dropbox の info.json'
        }
    }

    if ($null -eq $dropboxRoot) {
        Stop-ScriptWithAlert -Reason 'Dropbox フォルダーの場所を特定できませんでした。' -Detail @(
            "探索した場所: $(if ($env:USERPROFILE) { Join-Path $env:USERPROFILE 'Dropbox' } else { '%USERPROFILE%\Dropbox' })",
            '              Dropbox クライアントの info.json'
        ) -Action @(
            'Dropbox のルートを明示して実行してください。',
            '  .\scripts\copy-workspace-to-dropbox.ps1 -DestinationRoot "D:\Dropbox"'
        )
    }
}

if (-not (Test-Path -LiteralPath $dropboxRoot -PathType Container)) {
    Stop-ScriptWithAlert -Reason 'Dropbox のルートディレクトリが存在しません。' -Detail @(
        "指定されたルート: $dropboxRoot"
    ) -Action @(
        'パスを確認するか、-DestinationRoot で正しいルートを指定してください。'
    )
}

# 3. Documents からの相対パスを Dropbox 側へそのまま再現する。
$relativePath = $sourceRoot.Substring($documentsRoot.Length + 1)
$destinationPath = Get-NormalizedFullPath -Path (Join-Path $dropboxRoot $relativePath)

if ($destinationPath -ieq $dropboxRoot -or
    -not (Test-IsChildPath -Candidate $destinationPath -Parent $dropboxRoot)) {
    Stop-ScriptWithAlert -Reason '導出したコピー先が Dropbox ルートの外に出ました。' -Detail @(
        "Dropbox ルート: $dropboxRoot",
        "コピー先:       $destinationPath"
    )
}

if ($destinationPath -ieq $sourceRoot) {
    Write-Host "[OK] コピー元とコピー先が同じため、処理は不要です: $destinationPath"
    exit 0
}

if ((Test-IsChildPath -Candidate $destinationPath -Parent $sourceRoot) -or
    (Test-IsChildPath -Candidate $sourceRoot -Parent $destinationPath)) {
    Stop-ScriptWithAlert -Reason 'コピー元とコピー先が親子関係になりました。' -Detail @(
        "コピー元: $sourceRoot",
        "コピー先: $destinationPath"
    ) -Action @(
        '再帰コピーを防ぐため中止しました。Dropbox ルートの指定を見直してください。'
    )
}

$excludedDirectories = @(
    '.agents',
    '.claude\skills',
    'node_modules',
    'vendor',
    'dist',
    'build',
    'coverage',
    '.cache',
    '.parcel-cache',
    '.next',
    '.nuxt',
    '.turbo',
    '.pnpm-store',
    '.yarn\cache',
    '.gradle',
    '.venv',
    'venv',
    '__pycache__',
    '.pytest_cache',
    '.mypy_cache',
    '.ruff_cache',
    '.tox',
    '.wrangler',
    'target',
    'tmp',
    'temp'
)

$excludedFiles = @(
    '.DS_Store',
    'Thumbs.db',
    '*.log',
    '*.tmp',
    '*.temp',
    '*.pyc',
    '*.pyo',
    '.eslintcache',
    'index.lock',
    'config.lock',
    'HEAD.lock',
    'packed-refs.lock',
    'shallow.lock',
    'gc.log'
)

$arguments = @(
    $sourceRoot,
    $destinationPath,
    '/E',
    '/COPY:DAT',
    '/DCOPY:DAT',
    '/R:2',
    '/W:1',
    '/XJ',
    '/FFT',
    '/NP',
    '/NFL',
    '/NDL',
    '/XD'
) + $excludedDirectories + @('/XF') + $excludedFiles

Write-Host "Documents:   $documentsRoot"
Write-Host "Source:      $sourceRoot"
Write-Host "Dropbox:     $dropboxRoot ($dropboxRootSource)"
Write-Host "Destination: $destinationPath"
Write-Host "Relative:    $relativePath"

if ($Clean) {
    Write-Host 'Mode:        clean copy; the destination directory is removed first'

    $existingDestination = Get-Item -LiteralPath $destinationPath -Force -ErrorAction SilentlyContinue
    if ($null -ne $existingDestination) {
        $hasLinkType = $existingDestination.PSObject.Properties.Name -contains 'LinkType'
        $isLink = $hasLinkType -and -not [string]::IsNullOrEmpty([string]$existingDestination.LinkType)
        if ($isLink) {
            Stop-ScriptWithAlert -Reason 'コピー先が symlink または junction のため、クリーン削除を拒否しました。' -Detail @(
                "コピー先: $destinationPath"
            )
        }

        $resolvedDestination = Get-NormalizedFullPath -Path (Resolve-Path -LiteralPath $destinationPath).ProviderPath
        $resolvedDropboxRoot = Get-NormalizedFullPath -Path (Resolve-Path -LiteralPath $dropboxRoot).ProviderPath
        if ($resolvedDestination -ieq $resolvedDropboxRoot -or
            -not (Test-IsChildPath -Candidate $resolvedDestination -Parent $resolvedDropboxRoot)) {
            Stop-ScriptWithAlert -Reason '解決後のコピー先が Dropbox ルートの外にあるため、クリーン削除を拒否しました。' -Detail @(
                "Dropbox ルート: $resolvedDropboxRoot",
                "コピー先:       $resolvedDestination"
            )
        }

        Write-Host "Removing:    $resolvedDestination"
        Remove-Item -LiteralPath $resolvedDestination -Recurse -Force
    }
}
else {
    Write-Host 'Mode:        overwrite copy; destination-only files are kept'
}

& robocopy.exe @arguments
$robocopyExitCode = $LASTEXITCODE

# robocopy の 0～7 は成功または差分あり、8 以上は失敗。
if ($robocopyExitCode -ge 8) {
    Stop-ScriptWithAlert -Reason "robocopy.exe が終了コード $robocopyExitCode で失敗しました。" -Action @(
        '上のログでエラー行を確認してください。'
    )
}

Write-Host "[OK] ワークスペースをコピーしました (robocopy exit code $robocopyExitCode)。"
Write-Warning 'このコピーは世代管理バックアップではありません。重要データには別のバックアップも用意してください。'
