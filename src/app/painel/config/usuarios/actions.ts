"use server";

/** Server Actions de Usuários — todas exigem administrador. Senhas temporárias nunca vão para log/auditoria. */
import { refresh } from "next/cache";
import { z } from "zod";
import { actionError, actionOk, type ActionState } from "@/lib/action-state";
import { logAudit } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth";
import { USER_ROLE_LABELS, USER_ROLES } from "@/lib/domain";
import { f, formToObject, parseForm } from "@/server/action";
import { createUser, resetUserPassword, setUserActive, updateUser } from "@/server/config/users";
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

const createSchema = z.object(accountFields);
const updateSchema = z.object({ id: f.id("Conta inválida."), ...accountFields });
const idSchema = z.object({ id: f.id("Conta inválida.") });

export async function createUserAction(_prev: ActionState<TemporaryCredentials>, formData: FormData): Promise<ActionState<TemporaryCredentials>> {
  const admin = await requireAdmin();
  const parsed = parseForm(createSchema, formData);
  if (!parsed.ok) return parsed.state;

  const result = await createUser(parsed.data);
  if (!result.ok) return actionError("Já existe uma conta com este e-mail.", { fieldErrors: { email: "Já existe uma conta com este e-mail." }, values: typed(formData) });
  await logAudit({ user: admin, action: "create", entity: "user", entityId: result.user.id, summary: `Criou a conta de ${result.user.name} (${USER_ROLE_LABELS[result.user.role]})` });
  refresh();
  return actionOk("Conta criada.", { name: result.user.name, email: result.user.email, password: result.password });
}

export async function updateUserAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
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
    return actionError("Esta é a única conta de administrador ativa. Crie ou promova outra antes de mudar este perfil.", { fieldErrors: { role: "Precisa haver ao menos um administrador ativo." }, values: typed(formData) });
  }
  await logAudit({ user: admin, action: "update", entity: "user", entityId: id, summary: `Editou a conta de ${result.user.name} (${USER_ROLE_LABELS[result.user.role]})` });
  refresh();
  return actionOk("Conta atualizada.");
}

export async function resetUserPasswordAction(_prev: ActionState<TemporaryCredentials>, formData: FormData): Promise<ActionState<TemporaryCredentials>> {
  const admin = await requireAdmin();
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
  const admin = await requireAdmin();
  const parsed = parseForm(activeSchema, formData);
  if (!parsed.ok) return parsed.state;
  const active = parsed.data.active === "true";
  if (!active && parsed.data.id === admin.id) return actionError("Você não pode desativar a sua própria conta.");

  const result = await setUserActive(parsed.data.id, active);
  if (!result.ok) {
    return actionError(result.error === "not_found" ? "Esta conta não existe mais." : "Esta é a única conta de administrador ativa e não pode ser desativada.");
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
