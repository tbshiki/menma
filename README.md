# menma

Markdown を書いてブラウザでそのまま発表できる、軽量な Web スライドシステム。

`slides.md` を書き、ビルドした静的ファイルを公開すれば、その URL のまま登壇できる。GUI のプレゼンテーションツールの置き換えではなく、Markdown とブラウザの間に必要最小限のプレゼンテーション層を置くことを目的としている。

- Markdown を中心に資料を書き、Git で履歴管理・レビューできる
- 静的サイトとして公開でき、キーボードだけで発表できる
- 依存を少なく保ち、HTML / CSS の知識があればデザインを拡張できる

Vite + TypeScript + markdown-it + CSS で実装している（パッケージマネージャーは pnpm）。

## ドキュメント

- [docs/](docs/) — 全文書の索引と読み分け
- [要件定義](docs/requirements.md) — 何を作り、何を作らないか
- [記法仕様](docs/spec-markdown.md) — 原稿の書き方
- [ロードマップ](docs/roadmap.md) — マイルストーンと開発状況
- [開発環境](docs/development.md) — セットアップとコマンド
