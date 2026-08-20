import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

/**
 * 配信時のセキュリティヘッダ（D-25）を機械的に守る。
 *
 * `public/_headers` は Cloudflare だけが解釈するファイルで、ビルドもテストも通らない。
 * ディレクティブを 1 つ消しても手元では何も起きず、本番の防御だけが静かに外れる。
 * ここで、消えると困るものと、入っていると困るものの両方を検査する。
 */
const HEADERS_FILE = fileURLToPath(new URL("../../public/_headers", import.meta.url));

/**
 * `_headers` から 1 ルール分のヘッダを読む。
 * パターン行（インデントなし）に続く、インデントされた `名前: 値` の行がそのルールの中身。
 */
function readRule(pattern: string): Map<string, string> {
  const lines = readFileSync(HEADERS_FILE, "utf8").split(/\r?\n/);
  const headers = new Map<string, string>();
  let inRule = false;

  for (const line of lines) {
    if (line.trim() === "" || line.trimStart().startsWith("#")) continue;

    const isIndented = /^\s/.test(line);

    if (!isIndented) {
      inRule = line.trim() === pattern;
      continue;
    }

    if (!inRule) continue;

    const separator = line.indexOf(":");
    if (separator === -1) continue;

    const name = line.slice(0, separator).trim().toLowerCase();
    headers.set(name, line.slice(separator + 1).trim());
  }

  return headers;
}

describe("配信時のセキュリティヘッダ", () => {
  const headers = readRule("/*");

  it("全パスへ適用するルールがある", () => {
    expect(headers.size).toBeGreaterThan(0);
  });

  it.each([
    "content-security-policy",
    "strict-transport-security",
    "x-content-type-options",
    "x-frame-options",
    "referrer-policy",
    "permissions-policy",
  ])("%s が定義されている", (name) => {
    expect(headers.get(name)).toBeTruthy();
  });

  describe("CSP", () => {
    const csp = headers.get("content-security-policy") ?? "";

    it.each([
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self'",
      "object-src 'none'",
      "base-uri 'none'",
      "frame-ancestors 'none'",
    ])("%s を指定している", (directive) => {
      expect(csp).toContain(directive);
    });

    // 色や背景画像は style.setProperty() で当てており、インラインの style / script を
    // 生成しない（設計 12 章）。緩める必要が出たら、まず実装側を疑う。
    it.each(["'unsafe-inline'", "'unsafe-eval'"])("%s を許可しない", (keyword) => {
      expect(csp).not.toContain(keyword);
    });

    // ここを 'self' だけに絞ると記法仕様 9 章と D-20 の機能が壊れる。
    it.each([
      ["https:", "https:// の絶対 URL 画像（記法仕様 9 章）"],
      ["blob:", "取り込んだ画像の blob URL（D-20）"],
      ["data:", "データ URI の画像"],
    ])("img-src が %s を許可している（%s）", (scheme) => {
      const imgSrc = /img-src ([^;]+)/.exec(csp)?.[1] ?? "";

      expect(imgSrc).toContain(scheme);
    });
  });

  it("HSTS の有効期間が 1 年以上ある", () => {
    const maxAge = /max-age=(\d+)/.exec(headers.get("strict-transport-security") ?? "")?.[1];

    expect(Number(maxAge)).toBeGreaterThanOrEqual(31536000);
  });
});
