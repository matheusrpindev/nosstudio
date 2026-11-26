"use server";

/**
 * Server Actions de Clientes. Padrão do painel: requirePermission → zod → mutação (src/server/clients/admin.ts) →
 * logAudit → refresh()/redirect().
 */
import { inArray } from "drizzle-orm";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { flashToast } from "@/components/ui/flash";
import { db } from "@/db";
import { users } from "@/db/schema";
import { actionError, actionOk, type ActionState } from "@/lib/action-state";
import { logAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/auth";
import { CLIENT_KINDS, CLIENT_STATUS_LABELS, CLIENT_STATUSES, CONTACT_SOURCES, INTERACTION_KINDS, SERVICE_INTERESTS } from "@/lib/domain";
import { isISODate } from "@/lib/dates";
import { isValidPhone, onlyDigits } from "@/lib/format";
import { f, formToObject, jsonField, parseForm, parseInput } from "@/server/action";
import { addInteraction, createClient, deleteClient, setClientStatus, updateClient, type ClientInput } from "@/server/clients/admin";
import { localDateTimeToDate } from "@/server/clients/local-time";

const idSchema = z.object({ id: f.id("Cliente inválido.") });
const LOST_REASON_REQUIRED = "Conte por que o cliente foi perdido — isso ajuda a melhorar as próximas propostas.";

// --------------------------------------------------------------- cadastro/edição
const clientSchema = z
  .object({
    name: f.text(120, "Informe o nome ou a empresa."),
    contactName: f.optionalText(120),
    kind: z.enum(CLIENT_KINDS, { error: "Selecione o tipo." }),
    whatsapp: z
      .string()
      .trim()
      .refine((v) => v === "" || isValidPhone(v), "Informe o WhatsApp com DDD."),
    email: f.optionalEmail(),
    document: z
      .string()
      .trim()
      .max(30, "Documento muito longo.")
      .refine((v) => v === "" || [11, 14].includes(onlyDigits(v).length), "CPF tem 11 dígitos e CNPJ tem 14."),
    city: f.optionalText(120),
    segment: f.optionalText(120),
    source: z.enum(CONTACT_SOURCES, { error: "Selecione a origem." }),
    serviceInterest: z.enum(SERVICE_INTERESTS, { error: "Selecione o serviço de interesse." }),
    ownerId: f.optionalId(),
    status: z.enum(CLIENT_STATUSES, { error: "Selecione o status." }),
    lostReason: f.optionalText(500),
    firstContactAt: f.optionalDate(),
    nextStep: f.optionalText(300),
    nextStepDate: f.optionalDate(),
    importantDates: z
      .array(z.object({ label: z.string().trim().min(1).max(80), date: z.string().refine(isISODate) }))
      .max(30, "No máximo 30 datas."),
    notes: f.optionalText(5000),
  })
  .superRefine((value, ctx) => {
    if (value.status === "perdido" && !value.lostReason) ctx.addIssue({ code: "custom", path: ["lostReason"], message: LOST_REASON_REQUIRED });
  });

/** Lê o formulário de cliente (as datas importantes chegam como JSON; linhas totalmente vazias são descartadas). */
function parseClientForm(formData: FormData) {
  const object = formToObject(formData);
  const values: Record<string, string> = {};
  for (const [key, value] of Object.entries(object)) if (typeof value === "string") values[key] = value;
  const rawDates = jsonField(formData, "importantDates");
  const rows = Array.isArray(rawDates) ? rawDates : [];
  const importantDates = rows.filter((row) => {
    const r = row as { label?: unknown; date?: unknown };
    return String(r?.label ?? "").trim() !== "" || String(r?.date ?? "") !== "";
  });
  const parsed = parseInput(clientSchema, { ...object, importantDates }, values);
  if (!parsed.ok && Object.keys(parsed.state.fieldErrors ?? {}).some((key) => key.startsWith("importantDates"))) {
    const fieldErrors = { ...parsed.state.fieldErrors };
    for (const key of Object.keys(fieldErrors)) if (key.startsWith("importantDates.")) delete fieldErrors[key];
    fieldErrors.importantDates = "Preencha o nome e a data de cada data importante.";
    return { ok: false as const, state: { ...parsed.state, fieldErrors } };
  }
  return parsed;
}

/** O responsável precisa existir (o select só oferece usuários ativos, mas o POST pode ser forjado). */
async function ownerExists(ownerId: number | null): Promise<boolean> {
  if (ownerId === null) return true;
  const rows = await db.select({ id: users.id }).from(users).where(inArray(users.id, [ownerId]));
  return rows.length > 0;
}

export async function createClientAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission("clientes", "editar");
  const parsed = parseClientForm(formData);
  if (!parsed.ok) return parsed.state;
  if (!(await ownerExists(parsed.data.ownerId))) return actionError("Selecione um responsável válido.", { fieldErrors: { ownerId: "Responsável inválido." }, values: formToValues(formData) });

  const client = await createClient(parsed.data satisfies ClientInput, user.id);
  await logAudit({ user, action: "create", entity: "client", entityId: client.id, summary: "Cadastrou um cliente" });
  await flashToast("Cliente cadastrado.");
  redirect(`/painel/clientes/${client.id}`);
}

