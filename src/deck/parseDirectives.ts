import { FenceTracker } from "./fence";
import { SLIDE_LAYOUTS, type DeckWarning, type RawSlide, type SlideLayout } from "./types";

/**
 * スライド内のディレクティブを解釈する（記法仕様 4〜6 章）。
 *
 * 解釈するのは行頭 `@` の 3 つだけ。
 * - `@slide`: 最初の非空行にある場合のみ、そのスライドの表示属性
 * - `@aside`: 単独行。以降が補助部
 * - `@notes`: 単独行。以降が発表者ノート
 */

export type DirectiveResult = {
  layout: SlideLayout;
  classes: string[];
  background: string | undefined;
  backgroundColor: string | undefined;
  foreground: string | undefined;
  /** 主要部の Markdown */
  main: string;
  /** 補助部の Markdown（`@aside` 以降） */
  aside: string | undefined;
  /** 発表者ノートの Markdown（`@notes` 以降） */
  notes: string | undefined;
  warnings: DeckWarning[];
};

const SLIDE_DIRECTIVE = /^@slide\b(.*)$/;
const ASIDE_DIRECTIVE = /^@aside\s*$/;
const NOTES_DIRECTIVE = /^@notes\s*$/;

const CLASS_NAME = /^[A-Za-z0-9_-]+$/;
/** 構造クラスと衝突させないため、内部で使う接頭辞は原稿から指定できない */
const RESERVED_CLASS_PREFIX = "mn-";
const ATTRIBUTE_NAMES = ["layout", "class", "background", "backgroundColor", "foreground"] as const;

export function parseDirectives(slide: RawSlide): DirectiveResult {
  const lines = slide.source.split("\n");
  const warnings: DeckWarning[] = [];

  const fence = new FenceTracker();
  /** コードフェンスの外にある行だけがディレクティブになりうる */
  const isPlain = lines.map((line) => !fence.read(line));

  const mainLines: string[] = [];
  const asideLines: string[] = [];
  const notesLines: string[] = [];

  let attributes: AttributeResult | undefined;
  let seenContent = false;
  let section: "main" | "aside" | "notes" = "main";

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    const lineNumber = slide.startLine + index;
    const plain = isPlain[index] ?? false;

    if (plain && section !== "notes") {
      const slideMatch = SLIDE_DIRECTIVE.exec(line);

      if (slideMatch) {
        if (!seenContent && !attributes) {
          attributes = parseAttributes(slideMatch[1] ?? "", lineNumber, warnings);
          continue;
        }
        warnings.push({
          kind: "duplicate-directive",
          message: "@slide はスライドの最初の行に 1 つだけ書けます。この行は本文として表示します。",
          line: lineNumber,
        });
      }

      if (ASIDE_DIRECTIVE.test(line)) {
        if (section === "main") {
          section = "aside";
          continue;
        }
        warnings.push({
          kind: "duplicate-directive",
          message: "@aside は 1 スライドに 1 つだけ書けます。この行は本文として表示します。",
          line: lineNumber,
        });
      }

      if (NOTES_DIRECTIVE.test(line)) {
        section = "notes";
        continue;
      }
    }

    if (line.trim() !== "") {
      seenContent = true;
    }

    if (section === "main") {
      mainLines.push(line);
    } else if (section === "aside") {
      asideLines.push(line);
    } else {
      notesLines.push(line);
    }
  }

  return {
    layout: attributes?.layout ?? "default",
    classes: attributes?.classes ?? [],
    background: attributes?.background,
    backgroundColor: attributes?.backgroundColor,
    foreground: attributes?.foreground,
    main: trimBlankLines(mainLines),
    aside: asideLines.length > 0 ? orUndefined(trimBlankLines(asideLines)) : undefined,
    notes: notesLines.length > 0 ? orUndefined(trimBlankLines(notesLines)) : undefined,
    warnings,
  };
}

type AttributeResult = {
  layout: SlideLayout;
  classes: string[];
  background: string | undefined;
  backgroundColor: string | undefined;
  foreground: string | undefined;
};

/** `@slide` の後ろにある `name=value` の並びを読む */
function parseAttributes(rest: string, line: number, warnings: DeckWarning[]): AttributeResult {
  const result: AttributeResult = {
    layout: "default",
    classes: [],
    background: undefined,
    backgroundColor: undefined,
    foreground: undefined,
  };

  for (const token of tokenize(rest)) {
    const separator = token.indexOf("=");

    if (separator <= 0) {
      warnings.push({
        kind: "invalid-type",
        message: `@slide の属性は name=value の形式で書いてください（読めなかった指定: ${token}）。`,
        line,
      });
      continue;
    }

    const name = token.slice(0, separator);
    const value = unquote(token.slice(separator + 1));

    if (!isAttributeName(name)) {
      warnings.push({
        kind: "unknown-attribute",
        message: `@slide の ${name} は menma が知らない属性です。無視します。`,
        line,
      });
      continue;
    }

    switch (name) {
      case "layout": {
        if (isSlideLayout(value)) {
          result.layout = value;
        } else {
          warnings.push({
            kind: "unknown-layout",
            message: `layout=${value} は定義されていません。default で表示します。`,
            line,
          });
        }
        break;
      }
      case "class": {
        for (const className of value.split(/\s+/).filter((item) => item !== "")) {
          if (!CLASS_NAME.test(className)) {
            warnings.push({
              kind: "invalid-type",
              message: `class に使えるのは英数字とハイフン、アンダースコアだけです（無視した指定: ${className}）。`,
              line,
            });
            continue;
          }

          if (className.startsWith(RESERVED_CLASS_PREFIX)) {
            warnings.push({
              kind: "invalid-type",
              message: `${RESERVED_CLASS_PREFIX} で始まるクラス名は menma が使うため指定できません（無視した指定: ${className}）。`,
              line,
            });
            continue;
          }

          result.classes.push(className);
        }
        break;
      }
      default: {
        result[name] = value;
        break;
      }
    }
  }

  return result;
}

/** 空白区切り。ただし引用符の内側の空白は区切りにしない */
function tokenize(rest: string): string[] {
  const tokens: string[] = [];
  let current = "";
  let quote: '"' | "'" | undefined;

  for (const char of rest) {
    if (quote) {
      current += char;
      if (char === quote) {
        quote = undefined;
      }
      continue;
    }

    if (char === '"' || char === "'") {
      quote = char;
      current += char;
      continue;
    }

    if (/\s/.test(char)) {
      if (current !== "") {
        tokens.push(current);
        current = "";
      }
      continue;
    }

    current += char;
  }

  if (current !== "") {
    tokens.push(current);
  }

  return tokens;
}

function unquote(value: string): string {
  if (value.length >= 2) {
    const first = value[0];
    const last = value[value.length - 1];
    if ((first === '"' || first === "'") && first === last) {
      return value.slice(1, -1);
    }
  }
  return value;
}

function trimBlankLines(lines: string[]): string {
  let start = 0;
  let end = lines.length;

  while (start < end && (lines[start] ?? "").trim() === "") {
    start += 1;
  }
  while (end > start && (lines[end - 1] ?? "").trim() === "") {
    end -= 1;
  }

  return lines.slice(start, end).join("\n");
}

function orUndefined(value: string): string | undefined {
  return value === "" ? undefined : value;
}

function isAttributeName(name: string): name is (typeof ATTRIBUTE_NAMES)[number] {
  return (ATTRIBUTE_NAMES as readonly string[]).includes(name);
}

function isSlideLayout(value: string): value is SlideLayout {
  return (SLIDE_LAYOUTS as readonly string[]).includes(value);
}
