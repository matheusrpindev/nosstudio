/**
 * Backup completo: banco (cópia consistente) + arquivos enviados, num único .tar.gz.
 *
 *   npm run backup                 → data/backups/nos-backup-AAAAMMDD-HHMMSS.tar.gz (mantém os 14 mais recentes)
 *   npm run backup -- --keep 30    → muda a retenção
 *   npm run backup -- --out /mnt/disco-externo
 *
 * Agende no servidor (cron) e copie os arquivos para FORA da máquina (outro disco, nuvem).
 * Com banco remoto (Turso), o banco é protegido pelo provedor; este script salva só os uploads.
 */
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, statSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { DATABASE_URL, dbClient } from "@/db";
import { env } from "@/lib/env";

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main() {
  const outDir = path.resolve(arg("out") ?? "./data/backups");
  const keep = Math.max(1, Number(arg("keep") ?? 14) || 14);
  mkdirSync(outDir, { recursive: true });

  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace("T", "-").slice(0, 15);
  const work = mkdtempSync(path.join(os.tmpdir(), "nos-backup-"));
  const entries: string[] = [];
  try {
    if (DATABASE_URL.startsWith("file:")) {
      // VACUUM INTO gera uma cópia íntegra mesmo com o site no ar (modo WAL).
      const snapshot = path.join(work, "nos.db");
      await dbClient.execute(`VACUUM INTO '${snapshot.replace(/'/g, "''")}'`);
      entries.push("nos.db");
    } else {
      console.log("· Banco remoto: não incluído (use o backup do provedor).");
    }

    const uploads = path.resolve(env.uploadDir);
    if (existsSync(uploads)) {
      cpSync(uploads, path.join(work, "uploads"), { recursive: true });
      entries.push("uploads");
    }
    if (entries.length === 0) throw new Error("Nada para salvar.");

    const archive = path.join(outDir, `nos-backup-${stamp}.tar.gz`);
    execFileSync("tar", ["-czf", archive, "-C", work, ...entries]);
    const sizeMb = (statSync(archive).size / 1024 / 1024).toFixed(2);
    console.log(`✔ Backup criado: ${archive} (${sizeMb} MB) — conteúdo: ${entries.join(" + ")}`);

    const old = readdirSync(outDir)
      .filter((file) => /^nos-backup-\d{8}-\d{6}\.tar\.gz$/.test(file))
      .sort()
      .reverse()
      .slice(keep);
    for (const file of old) rmSync(path.join(outDir, file));
    if (old.length > 0) console.log(`· ${old.length} backup(s) antigo(s) removido(s) (retenção: ${keep}).`);
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(`✖ Falha no backup: ${(error as Error).message}`);
  process.exit(1);
});
