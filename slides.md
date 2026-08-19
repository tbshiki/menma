---
title: menma
author: tbshiki
lang: ja
theme: default
showPageNumber: true
---

@slide layout=cover

# menma

Markdown を書いて、ブラウザで発表する。

---

# これは何か

- Markdown ファイル 1 枚がそのままスライドになる
- Git で履歴を管理し、静的サイトとして公開できる
- キーボードだけで発表できる

---

@slide layout=center

# 1 スライド 1 メッセージ

---

# コード

```ts
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
```

---

# 表

| 記法 | 用途 |
| --- | --- |
| `---` | スライドの区切り |
| `@slide` | レイアウトなどの指定 |
| `@aside` | 本文と補助領域の分割 |

@notes

発表者ノートは画面に出ない。M0 の時点では原稿をそのまま表示しているので、ここも見えている。

---

# ここまで

続きは `docs/roadmap.md` のとおり実装する。
