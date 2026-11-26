import { logAudit } from "@/lib/audit";
import { authorizePermission } from "@/lib/auth";
import { todayISO } from "@/lib/dates";
import { CSV_KINDS, exportAllJson, exportCsv, type CsvKind } from "@/server/config/data";

const noStore = { "Cache-Control": "no-store" };

/**
 * GET /painel/config/dados/exportar            → JSON completo (todas as tabelas de negócio)
 * GET /painel/config/dados/exportar?csv=clientes|leads|financeiro → CSV (";" + BOM UTF-8)
 * Exige a permissão "baixar" em Exportação de dados (admin e sócio). Nunca inclui senhas, sessões nem tokens.
 * Compromissos particulares da agenda de OUTRAS pessoas saem só como "Ocupado" (regra em `src/server/config/data.ts`).
 */
export async function GET(request: Request) {
  const user = await authorizePermission("dados", "baixar");
  if (user instanceof Response) return user;

  const today = todayISO();
  const csvParam = new URL(request.url).searchParams.get("csv");

  if (csvParam !== null) {
    const kind = CSV_KINDS.find((item) => item === csvParam) as CsvKind | undefined;
    if (!kind) return Response.json({ error: "Tipo de CSV inválido." }, { status: 400, headers: noStore });
    const { csv, count } = await exportCsv(kind);
    await logAudit({ user, action: "export", entity: "dados", summary: `Exportou ${count} registro(s) de ${kind} em CSV` });
    return new Response(csv, {
      headers: { ...noStore, "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="nos-${kind}-${today}.csv"` },
    });
  }

  const { json, counts, maskedPrivateEvents } = await exportAllJson(new Date(), user);
  const total = Object.values(counts).reduce((sum, n) => sum + n, 0);
  await logAudit({
    user,
    action: "export",
    entity: "dados",
    summary:
      `Exportação completa em JSON (${Object.keys(counts).length} tabelas, ${total} registros)` +
      (maskedPrivateEvents ? ` — ${maskedPrivateEvents} compromisso(s) particular(es) de outras pessoas só como "Ocupado"` : ""),
  });
  return new Response(json, {
    headers: { ...noStore, "Content-Type": "application/json; charset=utf-8", "Content-Disposition": `attachment; filename="nos-dados-${today}.json"` },
  });
}
