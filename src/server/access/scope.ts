/**
 * ESCOPO POR PROJETO E POR CLIENTE — quem enxerga quais registros (briefing v2, seções 18, 27, 28 e 32:
 * "um usuário não pode acessar dados de outro por mudança de URL ou identificador").
 *
 * Regras:
 * - quem tem "ver projetos" no módulo inteiro (admin, sócio, gestor, técnico) vê todos os projetos;
 * - funcionário e freelancer veem só os projetos em que são MEMBROS (`project_members` com `canView`);
 * - cliente vê só os projetos dos CLIENTES a que a conta está vinculada (`client_users`), e só para ver.
 *
 * Estas funções devolvem apenas ids e sim/não — nunca linhas do banco. Nada de custo, margem, nota interna,
 * valor de outro profissional ou dado de outro cliente sai daqui (testado em scope.db.test.ts). Para montar o que
 * um perfil externo pode LER de um projeto, use as visões de ./projects.ts.
 *
 * Toda consulta de lista deve passar pelo filtro (`inScope`), e toda página/ação de detalhe por
 * `canAccessProject` / `canInProject`: conferir só o id da URL não basta.
 */
import "server-only";
import { and, eq, inArray, sql, type SQL } from "drizzle-orm";
import type { AnySQLiteColumn } from "drizzle-orm/sqlite-core";
import { db } from "@/db";
import { clientUsers, projectMembers, projects } from "@/db/schema";
import type { UserRole } from "@/lib/domain";
import { canEverywhere, PROJECT_SCOPED_PANEL_MODULES, permissionScope, type Action, type Module, type PermissionOverrides } from "@/lib/permissions";

/** O que as funções de escopo precisam saber de alguém. `CurrentUser` serve. */
export type AccessUser = { id: number; role: UserRole; permissions?: PermissionOverrides | null };

/** `"todos"` = sem restrição; lista = só estes ids (lista vazia = nada). */
export type IdScope = "todos" | number[];

/** O que um membro pode fazer num projeto (colunas de `project_members`). */
export const PROJECT_ACTIONS = ["ver", "editar", "baixar", "enviar"] as const;
export type ProjectAction = (typeof PROJECT_ACTIONS)[number];

// ------------------------------------------------------------------ clientes
/** Ids das fichas de cliente a que uma conta de perfil `cliente` está vinculada. Outros perfis: nenhum vínculo vale. */
async function linkedClientIds(user: AccessUser): Promise<number[]> {
  if (user.role !== "cliente") return [];
  const rows = await db.select({ clientId: clientUsers.clientId }).from(clientUsers).where(eq(clientUsers.userId, user.id));
  return rows.map((row) => row.clientId).sort((a, b) => a - b);
}

/**
 * Quais fichas de cliente a pessoa alcança: todas (quem tem "ver clientes" no módulo inteiro), só as vinculadas
 * (conta de cliente) ou nenhuma (funcionário, freelancer: trabalham no projeto, não na ficha comercial).
 */
export async function clientScope(user: AccessUser): Promise<IdScope> {
  if (user.role === "cliente") return linkedClientIds(user);
  return canEverywhere(user, "clientes", "ver") ? "todos" : [];
}

// ------------------------------------------------------------------ projetos
/** Quais projetos a pessoa enxerga: `"todos"` ou a lista de ids. */
export async function projectScope(user: AccessUser): Promise<IdScope> {
  if (user.role === "cliente") {
    const clientIds = await linkedClientIds(user);
    if (clientIds.length === 0) return [];
    const rows = await db.select({ id: projects.id }).from(projects).where(inArray(projects.clientId, clientIds));
    return rows.map((row) => row.id).sort((a, b) => a - b);
  }
  if (canEverywhere(user, "projetos", "ver")) return "todos";
  const rows = await db
    .select({ projectId: projectMembers.projectId })
    .from(projectMembers)
    .where(and(eq(projectMembers.userId, user.id), eq(projectMembers.canView, true)));
  return rows.map((row) => row.projectId).sort((a, b) => a - b);
}

type Membership = { canView: boolean; canEdit: boolean; canDownload: boolean; canUpload: boolean };

async function membershipOf(user: AccessUser, projectId: number): Promise<Membership | null> {
  if (user.role === "cliente") return null; // conta de cliente nunca é "membro da equipe" de um projeto
  const [row] = await db
    .select({ canView: projectMembers.canView, canEdit: projectMembers.canEdit, canDownload: projectMembers.canDownload, canUpload: projectMembers.canUpload })
    .from(projectMembers)
    .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, user.id)));
  return row ?? null;
}

function memberAllows(member: Membership | null, action: ProjectAction): boolean {
  if (!member || !member.canView) return false; // sem "ver", nenhuma outra permissão do membro vale
  if (action === "ver") return true;
  if (action === "editar") return member.canEdit;
  if (action === "baixar") return member.canDownload;
  return member.canUpload;
}

const validId = (id: unknown): id is number => typeof id === "number" && Number.isInteger(id) && id > 0;

