/**
 * Vínculos de acesso: membros de projeto (`project_members`) e usuários vinculados a um cliente (`client_users`).
 * Só fala com o banco e audita. QUEM AUTORIZA é a Server Action que chamar (ainda não há tela):
 * - membros de projeto → `requirePermission("equipe", "editar")`;
 * - usuários de um cliente → `requirePermission("usuarios", "editar")` (é gestão de acesso de conta).
 */
import "server-only";
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import { db, type DbOrTx } from "@/db";
import { clients, clientUsers, projectMembers, projects, users, type ClientUser, type ProjectMember } from "@/db/schema";
import { logAudit } from "@/lib/audit";
import type { UserRole } from "@/lib/domain";

type Actor = { id: number; name: string };

// --------------------------------------------------------- membros de projeto
/** O que um membro pode no projeto. `role` é texto livre (sugestões: TEAM_FUNCTIONS em src/lib/domain.ts). */
export const projectMemberSchema = z.object({
  role: z.string().trim().max(60, "Máximo de 60 caracteres.").default(""),
  canView: z.boolean().default(true),
  canEdit: z.boolean().default(false),
  canDownload: z.boolean().default(false),
  canUpload: z.boolean().default(false),
});
export type ProjectMemberInput = z.input<typeof projectMemberSchema>;

export type MemberResult = { ok: true; member: ProjectMember } | { ok: false; error: "invalid" | "project_not_found" | "user_not_found" | "role_not_allowed" };

/**
 * Inclui alguém num projeto ou atualiza o que essa pessoa pode nele (uma linha por projeto + pessoa).
 * Contas de cliente não entram como equipe: o acesso delas vem do vínculo com a ficha do cliente.
 */
export async function setProjectMember(projectId: number, userId: number, input: ProjectMemberInput, actor: Actor | null): Promise<MemberResult> {
  const parsed = projectMemberSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const [project] = await db.select({ id: projects.id, title: projects.title }).from(projects).where(eq(projects.id, projectId));
  if (!project) return { ok: false, error: "project_not_found" };
  const [user] = await db.select({ id: users.id, name: users.name, role: users.role, active: users.active }).from(users).where(eq(users.id, userId));
  if (!user || !user.active) return { ok: false, error: "user_not_found" };
  if (user.role === "cliente") return { ok: false, error: "role_not_allowed" };

  const values = parsed.data;
  const [member] = await db
    .insert(projectMembers)
    .values({ projectId, userId, ...values, addedBy: actor?.id ?? null })
    .onConflictDoUpdate({ target: [projectMembers.projectId, projectMembers.userId], set: { ...values, updatedAt: new Date() } })
    .returning();
  await logAudit({
    user: actor,
    action: "acesso_concedido",
    entity: "project_member",
    entityId: project.id,
    summary: `${user.name} no projeto "${project.title}"${values.role ? ` como ${values.role}` : ""}`,
  });
  return { ok: true, member };
}

/** Tira a pessoa do projeto: o acesso dela a ele acaba na hora (a checagem é feita a cada requisição). */
export async function removeProjectMember(projectId: number, userId: number, actor: Actor | null): Promise<boolean> {
  const removed = await db
    .delete(projectMembers)
    .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, userId)))
    .returning({ id: projectMembers.id });
  if (removed.length === 0) return false;
  await logAudit({ user: actor, action: "acesso_revogado", entity: "project_member", entityId: projectId, summary: `Tirou a conta nº ${userId} do projeto nº ${projectId}` });
  return true;
}

export type ProjectMemberRow = Pick<ProjectMember, "id" | "userId" | "role" | "canView" | "canEdit" | "canDownload" | "canUpload"> & {
  name: string;
  userRole: UserRole;
  active: boolean;
};

