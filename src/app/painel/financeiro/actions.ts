"use server";

/**
 * Server Actions do Financeiro. Toda action: `requireUser()` → zod → mutação (`src/server/finance/admin.ts`) →
 * `logAudit()` → `refresh()`/`redirect()`.
 */
import { eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { flashToast } from "@/components/ui/flash";
import { actionError, actionOk, type ActionState } from "@/lib/action-state";
import { logAudit } from "@/lib/audit";
import { requireUser } from "@/lib/auth";
import { db } from "@/db";
import { clients, projects, proposals } from "@/db/schema";
import { formatDate, todayISO } from "@/lib/dates";
import { FINANCE_CATEGORIES, FINANCE_CATEGORIES_BY_TYPE, FINANCE_TYPES, PAYMENT_METHODS, type PaymentMethod } from "@/lib/domain";
import { formatBRL, safeUrl } from "@/lib/format";
import { f, parseForm } from "@/server/action";
import {
  createEntriesFromInstallments,
  createFinanceEntry,
  deleteFinanceEntry,
  duplicateFinanceEntry,
  getFinanceEntry,
  getProposalInstallments,
  setEntryPaid,
  updateFinanceEntry,
  type EntryInput,
} from "@/server/finance/admin";
import { monthKey } from "@/server/finance/summary";
import { getMediaById } from "@/server/media";
import { saveSetting } from "@/server/settings";

const idSchema = z.object({ id: f.id("Lançamento inválido.") });

/** Método de pagamento opcional: vazio = não informado. */
const optionalMethod = z
  .string()
  .optional()
  .transform((v) => (v ? v : null))
  .refine((v): v is PaymentMethod | null => v === null || (PAYMENT_METHODS as readonly string[]).includes(v), "Método inválido.");

const entrySchema = z
  .object({
    id: f.optionalId(),
    type: z.enum(FINANCE_TYPES, { error: "Selecione o tipo." }),
    category: z.enum(FINANCE_CATEGORIES, { error: "Selecione a categoria." }),
    description: f.text(200, "Descreva o lançamento."),
    amount: f.money("Informe o valor."),
    dueDate: f.date("Informe o vencimento."),
    paidAt: f.optionalDate(),
    installmentLabel: f.optionalText(60),
    method: optionalMethod,
    supplier: f.optionalText(160),
    clientId: f.optionalId(),
    projectId: f.optionalId(),
    proposalId: f.optionalId(),
    receipt: f.optionalId(),
    receiptUrl: f.optionalText(500),
    notes: f.optionalText(2000),
  })
  .superRefine((data, ctx) => {
    if (!(FINANCE_CATEGORIES_BY_TYPE[data.type] as readonly string[]).includes(data.category)) {
      ctx.addIssue({ code: "custom", path: ["category"], message: "Esta categoria não vale para o tipo escolhido." });
    }
    if (data.amount <= 0) ctx.addIssue({ code: "custom", path: ["amount"], message: "O valor precisa ser maior que zero." });
    if (data.amount > 99_999_999_99) ctx.addIssue({ code: "custom", path: ["amount"], message: "Valor alto demais." });
  });

/** Confere que os vínculos existem (evita erro de chave estrangeira e mensagem confusa). */
async function checkLinks(data: { clientId: number | null; projectId: number | null; proposalId: number | null; receipt: number | null }): Promise<Record<string, string>> {
  const errors: Record<string, string> = {};
  const [client, project, proposal, media] = await Promise.all([
    data.clientId ? db.select({ id: clients.id }).from(clients).where(eq(clients.id, data.clientId)) : null,
    data.projectId ? db.select({ id: projects.id }).from(projects).where(eq(projects.id, data.projectId)) : null,
    data.proposalId ? db.select({ id: proposals.id }).from(proposals).where(eq(proposals.id, data.proposalId)) : null,
    data.receipt ? getMediaById(data.receipt) : null,
  ]);
  if (client && client.length === 0) errors.clientId = "Este cliente não existe mais.";
  if (project && project.length === 0) errors.projectId = "Este projeto não existe mais.";
  if (proposal && proposal.length === 0) errors.proposalId = "Esta proposta não existe mais.";
  if (data.receipt && (!media || media.visibility !== "private")) errors.receipt = "Arquivo inválido. Envie o comprovante de novo.";
  return errors;
}

// ------------------------------------------------------------- criar / editar
export async function saveEntryAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = parseForm(entrySchema, formData);
  if (!parsed.ok) return parsed.state;
  const data = parsed.data;

  const fieldErrors: Record<string, string> = await checkLinks(data);
  const receiptUrl = data.receiptUrl ? safeUrl(data.receiptUrl) : "";
  if (data.receiptUrl && !receiptUrl) fieldErrors.receiptUrl = "Informe um link válido (https://…).";
  if (Object.keys(fieldErrors).length > 0) {
    return actionError("Confira os campos destacados.", { fieldErrors, values: Object.fromEntries([...formData.entries()].filter((entry): entry is [string, string] => typeof entry[1] === "string")) });
  }

  const input: EntryInput = {
    type: data.type,
    category: data.category,
    description: data.description,
    amountCents: data.amount,
    dueDate: data.dueDate,
    paidAt: data.paidAt,
    installmentLabel: data.installmentLabel,
    method: data.method,
    supplier: data.type === "despesa" ? data.supplier : "",
    clientId: data.clientId,
    projectId: data.projectId,
    proposalId: data.proposalId,
    receiptMediaId: data.receipt,
    receiptUrl,
    notes: data.notes,
  };

  let entry;
  if (data.id) {
    entry = await updateFinanceEntry(data.id, input);
    if (!entry) return actionError("Este lançamento não existe mais.");
    await logAudit({ user, action: "update", entity: "finance_entry", entityId: entry.id, summary: `Editou lançamento (${data.type}, ${formatBRL(entry.amountCents)})` });
    await flashToast("Lançamento salvo.");
  } else {
    entry = await createFinanceEntry(input, user.id);
    await logAudit({ user, action: "create", entity: "finance_entry", entityId: entry.id, summary: `Criou lançamento (${data.type}, ${formatBRL(entry.amountCents)})` });
    await flashToast("Lançamento criado.");
  }
  redirect(`/painel/financeiro?mes=${monthKey(entry.paidAt ?? entry.dueDate)}#lancamentos`);
}

