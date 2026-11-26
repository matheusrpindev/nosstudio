import { logAudit } from "@/lib/audit";
import { authorizePermission } from "@/lib/auth";
import { todayISO } from "@/lib/dates";
import { exportClientSubjectData } from "@/server/clients/subject-data";

const noStore = { "Cache-Control": "no-store" };

/**
 * GET /painel/clientes/[id]/dados — "Dados deste titular": JSON com tudo o que o painel guarda ligado a este
 * cliente (LGPD: pedido de acesso/portabilidade). Exige "baixar" em Exportação de dados (admin e sócio), como as
 * outras exportações, e "ver" em Clientes; cada download
 * fica na auditoria (sem o nome da pessoa — a auditoria não é apagada quando o cliente é excluído).
 */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await authorizePermission("dados", "baixar");
  if (user instanceof Response) return user;
  const canSeeClients = await authorizePermission("clientes", "ver");
  if (canSeeClients instanceof Response) return canSeeClients;

  const id = Number((await context.params).id);
  const result = Number.isInteger(id) && id > 0 ? await exportClientSubjectData(id, new Date()) : null;
  if (!result) return Response.json({ error: "Cliente não encontrado." }, { status: 404, headers: noStore });

  await logAudit({ user, action: "export", entity: "client", entityId: id, summary: `Exportou os dados deste titular em JSON (${result.total} registro(s))` });
  return new Response(result.json, {
    headers: { ...noStore, "Content-Type": "application/json; charset=utf-8", "Content-Disposition": `attachment; filename="dados-do-titular-cliente-${id}-${todayISO()}.json"` },
  });
}
