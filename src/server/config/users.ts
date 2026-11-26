/**
 * Contas (de todos os ambientes): consultas e mutações. Quem autoriza (`requirePermission("usuarios", "editar")`),
 * valida e audita são as actions em `src/app/painel/config/usuarios/actions.ts`. Nunca devolve `passwordHash`.
 *
 * Proteção contra trancar o sistema: sempre precisa existir ao menos uma conta ATIVA de administrador ou sócio
 * (`ADMIN_ROLES`). Rebaixar ou desativar a última é recusado aqui, não só na tela.
 */
import "server-only";
import { and, asc, count, eq, inArray, ne } from "drizzle-orm";
import { db } from "@/db";
import { users, type User } from "@/db/schema";
import { hashPassword } from "@/lib/auth/password";
import { unlockLogin } from "@/lib/auth/rate-limit";
import { revokeResetTokens } from "@/lib/auth/reset-tokens";
import { destroyUserSessions } from "@/lib/auth/session";
import type { UserRole } from "@/lib/domain";
import { ADMIN_ROLES, isAdminRole, NO_OVERRIDES, overridesProblem, parseOverrides, type PermissionOverrides } from "@/lib/permissions";
import { permissionOverridesSchema } from "@/lib/permissions/schema";
import { pruneAccessForRole } from "@/server/access/members";
import { generateTemporaryPassword } from "./logic";

export type UserRow = Pick<User, "id" | "name" | "email" | "role" | "active" | "mustChangePassword" | "lastLoginAt" | "createdAt" | "permissions">;

const columns = {
  id: users.id,
  name: users.name,
  email: users.email,
  role: users.role,
  active: users.active,
  mustChangePassword: users.mustChangePassword,
  lastLoginAt: users.lastLoginAt,
  createdAt: users.createdAt,
  permissions: users.permissions,
};

export async function listUsers(): Promise<UserRow[]> {
  return db.select(columns).from(users).orderBy(asc(users.name), asc(users.id));
}

export async function getUser(id: number): Promise<UserRow | null> {
  const [row] = await db.select(columns).from(users).where(eq(users.id, id));
  return row ?? null;
}

async function emailTaken(email: string, exceptId?: number): Promise<boolean> {
  const [row] = await db
    .select({ id: users.id })
    .from(users)
    .where(exceptId ? and(eq(users.email, email), ne(users.id, exceptId)) : eq(users.email, email));
  return Boolean(row);
}

/** Quantas contas ativas de administrador ou sócio existem, sem contar `exceptId`. */
export async function countOtherActiveAdmins(exceptId: number): Promise<number> {
  const [row] = await db
    .select({ total: count() })
    .from(users)
    .where(and(inArray(users.role, [...ADMIN_ROLES]), eq(users.active, true), ne(users.id, exceptId)));
  return row.total;
}

export type CreateUserResult = { ok: true; user: UserRow; password: string } | { ok: false; error: "email_taken" };

/** Cria a conta com senha temporária (devolvida UMA vez; só o hash fica no banco). */
export async function createUser(input: { name: string; email: string; role: UserRole }): Promise<CreateUserResult> {
  if (await emailTaken(input.email)) return { ok: false, error: "email_taken" };
  const password = generateTemporaryPassword();
  const passwordHash = await hashPassword(password);
  const [created] = await db
    .insert(users)
    .values({ name: input.name, email: input.email, role: input.role, passwordHash, mustChangePassword: true, active: true })
    .returning(columns);
  return { ok: true, user: created, password };
}

export type UpdateUserResult = { ok: true; user: UserRow } | { ok: false; error: "not_found" | "email_taken" | "last_admin" };

