import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "server-only": path.resolve(__dirname, "src/test/empty.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    globalSetup: ["src/test/global-setup.ts"],
    env: { DATABASE_URL: "file:./data/test.db", APP_TIMEZONE: "America/Sao_Paulo" },
    // os testes compartilham um arquivo SQLite: um arquivo de teste por vez
    fileParallelism: false,
  },
});
