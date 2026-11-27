/**
 * Retenção das métricas: as sessões brutas somem depois de `VISIT_SESSION_RETENTION_DAYS` dias e os sais de dias
 * anteriores são apagados. Os totais diários (`visit_stats`) ficam — são agregados e anônimos.
 * Roda no primeiro acesso de cada dia (`recordPageview`) e junto da limpeza do temporizador do servidor
 * (`src/server/notifications/timer.ts`).
 */
import "server-only";
import { lt } from "drizzle-orm";
import { db } from "@/db";
import { visitSessions } from "@/db/schema";
import { todayISO } from "@/lib/dates";
import { VISIT_SESSION_RETENTION_DAYS } from "@/lib/metrics/classify";
import { pruneVisitSalts } from "./salt";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Apaga as sessões iniciadas há mais de `VISIT_SESSION_RETENTION_DAYS` dias. */
export async function pruneVisitSessions(now: Date = new Date()): Promise<void> {
  await db.delete(visitSessions).where(lt(visitSessions.startedAt, new Date(now.getTime() - VISIT_SESSION_RETENTION_DAYS * DAY_MS)));
}

/** Limpeza completa (sessões vencidas + sais antigos). */
export async function pruneVisitData(now: Date = new Date()): Promise<void> {
  await pruneVisitSessions(now);
  await pruneVisitSalts(todayISO(now));
}
