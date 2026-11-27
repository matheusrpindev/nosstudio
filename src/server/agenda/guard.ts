/**
 * Guarda de ROTA da agenda (exportação .ics): devolve a pessoa e o alcance, ou a resposta 401/403 pronta.
 * `requireScopedPermission` redireciona e não serve para Route Handlers.
 */
import "server-only";
import { getSessionUser, type CurrentUser } from "@/lib/auth";
import { hasEnvironment } from "@/lib/permissions";
import { agendaAccess, agendaLevel, type AgendaAccess } from "./access";

export async function authorizeAgenda(action: "ver" | "baixar"): Promise<{ user: CurrentUser; access: AgendaAccess } | Response> {
  const deny = (error: string, status: number) => Response.json({ error }, { status, headers: { "Cache-Control": "no-store" } });
  const user = await getSessionUser();
  if (!user) return deny("Sua sessão expirou. Entre novamente.", 401);
  if (user.mustChangePassword) return deny("Troque a senha antes de continuar.", 403);
  if (!hasEnvironment(user.role, "painel")) return deny("Sua conta não tem acesso ao painel.", 403);
  const access = await agendaAccess(user);
  const allowed = access.view !== "nenhum" && (action === "ver" || (await agendaLevel(user, "baixar")).level !== "nenhum");
  if (!allowed) return deny("Sua conta não tem permissão para baixar a agenda.", 403);
  return { user, access };
}
