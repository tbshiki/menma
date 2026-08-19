import { DeckError } from "./errors";
import { DEFAULT_DECK_META, type DeckMeta, type DeckWarning } from "./types";

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

const STRING_KEYS = ["title", "author", "lang", "theme"] as const;
const BOOLEAN_KEYS = ["showPageNumber", "showControls", "externalLinksNewTab"] as const;
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

  if (lines.length === 0 || !DELIMITER.test(lines[0] ?? "")) {
    return { meta, body: source, bodyStartLine: 1, warnings };
  }

  const closingIndex = lines.findIndex((line, index) => index > 0 && DELIMITER.test(line));

  if (closingIndex === -1) {
    throw new DeckError("Front Matter が --- で閉じられていません。", {
      userMessage: "スライドを読み込めませんでした。",
      line: 1,
    });
  }

  for (let index = 1; index < closingIndex; index += 1) {
    const line = lines[index] ?? "";
    const lineNumber = index + 1;
    const entry = parseEntry(line);

    if (entry === "skip") {
      continue;
    }

    if (entry === "invalid") {
      warnings.push({
        kind: "invalid-type",
        message: `Front Matter の ${lineNumber} 行目を解釈できません。key: value の形式で書いてください。`,
        line: lineNumber,
      });
      continue;
    }

    applyEntry(meta, entry, lineNumber, warnings);
  }

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

    if (char === "#") {
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
