import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { siteContent } from "@/db/schema";
import { resolveSiteContent, siteContentSchemas, type SiteContent, type SiteContentKey } from "@/lib/site/content";
import { collectMediaIds, droppedMediaIds, releaseMedia } from "@/server/media";

/**
 * Leitura SEM cache de uma seção do site — para os formulários do painel (sempre o valor mais recente).
 * No site público use `getSiteContent()` de ./queries (com cache).
 */
export async function getSiteContentForEdit<K extends SiteContentKey>(key: K): Promise<SiteContent[K]> {
  const [row] = await db.select().from(siteContent).where(eq(siteContent.key, key));
  return resolveSiteContent(key, row?.value);
}

/**
 * Valida e grava uma seção do site. Lança ZodError se inválida.
 * Quem chama (Server Action) deve em seguida chamar `invalidateSite()` e registrar auditoria.
 */
export async function saveSiteContent<K extends SiteContentKey>(key: K, value: unknown, userId?: number): Promise<SiteContent[K]> {
  const parsed = siteContentSchemas[key].parse(value) as SiteContent[K];
  const [previous] = await db.select({ value: siteContent.value }).from(siteContent).where(eq(siteContent.key, key));
  await db
    .insert(siteContent)
    .values({ key, value: parsed, updatedBy: userId ?? null })
    .onConflictDoUpdate({
      target: siteContent.key,
      set: { value: parsed, updatedBy: userId ?? null, updatedAt: new Date() },
    });
  // fotos trocadas ou removidas nesta seção: os arquivos antigos são apagados (não ficam acessíveis pelo link)
  if (previous) await releaseMedia(droppedMediaIds(collectMediaIds(previous.value), collectMediaIds(parsed)));
  return parsed;
}
