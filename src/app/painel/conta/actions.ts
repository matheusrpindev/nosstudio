"use server";

import { refresh } from "next/cache";
import { actionOk, type ActionState } from "@/lib/action-state";
import { logAudit } from "@/lib/audit";
import { requireSessionUser } from "@/lib/auth";
import { destroyUserSessions, getSession } from "@/lib/auth/session";

/** Encerra as sessões do usuário em outros aparelhos (mantém a atual). É da própria conta: vale em qualquer ambiente. */
export async function endOtherSessionsAction(_prev: ActionState, _formData: FormData): Promise<ActionState> {
  const user = await requireSessionUser();
  const session = await getSession();
  if (!session) return actionOk();
  await destroyUserSessions(user.id, session.sessionId);
  await logAudit({ user, action: "sessoes_encerradas", entity: "user", entityId: user.id, summary: "Encerrou as sessões em outros aparelhos" });
  refresh();
  return actionOk("Outras sessões encerradas.");
}
