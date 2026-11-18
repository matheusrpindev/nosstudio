import { logAudit } from "@/lib/audit";
import { getCurrentUser } from "@/lib/auth";
import { todayISO } from "@/lib/dates";
import { CSV_KINDS, exportAllJson, exportCsv, type CsvKind } from "@/server/config/data";

const noStore = { "Cache-Control": "no-store" };

/**
 * GET /painel/config/dados/exportar            → JSON completo (todas as tabelas de negócio)
 * GET /painel/config/dados/exportar?csv=clientes|leads|financeiro → CSV (";" + BOM UTF-8)
 * Só administradores. Nunca inclui senhas, sessões nem tokens.
 */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Sua sessão expirou. Entre novamente." }, { status: 401, headers: noStore });
  if (user.mustChangePassword) return Response.json({ error: "Troque a senha antes de continuar." }, { status: 403, headers: noStore });
  if (user.role !== "admin") return Response.json({ error: "Só administradores podem exportar os dados." }, { status: 403, headers: noStore });

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

  const { json, counts } = await exportAllJson(new Date());
  const total = Object.values(counts).reduce((sum, n) => sum + n, 0);
  await logAudit({ user, action: "export", entity: "dados", summary: `Exportação completa em JSON (${Object.keys(counts).length} tabelas, ${total} registros)` });
  return new Response(json, {
    headers: { ...noStore, "Content-Type": "application/json; charset=utf-8", "Content-Disposition": `attachment; filename="nos-dados-${today}.json"` },
  });
}
