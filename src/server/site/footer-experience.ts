import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { siteContent } from "@/db/schema";
import { FOOTER_EXPERIENCE_KEY, resolveFooterExperienceSettings, type FooterExperienceSettings } from "@/lib/site/footer-experience";

/**
 * Leitura SEM cache das configurações do rodapé interativo — para o painel. No site público use
 * `getFooterExperience()` de ./queries (com cache).
 */
export async function getFooterExperienceForEdit(): Promise<{ settings: FooterExperienceSettings; updatedAt: Date | null }> {
  const [row] = await db.select().from(siteContent).where(eq(siteContent.key, FOOTER_EXPERIENCE_KEY));
  return { settings: resolveFooterExperienceSettings(row?.value), updatedAt: row?.updatedAt ?? null };
}

/**
 * Grava as configurações (já validadas). Quem chama (Server Action) autoriza, confere as mídias, chama
 * `invalidateSite()`, libera os arquivos que saíram (`releaseMedia`) e registra a auditoria.
 * Devolve o valor anterior, para o desvínculo de arquivos.
 */
export async function saveFooterExperience(settings: FooterExperienceSettings, userId?: number): Promise<{ previous: FooterExperienceSettings; saved: FooterExperienceSettings }> {
  const { settings: previous } = await getFooterExperienceForEdit();
  const value = resolveFooterExperienceSettings(settings);
  await db
    .insert(siteContent)
    .values({ key: FOOTER_EXPERIENCE_KEY, value, updatedBy: userId ?? null })
    .onConflictDoUpdate({ target: siteContent.key, set: { value, updatedBy: userId ?? null, updatedAt: new Date() } });
  return { previous, saved: value };
}
