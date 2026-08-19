import { defineConfig } from "vitest/config";

// サブディレクトリ配信に備えて、ベースパスを環境変数で切り替えられるようにする。
// 例: MENMA_BASE=/slides/ pnpm build
const base = process.env["MENMA_BASE"] ?? "/";

export default defineConfig({
  base,
  build: {
    target: "es2022",
  },
  test: {
    // deck/ と utils/ は DOM を触らない純粋関数なので node 環境で足りる。
    // DOM を扱うテストが必要になったら、その時点で環境を追加する。
    environment: "node",
    include: ["tests/unit/**/*.test.ts"],
  },
});
