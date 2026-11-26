"use server";

/**
 * Server Actions do módulo de Leads — o padrão de TODA action do painel:
 *   1. `requirePermission(módulo, ação)` primeiro (o proxy não é barreira de segurança);
 *   2. validar o que veio do cliente com zod (`parseForm` devolve o estado de erro pronto);
 *   3. mutação pelo arquivo do módulo em `src/server/…` (aqui: `src/server/leads/admin.ts`);
 *   4. `logAudit()`;
 *   5. `refresh()` + `actionOk("…")` para ficar na tela, ou `flashToast("…")` + `redirect()` para sair dela.
 */
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { flashToast } from "@/components/ui/flash";
import { actionError, actionOk, type ActionState } from "@/lib/action-state";
import { logAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/auth";
import { CONTACT_SOURCES, LEAD_STATUS_LABELS, LEAD_STATUSES, SERVICE_INTERESTS } from "@/lib/domain";
import { isValidPhone } from "@/lib/format";
import { f, parseForm } from "@/server/action";
import { convertLeadToClient, createManualLead, deleteLead, markLeadRead, setLeadStatus } from "@/server/leads/admin";

const idSchema = z.object({ id: f.id("Lead inválido.") });

// ------------------------------------------------------------ cadastro manual
const manualLeadSchema = z.object({
  name: f.text(120, "Informe o nome."),
  whatsapp: z.string().trim().refine(isValidPhone, "Informe o WhatsApp com DDD."),
  email: f.optionalEmail(),
  serviceInterest: z.enum(SERVICE_INTERESTS, { error: "Selecione o interesse." }),
  source: z.enum(CONTACT_SOURCES, { error: "Selecione a origem." }),
  eventDate: f.optionalDate(),
  city: f.optionalText(120),
  message: f.optionalText(4000),
});

export async function createLeadAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission("leads", "editar");
  const parsed = parseForm(manualLeadSchema, formData);
  if (!parsed.ok) return parsed.state;

  const lead = await createManualLead(parsed.data);
  await logAudit({ user, action: "create", entity: "lead", entityId: lead.id, summary: "Cadastrou um lead manualmente" });
  await flashToast("Lead cadastrado.");
  redirect(`/painel/leads/${lead.id}`);
}

// ---------------------------------------------------------------------- status
const statusSchema = z.object({
  id: f.id("Lead inválido."),
  status: z.enum(LEAD_STATUSES, { error: "Selecione um status." }),
});

export async function updateLeadStatusAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission("leads", "editar");
  const parsed = parseForm(statusSchema, formData);
  if (!parsed.ok) return parsed.state;

  const lead = await setLeadStatus(parsed.data.id, parsed.data.status);
  if (!lead) return actionError("Este lead não existe mais.");
  await logAudit({ user, action: "status", entity: "lead", entityId: lead.id, summary: `Status do lead: ${LEAD_STATUS_LABELS[lead.status]}` });
  refresh();
  return actionOk("Status atualizado.");
}

// --------------------------------------------------------------- marcar lido
/**
 * Chamada pelo cliente ao abrir o detalhe (ver `[id]/mark-read.tsx`): a página (GET) não grava nada sozinha.
 * Não é action de formulário, então recebe o id direto — e valida do mesmo jeito.
 */
export async function markLeadReadAction(id: number): Promise<void> {
  await requirePermission("leads", "ver");
  const parsed = z.number().int().positive().safeParse(id);
  if (!parsed.success) return;
  if (await markLeadRead(parsed.data)) refresh();
}

// ------------------------------------------------------- converter em cliente
export async function convertLeadAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission("leads", "editar");
  await requirePermission("clientes", "editar");
  const parsed = parseForm(idSchema, formData);
  if (!parsed.ok) return parsed.state;

  const result = await convertLeadToClient(parsed.data.id, user.id);
  if (!result.ok) return actionError("Este lead não existe mais.");
  if (result.created) {
    await logAudit({ user, action: "create", entity: "client", entityId: result.clientId, summary: `Converteu o lead #${parsed.data.id} em cliente` });
    await flashToast("Lead convertido em cliente.");
  }
  redirect(`/painel/clientes/${result.clientId}`);
}

// --------------------------------------------------------------------- excluir
export async function deleteLeadAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission("leads", "excluir");
  const parsed = parseForm(idSchema, formData);
  if (!parsed.ok) return parsed.state;

  const deleted = await deleteLead(parsed.data.id);
  if (deleted) {
    // LGPD: o registro de auditoria não repete os dados pessoais que acabaram de ser eliminados
    await logAudit({ user, action: "delete", entity: "lead", entityId: deleted.id, summary: "Excluiu um lead (eliminação de dados)" });
  }
  await flashToast("Lead excluído.");
  redirect("/painel/leads");
}
