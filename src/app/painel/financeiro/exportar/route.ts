import { logAudit } from "@/lib/audit";
import { getCurrentUser } from "@/lib/auth";
import { todayISO } from "@/lib/dates";
import { buildFinanceCsv } from "@/server/finance/csv";
import { listFinanceEntries } from "@/server/finance/admin";
import { parseFinanceFilters, resolveScope } from "@/server/finance/filters";

/**
 * CSV dos lançamentos (mesmos filtros da tela: `mes`, `tipo`, `categoria`, `situacao`, `cliente`, `projeto`, `de`, `ate`, `q`).
 * Só leitura (GET), só com sessão. Fica registrado na auditoria.
 */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || user.mustChangePassword) return new Response("Não autorizado", { status: 401 });

  const today = todayISO();
  const raw: Record<string, string> = {};
  for (const [key, value] of new URL(request.url).searchParams) raw[key] = value;
  const filters = parseFinanceFilters(raw, today);
  const entries = await listFinanceEntries(filters, today);
  const csv = buildFinanceCsv(entries, today);

  const scope = resolveScope(filters);
  const suffix = scope.kind === "month" ? filters.month.slice(0, 7) : scope.kind === "range" ? `${scope.from ?? "inicio"}_a_${scope.to ?? "hoje"}` : "completo";
  await logAudit({ user, action: "export", entity: "finance_entry", summary: `Exportou o financeiro em CSV (${entries.length} ${entries.length === 1 ? "lançamento" : "lançamentos"}, ${suffix})` });

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="financeiro-${suffix}.csv"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
