/**
 * Leitura das métricas do site para o PAINEL (consultas diretas, sem cache). Quem chama já passou pelo guarda da
 * página/rota (`site:ver`). A montagem do relatório é pura: `@/lib/metrics/report`.
 */
import "server-only";
import { and, asc, eq, gte, inArray, lt, lte, min, sql } from "drizzle-orm";
import { db } from "@/db";
import { banners, leads, visitStats } from "@/db/schema";
import { addDays, toISODate, type ISODate } from "@/lib/dates";
import type { VisitDimension } from "@/lib/domain";
import { previousPeriod, type MetricsPeriod } from "@/lib/metrics/period";
import { buildMetricsReport, type DailyStatRow, type LeadRow, type MetricsReport, type StatRow } from "@/lib/metrics/report";
import { localDateTimeToDate } from "@/server/clients/local-time";

const num = (value: number | string | null | undefined) => Number(value ?? 0);
type Range = { from: ISODate; to: ISODate };

/** Primeiro dia com alguma visita medida (`null` = a coleta ainda não registrou nada). */
export async function collectingSince(): Promise<ISODate | null> {
  const [row] = await db.select({ day: min(visitStats.day) }).from(visitStats).where(eq(visitStats.dimension, "total"));
  return row?.day ?? null;
}

/** Somas por recorte × chave num intervalo. */
async function statsIn(range: Range): Promise<StatRow[]> {
  const rows = await db
    .select({
      dimension: visitStats.dimension,
      key: visitStats.key,
      visits: sql<number>`sum(${visitStats.visits})`,
      visitors: sql<number>`sum(${visitStats.visitors})`,
      hits: sql<number>`sum(${visitStats.hits})`,
    })
    .from(visitStats)
    .where(and(gte(visitStats.day, range.from), lte(visitStats.day, range.to)))
    .groupBy(visitStats.dimension, visitStats.key);
  return rows.map((row) => ({ dimension: row.dimension, key: row.key, visits: num(row.visits), visitors: num(row.visitors), hits: num(row.hits) }));
}

const DAILY_DIMENSIONS: VisitDimension[] = ["total", "formulario", "clique"];

async function dailyIn(range: Range): Promise<DailyStatRow[]> {
  const rows = await db
    .select({ day: visitStats.day, dimension: visitStats.dimension, key: visitStats.key, visits: visitStats.visits, visitors: visitStats.visitors, hits: visitStats.hits })
    .from(visitStats)
    .where(and(inArray(visitStats.dimension, DAILY_DIMENSIONS), gte(visitStats.day, range.from), lte(visitStats.day, range.to)))
    .orderBy(asc(visitStats.day));
  return rows;
}

/** Leads cadastrados no intervalo (dias no fuso do estúdio). Só o que o relatório usa: dia, interesse e origem. */
async function leadsIn(range: Range): Promise<LeadRow[]> {
  const start = localDateTimeToDate(`${range.from}T00:00`);
  const end = localDateTimeToDate(`${addDays(range.to, 1)}T00:00`);
  if (!start || !end) return [];
  const rows = await db
    .select({ createdAt: leads.createdAt, serviceInterest: leads.serviceInterest, source: leads.source })
    .from(leads)
    .where(and(gte(leads.createdAt, start), lt(leads.createdAt, end)));
  return rows.map((row) => ({ day: toISODate(row.createdAt), serviceInterest: row.serviceInterest, source: row.source }));
}

/** Nome (interno) de cada banner, para os cliques aparecerem com nome em vez de número. */
async function bannerNames(): Promise<Map<number, string>> {
  const rows = await db.select({ id: banners.id, name: banners.name, title: banners.title }).from(banners);
  return new Map(rows.map((row) => [row.id, row.name.trim() || row.title.trim()]));
}

/**
 * Relatório completo do período, com o período anterior para comparação.
 * `includeLeads: false` para quem não vê o módulo de leads: os leads nem são consultados (voltam zerados).
 */
export async function getMetricsReport(period: MetricsPeriod, options: { includeLeads?: boolean } = {}): Promise<MetricsReport> {
  const previous = previousPeriod(period);
  const withLeads = options.includeLeads !== false;
  const [since, daily, stats, previousStats, currentLeads, previousLeads, names] = await Promise.all([
    collectingSince(),
    dailyIn(period),
    statsIn(period),
    statsIn(previous),
    withLeads ? leadsIn(period) : [],
    withLeads ? leadsIn(previous) : [],
    bannerNames(),
  ]);
  return buildMetricsReport({ period, previous, collectingSince: since, daily, stats, previousStats, leads: currentLeads, previousLeads, bannerNames: names });
}

export type VisitSnapshot = { today: number; visitorsToday: number; last7: number; collectingSince: ISODate | null };

/** Indicador da visão geral do painel: visitas de hoje e dos últimos 7 dias (hoje incluído). */
export async function getVisitSnapshot(today: ISODate): Promise<VisitSnapshot> {
  const from = addDays(today, -6);
  const [[row], since] = await Promise.all([
    db
      .select({
        today: sql<number>`coalesce(sum(case when ${visitStats.day} = ${today} then ${visitStats.visits} else 0 end), 0)`,
        visitorsToday: sql<number>`coalesce(sum(case when ${visitStats.day} = ${today} then ${visitStats.visitors} else 0 end), 0)`,
        last7: sql<number>`coalesce(sum(${visitStats.visits}), 0)`,
      })
      .from(visitStats)
      .where(and(eq(visitStats.dimension, "total"), gte(visitStats.day, from), lte(visitStats.day, today))),
    collectingSince(),
  ]);
  return { today: num(row?.today), visitorsToday: num(row?.visitorsToday), last7: num(row?.last7), collectingSince: since };
}
