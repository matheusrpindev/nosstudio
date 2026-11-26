import { mkdirSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type { TestProject } from "vitest/node";

const RUN_DIR_PATTERN = /^nosstudio-vitest-(\d+)$/;

function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    // EPERM = o processo existe, mas é de outro usuário
    return (error as NodeJS.ErrnoException).code === "EPERM";
  }
}

/** Pastas de execuções que morreram sem limpar (processo encerrado à força): o pid do nome não existe mais. */
function removeStaleRunDirs(current: string) {
  for (const name of readdirSync(tmpdir())) {
    const match = RUN_DIR_PATTERN.exec(name);
    const dir = path.join(tmpdir(), name);
    if (!match || dir === current || isAlive(Number(match[1]))) continue;
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      // de outro usuário, ou já apagada por outra execução
    }
  }
}

/**
 * Banco SQLite exclusivo DESTA execução do vitest (pasta definida em `vitest.config.mts`, com o pid no nome):
 * criado e migrado aqui, apagado no fim. Execuções simultâneas não compartilham nada.
 */
export default async function setup(project: TestProject) {
  const runDir = String(project.config.env.NOS_TEST_RUN_DIR ?? "");
  const databaseUrl = String(project.config.env.DATABASE_URL ?? "");
  if (!RUN_DIR_PATTERN.test(path.basename(runDir)) || !databaseUrl.startsWith(`file:${runDir}${path.sep}`)) {
    throw new Error("Testes: NOS_TEST_RUN_DIR/DATABASE_URL fora do padrão de vitest.config.mts — nada foi criado nem apagado.");
  }
  removeStaleRunDirs(runDir);
  rmSync(runDir, { recursive: true, force: true });
  mkdirSync(runDir, { recursive: true });

  process.env.DATABASE_URL = databaseUrl;
  const { runMigrations } = await import("../db/migrate");
  await runMigrations();

  return async function teardown() {
    const { dbClient } = await import("../db");
    dbClient.close();
    rmSync(runDir, { recursive: true, force: true });
  };
}
