---
title: menma
author: tbshiki
lang: ja
theme: default
showPageNumber: true
showControls: true
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

@slide layout=split

# 左右に分ける

`@aside` から先が右側になる。図や補足を並べたいときに使う。

@aside

![Markdown から HTML を経てスライドになる流れ](/assets/sample-diagram.svg)

---

@slide layout=image-left

# 画像を左へ

`image-left` は補助部を左、本文を右に置く。`image-right` はその逆。

@aside

![Markdown から HTML を経てスライドになる流れ](/assets/sample-diagram.svg)

---

@slide layout=quote

> 迷ったら、Markdown が読みやすいほうを選ぶ。

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

発表者ノートは画面にも HTML にも出ない。M4 以降で発表者モードから使う。

---

@slide layout=blank

---

@slide layout=center backgroundColor=#101418 foreground=#f2f5f8

# ここまで

続きは [ロードマップ](https://example.com/roadmap) のとおり。
