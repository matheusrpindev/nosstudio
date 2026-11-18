import { logAudit } from "@/lib/audit";
import { getCurrentUser } from "@/lib/auth";
import { todayISO } from "@/lib/dates";
import { exportClientsCsv } from "@/server/clients/admin";
import { clientFiltersFromParams } from "../filters";

/** GET /painel/clientes/exportar — CSV (";" + BOM UTF-8) com os mesmos filtros da lista (`?status=&q=&…`). */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return new Response("Não autorizado.", { status: 401, headers: { "Cache-Control": "no-store" } });

  if (user.mustChangePassword) return new Response("Troque a senha antes de continuar.", { status: 403, headers: { "Cache-Control": "no-store" } });

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
