/**
 * Financeiro no PAINEL: consultas e mutações (só fala com o banco; quem autoriza/valida/audita são as actions e as páginas).
 * Funções puras de resumo ficam em `summary.ts`; filtros da URL em `filters.ts`; CSV em `csv.ts`.
 */
import "server-only";
import { and, asc, desc, eq, gte, isNotNull, isNull, lt, lte, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { clients, financeEntries, projects, proposalPayments, proposals, type FinanceEntry } from "@/db/schema";
import { endOfMonth, startOfMonth, type ISODate } from "@/lib/dates";
import type { FinanceCategory, FinanceType, PaymentMethod } from "@/lib/domain";
import { droppedMediaIds, releaseMedia } from "@/server/media";
import type { FinanceFilters, Scope } from "./filters";
import { resolveScope } from "./filters";
import { lastMonths, type EntryLike } from "./summary";

export const FINANCE_PAGE_SIZE = 25;

const likePattern = (term: string) => `%${term.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;

/** Data de referência no SQL: pagamento se houve, senão vencimento. */
const referenceSql = sql<string>`coalesce(${financeEntries.paidAt}, ${financeEntries.dueDate})`;

function scopeConditions(scope: Scope): SQL[] {
  const conditions: SQL[] = [];
  if (scope.from) conditions.push(sql`${referenceSql} >= ${scope.from}`);
  if (scope.to) conditions.push(sql`${referenceSql} <= ${scope.to}`);
  return conditions;
}

function filterWhere(filters: FinanceFilters, today: ISODate): SQL | undefined {
  const conditions: (SQL | undefined)[] = [...scopeConditions(resolveScope(filters))];
  if (filters.type) conditions.push(eq(financeEntries.type, filters.type));
  if (filters.category) conditions.push(eq(financeEntries.category, filters.category));
  if (filters.clientId) conditions.push(eq(financeEntries.clientId, filters.clientId));
  if (filters.projectId) conditions.push(eq(financeEntries.projectId, filters.projectId));
  if (filters.proposalId) conditions.push(eq(financeEntries.proposalId, filters.proposalId));
  if (filters.situation === "realizado") conditions.push(isNotNull(financeEntries.paidAt));
  if (filters.situation === "vencido") conditions.push(isNull(financeEntries.paidAt), lt(financeEntries.dueDate, today));
  if (filters.situation === "previsto") conditions.push(isNull(financeEntries.paidAt), gte(financeEntries.dueDate, today));
  if (filters.q) {
    const text = likePattern(filters.q.toLowerCase());
    conditions.push(sql`(lower(${financeEntries.description}) like ${text} escape '\\' or lower(${financeEntries.supplier}) like ${text} escape '\\')`);
  }
  return and(...conditions);
}

/** "2026-007" ou "2026-007 v2" — para o aviso do filtro por proposta (`?proposta=`). `null` se não existir. */
export async function getProposalLabel(id: number): Promise<string | null> {
  const [row] = await db.select({ number: proposals.number, version: proposals.version }).from(proposals).where(and(eq(proposals.id, id), eq(proposals.isTemplate, false)));
  return row ? `${row.number}${row.version > 1 ? ` v${row.version}` : ""}` : null;
}

export type FinanceListItem = FinanceEntry & { clientName: string | null; projectTitle: string | null };

/** Todos os lançamentos do filtro (sem paginar): usados nos totais, na lista e no CSV. */
export async function listFinanceEntries(filters: FinanceFilters, today: ISODate): Promise<FinanceListItem[]> {
  const scope = resolveScope(filters);
  const rows = await db
    .select({ entry: financeEntries, clientName: clients.name, projectTitle: projects.title })
    .from(financeEntries)
    .leftJoin(clients, eq(clients.id, financeEntries.clientId))
    .leftJoin(projects, eq(projects.id, financeEntries.projectId))
    .where(filterWhere(filters, today))
    .orderBy(scope.kind === "month" ? asc(referenceSql) : desc(referenceSql), asc(financeEntries.id));
  return rows.map((row) => ({ ...row.entry, clientName: row.clientName, projectTitle: row.projectTitle }));
}

/** Lançamentos de um mês (data de referência no mês), só o que o resumo precisa. */
export async function getMonthEntries(month: ISODate): Promise<EntryLike[]> {
  return db
    .select({ type: financeEntries.type, amountCents: financeEntries.amountCents, dueDate: financeEntries.dueDate, paidAt: financeEntries.paidAt })
    .from(financeEntries)
    .where(and(...scopeConditions({ kind: "month", from: startOfMonth(month), to: endOfMonth(month) })));
}

/** Tudo que está em aberto e já venceu (qualquer mês). */
export async function getOverdueEntries(today: ISODate): Promise<EntryLike[]> {
  return db
    .select({ type: financeEntries.type, amountCents: financeEntries.amountCents, dueDate: financeEntries.dueDate, paidAt: financeEntries.paidAt })
    .from(financeEntries)
    .where(and(isNull(financeEntries.paidAt), lt(financeEntries.dueDate, today)));
}

/** Realizados dos últimos `count` meses terminando em `endMonth` (para o gráfico). */
export async function getRealizedEntries(endMonth: string, count = 6): Promise<EntryLike[]> {
  const months = lastMonths(endMonth, count);
  const from = `${months[0]}-01`;
  const to = endOfMonth(`${months[months.length - 1]}-01`);
  return db
    .select({ type: financeEntries.type, amountCents: financeEntries.amountCents, dueDate: financeEntries.dueDate, paidAt: financeEntries.paidAt })
    .from(financeEntries)
    .where(and(isNotNull(financeEntries.paidAt), gte(financeEntries.paidAt, from), lte(financeEntries.paidAt, to)));
}

export async function getFinanceEntry(id: number): Promise<FinanceEntry | null> {
  const [row] = await db.select().from(financeEntries).where(eq(financeEntries.id, id));
  return row ?? null;
}

// ------------------------------------------------------------------ mutações
export type EntryInput = {
  type: FinanceType;
  category: FinanceCategory;
  description: string;
  amountCents: number;
  dueDate: ISODate;
  paidAt: ISODate | null;
  installmentLabel: string;
  method: PaymentMethod | null;
  supplier: string;
  clientId: number | null;
  projectId: number | null;
  proposalId: number | null;
  receiptMediaId: number | null;
  receiptUrl: string;
  notes: string;
};

export async function createFinanceEntry(input: EntryInput, userId: number): Promise<FinanceEntry> {
  const [row] = await db
    .insert(financeEntries)
    .values({ ...input, createdBy: userId })
    .returning();
  return row;
}

export async function updateFinanceEntry(id: number, input: EntryInput): Promise<FinanceEntry | null> {
  const previous = await getFinanceEntry(id);
  const [row] = await db
    .update(financeEntries)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(financeEntries.id, id))
    .returning();
  // comprovante trocado ou removido: o arquivo antigo é apagado (não fica órfão no disco e nos backups)
  if (row && previous) await releaseMedia(droppedMediaIds([previous.receiptMediaId], [row.receiptMediaId]));
  return row ?? null;
}

export async function setEntryPaid(id: number, paidAt: ISODate | null, method?: PaymentMethod | null): Promise<FinanceEntry | null> {
  const [row] = await db
    .update(financeEntries)
    .set({ paidAt, ...(method !== undefined ? { method } : {}), updatedAt: new Date() })
    .where(eq(financeEntries.id, id))
    .returning();
  return row ?? null;
}

/** Cópia como PREVISTO (sem pagamento nem comprovante) — útil para lançamentos recorrentes. */
export async function duplicateFinanceEntry(id: number, dueDate: ISODate, userId: number): Promise<FinanceEntry | null> {
  const source = await getFinanceEntry(id);
  if (!source) return null;
  const [row] = await db
    .insert(financeEntries)
    .values({
      type: source.type,
      category: source.category,
      description: source.description,
      amountCents: source.amountCents,
      dueDate,
      paidAt: null,
      installmentLabel: "",
      method: null,
      supplier: source.supplier,
      clientId: source.clientId,
      projectId: source.projectId,
      proposalId: source.proposalId,
      receiptMediaId: null,
      receiptUrl: "",
      notes: source.notes,
      createdBy: userId,
    })
    .returning();
  return row;
}

/** Exclui o lançamento e apaga o comprovante dele (se nenhum outro registro usar o mesmo arquivo). */
export async function deleteFinanceEntry(id: number): Promise<FinanceEntry | null> {
  const [row] = await db.delete(financeEntries).where(eq(financeEntries.id, id)).returning();
  if (row) await releaseMedia([row.receiptMediaId]);
  return row ?? null;
}

// ------------------------------------------- parcelas de proposta → lançamentos
export type ProposalInstallments = {
  proposal: { id: number; number: string; version: number; title: string; clientId: number | null; clientName: string | null; projectId: number | null };
  installments: {
    id: number;
    label: string;
    dueDate: ISODate | null;
    dueLabel: string;
    amountCents: number;
    /** Já existe um lançamento de receita desta proposta com a mesma parcela e valor. */
    alreadyCreated: boolean;
  }[];
};

export async function getProposalInstallments(proposalId: number): Promise<ProposalInstallments | null> {
  const [proposal] = await db
    .select({
      id: proposals.id,
      number: proposals.number,
      version: proposals.version,
      title: proposals.title,
      clientId: proposals.clientId,
      clientName: clients.name,
      isTemplate: proposals.isTemplate,
      clientDisplayName: proposals.clientDisplayName,
    })
    .from(proposals)
    .leftJoin(clients, eq(clients.id, proposals.clientId))
    .where(eq(proposals.id, proposalId));
  if (!proposal || proposal.isTemplate) return null;
  const [payments, existing, project] = await Promise.all([
    db.select().from(proposalPayments).where(eq(proposalPayments.proposalId, proposalId)).orderBy(asc(proposalPayments.sortOrder), asc(proposalPayments.id)),
    db
      .select({ installmentLabel: financeEntries.installmentLabel, amountCents: financeEntries.amountCents })
      .from(financeEntries)
      .where(and(eq(financeEntries.proposalId, proposalId), eq(financeEntries.type, "receita"))),
    db.select({ id: projects.id }).from(projects).where(eq(projects.proposalId, proposalId)).orderBy(desc(projects.id)).limit(1),
  ]);
  return {
    proposal: {
      id: proposal.id,
      number: proposal.number,
      version: proposal.version,
      title: proposal.title,
      clientId: proposal.clientId,
      clientName: proposal.clientName ?? (proposal.clientDisplayName || null),
      projectId: project[0]?.id ?? null,
    },
    installments: payments.map((payment) => ({
      id: payment.id,
      label: payment.label,
      dueDate: payment.dueDate,
      dueLabel: payment.dueLabel,
      amountCents: payment.amountCents,
      alreadyCreated: existing.some((entry) => entry.installmentLabel === payment.label && entry.amountCents === payment.amountCents),
    })),
  };
}

/** Cria um lançamento de receita PREVISTO por parcela. Devolve os criados. */
export async function createEntriesFromInstallments(
  data: ProposalInstallments,
  installmentIds: number[],
  today: ISODate,
  userId: number,
): Promise<FinanceEntry[]> {
  const chosen = data.installments.filter((installment) => installmentIds.includes(installment.id) && installment.amountCents > 0);
  if (chosen.length === 0) return [];
  const { proposal } = data;
  const who = proposal.clientName ? ` · ${proposal.clientName}` : "";
  const rows = chosen.map((installment) => ({
    type: "receita" as const,
    category: "servico" as const,
    description: `Proposta ${proposal.number}${who} — ${installment.label}`.slice(0, 200),
    amountCents: installment.amountCents,
    dueDate: installment.dueDate ?? today,
    installmentLabel: installment.label,
    clientId: proposal.clientId,
    projectId: proposal.projectId,
    proposalId: proposal.id,
    notes: installment.dueDate ? "" : installment.dueLabel ? `Vencimento combinado: ${installment.dueLabel}. Ajuste a data quando souber.` : "",
    createdBy: userId,
  }));
  return db.insert(financeEntries).values(rows).returning();
}
