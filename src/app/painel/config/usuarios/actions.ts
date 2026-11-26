"use server";

/**
 * Server Actions de Usuários — todas exigem a permissão "editar" em Usuários (só administradores e sócios: o
 * módulo é reservado e não pode ser concedido por ajuste). Senhas temporárias nunca vão para log/auditoria.
 */
import { refresh } from "next/cache";
import { z } from "zod";
import { actionError, actionOk, type ActionState } from "@/lib/action-state";
import { logAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/auth";
import { USER_ROLE_LABELS, USER_ROLES } from "@/lib/domain";
import { f, formToObject, jsonField, parseForm } from "@/server/action";
import { linkClientUser, unlinkClientUser } from "@/server/access/members";
import { createUser, resetUserPassword, setUserActive, setUserPermissions, updateUser } from "@/server/config/users";
import { getSetting } from "@/server/settings";

/** O que a tela recebe depois de criar/redefinir: a senha temporária, mostrada uma única vez. */
export type TemporaryCredentials = { name: string; email: string; password: string };

const accountFields = {
  name: f.text(120, "Informe o nome."),
  email: f
    .text(160, "Informe o e-mail.")
    .toLowerCase()
    .refine((v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v), "E-mail inválido."),
  role: z.enum(USER_ROLES, { error: "Selecione o perfil." }),
};

/** O que o usuário digitou, para repopular o formulário quando a regra de negócio recusa. */
function typed(formData: FormData): Record<string, string> {
  return Object.fromEntries(Object.entries(formToObject(formData)).filter((entry): entry is [string, string] => typeof entry[1] === "string"));
}

/**
 * Perfis que podem nascer AQUI, com senha temporária: os de quem administra ou dá suporte. Gestor, funcionário,
 * freelancer e cliente nascem por CONVITE (a pessoa cria a própria senha e o convite já carrega os vínculos de
 * projeto/cliente) — `createInviteAction` em src/server/access.
 */
const DIRECT_ROLES = ["admin", "socio", "tecnico"] as const;
const createSchema = z.object({ ...accountFields, role: z.enum(DIRECT_ROLES, { error: "Este perfil nasce por convite: use “Convidar pessoa”." }) });
const updateSchema = z.object({ id: f.id("Conta inválida."), ...accountFields });
const idSchema = z.object({ id: f.id("Conta inválida.") });

export async function createUserAction(_prev: ActionState<TemporaryCredentials>, formData: FormData): Promise<ActionState<TemporaryCredentials>> {
  const admin = await requirePermission("usuarios", "editar");
  const parsed = parseForm(createSchema, formData);
  if (!parsed.ok) return parsed.state;

  const result = await createUser(parsed.data);
  if (!result.ok) return actionError("Já existe uma conta com este e-mail.", { fieldErrors: { email: "Já existe uma conta com este e-mail." }, values: typed(formData) });
  await logAudit({ user: admin, action: "create", entity: "user", entityId: result.user.id, summary: `Criou a conta de ${result.user.name} (${USER_ROLE_LABELS[result.user.role]})` });
  refresh();
  return actionOk("Conta criada.", { name: result.user.name, email: result.user.email, password: result.password });
}

export async function updateUserAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requirePermission("usuarios", "editar");
  const parsed = parseForm(updateSchema, formData);
  if (!parsed.ok) return parsed.state;
  const { id, ...input } = parsed.data;

  if (id === admin.id && input.role !== admin.role) {
    return actionError("Você não pode mudar o seu próprio perfil. Peça a outro administrador.", { fieldErrors: { role: "Não é possível mudar o próprio perfil." }, values: typed(formData) });
  }
  const result = await updateUser(id, input);
  if (!result.ok) {
    if (result.error === "not_found") return actionError("Esta conta não existe mais.");
    if (result.error === "email_taken") return actionError("Já existe uma conta com este e-mail.", { fieldErrors: { email: "Já existe uma conta com este e-mail." }, values: typed(formData) });
    return actionError("Esta é a única conta ativa de administrador ou sócio. Crie ou promova outra antes de mudar este perfil.", { fieldErrors: { role: "Precisa haver ao menos um administrador ou sócio ativo." }, values: typed(formData) });
  }
  await logAudit({ user: admin, action: "update", entity: "user", entityId: id, summary: `Editou a conta de ${result.user.name} (${USER_ROLE_LABELS[result.user.role]})` });
  refresh();
  return actionOk("Conta atualizada.");
}

