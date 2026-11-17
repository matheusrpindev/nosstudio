import { migrate } from "drizzle-orm/libsql/migrator";
import path from "node:path";
import { DATABASE_URL, db, dbClient } from "./index";

/** Aplica as migrations pendentes (idempotente). */
export async function runMigrations() {
  if (DATABASE_URL.startsWith("file:")) {
    // WAL: leituras não bloqueiam a escrita (o modo fica gravado no arquivo do banco).
    await dbClient.execute("PRAGMA journal_mode = WAL");
  }
  await migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") });
}
