import { DeckError } from "./errors";
import { DEFAULT_DECK_META, THEMES, type DeckMeta, type DeckWarning } from "./types";

/**
 * Front Matter の解析（記法仕様 3 章）。
 *
 * フラットな `key: value` だけを解釈する。YAML ライブラリは使わない（決定 D-04）。
 */

export type FrontMatterResult = {
  meta: DeckMeta;
  /** Front Matter を取り除いた本文 */
  body: string;
  /** body の 1 行目が原稿の何行目にあたるか（1 始まり） */
  bodyStartLine: number;
  warnings: DeckWarning[];
};

const DELIMITER = /^---\s*$/;

const STRING_KEYS = ["title", "author", "lang", "pageBackground", "progressColor"] as const;
const BOOLEAN_KEYS = [
  "showPageNumber",
  "showControls",
  "showProgress",
  "externalLinksNewTab",
] as const;
/** 取りうる値が決まっているキー。MVP ではどちらも 1 種類しか受け付けない */
const ENUM_KEYS = {
  aspectRatio: ["16/9"],
  transition: ["none"],
} as const;

type StringKey = (typeof STRING_KEYS)[number];
type BooleanKey = (typeof BOOLEAN_KEYS)[number];
type EnumKey = keyof typeof ENUM_KEYS;

export function parseFrontMatter(source: string): FrontMatterResult {
  const lines = source.split("\n");
  const meta: DeckMeta = { ...DEFAULT_DECK_META };
  const warnings: DeckWarning[] = [];

  const withoutFrontMatter: FrontMatterResult = {
    meta,
    body: source,
    bodyStartLine: 1,
    warnings,
  };

  if (lines.length === 0 || !DELIMITER.test(lines[0] ?? "")) {
    return withoutFrontMatter;
  }

  const closingIndex = lines.findIndex((line, index) => index > 0 && DELIMITER.test(line));
  const contentEnd = closingIndex === -1 ? lines.length : closingIndex;
  const entries = lines.slice(1, contentEnd).map((line) => parseEntry(line));

  // 設定が 1 つも無い `---` は Front Matter ではなく、スライドの区切りとして書かれたもの。
  // 原稿を `---` で書き始めても 1 枚目が失われないようにする（記法仕様 3.2）。
  if (!entries.some((entry) => entry !== "skip" && entry !== "invalid")) {
    return withoutFrontMatter;
  }

  if (closingIndex === -1) {
    throw new DeckError("Front Matter が --- で閉じられていません。", {
      userMessage: "スライドを読み込めませんでした。",
      line: 1,
    });
  }

  entries.forEach((entry, offset) => {
    const lineNumber = offset + 2;

    if (entry === "skip") {
      return;
    }

    if (entry === "invalid") {
      warnings.push({
        kind: "invalid-type",
        message: `Front Matter の ${lineNumber} 行目を解釈できません。key: value の形式で書いてください。`,
        line: lineNumber,
      });
      return;
    }

    applyEntry(meta, entry, lineNumber, warnings);
  });

  return {
    meta,
    body: lines.slice(closingIndex + 1).join("\n"),
    bodyStartLine: closingIndex + 2,
    warnings,
  };
}

type Entry = { key: string; value: string };

function parseEntry(line: string): Entry | "skip" | "invalid" {
  const trimmed = line.trim();

  if (trimmed === "" || trimmed.startsWith("#")) {
    return "skip";
  }

  const separator = line.indexOf(":");
  if (separator === -1) {
    return "invalid";
  }

  const key = line.slice(0, separator).trim();
  if (key === "") {
    return "invalid";
  }

  return { key, value: normalizeValue(line.slice(separator + 1)) };
}

/** 引用符の外側にあるコメントを落とし、前後の空白と囲みの引用符を外す */
function normalizeValue(raw: string): string {
  let quote: '"' | "'" | undefined;
  let end = raw.length;

  for (let index = 0; index < raw.length; index += 1) {
    const char = raw[index];

    if (quote) {
      if (char === quote) {
        quote = undefined;
      }
      continue;
    }

    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }

    // コメントと認めるのは「前が空白」かつ「後ろが空白か行末」の # だけ。
    // `title: C# 入門` の # を値の一部として残し、`pageBackground: #101418` も色として扱うため
    if (char === "#" && isCommentStart(raw, index)) {
      end = index;
      break;
    }
  }

  const value = raw.slice(0, end).trim();

  if (value.length >= 2) {
    const first = value[0];
    const last = value[value.length - 1];
    if ((first === '"' || first === "'") && first === last) {
      return value.slice(1, -1);
    }
  }

  return value;
}

function applyEntry(meta: DeckMeta, entry: Entry, line: number, warnings: DeckWarning[]): void {
  const { key, value } = entry;

  if (isStringKey(key)) {
    meta[key] = value;
    return;
  }

  // テーマ名は用意してある CSS と対応している必要がある。
  // 知らない名前をそのまま通すと、変数が 1 つも定義されず読めない画面になる
  if (key === "theme") {
    if (!(THEMES as readonly string[]).includes(value)) {
      warnings.push({
        kind: "unknown-theme",
        message: `theme=${value} は用意されていません（使えるのは ${THEMES.join(" / ")}）。default で表示します。`,
        line,
      });
      return;
    }
    meta.theme = value;
    return;
  }

  if (isBooleanKey(key)) {
    const parsed = parseBoolean(value);
    if (parsed === undefined) {
      warnings.push({
        kind: "invalid-type",
        message: `${key} には true か false を指定してください（指定値: ${value}）。既定値を使います。`,
        line,
      });
      return;
    }
    meta[key] = parsed;
    return;
  }

  if (isEnumKey(key)) {
    const allowed: readonly string[] = ENUM_KEYS[key];
    if (!allowed.includes(value)) {
      warnings.push({
        kind: "invalid-type",
        message: `${key} に使えるのは ${allowed.join(" / ")} です（指定値: ${value}）。既定値を使います。`,
        line,
      });
      return;
    }
    // 許容値は 1 種類しかないため、既定値のままで正しい
    return;
  }

  warnings.push({
    kind: "unknown-key",
    message: `Front Matter の ${key} は menma が知らないキーです。無視します。`,
    line,
  });
}

function parseBoolean(value: string): boolean | undefined {
  const normalized = value.toLowerCase();
  if (normalized === "true") {
    return true;
  }
  if (normalized === "false") {
    return false;
  }
  return undefined;
}

function isStringKey(key: string): key is StringKey {
  return (STRING_KEYS as readonly string[]).includes(key);
}

function isBooleanKey(key: string): key is BooleanKey {
  return (BOOLEAN_KEYS as readonly string[]).includes(key);
}

function isEnumKey(key: string): key is EnumKey {
  return Object.hasOwn(ENUM_KEYS, key);
}

/**
 * その `#` がコメントの始まりかを判定する。
 *
 * 前が行頭か空白で、後ろが空白か行末のときだけコメントとみなす。
 * `#101418` のように文字が続くものは値の一部（色など）として残す。
 */
function isCommentStart(raw: string, index: number): boolean {
  const before = index === 0 ? " " : (raw[index - 1] ?? "");
  const after = raw[index + 1];

  return /\s/.test(before) && (after === undefined || /\s/.test(after));
}
