import { existsSync, rmSync } from "node:fs";

/** Banco SQLite exclusivo dos testes, recriado e migrado a cada execução do vitest. */
export default async function setup() {
  const file = "./data/test.db";
  for (const suffix of ["", "-wal", "-shm"]) if (existsSync(file + suffix)) rmSync(file + suffix);
  process.env.DATABASE_URL = `file:${file}`;
  const { runMigrations } = await import("../db/migrate");
  await runMigrations();
}
