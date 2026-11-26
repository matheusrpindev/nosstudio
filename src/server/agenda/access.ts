/**
 * ALCANCE DA AGENDA — quem vê e quem altera cada compromisso (além da privacidade de `privacy.ts`).
 *
 * - "todos": quem tem a permissão da agenda no módulo inteiro (admin, sócio, gestor, técnico);
 * - "restrito": o funcionário ("só nos projetos em que está"). Ele VÊ os compromissos em que é responsável,
 *   participante ou que criou, e os dos projetos em que é membro; ALTERA só os próprios (os que criou ou em que é
 *   responsável). Particular de que não participa não existe para ele — nem como "Ocupado";
 * - "nenhum": sem permissão, ou alcance por projeto enquanto a agenda não está em
 *   `PROJECT_SCOPED_PANEL_MODULES` (falha fechada).
 *
 * Todas as consultas de `queries.ts` calculam o alcance a partir de quem está vendo: quem chama de fora (visão
 * geral, projeto, cliente) não precisa — nem consegue — pular o filtro.
 */
import "server-only";
import { getSessionUser, type CurrentUser } from "@/lib/auth";
import type { UserRole } from "@/lib/domain";
import { hasEnvironment, PROJECT_SCOPED_PANEL_MODULES, permissionScope, type Action, type PermissionOverrides } from "@/lib/permissions";
import { moduleScope } from "@/server/access/scope";
import { canSeeEvent, eventUserIds, type EventRecord } from "./privacy";

export type AgendaViewer = { id: number; role: UserRole; permissions?: PermissionOverrides | null };
export type AgendaLevel = "todos" | "restrito" | "nenhum";

export type AgendaAccess = {
  userId: number;
  view: AgendaLevel;
  edit: AgendaLevel;
  /** Com `view: "restrito"`: projetos cujos compromissos a pessoa enxerga. */
  viewProjectIds: readonly number[];
  /** Com `edit: "restrito"`: projetos a que a pessoa pode ligar um compromisso seu. */
  editProjectIds: readonly number[];
};

async function levelOf(viewer: AgendaViewer, action: Action): Promise<{ level: AgendaLevel; projectIds: number[] }> {
  const cell = permissionScope(viewer, "agenda", action);
  if (cell === "todos") return { level: "todos", projectIds: [] };
  if (cell === null || !PROJECT_SCOPED_PANEL_MODULES.includes("agenda")) return { level: "nenhum", projectIds: [] };
  const scope = await moduleScope(viewer, "agenda", action);
  return scope === "todos" ? { level: "todos", projectIds: [] } : { level: "restrito", projectIds: scope };
}

/** O alcance desta pessoa na agenda (uma consulta a `project_members` só para quem é restrito). */
export async function agendaAccess(viewer: AgendaViewer): Promise<AgendaAccess> {
  const [view, edit] = await Promise.all([levelOf(viewer, "ver"), levelOf(viewer, "editar")]);
  return {
    userId: viewer.id,
    view: view.level,
    // quem não vê, não altera
    edit: view.level === "nenhum" ? "nenhum" : edit.level,
    viewProjectIds: view.projectIds,
    editProjectIds: edit.projectIds,
  };
}

/** Alcance de quem tem o módulo inteiro (scripts e testes; as telas usam `agendaAccess`). */
export const fullAccess = (userId: number): AgendaAccess => ({ userId, view: "todos", edit: "todos", viewProjectIds: [], editProjectIds: [] });

type Scoped = Pick<EventRecord, "createdBy" | "people" | "projectId">;

/** O compromisso está no alcance de leitura desta pessoa? (a privacidade é conferida à parte) */
export function inViewScope(access: AgendaAccess, event: Scoped): boolean {
  if (access.view === "todos") return true;
  if (access.view === "nenhum") return false;
  if (eventUserIds(event).includes(access.userId)) return true;
  return typeof event.projectId === "number" && access.viewProjectIds.includes(event.projectId);
}

/** "Próprio": a pessoa criou o compromisso ou é responsável por ele. */
export function isOwnEvent(event: Pick<EventRecord, "createdBy" | "people">, userId: number): boolean {
  return event.createdBy === userId || event.people.some((person) => person.role === "responsavel" && person.userId === userId);
}

/** Esta pessoa pode ALTERAR o compromisso? (editar, reagendar, arrastar, cancelar, duplicar, marcar checklist) */
export function canMutateEvent(access: AgendaAccess, event: Pick<EventRecord, "visibility" | "createdBy" | "people" | "projectId">): boolean {
  if (access.edit === "nenhum" || !inViewScope(access, event) || !canSeeEvent(event, access.userId)) return false;
  return access.edit === "todos" || isOwnEvent(event, access.userId);
}

/**
 * Guarda de ROTA de leitura (exportação .ics): devolve a pessoa e o alcance, ou a resposta 401/403/404 pronta.
 * `requireScopedPermission` redireciona e não serve para Route Handlers.
 */
export async function authorizeAgenda(action: "ver" | "baixar"): Promise<{ user: CurrentUser; access: AgendaAccess } | Response> {
  const deny = (error: string, status: number) => Response.json({ error }, { status, headers: { "Cache-Control": "no-store" } });
  const user = await getSessionUser();
  if (!user) return deny("Sua sessão expirou. Entre novamente.", 401);
  if (user.mustChangePassword) return deny("Troque a senha antes de continuar.", 403);
  if (!hasEnvironment(user.role, "painel")) return deny("Sua conta não tem acesso ao painel.", 403);
  const access = await agendaAccess(user);
  const allowed = access.view !== "nenhum" && (action === "ver" || (await levelOf(user, "baixar")).level !== "nenhum");
  if (!allowed) return deny("Sua conta não tem permissão para baixar a agenda.", 403);
  return { user, access };
}
