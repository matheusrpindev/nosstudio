import { logAudit } from "@/lib/audit";
import { authorizePermission, canEverywhere } from "@/lib/auth";
import { todayISO } from "@/lib/dates";
import { parseMetricsPeriod, periodFileSuffix } from "@/lib/metrics/period";
import { buildBreakdownMetricsCsv, buildDailyMetricsCsv, METRICS_CSV_TABLES } from "@/server/metrics/csv";
import { getMetricsReport } from "@/server/metrics/queries";

/**
 * CSV das métricas do site (mesmo período da tela: `periodo`, `mes`, `de`, `ate`). `tabela=dias` (padrão) traz uma
 * linha por dia; `tabela=recortes`, os totais do período por origem, página, aparelho, cliques…
 * Só leitura (GET). Exige "baixar" em Exportação de dados (admin e sócio — mesma regra dos outros `exportar`) e
 * "ver" em Site. Os números de leads só entram para quem vê o módulo de leads. Fica registrado na auditoria.
 */
export async function GET(request: Request) {
  const user = await authorizePermission("dados", "baixar");
  if (user instanceof Response) return user;
  const canSeeSite = await authorizePermission("site", "ver");
  if (canSeeSite instanceof Response) return canSeeSite;

  const raw: Record<string, string> = {};
  for (const [key, value] of new URL(request.url).searchParams) raw[key] = value;
  const period = parseMetricsPeriod(raw, todayISO());
  const table = METRICS_CSV_TABLES.find((name) => name === raw.tabela) ?? "dias";
  const report = await getMetricsReport(period, { includeLeads: canEverywhere(user, "leads", "ver") });
  const csv = table === "recortes" ? buildBreakdownMetricsCsv(report) : buildDailyMetricsCsv(report);

  const suffix = periodFileSuffix(period);
  await logAudit({ user, action: "export", entity: "site_metrics", summary: `Exportou as métricas do site em CSV (${table === "recortes" ? "por recorte" : "por dia"}, ${suffix})` });

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="metricas-do-site-${table}-${suffix}.csv"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
