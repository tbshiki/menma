import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

/**
 * deck/ は DOM に触らない純粋層である、という設計上の境界（設計 3 章）を機械的に守る。
 * 破ると単体テストが node 環境で落ちるが、落ちる前にここで理由付きで気付けるようにしておく。
 */
const DECK_DIR = fileURLToPath(new URL("../../src/deck", import.meta.url));
const DOM_GLOBALS = /\b(document|window|navigator|location|HTMLElement)\b/;

describe("deck 層の純粋性", () => {
  const files = readdirSync(DECK_DIR).filter((name) => name.endsWith(".ts"));

  it("対象ファイルを列挙できる", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(files)("%s が DOM API を参照しない", (name) => {
    const source = readFileSync(`${DECK_DIR}/${name}`, "utf8");

    expect(source).not.toMatch(DOM_GLOBALS);
  });

  it.each(files)("%s が view / navigation を import しない", (name) => {
    const source = readFileSync(`${DECK_DIR}/${name}`, "utf8");

    expect(source).not.toMatch(/from\s+"\.\.\/(view|navigation)\//);
  });
});
