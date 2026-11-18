"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { actionOk, type ActionState } from "@/lib/action-state";
import { logAudit } from "@/lib/audit";
import { requireUser } from "@/lib/auth";
import { f, jsonField, parseInput } from "@/server/action";
import { saveSetting } from "@/server/settings";

const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(160, "E-mail longo demais.")
  .refine((v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v), "Há um e-mail inválido na lista.");

const schema = z.object({
  notifyOnLead: f.checkbox(),
  leadEmails: z.array(emailSchema).max(10, "No máximo 10 destinatários."),
});

export async function saveNotificationsAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = parseInput(schema, { notifyOnLead: formData.get("notifyOnLead") ?? undefined, leadEmails: jsonField(formData, "leadEmails") ?? [] });
  if (!parsed.ok) {
    // o erro de um item da lista (`leadEmails.2`) aparece no campo da lista inteira
    const errors = parsed.state.fieldErrors ?? {};
    const listError = Object.entries(errors).find(([key]) => key.startsWith("leadEmails"))?.[1];
    return listError ? { ...parsed.state, fieldErrors: { ...errors, leadEmails: listError } } : parsed.state;
  }

  const leadEmails = [...new Set(parsed.data.leadEmails)];
  await saveSetting("notifications", { notifyOnLead: parsed.data.notifyOnLead, leadEmails }, user.id);
  await logAudit({
    user,
    action: "update",
    entity: "settings",
    entityId: "notifications",
    summary: `Aviso de novo lead por e-mail: ${parsed.data.notifyOnLead ? "ligado" : "desligado"} (${leadEmails.length === 0 ? "todos os usuários ativos" : `${leadEmails.length} destinatário(s)`})`,
  });
  refresh();
  return actionOk("Notificações salvas.");
}
