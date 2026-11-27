/**
 * Sal do dia e código do visitante.
 *
 * O "visitante estimado" é um código calculado a cada página vista: HMAC-SHA256(IP + navegador) com um sal
 * ALEATÓRIO que só vale por um dia. O IP e o navegador não são gravados em lugar nenhum — só o código — e o sal é
 * apagado na virada do dia. Consequências:
 * - dentro do dia, a mesma pessoa (mesma rede + mesmo navegador) gera sempre o mesmo código: dá para contar
 *   visitantes e juntar as páginas de uma visita sem cookie;
 * - no dia seguinte o código é outro e o sal antigo não existe mais: não dá para ligar um visitante a outro dia,
 *   nem refazer a conta para testar se um IP esteve no site.
 */
import "server-only";
import { createHmac, randomBytes } from "node:crypto";
import { eq, lt } from "drizzle-orm";
import { db, type DbOrTx } from "@/db";
import { visitSalts } from "@/db/schema";
import type { ISODate } from "@/lib/dates";

/**
 * Sal de `day` (cria se for o primeiro acesso do dia). Ao criar, apaga os sais de dias anteriores.
 * `created: true` avisa quem chamou que o dia virou (hora de rodar a limpeza das sessões antigas).
 */
export async function dailySalt(day: ISODate, executor: DbOrTx = db): Promise<{ salt: string; created: boolean }> {
  const [existing] = await executor.select({ salt: visitSalts.salt }).from(visitSalts).where(eq(visitSalts.day, day));
  if (existing) return { salt: existing.salt, created: false };
  await executor.insert(visitSalts).values({ day, salt: randomBytes(32).toString("base64url") }).onConflictDoNothing();
  await executor.delete(visitSalts).where(lt(visitSalts.day, day));
  const [row] = await executor.select({ salt: visitSalts.salt }).from(visitSalts).where(eq(visitSalts.day, day));
  return { salt: row.salt, created: true };
}

/** Apaga os sais de dias anteriores a `today` (a criação do sal do dia já faz isso; aqui é a rede de segurança). */
export async function pruneVisitSalts(today: ISODate): Promise<void> {
  await db.delete(visitSalts).where(lt(visitSalts.day, today));
}

/** Código do visitante no dia: não permite voltar ao IP e muda quando o sal muda. */
export function visitorHash(salt: string, ip: string, userAgent: string): string {
  return createHmac("sha256", salt).update(`visitante|${ip}|${userAgent}`).digest("hex").slice(0, 32);
}

/** Chave do limitador de tentativas da coleta: também derivada do sal do dia (não sobrevive a ele). */
export function visitRateKey(salt: string, ip: string): string {
  return `visita:${createHmac("sha256", salt).update(`limite|${ip}`).digest("hex").slice(0, 32)}`;
}