/**
 * A pessoa pode `action` NESTE projeto? Vale para os três ambientes. Projeto inexistente, id inválido e projeto
 * alheio dão a mesma resposta (`false`): trocar o id da URL não revela nem que o projeto existe.
 */
export async function canAccessProject(user: AccessUser, projectId: number, action: ProjectAction): Promise<boolean> {
  if (!validId(projectId)) return false;
  const [project] = await db.select({ id: projects.id, clientId: projects.clientId }).from(projects).where(eq(projects.id, projectId));
  if (!project) return false;

  if (user.role === "cliente") {
    // o cliente só VÊ; baixar depende de liberação explícita de arquivos (galerias), que ainda não existe
    if (action !== "ver" || project.clientId === null) return false;
    return (await linkedClientIds(user)).includes(project.clientId);
  }
  const globally =
    action === "enviar" ? canEverywhere(user, "arquivos", "editar") && canEverywhere(user, "projetos", "ver") : canEverywhere(user, "projetos", action);
  if (globally) return true;
  return memberAllows(await membershipOf(user, projectId), action);
}

/**
 * Permissão de MÓDULO aplicada a um registro de projeto (painel): junta a matriz com a lista de membros.
 * - alcance "todos" → pode;
 * - alcance "projetos" (funcionário) → só se for membro com a permissão correspondente; excluir e compartilhar
 *   nunca vêm de ser membro;
 * - sem permissão no módulo → não pode, mesmo sendo membro.
 */
export async function canInProject(user: AccessUser, mod: Module, action: Action, projectId: number | null | undefined): Promise<boolean> {
  const scope = permissionScope(user, mod, action);
  if (scope === null) return false;
  if (scope === "todos") return true;
  if (!validId(projectId) || action === "excluir" || action === "compartilhar") return false;
  return memberAllows(await membershipOf(user, projectId), action);
}

/**
 * PAINEL: em quais projetos a pessoa pode `action` nos registros do módulo `mod` — para filtrar listas
 * (`inScope(tasks.projectId, escopo)`) e conferir registros (`scopeAllows`).
 * - alcance "todos" → `"todos"`;
 * - alcance "projetos" (funcionário) → os projetos em que é membro com a permissão correspondente — e só nos
 *   módulos cujas telas já filtram por projeto (`PROJECT_SCOPED_PANEL_MODULES`); excluir e compartilhar nunca vêm
 *   de ser membro;
 * - sem permissão → `[]` (nada).
 */
export async function moduleScope(user: AccessUser, mod: Module, action: Action = "ver"): Promise<IdScope> {
  const scope = permissionScope(user, mod, action);
  if (scope === null) return [];
  if (scope === "todos") return "todos";
  if (!PROJECT_SCOPED_PANEL_MODULES.includes(mod) || action === "excluir" || action === "compartilhar" || user.role === "cliente") return [];
  const flag = action === "editar" ? projectMembers.canEdit : action === "baixar" ? projectMembers.canDownload : undefined;
  const rows = await db
    .select({ projectId: projectMembers.projectId })
    .from(projectMembers)
    .where(and(eq(projectMembers.userId, user.id), eq(projectMembers.canView, true), flag ? eq(flag, true) : undefined));
  return rows.map((row) => row.projectId).sort((a, b) => a - b);
}

/** O registro (pelo `projectId` LIDO DO BANCO) está dentro do escopo? Registro sem projeto só entra em `"todos"`. */
export function scopeAllows(scope: IdScope, projectId: number | null | undefined): boolean {
  if (scope === "todos") return true;
  return validId(projectId) && scope.includes(projectId);
}

// ------------------------------------------------------- filtros de consulta
/**
 * Condição Drizzle para restringir uma consulta a um escopo:
 *
 *   const scope = await projectScope(user);
 *   db.select().from(tasks).where(and(eq(tasks.done, false), inScope(tasks.projectId, scope)));
 *
 * `"todos"` → sem condição (`undefined`, que o `and()` ignora); lista vazia → condição sempre falsa (nenhuma
 * linha, nunca "todas"); registros com a coluna nula (tarefa sem projeto) ficam de fora de qualquer lista.
 */
export function inScope(column: AnySQLiteColumn, scope: IdScope): SQL | undefined {
  if (scope === "todos") return undefined;
  if (scope.length === 0) return sql`0 = 1`;
  return inArray(column, scope);
}

/** Atalho: a condição de escopo de projetos desta pessoa sobre `column` (por padrão, `projects.id`). */
export async function projectScopeFilter(user: AccessUser, column: AnySQLiteColumn = projects.id): Promise<SQL | undefined> {
  return inScope(column, await projectScope(user));
}

/** Atalho: a condição de escopo de clientes desta pessoa sobre `column` (por padrão, `projects.clientId`). */
export async function clientScopeFilter(user: AccessUser, column: AnySQLiteColumn = projects.clientId): Promise<SQL | undefined> {
  return inScope(column, await clientScope(user));
}