export async function updateUser(id: number, input: { name: string; email: string; role: UserRole }): Promise<UpdateUserResult> {
  const current = await getUser(id);
  if (!current) return { ok: false, error: "not_found" };
  if (await emailTaken(input.email, id)) return { ok: false, error: "email_taken" };
  // tirar o perfil de administrador/sócio da última conta ativa com ele deixaria o painel sem quem gerencie as contas
  if (isAdminRole(current.role) && current.active && !isAdminRole(input.role) && (await countOtherActiveAdmins(id)) === 0) {
    return { ok: false, error: "last_admin" };
  }
  const emailChanged = current.email !== input.email;
  const roleChanged = current.role !== input.role;
  // Os ajustes individuais são relativos ao perfil: perfil novo começa do padrão dele (uma concessão feita a um
  // gestor não acompanha a pessoa quando ela vira funcionária, por exemplo).
  const [updated] = await db
    .update(users)
    .set(roleChanged ? { ...input, permissions: NO_OVERRIDES } : input)
    .where(eq(users.id, id))
    .returning(columns);
  // …e os vínculos que não combinam com o perfil novo (membro de projeto × conta de cliente) são apagados
  if (roleChanged) await pruneAccessForRole(id, input.role);
  // mudou o e-mail ou o perfil: as sessões abertas dessa conta são encerradas para valerem os novos dados
  if (emailChanged || roleChanged) await destroyUserSessions(id);
  // um link de redefinição enviado ao e-mail antigo não pode continuar valendo
  if (emailChanged) await revokeResetTokens(id);
  return { ok: true, user: updated };
}

export type SetActiveResult = { ok: true; user: UserRow } | { ok: false; error: "not_found" | "last_admin" };

/** Ativa/desativa. Desativar encerra as sessões. Não deixa desativar o último administrador/sócio ativo. */
export async function setUserActive(id: number, active: boolean): Promise<SetActiveResult> {
  const current = await getUser(id);
  if (!current) return { ok: false, error: "not_found" };
  if (!active && isAdminRole(current.role) && current.active && (await countOtherActiveAdmins(id)) === 0) {
    return { ok: false, error: "last_admin" };
  }
  const [updated] = await db.update(users).set({ active }).where(eq(users.id, id)).returning(columns);
  if (!active) {
    await destroyUserSessions(id);
    await revokeResetTokens(id);
  }
  return { ok: true, user: updated };
}

/**
 * Nova senha temporária (a conta volta a exigir troca no próximo acesso) e todas as sessões encerradas.
 * Links de redefinição pendentes deixam de valer e o login da conta é destravado (caso alguém tenha estourado
 * o limite de tentativas dela).
 */
export async function resetUserPassword(id: number): Promise<{ ok: true; user: UserRow; password: string } | { ok: false }> {
  const current = await getUser(id);
  if (!current) return { ok: false };
  const password = generateTemporaryPassword();
  const passwordHash = await hashPassword(password);
  const [updated] = await db.update(users).set({ passwordHash, mustChangePassword: true }).where(eq(users.id, id)).returning(columns);
  await destroyUserSessions(id);
  await revokeResetTokens(id);
  await unlockLogin(updated.email);
  return { ok: true, user: updated, password };
}

export type SetPermissionsResult =
  | { ok: true; user: UserRow }
  | { ok: false; error: "not_found" | "invalid" | "not_adjustable"; message: string };

/**
 * Grava os ajustes individuais de permissão de uma conta (concessões e negações sobre a matriz do perfil).
 * Validação estrita com zod; recusa ajustes em administradores/sócios (não podem ser rebaixados por ajuste),
 * em perfis que não usam o painel e concessões de módulos reservados (`overridesProblem`).
 * Vale na requisição seguinte da pessoa: as permissões são lidas do banco a cada requisição.
 */
export async function setUserPermissions(id: number, input: unknown): Promise<SetPermissionsResult> {
  const current = await getUser(id);
  if (!current) return { ok: false, error: "not_found", message: "Esta conta não existe mais." };
  const parsed = permissionOverridesSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid", message: "Lista de permissões inválida." };
  const overrides: PermissionOverrides = parsed.data;
  const problem = overridesProblem(current.role, overrides);
  if (problem) return { ok: false, error: "not_adjustable", message: problem };
  const [updated] = await db.update(users).set({ permissions: overrides }).where(eq(users.id, id)).returning(columns);
  return { ok: true, user: { ...updated, permissions: parseOverrides(updated.permissions) } };
}
