#Requires -Version 5.1

# ルートの skills/ を正典とし、Codex 用の .agents/skills と Claude Code 用の .claude/skills を
# 相対 symlink として生成する。Windows 専用。
#
# このスクリプトは .vscode/tasks.json の runOn: folderOpen で自動実行されるため、
# 失敗時は生の例外ではなく、理由と対処を示すアラートを表示して終了コード 1 で止まる。

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version 2.0

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
    Write-Host ' [NG] AI スキル symlink の同期を中止しました' -ForegroundColor Red
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

# PowerShell 5.1 には $IsWindows が無いため、両方で判定できる方法を使う。
if ([Environment]::OSVersion.Platform -ne [PlatformID]::Win32NT) {
    Stop-ScriptWithAlert -Reason 'このスクリプトは Windows 専用です。' -Detail @(
        "検出したプラットフォーム: $([Environment]::OSVersion.Platform)"
    ) -Action @(
        'macOS / Linux では、リポジトリのルートで次を実行すると同等のリンクを作れます。',
        '  mkdir -p .agents .claude',
        '  ln -s ../skills .agents/skills',
        '  ln -s ../skills .claude/skills'
    )
}

if (-not ('AiWorkspaceSymlink' -as [type])) {
    Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public static class AiWorkspaceSymlink {
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    public static extern bool CreateSymbolicLinkW(string linkPath, string targetPath, int flags);
}
"@
}

$root = Split-Path -Parent $PSScriptRoot
$skillsPath = Join-Path $root 'skills'

if (-not (Test-Path -LiteralPath $skillsPath -PathType Container)) {
    Stop-ScriptWithAlert -Reason '正典の skills ディレクトリがありません。' -Detail @(
        "探した場所: $skillsPath"
    ) -Action @(
        'リポジトリのルートに skills/ があることを確認してください。',
        'このスクリプトは skills/ を指すリンクを作るだけで、スキルの実体は作りません。'
    )
}

$links = @('.agents\skills', '.claude\skills')
# SYMBOLIC_LINK_FLAG_DIRECTORY | SYMBOLIC_LINK_FLAG_ALLOW_UNPRIVILEGED_CREATE
$flags = 0x1 -bor 0x2

foreach ($relativeLink in $links) {
    $linkPath = Join-Path $root $relativeLink
    $parentPath = Split-Path -Parent $linkPath
    $relativeTarget = '..\skills'

    if (-not (Test-Path -LiteralPath $parentPath -PathType Container)) {
        New-Item -ItemType Directory -Path $parentPath | Out-Null
    }

    $existing = Get-Item -LiteralPath $linkPath -Force -ErrorAction SilentlyContinue
    if ($null -ne $existing) {
        $hasLinkType = $existing.PSObject.Properties.Name -contains 'LinkType'
        $isSymbolicLink = $hasLinkType -and $existing.LinkType -eq 'SymbolicLink'
        if (-not $isSymbolicLink) {
            $existingKind = if ($existing.PSIsContainer) { '実ディレクトリ' } else { '通常ファイル' }
            if ($hasLinkType -and -not [string]::IsNullOrEmpty([string]$existing.LinkType)) {
                $existingKind = "$($existing.LinkType)"
            }

            Stop-ScriptWithAlert -Reason "$relativeLink が symlink ではありません。" -Detail @(
                "対象: $linkPath",
                "種別: $existingKind"
            ) -Action @(
                'データ保護のため、削除も上書きもせずに中止しました。',
                '中身が不要であることを自分で確認してから手動で退避または削除し、',
                'もう一度このスクリプトを実行してください。',
                '',
                'スキルの実体はルートの skills/ だけです。ここへ実ディレクトリを置くと',
                '正典が二重化するため、内容は skills/ へ統合してください。'
            )
        }

        $targetValue = [string](@($existing.Target)[0])
        $existingTargetPath = [IO.Path]::GetFullPath((Join-Path $parentPath $targetValue))
        $expectedTargetPath = [IO.Path]::GetFullPath($skillsPath)
        if ($existingTargetPath -eq $expectedTargetPath) {
            Write-Host "[OK] $relativeLink -> $relativeTarget"
            continue
        }

        # reparse point 自体だけを削除し、リンク先は変更しない。
        if ($existing.PSIsContainer) {
            [IO.Directory]::Delete($linkPath, $false)
        }
        else {
            [IO.File]::Delete($linkPath)
        }
    }

    $created = [AiWorkspaceSymlink]::CreateSymbolicLinkW($linkPath, $relativeTarget, $flags)
    if (-not $created) {
        $code = [Runtime.InteropServices.Marshal]::GetLastWin32Error()

        $action = @(
            'Windows の「設定 > システム > 開発者向け」で開発者モードを有効にしてください。',
            '管理者権限なしで symlink を作成するために必要です。',
            '組織管理端末では、管理者または管理部門の許可が必要な場合があります。',
            '',
            '有効にしたあと、次を実行して再同期します。',
            '  powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\sync-ai-symlinks.ps1'
        )
        if ($code -eq 87) {
            $action = @(
                'この Windows は非管理者での symlink 作成に対応していない可能性があります。',
                '管理者として起動した PowerShell で、もう一度このスクリプトを実行してください。'
            )
        }
        $action += @(
            '',
            'リンクを作れないままスキルのコピーや junction で代替しないでください。',
            '正典が二重化し、内容が食い違います。'
        )

        Stop-ScriptWithAlert -Reason "$relativeLink の symlink を作成できませんでした (Win32 error $code)。" -Detail @(
            "リンク: $linkPath",
            "リンク先: $relativeTarget"
        ) -Action $action
    }

    Write-Host "[OK] $relativeLink -> $relativeTarget"
}