/** Membros de um projeto, para a tela do PAINEL (equipe do projeto). Não usar em telas da equipe ou do cliente. */
export async function listProjectMembers(projectId: number): Promise<ProjectMemberRow[]> {
  return db
    .select({
      id: projectMembers.id,
      userId: projectMembers.userId,
      role: projectMembers.role,
      canView: projectMembers.canView,
      canEdit: projectMembers.canEdit,
      canDownload: projectMembers.canDownload,
      canUpload: projectMembers.canUpload,
      name: users.name,
      userRole: users.role,
      active: users.active,
    })
    .from(projectMembers)
    .innerJoin(users, eq(users.id, projectMembers.userId))
    .where(eq(projectMembers.projectId, projectId))
    .orderBy(asc(users.name), asc(users.id));
}

// ------------------------------------------------ usuários vinculados a cliente
export type ClientLinkResult = { ok: true; link: ClientUser } | { ok: false; error: "client_not_found" | "user_not_found" | "role_not_allowed" };

/** Vincula uma conta de perfil `cliente` à ficha de um cliente. Só esse perfil pode ser vinculado. */
export async function linkClientUser(clientId: number, userId: number, actor: Actor | null): Promise<ClientLinkResult> {
  const [client] = await db.select({ id: clients.id }).from(clients).where(eq(clients.id, clientId));
  if (!client) return { ok: false, error: "client_not_found" };
  const [user] = await db.select({ id: users.id, role: users.role, active: users.active }).from(users).where(eq(users.id, userId));
  if (!user || !user.active) return { ok: false, error: "user_not_found" };
  if (user.role !== "cliente") return { ok: false, error: "role_not_allowed" };

  await db.insert(clientUsers).values({ clientId, userId, addedBy: actor?.id ?? null }).onConflictDoNothing();
  const [link] = await db.select().from(clientUsers).where(and(eq(clientUsers.clientId, clientId), eq(clientUsers.userId, userId)));
  // sem nome do cliente na auditoria (ela não é apagada quando a ficha é excluída — LGPD)
  await logAudit({ user: actor, action: "acesso_concedido", entity: "client_user", entityId: clientId, summary: `Vinculou a conta nº ${userId} ao cliente nº ${clientId}` });
  return { ok: true, link };
}

export async function unlinkClientUser(clientId: number, userId: number, actor: Actor | null): Promise<boolean> {
  const removed = await db
    .delete(clientUsers)
    .where(and(eq(clientUsers.clientId, clientId), eq(clientUsers.userId, userId)))
    .returning({ id: clientUsers.id });
  if (removed.length === 0) return false;
  await logAudit({ user: actor, action: "acesso_revogado", entity: "client_user", entityId: clientId, summary: `Desvinculou a conta nº ${userId} do cliente nº ${clientId}` });
  return true;
}

export type ClientUserRow = { userId: number; name: string; email: string; active: boolean; lastLoginAt: Date | null };

/** "Usuários vinculados" de uma ficha de cliente, para o PAINEL. */
export async function listClientUsers(clientId: number): Promise<ClientUserRow[]> {
  return db
    .select({ userId: users.id, name: users.name, email: users.email, active: users.active, lastLoginAt: users.lastLoginAt })
    .from(clientUsers)
    .innerJoin(users, eq(users.id, clientUsers.userId))
    .where(eq(clientUsers.clientId, clientId))
    .orderBy(asc(users.name), asc(users.id));
}

// --------------------------------------------------------------- mudança de perfil
/**
 * Mudou o perfil de uma conta: os vínculos que não combinam com o perfil novo são apagados — quem vira cliente
 * deixa de ser membro de projetos; quem deixa de ser cliente perde os vínculos com fichas de cliente. (As
 * funções de escopo já ignoram vínculos do perfil errado; apagar evita que voltem a valer numa mudança futura.)
 */
export async function pruneAccessForRole(userId: number, role: UserRole, executor: DbOrTx = db): Promise<void> {
  if (role === "cliente") await executor.delete(projectMembers).where(eq(projectMembers.userId, userId));
  else await executor.delete(clientUsers).where(eq(clientUsers.userId, userId));
}