export async function updateClientAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission("clientes", "editar");
  const id = parseForm(idSchema, formData);
  if (!id.ok) return id.state;
  const parsed = parseClientForm(formData);
  if (!parsed.ok) return parsed.state;
  if (!(await ownerExists(parsed.data.ownerId))) return actionError("Selecione um responsável válido.", { fieldErrors: { ownerId: "Responsável inválido." }, values: formToValues(formData) });

  const result = await updateClient(id.data.id, parsed.data satisfies ClientInput, user.id);
  if (!result) return actionError("Este cliente não existe mais.");
  await logAudit({ user, action: "update", entity: "client", entityId: id.data.id, summary: "Editou o cadastro do cliente" });
  if (result.statusChanged) {
    await logAudit({
      user,
      action: "status",
      entity: "client",
      entityId: id.data.id,
      summary: `Status do cliente: ${CLIENT_STATUS_LABELS[result.statusChanged.from]} → ${CLIENT_STATUS_LABELS[result.statusChanged.to]}`,
    });
  }
  await flashToast("Cadastro atualizado.");
  redirect(`/painel/clientes/${id.data.id}`);
}

function formToValues(formData: FormData): Record<string, string> {
  const values: Record<string, string> = {};
  for (const [key, value] of Object.entries(formToObject(formData))) if (typeof value === "string") values[key] = value;
  return values;
}

// ---------------------------------------------------------------------- status
/** Chamada pelo funil (Board): recebe `(id, coluna)` direto, não um FormData. A mensagem de erro aparece acima do quadro. */
export async function moveClientAction(cardId: number, toColumnId: string): Promise<ActionState> {
  const user = await requirePermission("clientes", "editar");
  const parsed = parseInput(z.object({ id: f.id("Cliente inválido."), status: z.enum(CLIENT_STATUSES, { error: "Etapa inválida." }) }), { id: cardId, status: toColumnId });
  if (!parsed.ok) return actionError(parsed.state.message ?? "Movimento inválido.");

  const result = await setClientStatus(parsed.data.id, parsed.data.status, user.id);
  if (!result) return actionError("Este cliente não existe mais.");
  if (result.statusChanged) {
    await logAudit({
      user,
      action: "status",
      entity: "client",
      entityId: parsed.data.id,
      summary: `Status do cliente: ${CLIENT_STATUS_LABELS[result.statusChanged.from]} → ${CLIENT_STATUS_LABELS[result.statusChanged.to]} (funil)`,
    });
  }
  refresh();
  return actionOk();
}

const statusSchema = z
  .object({
    id: f.id("Cliente inválido."),
    status: z.enum(CLIENT_STATUSES, { error: "Selecione um status." }),
    lostReason: f.optionalText(500),
  })
  .superRefine((value, ctx) => {
    if (value.status === "perdido" && !value.lostReason) ctx.addIssue({ code: "custom", path: ["lostReason"], message: LOST_REASON_REQUIRED });
  });

/** Formulário "Andamento" da ficha. */
export async function updateClientStatusAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission("clientes", "editar");
  const parsed = parseForm(statusSchema, formData);
  if (!parsed.ok) return parsed.state;

  const result = await setClientStatus(parsed.data.id, parsed.data.status, user.id, parsed.data.lostReason);
  if (!result) return actionError("Este cliente não existe mais.");
  if (!result.statusChanged) return actionOk("O status já era esse.");
  await logAudit({
    user,
    action: "status",
    entity: "client",
    entityId: parsed.data.id,
    summary: `Status do cliente: ${CLIENT_STATUS_LABELS[result.statusChanged.from]} → ${CLIENT_STATUS_LABELS[result.statusChanged.to]}`,
  });
  refresh();
  return actionOk("Status atualizado.");
}

// ----------------------------------------------------------------- atendimento
const MANUAL_KINDS = INTERACTION_KINDS.filter((kind) => kind !== "status") as readonly Exclude<(typeof INTERACTION_KINDS)[number], "status">[];

const interactionSchema = z.object({
  clientId: f.id("Cliente inválido."),
  kind: z.enum(MANUAL_KINDS as [string, ...string[]], { error: "Selecione o tipo de atendimento." }),
  content: f.text(4000, "Escreva o que aconteceu no atendimento."),
  occurredAt: z
    .string()
    .transform((v) => localDateTimeToDate(v))
    .refine((v): v is Date => v !== null, "Informe uma data e hora válidas."),
});

export async function addInteractionAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission("clientes", "editar");
  const parsed = parseForm(interactionSchema, formData);
  if (!parsed.ok) return parsed.state;

  const created = await addInteraction({
    clientId: parsed.data.clientId,
    userId: user.id,
    kind: parsed.data.kind as (typeof MANUAL_KINDS)[number],
    content: parsed.data.content,
    occurredAt: parsed.data.occurredAt,
  });
  if (!created) return actionError("Este cliente não existe mais.");
  await logAudit({ user, action: "create", entity: "client_interaction", entityId: created.id, summary: `Registrou um atendimento no cliente #${parsed.data.clientId}` });
  refresh();
  return actionOk("Atendimento registrado.");
}

// --------------------------------------------------------------------- excluir
export async function deleteClientAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission("clientes", "excluir");
  const parsed = parseForm(idSchema, formData);
  if (!parsed.ok) return parsed.state;

  const deleted = await deleteClient(parsed.data.id, { withLeads: formData.get("deleteLeads") === "on" });
  if (deleted) {
    // LGPD: a auditoria não repete os dados pessoais que acabaram de ser eliminados
    const what = deleted.leadsDeleted > 0 ? `um cliente, o histórico de atendimento e ${deleted.leadsDeleted} pedido(s) recebido(s) pelo site` : "um cliente e o histórico de atendimento";
    await logAudit({ user, action: "delete", entity: "client", entityId: deleted.id, summary: `Excluiu ${what}` });
  }
  await flashToast("Cliente excluído.");
  redirect("/painel/clientes");
}
