# menma ドキュメント

実装の正典はこの 5 つ。目的が違うので、更新するときも参照するときも使い分ける。

| 文書 | 何が書いてあるか | いつ読むか |
| --- | --- | --- |
| [requirements.md](./requirements.md) | 目的、スコープ、機能要件（FR-xx）、非機能要件（NFR-xx）、MVP 受け入れ条件 | 何を作るか確認するとき。実装の是非を判断するとき |
| [spec-markdown.md](./spec-markdown.md) | 原稿の書き方（Front Matter、スライド分割、`@slide` / `@aside` / `@notes`） | 記法に関わる実装をするとき。README を書くとき |
| [architecture.md](./architecture.md) | 内部モデル、モジュール構成、DOM とクラス名、CSS トークン、ナビゲーション、テスト戦略 | コードを書く直前 |
| [roadmap.md](./roadmap.md) | マイルストーン M0〜M7、タスク、完了条件 | 次に何をやるか決めるとき |
| [decisions.md](./decisions.md) | 確定した設計判断とその理由、未決事項、発表後の評価ログ | 「なぜこうなっているか」を知りたいとき。方針を変えたいとき |

手順書（正典ではない）

| 文書 | 何が書いてあるか |
| --- | --- |
| [writing-slides.md](./writing-slides.md) | 原稿を書く人向けのガイド。記法の使い方とつまずきどころ。**menma 記法で書いてあり、入口画面から「マニュアルを見る」でスライドとして開ける**（[D-26](./decisions.md)）。直すときは記法を壊さないこと（`tests/unit/manual.test.ts` が検査する） |
| [development.md](./development.md) | セットアップ、コマンド、生成物、AI 開発基盤の構成と注意点 |

## 更新のルール

- **仕様を変えるときは、コードより先にこの `docs/` を更新する。** docs とコードが食い違ったまま進めない
- 判断を変えたときは `decisions.md` へ理由ごと追記する。決定の履歴を消さない
- **記法を変えたときは `spec-markdown.md` と `writing-slides.md` の両方を直す。** 正典は `spec-markdown.md`、`writing-slides.md` はその利用者向けの言い換え。人はスライド（`writing-slides.md`）、AI は正典（`spec-markdown.md`）を読むため、片方だけ直すと参照先で説明が食い違う（[D-26](./decisions.md)）
- **進捗は `roadmap.md` の一覧表だけで管理する。** README や他の文書へ書かない
- 未決事項（`decisions.md` の Q-xx）は AI が勝手に確定しない。ユーザーへ確認する

## 参考

- [archive/2026-08-19-initial-concept.md](./archive/2026-08-19-initial-concept.md) — 構想段階のメモ。**正典ではない**（経緯の確認用）
