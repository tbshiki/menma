import { FenceTracker } from "./fence";
import type { RawSlide } from "./types";

/**
 * 本文をスライドへ分割する（記法仕様 2 章）。
 *
 * 区切りと認めるのは、行頭から `---` だけが並ぶ単独行のうち、
 * - コードフェンスの外にあり
 * - 直前の行が空である（直前が非空なら Markdown のセットアップ見出しになるため）
 * もの。`***` と `___` は水平線として本文に残す（決定 D-13）。
 */
const SEPARATOR = /^ {0,3}-{3,}\s*$/;

export function splitSlides(body: string, bodyStartLine: number): RawSlide[] {
  const lines = body.split("\n");
  const fence = new FenceTracker();
  const inFence = lines.map((line) => fence.read(line));

  const chunks: { lines: string[]; startLine: number }[] = [];
  let current: string[] = [];
  let currentStartLine = bodyStartLine;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    const previous = index > 0 ? (lines[index - 1] ?? "") : "";
    // 直前がコードフェンスの終了行なら、その次の `---` は見出しにならないので区切りとして扱う
    const afterFence = index > 0 && (inFence[index - 1] ?? false);
    const isSeparator =
      !(inFence[index] ?? false) &&
      SEPARATOR.test(line) &&
      (index === 0 || previous.trim() === "" || afterFence);

    if (isSeparator) {
      chunks.push({ lines: current, startLine: currentStartLine });
      current = [];
      currentStartLine = bodyStartLine + index + 1;
      continue;
    }

    current.push(line);
  }

  chunks.push({ lines: current, startLine: currentStartLine });

  return chunks.map(toRawSlide).filter((slide): slide is RawSlide => slide !== undefined);
}

/** 前後の空行を落とす。中身が無くなったスライドは捨てる（記法仕様 2 章） */
function toRawSlide(chunk: { lines: string[]; startLine: number }): RawSlide | undefined {
  let start = 0;
  let end = chunk.lines.length;

  while (start < end && (chunk.lines[start] ?? "").trim() === "") {
    start += 1;
  }
  while (end > start && (chunk.lines[end - 1] ?? "").trim() === "") {
    end -= 1;
  }

  if (start === end) {
    return undefined;
  }

  return {
    source: chunk.lines.slice(start, end).join("\n"),
    startLine: chunk.startLine + start,
  };
}
