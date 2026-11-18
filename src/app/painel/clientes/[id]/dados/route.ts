import { logAudit } from "@/lib/audit";
import { getCurrentUser } from "@/lib/auth";
import { todayISO } from "@/lib/dates";
import { exportClientSubjectData } from "@/server/clients/subject-data";

const noStore = { "Cache-Control": "no-store" };

/**
 * GET /painel/clientes/[id]/dados — "Dados deste titular": JSON com tudo o que o painel guarda ligado a este
 * cliente (LGPD: pedido de acesso/portabilidade). Só administradores, como as outras exportações; cada download
 * fica na auditoria (sem o nome da pessoa — a auditoria não é apagada quando o cliente é excluído).
 */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Sua sessão expirou. Entre novamente." }, { status: 401, headers: noStore });
  if (user.mustChangePassword) return Response.json({ error: "Troque a senha antes de continuar." }, { status: 403, headers: noStore });
  if (user.role !== "admin") return Response.json({ error: "Só administradores podem exportar os dados." }, { status: 403, headers: noStore });

  const id = Number((await context.params).id);
  const result = Number.isInteger(id) && id > 0 ? await exportClientSubjectData(id, new Date()) : null;
  if (!result) return Response.json({ error: "Cliente não encontrado." }, { status: 404, headers: noStore });

  await logAudit({ user, action: "export", entity: "client", entityId: id, summary: `Exportou os dados deste titular em JSON (${result.total} registro(s))` });
  return new Response(result.json, {
    headers: { ...noStore, "Content-Type": "application/json; charset=utf-8", "Content-Disposition": `attachment; filename="dados-do-titular-cliente-${id}-${todayISO()}.json"` },
  });
}
