/**
 * GET /painel/notificacoes/resumo — o que o sino consulta de tempos em tempos: quantas não lidas e as mais
 * recentes de QUEM ESTÁ LOGADO (qualquer conta do painel). Sem sessão do painel: 401 em JSON.
 */
import { getSessionUser } from "@/lib/auth";
import { hasEnvironment } from "@/lib/permissions";
import { getNotificationSummary } from "../summary";

export async function GET() {
  const user = await getSessionUser();
  const headers = { "Cache-Control": "private, no-store" };
  if (!user || user.mustChangePassword || !hasEnvironment(user.role, "painel")) return Response.json({ error: "Sua sessão expirou. Entre novamente." }, { status: 401, headers });
  return Response.json(await getNotificationSummary(user.id), { headers });
}
