---
name: qa
description: プロジェクト固有の QA 方法が未確定なリポジトリで、利用可能な検証コマンドを調査し段階的に実行するときに使う。
---

# QA の調査と実行

## このリポジトリで使えるコマンド

軽い順に並べる。上から順に、変更の影響範囲に応じて実行する。

| コマンド | 種別 | 備考 |
| --- | --- | --- |
| `git diff --check` | 差分の空白・改行チェック | |
| `pnpm typecheck` | 型検査 | `tsc --noEmit` |
| `pnpm lint` | 静的解析 | ESLint（flat config） |
| `pnpm format:check` | 整形チェック | Prettier。対象はコードのみ（`*.md` と `.claude/` は除外） |
| `pnpm test` | 単体テスト | Vitest。`tests/unit/**/*.test.ts` |
| `pnpm build` | 本番ビルド | Vite。成果物は `dist/` |
| `powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\check-ai-config.ps1` | AI 設定のヘルスチェック | AI 設定・スキル・権限・hook・`*.ps1` の BOM を検証する |

補助コマンド: `pnpm dev`（開発サーバ）、`pnpm preview`（ビルド結果の確認）、`pnpm test:watch`、`pnpm format`（自動整形）。

> E2E（`pnpm test:e2e`）は `docs/roadmap.md` の M2 で Playwright を導入した時点で上の表へ追加する。**まだ存在しないので実行しない。**

**調査の結果、恒常的に使える検証手段が判明したらこの表へ追記する。** 次回以降のゼロからの再調査を避けるため。追記するのは、リポジトリに定義済みで再現性のあるコマンドだけとする。その場限りの一時コマンドは載せない。

## 表に無い場合の調査手順

1. `README*`、`package.json`、`composer.json`、`Makefile`、CI 設定などを `rg --files` で探す。
2. ドキュメントと設定に明記された lint、format check、typecheck、test、build コマンドを抽出する。
3. 存在しないスクリプト、ツール、オプションを推測で実行しない。
4. 構文や設定の確認から始め、対象テスト、静的解析、全体テスト、ビルドの順に影響範囲に応じて実行する。
5. 自動修正コマンドは意図しない差分を生むため、必要性を確認してから使う。
6. 恒常的に使えると判断したコマンドを上の表へ追記する。
7. 実行したコマンドと結果、実行できなかった検証と理由、残るリスクを報告する。