export async function resetUserPasswordAction(_prev: ActionState<TemporaryCredentials>, formData: FormData): Promise<ActionState<TemporaryCredentials>> {
  const admin = await requirePermission("usuarios", "editar");
  const parsed = parseForm(idSchema, formData);
  if (!parsed.ok) return parsed.state;
  if (parsed.data.id === admin.id) return actionError("Para trocar a sua própria senha, use Minha conta.");

  const result = await resetUserPassword(parsed.data.id);
  if (!result.ok) return actionError("Esta conta não existe mais.");
  await logAudit({ user: admin, action: "password_reset", entity: "user", entityId: result.user.id, summary: `Redefiniu a senha de ${result.user.name} e encerrou as sessões` });
  refresh();
  return actionOk("Nova senha gerada.", { name: result.user.name, email: result.user.email, password: result.password });
}

const activeSchema = z.object({ id: f.id("Conta inválida."), active: z.enum(["true", "false"]) });

export async function setUserActiveAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requirePermission("usuarios", "editar");
  const parsed = parseForm(activeSchema, formData);
  if (!parsed.ok) return parsed.state;
  const active = parsed.data.active === "true";
  if (!active && parsed.data.id === admin.id) return actionError("Você não pode desativar a sua própria conta.");

  const result = await setUserActive(parsed.data.id, active);
  if (!result.ok) {
    return actionError(result.error === "not_found" ? "Esta conta não existe mais." : "Esta é a única conta ativa de administrador ou sócio e não pode ser desativada.");
  }
  await logAudit({
    user: admin,
    action: active ? "activate" : "deactivate",
    entity: "user",
    entityId: result.user.id,
    summary: active ? `Reativou a conta de ${result.user.name}` : `Desativou a conta de ${result.user.name} e encerrou as sessões`,
  });
  refresh();
  if (active) return actionOk("Conta reativada.");
  // A lista de avisos de novo lead é separada das contas: desativar a conta não tira o e-mail de lá.
  const stillNotified = (await getSetting("notifications")).leadEmails.some((email) => email.toLowerCase() === result.user.email.toLowerCase());
  return actionOk(stillNotified ? "Conta desativada. O e-mail dela ainda recebe os avisos de novo lead: tire-o em Configurações › Notificações." : "Conta desativada.");
}

const permissionsSchema = z.object({ id: f.id("Conta inválida.") });

/**
 * Ajustes individuais de permissão (tela: "Permissões" em cada conta). O formulário manda `grant` e `deny` como JSON em campos
 * ocultos: listas de "modulo:acao". Quem valida as chaves e as regras é `setUserPermissions`.
 */
export async function setUserPermissionsAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requirePermission("usuarios", "editar");
  const parsed = parseForm(permissionsSchema, formData);
  if (!parsed.ok) return parsed.state;
  if (parsed.data.id === admin.id) return actionError("Você não pode mudar as suas próprias permissões. Peça a outro administrador.");

  const result = await setUserPermissions(parsed.data.id, { grant: jsonField(formData, "grant") ?? [], deny: jsonField(formData, "deny") ?? [] });
  if (!result.ok) return actionError(result.message);
  const { grant, deny } = result.user.permissions;
  await logAudit({
    user: admin,
    action: "permissoes",
    entity: "user",
    entityId: result.user.id,
    summary: `Ajustou as permissões de ${result.user.name}: ${grant.length} concessão(ões), ${deny.length} negação(ões)`,
  });
  refresh();
  return actionOk("Permissões atualizadas.");
}

// ------------------------------------------------------- acessos do cliente
/*
 * Contas de perfil Cliente vinculadas a uma ficha (bloco "Acessos do cliente" em Clientes › ficha). É gestão de
 * ACESSO DE CONTA, não do cadastro do cliente: exige "editar" em Usuários (admin e sócio) — por isso mora aqui
 * e não em `clientes/actions.ts`. Convidar um acesso novo usa `createInviteAction` (src/server/access).
 */
const clientLinkSchema = z.object({ clientId: f.id("Cliente inválido."), userId: f.id("Escolha a conta.") });

export async function linkClientUserAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requirePermission("usuarios", "editar");
  const parsed = parseForm(clientLinkSchema, formData);
  if (!parsed.ok) return parsed.state;
  const result = await linkClientUser(parsed.data.clientId, parsed.data.userId, admin);
  if (!result.ok) {
    return actionError(
      result.error === "client_not_found" ? "Este cliente não existe mais." : result.error === "user_not_found" ? "Esta conta não existe mais ou está desativada." : "Só contas de perfil Cliente podem ser vinculadas a uma ficha.",
    );
  }
  refresh();
  return actionOk("Conta vinculada a este cliente.");
}

export async function unlinkClientUserAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requirePermission("usuarios", "editar");
  const parsed = parseForm(clientLinkSchema, formData);
  if (!parsed.ok) return parsed.state;
  await unlinkClientUser(parsed.data.clientId, parsed.data.userId, admin);
  refresh();
  return actionOk("Conta desvinculada. Ela deixa de ver os projetos deste cliente.");
}
