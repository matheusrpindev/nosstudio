import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { settings } from "@/db/schema";
import { resolveSetting, settingsSchemas, type Settings, type SettingsKey } from "@/lib/settings";

/** Lê uma configuração interna (com os padrões onde nada foi salvo). Sempre do banco, sem cache. */
export async function getSetting<K extends SettingsKey>(key: K): Promise<Settings[K]> {
  const [row] = await db.select().from(settings).where(eq(settings.key, key));
  return resolveSetting(key, row?.value);
}

/** Valida e grava uma configuração interna. Lança ZodError se o valor for inválido. */
export async function saveSetting<K extends SettingsKey>(key: K, value: Settings[K], userId?: number): Promise<Settings[K]> {
  const parsed = settingsSchemas[key].parse(value) as Settings[K];
  await db
    .insert(settings)
    .values({ key, value: parsed, updatedBy: userId ?? null })
    .onConflictDoUpdate({ target: settings.key, set: { value: parsed, updatedBy: userId ?? null, updatedAt: new Date() } });
  return parsed;
}
