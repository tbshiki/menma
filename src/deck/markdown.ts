import MarkdownIt, { type RendererRule } from "markdown-it";

/**
 * Markdown から HTML への変換（設計 8 章）。
 *
 * raw HTML は既定で無効。`innerHTML` へ渡すのはこの関数が返した文字列だけに限る（FR-19）。
 * 型は markdown-it に同梱されているものを使う（別途 @types を入れない）。
 */

export type MarkdownRenderer = (markdown: string) => string;

export type MarkdownOptions = {
  /** 外部リンクを別タブで開くか（FR-20） */
  externalLinksNewTab: boolean;
};

/** スキーム付き、またはスキーム相対の URL を外部リンクとみなす */
const EXTERNAL_LINK = /^(https?:)?\/\//i;

export function createMarkdownRenderer(options: MarkdownOptions): MarkdownRenderer {
  const md = new MarkdownIt({
    html: false,
    linkify: true,
    typographer: false,
    breaks: false,
  });

  if (options.externalLinksNewTab) {
    const renderToken: RendererRule = (tokens, index, opts, _env, self) =>
      self.renderToken(tokens, index, opts);
    const defaultRule: RendererRule = md.renderer.rules["link_open"] ?? renderToken;

    md.renderer.rules["link_open"] = (tokens, index, opts, env, self) => {
      const token = tokens[index];
      const href = String(token?.attrGet("href") ?? "");

      if (token && EXTERNAL_LINK.test(href)) {
        token.attrSet("target", "_blank");
        token.attrSet("rel", "noopener noreferrer");
      }

      return defaultRule(tokens, index, opts, env, self);
    };
  }

  return (markdown: string): string => md.render(markdown);
}
