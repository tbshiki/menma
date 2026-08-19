import { DeckError } from "./errors";
import { createMarkdownRenderer } from "./markdown";
import { parseDirectives } from "./parseDirectives";
import { parseFrontMatter } from "./parseFrontMatter";
import { splitSlides } from "./splitSlides";
import type { Deck, DeckWarning, Slide } from "./types";

/**
 * 原稿 1 本を Deck へ変換する（設計 1 章のパイプライン）。
 *
 * 記法の誤りは警告として集め、回復不能な場合だけ DeckError を投げる。
 */
export function parseDeck(source: string): Deck {
  const normalized = normalize(source);
  const frontMatter = parseFrontMatter(normalized);
  const rawSlides = splitSlides(frontMatter.body, frontMatter.bodyStartLine);

  if (rawSlides.length === 0) {
    throw new DeckError("原稿にスライドが 1 枚もありません。", {
      userMessage: "表示できるスライドがありません。",
    });
  }

  const render = createMarkdownRenderer({
    externalLinksNewTab: frontMatter.meta.externalLinksNewTab,
  });
  const warnings: DeckWarning[] = [...frontMatter.warnings];

  const slides: Slide[] = rawSlides.map((raw, index) => {
    const directives = parseDirectives(raw);
    warnings.push(...directives.warnings);

    return {
      index,
      source: raw.source,
      html: render(directives.main),
      asideHtml: directives.aside === undefined ? undefined : render(directives.aside),
      // ノートは Markdown のまま保持する。MVP では描画も HTML 出力もしない（決定 D-10）
      notes: directives.notes,
      layout: directives.layout,
      classes: directives.classes,
      background: directives.background,
      backgroundColor: directives.backgroundColor,
      foreground: directives.foreground,
    };
  });

  return { meta: frontMatter.meta, slides, warnings };
}

/** BOM と改行コードの揺れを取り除く。以降の処理は LF だけを前提にする */
function normalize(source: string): string {
  return source.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
}
