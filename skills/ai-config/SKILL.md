---
name: ai-config
description: Codex と Claude Code の共通指示、スキル、権限、symlink 設定を安全に変更・点検するときに使う。
---

# AI 設定の変更

1. `git status --short` で既存変更を確認する。
2. 共通指示は `AGENTS.md`、再利用可能な手順は `skills/` だけを正典として編集する。
3. `CLAUDE.md` は `@AGENTS.md` の import を維持する。
4. `.agents/skills` と `.claude/skills` の内容を直接編集しない。
5. スキルを追加・削除したら、`AGENTS.md` の `skills:table` マーカー内の表も同時に更新する。ヘルスチェックが実体と表を双方向に突き合わせるため、片方だけだと FAIL する。
6. 権限は最小限に保ち、秘密情報と破壊的・公開操作を自動許可しない。
7. 秘密情報の保護対象を変えるときは、`.gitignore`（コミット防止）、`.claude/settings.json` の `permissions.deny`（Read ツール）、`.claude/hooks/deny-secret-file-access.ps1`（シェルコマンド）の**3箇所を揃える**。1箇所だけ変えると、経路によって守られたり守られなかったりする。
8. ガードレール（`.claude/`、`AGENTS.md`、`.gitignore` など）の編集は自動許可されない。人間の承認を得てから変更し、**依頼された作業の副作用として権限を緩めない**。緩める必要があるなら理由を示して個別に確認する。
9. `*.ps1` を新規作成・編集したら、UTF-8 BOM 付き・CRLF で保存されていることを確認する。エディタやAIの書き込みは `.editorconfig` を適用しないため、BOM が落ちると Windows PowerShell 5.1 で日本語が壊れる。
10. PowerShell からテキストを読む処理には `-Encoding UTF8` を明示する。既定エンコーディングでは行が結合し、行単位の判定が FAIL も出さずに外れる。
11. `scripts/sync-ai-symlinks.ps1` でリンクを同期する。
12. `scripts/check-ai-config.ps1` と `git diff --check` を実行する。
13. 検査や hook を変更したときは、**意図的に壊して FAIL が出ることまで確認する。** 全項目 OK は、検査が通ったのか空振りしたのかを区別しない。hook は拒否側だけでなく誤検知側（`*.example`、`*.pub`、`process.env`、通常ファイルの `allow`）も確認する。
14. 失敗した確認、環境依存の制約、残るリスクを報告する。
