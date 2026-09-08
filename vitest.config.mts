import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@cg/contracts": resolve(__dirname, "shared/contracts/src/index.ts"),
      "@cg/engine": resolve(__dirname, "client/packages/engine/src/index.ts"),
      "@cg/battle": resolve(__dirname, "shared/battle/src/index.ts"),
      "@cg/meta": resolve(__dirname, "shared/meta/src/index.ts"),
    },
  },
  test: {
    environment: "node",
    // Server tests hit the real schema, just never the real file
    env: { DB_PATH: ":memory:" },
    include: ["client/**/*.test.ts", "shared/**/*.test.ts", "server/**/*.test.ts"],
  },
});
