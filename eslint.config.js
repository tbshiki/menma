import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: ["dist/**", "node_modules/**", "coverage/**", "docs/archive/**"],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["src/**/*.ts"],
    languageOptions: {
      globals: globals.browser,
    },
    rules: {
      // 本番ビルドに console を残さない（FR-23）。出力は utils/log.ts に集約する。
      "no-console": "error",
    },
  },
  {
    files: ["tests/**/*.ts", "*.config.ts", "*.config.js"],
    languageOptions: {
      globals: globals.node,
    },
  },
);
