import { logAudit } from "@/lib/audit";
import { authorizePermission } from "@/lib/auth";
import { todayISO } from "@/lib/dates";
import { exportClientsCsv } from "@/server/clients/admin";
import { clientFiltersFromParams } from "../filters";

/**
 * GET /painel/clientes/exportar — CSV (";" + BOM UTF-8) com os mesmos filtros da lista (`?status=&q=&…`).
 * Exige "baixar" em Exportação de dados (admin e sócio — a conta de acesso técnico usa o painel, mas não
 * exporta dados; mesma regra de /painel/config/dados/exportar) e "ver" em Clientes.
 */
export async function GET(request: Request) {
  const user = await authorizePermission("dados", "baixar");
  if (user instanceof Response) return user;
  const canSeeClients = await authorizePermission("clientes", "ver");
  if (canSeeClients instanceof Response) return canSeeClients;

  const url = new URL(request.url);
  const params: Record<string, string | undefined> = {};
  for (const key of ["q", "status", "responsavel", "servico", "origem"]) params[key] = url.searchParams.get(key) ?? undefined;
  const { csv, count } = await exportClientsCsv(clientFiltersFromParams(params));

  await logAudit({ user, action: "export", entity: "client", summary: `Exportou ${count} cliente(s) em CSV` });
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="clientes-${todayISO()}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
