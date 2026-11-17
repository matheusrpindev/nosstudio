/** Aplica as migrations do banco. Uso: npm run db:migrate */
import { DATABASE_URL } from "@/db";
import { runMigrations } from "@/db/migrate";

async function main() {
  await runMigrations();
  console.log(`✔ Banco atualizado (${DATABASE_URL.startsWith("file:") ? DATABASE_URL : "remoto"})`);
}

main().catch((error) => {
  console.error("✖ Falha ao migrar o banco:", error);
  process.exit(1);
});
