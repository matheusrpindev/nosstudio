"use server";

/**
 * Server Actions dos convites. Ainda não há tela: ficam prontas para Configurações › Usuários (criar, revogar)
 * e para a futura tela pública de aceite (`/convite?token=…`). Regras, limites e auditoria: ./invites.ts.
 */
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { actionError, actionOk, type ActionState } from "@/lib/action-state";
import { LOGIN_PATH, requirePermission } from "@/lib/auth";
import { rateLimitIp } from "@/lib/client-ip";
import { getClientIp } from "@/lib/request";
import { f, parseForm } from "@/server/action";
import { acceptInvite, createInvite, revokeInvite, sendInviteEmail } from "./invites";

const createSchema = z.object({
  email: z.string(),
  name: f.optionalText(120),
  role: z.string(),
  clientId: f.optionalId(),
  projectId: f.optionalId(),
  projectRole: f.optionalText(60),
});

/** Cria o convite e envia o e-mail. Só quem gerencia usuários (admin, sócio). */
export async function createInviteAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission("usuarios", "editar");
  const parsed = parseForm(createSchema, formData);
  if (!parsed.ok) return parsed.state;
  // o perfil e as combinações (cliente ↔ ficha, projeto ↔ equipe) são validados por `createInvite`
  const result = await createInvite(parsed.data as Parameters<typeof createInvite>[0], user);
  if (!result.ok) return actionError(result.message, { fieldErrors: result.fieldErrors });
  const mail = await sendInviteEmail(result.invite, result.token);
  refresh();
  return actionOk(mail.delivered ? "Convite enviado por e-mail." : "Convite criado, mas o e-mail não pôde ser enviado. Confira o envio de e-mails e convide de novo.");
}

const revokeSchema = z.object({ id: f.id("Convite inválido.") });

export async function revokeInviteAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission("usuarios", "editar");
  const parsed = parseForm(revokeSchema, formData);
  if (!parsed.ok) return parsed.state;
  const result = await revokeInvite(parsed.data.id, user);
  if (!result.ok) {
    return actionError(result.error === "already_accepted" ? "Este convite já foi aceito. Para tirar o acesso, desative a conta." : "Este convite não existe mais.");
  }
  refresh();
  return actionOk("Convite revogado. O link enviado deixou de funcionar.");
}

/** Aceite PÚBLICO (sem sessão): só funciona com um convite válido para aquele e-mail. Termina na tela de login. */
export async function acceptInviteAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const text = (name: string) => {
    const value = formData.get(name);
    return typeof value === "string" ? value : "";
  };
  const values = { email: text("email"), name: text("name") };
  if (text("password") !== text("confirm")) {
    return actionError("As senhas não conferem.", { fieldErrors: { confirm: "Repita a mesma senha." }, values });
  }
  const result = await acceptInvite(
    { token: text("token"), email: text("email"), name: text("name"), password: text("password") },
    { ipBucket: rateLimitIp(await getClientIp()) },
  );
  if (!result.ok) {
    const field = result.error === "weak_password" ? "password" : result.error === "invalid_name" ? "name" : null;
    const fieldErrors: Record<string, string> | undefined = field ? { [field]: result.message } : undefined;
    return actionError(result.message, { fieldErrors, values });
  }
  redirect(`${LOGIN_PATH}?aviso=conta-criada`);
}