// -------------------------------------------------- marcar como recebido/pago
const paySchema = z.object({ id: f.id("Lançamento inválido."), paidAt: f.date("Informe a data do pagamento."), method: optionalMethod });

export async function markPaidAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = parseForm(paySchema, formData);
  if (!parsed.ok) return parsed.state;
  const { id, paidAt, method } = parsed.data;

  const current = await getFinanceEntry(id);
  if (!current) return actionError("Este lançamento não existe mais.");
  const entry = await setEntryPaid(id, paidAt, method ?? current.method);
  if (!entry) return actionError("Este lançamento não existe mais.");
  await logAudit({
    user,
    action: "status",
    entity: "finance_entry",
    entityId: id,
    summary: `${entry.type === "receita" ? "Marcou como recebido" : "Marcou como pago"} em ${formatDate(paidAt)} (${formatBRL(entry.amountCents)})`,
  });
  refresh();
  return actionOk(entry.type === "receita" ? "Marcado como recebido." : "Marcado como pago.");
}

export async function undoPaidAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = parseForm(idSchema, formData);
  if (!parsed.ok) return parsed.state;
  const entry = await setEntryPaid(parsed.data.id, null);
  if (!entry) return actionError("Este lançamento não existe mais.");
  await logAudit({ user, action: "status", entity: "finance_entry", entityId: entry.id, summary: "Desfez o pagamento/recebimento (voltou a previsto)" });
  refresh();
  return actionOk("Voltou para previsto.");
}

// -------------------------------------------------------------------- duplicar
const duplicateSchema = z.object({ id: f.id("Lançamento inválido."), dueDate: f.date("Informe o novo vencimento.") });

export async function duplicateEntryAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = parseForm(duplicateSchema, formData);
  if (!parsed.ok) return parsed.state;
  const copy = await duplicateFinanceEntry(parsed.data.id, parsed.data.dueDate, user.id);
  if (!copy) return actionError("Este lançamento não existe mais.");
  await logAudit({ user, action: "create", entity: "finance_entry", entityId: copy.id, summary: `Duplicou o lançamento #${parsed.data.id} para ${formatDate(copy.dueDate)}` });
  refresh();
  return actionOk(`Lançamento duplicado para ${formatDate(copy.dueDate)}.`);
}

// --------------------------------------------------------------------- excluir
const deleteSchema = z.object({ id: f.id("Lançamento inválido."), stay: f.checkbox() });

export async function deleteEntryAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = parseForm(deleteSchema, formData);
  if (!parsed.ok) return parsed.state;
  const deleted = await deleteFinanceEntry(parsed.data.id);
  if (deleted) {
    await logAudit({ user, action: "delete", entity: "finance_entry", entityId: deleted.id, summary: `Excluiu lançamento (${deleted.type}, ${formatBRL(deleted.amountCents)})` });
  }
  if (parsed.data.stay) {
    refresh();
    return actionOk("Lançamento excluído.");
  }
  await flashToast("Lançamento excluído.");
  redirect("/painel/financeiro");
}

// ------------------------------------------------------------ reserva de caixa
const reserveSchema = z.object({
  cashReserve: f.money("Informe o valor atual da reserva."),
  goal: f.optionalMoney(),
  note: f.optionalText(1000),
});

export async function saveReserveAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = parseForm(reserveSchema, formData);
  if (!parsed.ok) return parsed.state;
  await saveSetting("finance", { cashReserveCents: parsed.data.cashReserve, cashReserveGoalCents: parsed.data.goal ?? 0, note: parsed.data.note }, user.id);
  await logAudit({ user, action: "update", entity: "finance_reserve", summary: `Atualizou a reserva de caixa (${formatBRL(parsed.data.cashReserve)})` });
  refresh();
  return actionOk("Reserva de caixa atualizada.");
}

// ------------------------------------------------- parcelas da proposta → lançamentos
const installmentsSchema = z.object({
  proposalId: f.id("Proposta inválida."),
  parcela: z.array(z.coerce.number().int().positive()).min(1, "Marque pelo menos uma parcela."),
});

export async function generateInstallmentsAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = parseForm(installmentsSchema, formData);
  if (!parsed.ok) return parsed.state;

  // os valores vêm do banco, nunca do formulário: o cliente só diz QUAIS parcelas
  const data = await getProposalInstallments(parsed.data.proposalId);
  if (!data) return actionError("Esta proposta não existe mais.");
  const created = await createEntriesFromInstallments(data, parsed.data.parcela, todayISO(), user.id);
  if (created.length === 0) return actionError("Nenhuma parcela válida foi selecionada.");
  await logAudit({
    user,
    action: "create",
    entity: "finance_entry",
    entityId: created[0].id,
    summary: `Gerou ${created.length} ${created.length === 1 ? "lançamento" : "lançamentos"} a receber da proposta ${data.proposal.number}`,
  });
  await flashToast(created.length === 1 ? "1 lançamento criado." : `${created.length} lançamentos criados.`);
  redirect(`/painel/financeiro?mes=${monthKey(created[0].dueDate)}#lancamentos`);
}
