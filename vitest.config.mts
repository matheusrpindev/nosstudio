import { tmpdir } from "node:os";
import path from "node:path";
import { defineConfig } from "vitest/config";

/**
 * Cada execução do vitest tem a SUA pasta temporária (banco SQLite + uploads), com o pid do processo principal
 * no nome: duas execuções ao mesmo tempo (dois terminais, dois agentes, CI em paralelo) não se atropelam, e nada
 * fica em `data/`. Quem cria, migra e apaga a pasta é `src/test/global-setup.ts`.
 */
const runDir = path.join(tmpdir(), `nosstudio-vitest-${process.pid}`);

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "server-only": path.resolve(import.meta.dirname, "src/test/empty.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    globalSetup: ["src/test/global-setup.ts"],
    env: {
      NOS_TEST_RUN_DIR: runDir,
      DATABASE_URL: `file:${path.join(runDir, "test.db")}`,
      UPLOAD_DIR: path.join(runDir, "uploads"),
      APP_TIMEZONE: "America/Sao_Paulo",
    },
    // dentro de UMA execução os testes compartilham um arquivo SQLite: um arquivo de teste por vez
    fileParallelism: false,
  },
});
