"use server";

/**
 * Notificações: marcar como lida(s). Vale para QUALQUER conta do painel e só alcança as notificações da própria
 * pessoa (`markRead`/`markAllRead` filtram por `userId` no banco — o id vindo do formulário não basta).
 */
import { refresh } from "next/cache";
import { z } from "zod";
import { actionOk, type ActionState } from "@/lib/action-state";
import { requirePanelUser } from "@/lib/auth";
import { f, parseForm } from "@/server/action";
import { markAllRead, markRead } from "@/server/notifications";

export async function markNotificationReadAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePanelUser();
  const parsed = parseForm(z.object({ id: f.id("Notificação inválida.") }), formData);
  if (!parsed.ok) return parsed.state;
  await markRead(user.id, [parsed.data.id]);
  refresh();
  return actionOk();
}

export async function markAllNotificationsReadAction(_prev: ActionState, _formData: FormData): Promise<ActionState> {
  const user = await requirePanelUser();
  const changed = await markAllRead(user.id);
  refresh();
  return actionOk(changed > 0 ? "Notificações marcadas como lidas." : undefined);
}
