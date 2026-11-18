/**
 * Restaura um backup gerado por `npm run backup`.
 *
 *   1. PARE o site (o banco não pode estar em uso).
 *   2. npm run restore -- data/backups/nos-backup-AAAAMMDD-HHMMSS.tar.gz
 *   3. Inicie o site de novo.
 *
 * O banco e a pasta de uploads atuais NÃO são apagados: ficam ao lado, com o sufixo .antes-da-restauracao-<data>,
 * para você conferir e remover depois.
 */
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, renameSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

// Lê as variáveis direto do ambiente (sem abrir o banco, que será substituído).
const DATABASE_URL = process.env.DATABASE_URL || "file:./data/nos.db";
const UPLOAD_DIR = process.env.UPLOAD_DIR || "./data/uploads";

function main() {
  const archive = process.argv[2];
  if (!archive || !existsSync(archive)) throw new Error("Informe o arquivo de backup: npm run restore -- caminho/do/backup.tar.gz");

  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace("T", "-").slice(0, 15);
  const work = mkdtempSync(path.join(os.tmpdir(), "nos-restore-"));
  try {
    execFileSync("tar", ["-xzf", path.resolve(archive), "-C", work]);

    const snapshot = path.join(work, "nos.db");
    if (existsSync(snapshot)) {
      if (!DATABASE_URL.startsWith("file:")) throw new Error("O backup contém um banco local, mas DATABASE_URL aponta para um banco remoto.");
      const target = path.resolve(DATABASE_URL.slice("file:".length));
      mkdirSync(path.dirname(target), { recursive: true });
      if (existsSync(target)) renameSync(target, `${target}.antes-da-restauracao-${stamp}`);
      // restos do modo WAL do banco antigo não podem ser aplicados sobre o banco restaurado
      for (const suffix of ["-wal", "-shm"]) rmSync(target + suffix, { force: true });
      cpSync(snapshot, target);
      console.log(`✔ Banco restaurado em ${target}`);
    }

    const uploads = path.join(work, "uploads");
    if (existsSync(uploads)) {
      const target = path.resolve(UPLOAD_DIR);
      if (existsSync(target)) renameSync(target, `${target}.antes-da-restauracao-${stamp}`);
      cpSync(uploads, target, { recursive: true });
      console.log(`✔ Uploads restaurados em ${target}`);
    }
    console.log("\nPronto. Inicie o site e confira. As versões anteriores ficaram com o sufixo .antes-da-restauracao-…");
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

try {
  main();
} catch (error) {
  console.error(`✖ Falha na restauração: ${(error as Error).message}`);
  process.exit(1);
}
