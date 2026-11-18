import "server-only";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { siteContent, users } from "@/db/schema";
import type { SiteContentKey } from "@/lib/site/content";

export type SectionInfo = { customized: boolean; updatedAt: Date | null; updatedByName: string | null };

/** Quais seções já foram editadas (têm registro) e quando/por quem. Seções sem registro usam os textos originais. */
export async function getSectionInfos(keys: readonly SiteContentKey[]): Promise<Record<SiteContentKey, SectionInfo>> {
  const rows = await db
    .select({ key: siteContent.key, updatedAt: siteContent.updatedAt, updatedByName: users.name })
    .from(siteContent)
    .leftJoin(users, eq(users.id, siteContent.updatedBy))
    .where(inArray(siteContent.key, [...keys]));
  const byKey = new Map(rows.map((row) => [row.key, row]));
  const result = {} as Record<SiteContentKey, SectionInfo>;
  for (const key of keys) {
    const row = byKey.get(key);
    result[key] = { customized: Boolean(row), updatedAt: row?.updatedAt ?? null, updatedByName: row?.updatedByName ?? null };
  }
  return result;
}

/** Apaga o registro da seção: o site volta a usar os textos originais do briefing. Devolve `true` se havia algo. */
export async function resetSiteContent(key: SiteContentKey): Promise<boolean> {
  const deleted = await db.delete(siteContent).where(eq(siteContent.key, key)).returning({ key: siteContent.key });
  return deleted.length > 0;
}
