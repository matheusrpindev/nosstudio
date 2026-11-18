import { sql } from "drizzle-orm";
import { revalidateTag } from "next/cache";
import { connection } from "next/server";
import { db } from "@/db";
import { SITE_TAG } from "@/server/site/cache";

let bootInvalidated = false;

/**
 * Verificação de saúde para a hospedagem (healthcheck) e para o script de inicialização.
 *
 * Na primeira chamada de cada processo, invalida o cache do conteúdo público: as páginas pré-renderizadas no
 * build podem ter sido geradas com outro banco (ex.: build de imagem Docker) ou antes de edições feitas no
 * painel. Assim um servidor recém-iniciado sempre regenera o site a partir do banco real.
 */
export async function GET() {
  await connection();
  try {
    await db.run(sql`select 1`);
  } catch {
    return Response.json({ ok: false }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
  if (!bootInvalidated) {
    bootInvalidated = true;
    revalidateTag(SITE_TAG, { expire: 0 });
  }
  return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
