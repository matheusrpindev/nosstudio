import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { siteContent } from "@/db/schema";
import { HOME_LAYOUT_KEY, isDefaultHomeLayout, resolveHomeLayout, type HomeLayout } from "@/lib/site/home-layout";

/**
 * Leitura SEM cache da ordem/visibilidade das seções da página inicial — para o painel. No site público use
 * `getHomeLayout()` de ./queries (com cache).
 */
export async function getHomeLayoutForEdit(): Promise<{ layout: HomeLayout; customized: boolean; updatedAt: Date | null }> {
  const [row] = await db.select().from(siteContent).where(eq(siteContent.key, HOME_LAYOUT_KEY));
  const layout = resolveHomeLayout(row?.value);
  return { layout, customized: Boolean(row) && !isDefaultHomeLayout(layout), updatedAt: row?.updatedAt ?? null };
}

/**
 * Grava a ordem/visibilidade (sempre a lista completa, já normalizada). Quem chama (Server Action) autoriza,
 * chama `invalidateSite()` e registra a auditoria.
 */
export async function saveHomeLayout(layout: HomeLayout, userId?: number): Promise<HomeLayout> {
  const value = resolveHomeLayout(layout);
  await db
    .insert(siteContent)
    .values({ key: HOME_LAYOUT_KEY, value, updatedBy: userId ?? null })
    .onConflictDoUpdate({ target: siteContent.key, set: { value, updatedBy: userId ?? null, updatedAt: new Date() } });
  return value;
}

/** Apaga o registro: a página inicial volta à ordem do briefing, com tudo ligado. */
export async function resetHomeLayout(): Promise<void> {
  await db.delete(siteContent).where(eq(siteContent.key, HOME_LAYOUT_KEY));
}
