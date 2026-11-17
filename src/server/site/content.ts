import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { siteContent } from "@/db/schema";
import { resolveSiteContent, siteContentSchemas, type SiteContent, type SiteContentKey } from "@/lib/site/content";

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
  await db
    .insert(siteContent)
    .values({ key, value: parsed, updatedBy: userId ?? null })
    .onConflictDoUpdate({
      target: siteContent.key,
      set: { value: parsed, updatedBy: userId ?? null, updatedAt: new Date() },
    });
  return parsed;
}
