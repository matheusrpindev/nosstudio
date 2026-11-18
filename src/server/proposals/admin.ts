/**
 * Orçamentos e propostas no PAINEL: consultas e mutações (o caminho banco → PDF fica em `source.ts`).
 *
 * Este arquivo só fala com o banco: recebe dados JÁ validados (as Server Actions em
 * `src/app/painel/orcamentos/actions.ts` autorizam, validam com zod, auditam e navegam).
 *
 * Segurança: custos, rateio, tributos, margem-alvo e notas internas são lidos e gravados aqui apenas para o
 * editor do painel. Nada daqui alimenta o PDF — ele usa exclusivamente `loadPublicProposal()` → `toPublicProposal()`.
 */
import "server-only";
import { and, asc, count, desc, eq, inArray, max, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import {
  clientInteractions,
  clients,
  contracts,
  financeEntries,
  projects,
  proposalCosts,
  proposalItems,
  proposalPayments,
  proposals,
  users,
  type Proposal,
  type ProposalCost,
  type ProposalItem,
  type ProposalPayment,
} from "@/db/schema";
import { addDays, formatDate, todayISO } from "@/lib/dates";
import {
  PROPOSAL_STATUSES,
  type ContractStatus,
  type EntryMode,
  type FinanceType,
  type ProposalCostCategory,
  type ProposalItemKind,
  type ProposalModality,
  type ProposalStatus,
  type ServiceInterest,
} from "@/lib/domain";
import { formatBRL, onlyDigits } from "@/lib/format";
import { clientNumbers } from "@/lib/proposals/calc";
import { getSetting } from "@/server/settings";
import { advanceClientInFunnel, type FunnelMove } from "./funnel";
import { nextProposalNumber } from "./source";

export const PROPOSALS_PAGE_SIZE = 20;

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** `%` e `_` digitados pelo usuário não podem virar curingas do LIKE. */
const likePattern = (term: string) => `%${term.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;

const isUniqueViolation = (error: unknown) => {
  const seen = new Set<unknown>();
  for (let current: unknown = error; current && !seen.has(current); current = (current as { cause?: unknown }).cause) {
    seen.add(current);
    const text = `${(current as { code?: string }).code ?? ""} ${(current as { message?: string }).message ?? ""}`;
    if (/SQLITE_CONSTRAINT|UNIQUE constraint/i.test(text)) return true;
  }
  return false;
};

// ------------------------------------------------------------------ consultas
export type ProposalFilters = {
  status?: ProposalStatus;
  /** Busca livre: número, cliente ou título. */
  q?: string;
  page?: number;
};

export type ProposalListItem = {
  id: number;
  number: string;
  version: number;
  modality: ProposalModality;
  status: ProposalStatus;
  title: string;
  clientId: number | null;
  /** Nome na capa ou, se vazio, o nome do cadastro. */
  clientLabel: string;
  ownerName: string | null;
  validUntil: string | null;
  /** Total ao cliente (mesma conta do PDF). */
  totalCents: number;
  /** Validade vencida numa proposta ainda em aberto (rascunho ou enviada). */
  overdue: boolean;
};

function proposalWhere(filters: ProposalFilters): SQL | undefined {
  const conditions: (SQL | undefined)[] = [eq(proposals.isTemplate, false)];
  if (filters.status) conditions.push(eq(proposals.status, filters.status));
  const q = filters.q?.trim().slice(0, 80);
  if (q) {
    const text = likePattern(q.toLowerCase());
    conditions.push(
      or(
        sql`lower(${proposals.number}) like ${text} escape '\\'`,
        sql`lower(${proposals.title}) like ${text} escape '\\'`,
        sql`lower(${proposals.clientDisplayName}) like ${text} escape '\\'`,
        sql`lower(coalesce(${clients.name}, '')) like ${text} escape '\\'`,
      ),
    );
  }
  return and(...conditions);
}

/** Total ao cliente de várias propostas de uma vez (soma dos itens inclusos − desconto aprovado). */
async function totalsFor(rows: Pick<Proposal, "id" | "discountCents" | "discountApproved" | "entryMode" | "entryPercent" | "entryCents">[]): Promise<Map<number, number>> {
  const totals = new Map<number, number>();
  if (rows.length === 0) return totals;
  const items = await db
    .select({ proposalId: proposalItems.proposalId, kind: proposalItems.kind, quantity: proposalItems.quantity, unitPriceCents: proposalItems.unitPriceCents })
    .from(proposalItems)
    .where(
      inArray(
        proposalItems.proposalId,
        rows.map((row) => row.id),
      ),
    );
  for (const row of rows) {
    const numbers = clientNumbers({
      items: items.filter((item) => item.proposalId === row.id),
      discountCents: row.discountCents,
      discountApproved: row.discountApproved,
      entryMode: row.entryMode,
      entryPercent: row.entryPercent,
      entryCents: row.entryCents,
    });
    totals.set(row.id, numbers.totalCents);
  }
  return totals;
}

/** Lista paginada (sem modelos), mais recentes primeiro. */
export async function listProposals(filters: ProposalFilters = {}): Promise<{ rows: ProposalListItem[]; total: number; page: number; pageSize: number }> {
  const where = proposalWhere(filters);
  const [{ total }] = await db.select({ total: count() }).from(proposals).leftJoin(clients, eq(clients.id, proposals.clientId)).where(where);
  const pageCount = Math.max(1, Math.ceil(total / PROPOSALS_PAGE_SIZE));
  const page = Math.min(Math.max(1, filters.page ?? 1), pageCount);
  const rows = await db
    .select({ proposal: proposals, clientName: clients.name, ownerName: users.name })
    .from(proposals)
    .leftJoin(clients, eq(clients.id, proposals.clientId))
    .leftJoin(users, eq(users.id, proposals.ownerId))
    .where(where)
    .orderBy(desc(proposals.createdAt), desc(proposals.id))
    .limit(PROPOSALS_PAGE_SIZE)
    .offset((page - 1) * PROPOSALS_PAGE_SIZE);
  const totals = await totalsFor(rows.map((row) => row.proposal));
  const today = todayISO();
  return {
    rows: rows.map(({ proposal, clientName, ownerName }) => ({
      id: proposal.id,
      number: proposal.number,
      version: proposal.version,
      modality: proposal.modality,
      status: proposal.status,
      title: proposal.title,
      clientId: proposal.clientId,
      clientLabel: proposal.clientDisplayName.trim() || clientName || "",
      ownerName,
      validUntil: proposal.validUntil,
      totalCents: totals.get(proposal.id) ?? 0,
      overdue: isOverdue(proposal, today),
    })),
    total,
    page,
    pageSize: PROPOSALS_PAGE_SIZE,
  };
}

/** Validade vencida numa proposta que ainda espera resposta. */
export function isOverdue(proposal: Pick<Proposal, "status" | "validUntil">, today: string): boolean {
  return Boolean(proposal.validUntil && proposal.validUntil < today && (proposal.status === "rascunho" || proposal.status === "enviada"));
}

/** Quantas propostas há em cada status (para as abas da lista). */
export async function countProposalsByStatus(): Promise<Record<ProposalStatus, number> & { all: number }> {
  const rows = await db.select({ status: proposals.status, total: count() }).from(proposals).where(eq(proposals.isTemplate, false)).groupBy(proposals.status);
  const counts = Object.fromEntries(PROPOSAL_STATUSES.map((status) => [status, 0])) as Record<ProposalStatus, number>;
  let all = 0;
  for (const row of rows) {
    counts[row.status] = row.total;
    all += row.total;
  }
  return { ...counts, all };
}

export type TemplateListItem = {
  id: number;
  templateName: string;
  modality: ProposalModality;
  title: string;
  itemCount: number;
  totalCents: number;
};

/** Modelos reutilizáveis, em ordem alfabética. */
export async function listTemplates(): Promise<TemplateListItem[]> {
  const rows = await db.select().from(proposals).where(eq(proposals.isTemplate, true)).orderBy(asc(proposals.templateName), asc(proposals.id));
  if (rows.length === 0) return [];
  const [totals, counts] = await Promise.all([
    totalsFor(rows),
    db
      .select({ proposalId: proposalItems.proposalId, total: count() })
      .from(proposalItems)
      .where(
        inArray(
          proposalItems.proposalId,
          rows.map((row) => row.id),
        ),
      )
      .groupBy(proposalItems.proposalId),
  ]);
  return rows.map((row) => ({
    id: row.id,
    templateName: row.templateName || row.title,
    modality: row.modality,
    title: row.title,
    itemCount: counts.find((entry) => entry.proposalId === row.id)?.total ?? 0,
    totalCents: totals.get(row.id) ?? 0,
  }));
}

export type ProposalVersion = { id: number; version: number; status: ProposalStatus; createdAt: Date; sentAt: Date | null };
export type ContractOption = { id: number; title: string; status: ContractStatus };
/** Lançamentos do financeiro já ligados a esta proposta (parcelas geradas ou lançadas à mão). */
export type ProposalFinanceSummary = {
  count: number;
  receivableCents: number;
  receivedCents: number;
  /** Os lançamentos em si, por vencimento (no máximo `FINANCE_PREVIEW_LIMIT`; `count` é o total). */
  entries: { id: number; type: FinanceType; description: string; amountCents: number; dueDate: string; paidAt: string | null }[];
};
const FINANCE_PREVIEW_LIMIT = 12;

export type ProposalEditorData = {
  proposal: Proposal;
  items: ProposalItem[];
  /** Custos internos — SÓ painel. */
  costs: ProposalCost[];
  payments: ProposalPayment[];
  client: { id: number; name: string; whatsapp: string } | null;
  /** Todas as versões da mesma cadeia (inclui esta), da mais antiga para a mais nova. */
  versions: ProposalVersion[];
  project: { id: number; title: string } | null;
  /** Contratos do cliente (para vincular). */
  contracts: ContractOption[];
  /** Resumo dos lançamentos do financeiro com esta proposta (`count` 0 = parcelas ainda não geradas). */
  finance: ProposalFinanceSummary;
};

/** Tudo o que o editor precisa de uma proposta ou modelo (`null` se não existir). */
export async function getProposalEditorData(id: number): Promise<ProposalEditorData | null> {
  const [proposal] = await db.select().from(proposals).where(eq(proposals.id, id));
  if (!proposal) return null;
  const rootId = proposal.rootId ?? proposal.id;

  const [items, costs, payments, clientRows, versions, projectRows, contractRows, financeRows] = await Promise.all([
    db.select().from(proposalItems).where(eq(proposalItems.proposalId, id)).orderBy(asc(proposalItems.sortOrder), asc(proposalItems.id)),
    db.select().from(proposalCosts).where(eq(proposalCosts.proposalId, id)).orderBy(asc(proposalCosts.sortOrder), asc(proposalCosts.id)),
    db.select().from(proposalPayments).where(eq(proposalPayments.proposalId, id)).orderBy(asc(proposalPayments.sortOrder), asc(proposalPayments.id)),
    proposal.clientId
      ? db.select({ id: clients.id, name: clients.name, whatsapp: clients.whatsapp }).from(clients).where(eq(clients.id, proposal.clientId))
      : Promise.resolve([]),
    proposal.isTemplate
      ? Promise.resolve([])
      : db
          .select({ id: proposals.id, version: proposals.version, status: proposals.status, createdAt: proposals.createdAt, sentAt: proposals.sentAt })
          .from(proposals)
          .where(and(eq(proposals.isTemplate, false), or(eq(proposals.id, rootId), eq(proposals.rootId, rootId))))
          .orderBy(asc(proposals.version), asc(proposals.id)),
    proposal.projectId ? db.select({ id: projects.id, title: projects.title }).from(projects).where(eq(projects.id, proposal.projectId)) : Promise.resolve([]),
    proposal.clientId
      ? db
          .select({ id: contracts.id, title: contracts.title, status: contracts.status })
          .from(contracts)
          .where(and(eq(contracts.clientId, proposal.clientId), eq(contracts.isTemplate, false)))
          .orderBy(desc(contracts.id))
      : Promise.resolve([]),
    proposal.isTemplate
      ? Promise.resolve([])
      : db
          .select({ id: financeEntries.id, type: financeEntries.type, description: financeEntries.description, amountCents: financeEntries.amountCents, dueDate: financeEntries.dueDate, paidAt: financeEntries.paidAt })
          .from(financeEntries)
          .where(eq(financeEntries.proposalId, id))
          .orderBy(asc(financeEntries.dueDate), asc(financeEntries.id)),
  ]);

  const receivables = financeRows.filter((entry) => entry.type === "receita");
  const finance: ProposalFinanceSummary = {
    count: financeRows.length,
    receivableCents: receivables.reduce((total, entry) => total + entry.amountCents, 0),
    receivedCents: receivables.filter((entry) => entry.paidAt !== null).reduce((total, entry) => total + entry.amountCents, 0),
    entries: financeRows.slice(0, FINANCE_PREVIEW_LIMIT),
  };

  return { proposal, items, costs, payments, client: clientRows[0] ?? null, versions, project: projectRows[0] ?? null, contracts: contractRows, finance };
}

// ------------------------------------------------------------------ cópia
type ItemInput = { kind: ProposalItemKind; title: string; description: string; quantity: number; unit: string; unitPriceCents: number };
type CostInput = { category: ProposalCostCategory; description: string; amountCents: number };
type PaymentInput = { label: string; dueDate: string | null; dueLabel: string; amountCents: number };

async function insertChildren(tx: Tx, proposalId: number, children: { items: ItemInput[]; costs: CostInput[]; payments: PaymentInput[] }) {
  if (children.items.length > 0) {
    await tx.insert(proposalItems).values(children.items.map((item, index) => ({ ...pickItem(item), proposalId, sortOrder: index + 1 })));
  }
  if (children.costs.length > 0) {
    await tx.insert(proposalCosts).values(children.costs.map((cost, index) => ({ ...pickCost(cost), proposalId, sortOrder: index + 1 })));
  }
  if (children.payments.length > 0) {
    await tx.insert(proposalPayments).values(children.payments.map((payment, index) => ({ ...pickPayment(payment), proposalId, sortOrder: index + 1 })));
  }
}

const pickItem = (item: ItemInput): ItemInput => ({
  kind: item.kind,
  title: item.title,
  description: item.description,
  quantity: item.quantity,
  unit: item.unit,
  unitPriceCents: item.unitPriceCents,
});
const pickCost = (cost: CostInput): CostInput => ({ category: cost.category, description: cost.description, amountCents: cost.amountCents });
const pickPayment = (payment: PaymentInput): PaymentInput => ({
  label: payment.label,
  dueDate: payment.dueDate,
  dueLabel: payment.dueLabel,
  amountCents: payment.amountCents,
});

async function loadChildren(tx: Tx, proposalId: number) {
  const items = await tx.select().from(proposalItems).where(eq(proposalItems.proposalId, proposalId)).orderBy(asc(proposalItems.sortOrder), asc(proposalItems.id));
  const costs = await tx.select().from(proposalCosts).where(eq(proposalCosts.proposalId, proposalId)).orderBy(asc(proposalCosts.sortOrder), asc(proposalCosts.id));
  const payments = await tx
    .select()
    .from(proposalPayments)
    .where(eq(proposalPayments.proposalId, proposalId))
    .orderBy(asc(proposalPayments.sortOrder), asc(proposalPayments.id));
  return { items, costs, payments };
}

/** Campos de conteúdo copiados entre propostas (escopo, textos, preço e premissas internas). */
function contentOf(source: Proposal) {
  return {
    modality: source.modality,
    title: source.title,
    intro: source.intro,
    scheduleText: source.scheduleText,
    exclusions: source.exclusions,
    paymentNotes: source.paymentNotes,
    conditions: source.conditions,
    discountCents: source.discountCents,
    discountLabel: source.discountLabel,
    discountApproved: source.discountApproved,
    showItemPrices: source.showItemPrices,
    entryMode: source.entryMode,
    entryPercent: source.entryPercent,
    entryCents: source.entryCents,
    overheadCents: source.overheadCents,
    taxPercent: source.taxPercent,
    targetMarginPercent: source.targetMarginPercent,
  };
}

/** Número de proposta com nova tentativa se outro usuário pegou o mesmo número no mesmo instante. */
async function withFreshNumber<T>(create: (number: string) => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    const number = await nextProposalNumber();
    try {
      return await create(number);
    } catch (error) {
      if (attempt >= 4 || !isUniqueViolation(error)) throw error;
    }
  }
}

/** Modelos também precisam de um "número" único: `MODELO-0007` (pelo id). */
async function insertTemplate(tx: Tx, values: Omit<typeof proposals.$inferInsert, "number" | "isTemplate" | "version">): Promise<number> {
  const [created] = await tx
    .insert(proposals)
    .values({ ...values, isTemplate: true, version: 1, number: `MODELO-TMP-${crypto.randomUUID()}` })
    .returning({ id: proposals.id });
  await tx
    .update(proposals)
    .set({ number: `MODELO-${String(created.id).padStart(4, "0")}` })
    .where(eq(proposals.id, created.id));
  return created.id;
}

// ------------------------------------------------------------------ criação
export type NewProposalInput = {
  modality: ProposalModality;
  title: string;
  /** Cliente existente… */
  clientId: number | null;
  /** …ou cadastro rápido (nome + WhatsApp). */
  newClient: { name: string; whatsapp: string } | null;
  templateId: number | null;
  userId: number;
};

export type NewProposalResult = { ok: true; id: number; number: string; createdClientId: number | null } | { ok: false; reason: "client_not_found" | "template_not_found" };

/**
 * Cria uma proposta em rascunho com os padrões das configurações (validade, entrada, textos e premissas) e,
 * se houver modelo, copia dele itens, parcelas, custos e textos.
 */
export async function createProposal(input: NewProposalInput): Promise<NewProposalResult> {
  const settings = await getSetting("proposal");
  const today = todayISO();

  return withFreshNumber((number) =>
    db.transaction(async (tx) => {
      // conferências primeiro: um retorno de erro aqui não pode deixar nada gravado
      let template: Proposal | null = null;
      if (input.templateId) {
        const [row] = await tx
          .select()
          .from(proposals)
          .where(and(eq(proposals.id, input.templateId), eq(proposals.isTemplate, true)));
        if (!row) return { ok: false, reason: "template_not_found" } as const;
        template = row;
      }

      let clientId = input.clientId;
      let contactName = "";
      let createdClientId: number | null = null;
      if (clientId) {
        const [client] = await tx.select({ id: clients.id, contactName: clients.contactName }).from(clients).where(eq(clients.id, clientId));
        if (!client) return { ok: false, reason: "client_not_found" } as const;
        contactName = client.contactName;
      } else if (input.newClient) {
        const [client] = await tx
          .insert(clients)
          .values({
            name: input.newClient.name,
            whatsapp: onlyDigits(input.newClient.whatsapp),
            status: "em_orcamento",
            serviceInterest: SERVICE_BY_MODALITY[input.modality],
            firstContactAt: today,
            ownerId: input.userId,
          })
          .returning({ id: clients.id });
        clientId = client.id;
        createdClientId = client.id;
      }

      const base = template
        ? {
            ...contentOf(template),
            paymentNotes: template.paymentNotes || settings.paymentNotes,
            conditions: template.conditions || settings.conditions,
            taxPercent: template.taxPercent || settings.taxPercent,
            targetMarginPercent: template.targetMarginPercent || settings.targetMarginPercent,
          }
        : {
            entryMode: "percentual" as EntryMode,
            entryPercent: settings.entryPercent,
            paymentNotes: settings.paymentNotes,
            conditions: settings.conditions,
            taxPercent: settings.taxPercent,
            targetMarginPercent: settings.targetMarginPercent,
          };

      const [created] = await tx
        .insert(proposals)
        .values({
          ...base,
          number,
          version: 1,
          isTemplate: false,
          status: "rascunho",
          modality: input.modality,
          title: input.title || template?.title || "Proposta",
          clientId,
          contactName,
          ownerId: input.userId,
          createdBy: input.userId,
          validUntil: addDays(today, settings.validityDays),
        })
        .returning({ id: proposals.id });
      if (template) await insertChildren(tx, created.id, await loadChildren(tx, template.id));
      return { ok: true, id: created.id, number, createdClientId } as const;
    }),
  );
}

/** Modelo novo, em branco, com as premissas padrão. */
export async function createTemplate(input: { templateName: string; modality: ProposalModality; title: string; userId: number }): Promise<number> {
  const settings = await getSetting("proposal");
  return db.transaction((tx) =>
    insertTemplate(tx, {
      templateName: input.templateName,
      modality: input.modality,
      title: input.title,
      status: "rascunho",
      entryMode: "percentual",
      entryPercent: settings.entryPercent,
      paymentNotes: settings.paymentNotes,
      conditions: settings.conditions,
      taxPercent: settings.taxPercent,
      targetMarginPercent: settings.targetMarginPercent,
      createdBy: input.userId,
    }),
  );
}

// ------------------------------------------------------------------ salvar
export type ProposalSaveInput = {
  templateName: string;
  modality: ProposalModality;
  clientId: number | null;
  clientDisplayName: string;
  contactName: string;
  ownerId: number | null;
  title: string;
  eventDate: string | null;
  eventLocation: string;
  validUntil: string | null;
  intro: string;
  scheduleText: string;
  exclusions: string;
  paymentNotes: string;
  conditions: string;
  items: ItemInput[];
  discountCents: number;
  discountLabel: string;
  discountApproved: boolean;
  showItemPrices: boolean;
  entryMode: EntryMode;
  entryPercent: number;
  entryCents: number;
  payments: PaymentInput[];
  costs: CostInput[];
  overheadCents: number;
  taxPercent: number;
  targetMarginPercent: number;
  internalNotes: string;
};

export type SaveResult = { ok: true; proposal: Proposal; totalCents: number } | { ok: false; reason: "not_found" | "client_not_found" | "owner_not_found" };

/**
 * Grava o editor inteiro numa transação: atualiza a proposta e SUBSTITUI itens, custos e parcelas.
 * O servidor refaz a conta do preço (`clientNumbers`) e grava o sinal coerente nos dois formatos (% e valor).
 */
export async function saveProposal(id: number, input: ProposalSaveInput): Promise<SaveResult> {
  return db.transaction(async (tx) => {
    const [current] = await tx.select({ id: proposals.id, isTemplate: proposals.isTemplate }).from(proposals).where(eq(proposals.id, id));
    if (!current) return { ok: false, reason: "not_found" } as const;

    // modelos não têm cliente, validade nem data de evento
    const clientId = current.isTemplate ? null : input.clientId;
    if (clientId) {
      const [client] = await tx.select({ id: clients.id }).from(clients).where(eq(clients.id, clientId));
      if (!client) return { ok: false, reason: "client_not_found" } as const;
    }
    if (input.ownerId) {
      const [owner] = await tx.select({ id: users.id }).from(users).where(eq(users.id, input.ownerId));
      if (!owner) return { ok: false, reason: "owner_not_found" } as const;
    }

    const numbers = clientNumbers({
      items: input.items,
      discountCents: input.discountCents,
      discountApproved: input.discountApproved,
      entryMode: input.entryMode,
      entryPercent: input.entryPercent,
      entryCents: input.entryCents,
    });
    const itemsTotal = numbers.itemsTotalCents;

    const [proposal] = await tx
      .update(proposals)
      .set({
        templateName: current.isTemplate ? input.templateName || input.title : "",
        modality: input.modality,
        clientId,
        clientDisplayName: current.isTemplate ? "" : input.clientDisplayName,
        contactName: current.isTemplate ? "" : input.contactName,
        ownerId: input.ownerId,
        title: input.title,
        eventDate: current.isTemplate ? null : input.eventDate,
        eventLocation: input.eventLocation,
        validUntil: current.isTemplate ? null : input.validUntil,
        intro: input.intro,
        scheduleText: input.scheduleText,
        exclusions: input.exclusions,
        paymentNotes: input.paymentNotes,
        conditions: input.conditions,
        // o desconto nunca passa do valor dos itens
        discountCents: Math.min(input.discountCents, itemsTotal),
        discountLabel: input.discountLabel,
        discountApproved: input.discountApproved,
        showItemPrices: input.showItemPrices,
        entryMode: input.entryMode,
        // sinal recalculado no servidor: % e valor ficam coerentes com o total
        entryPercent: numbers.entryPercent,
        entryCents: numbers.entryCents,
        internalNotes: input.internalNotes,
        overheadCents: input.overheadCents,
        taxPercent: input.taxPercent,
        targetMarginPercent: input.targetMarginPercent,
        updatedAt: new Date(),
      })
      .where(eq(proposals.id, id))
      .returning();

    await tx.delete(proposalItems).where(eq(proposalItems.proposalId, id));
    await tx.delete(proposalCosts).where(eq(proposalCosts.proposalId, id));
    await tx.delete(proposalPayments).where(eq(proposalPayments.proposalId, id));
    await insertChildren(tx, id, { items: input.items, costs: input.costs, payments: input.payments });

    return { ok: true, proposal, totalCents: numbers.totalCents } as const;
  });
}

// ------------------------------------------------------------------ duplicar, versão, modelo
type CopyResult = { ok: true; id: number; number: string; version: number } | { ok: false; reason: "not_found" };

/**
 * Duplica: uma proposta vira outra proposta (número novo, versão 1, rascunho, validade renovada);
 * um modelo vira outro modelo ("… (cópia)").
 */
export async function duplicateProposal(id: number, userId: number): Promise<CopyResult> {
  const [source] = await db.select().from(proposals).where(eq(proposals.id, id));
  if (!source) return { ok: false, reason: "not_found" };

  if (source.isTemplate) {
    return db.transaction(async (tx) => {
      const newId = await insertTemplate(tx, {
        ...contentOf(source),
        templateName: `${source.templateName || source.title} (cópia)`.slice(0, 120),
        eventLocation: source.eventLocation,
        ownerId: source.ownerId,
        status: "rascunho",
        createdBy: userId,
      });
      await insertChildren(tx, newId, await loadChildren(tx, source.id));
      return { ok: true, id: newId, number: "", version: 1 } as const;
    });
  }

  const settings = await getSetting("proposal");
  return withFreshNumber((number) =>
    db.transaction(async (tx) => {
      const [created] = await tx
        .insert(proposals)
        .values({
          ...contentOf(source),
          number,
          version: 1,
          rootId: null,
          isTemplate: false,
          status: "rascunho",
          clientId: source.clientId,
          clientDisplayName: source.clientDisplayName,
          contactName: source.contactName,
          ownerId: source.ownerId ?? userId,
          eventDate: source.eventDate,
          eventLocation: source.eventLocation,
          validUntil: addDays(todayISO(), settings.validityDays),
          internalNotes: source.internalNotes,
          createdBy: userId,
        })
        .returning({ id: proposals.id });
      await insertChildren(tx, created.id, await loadChildren(tx, source.id));
      return { ok: true, id: created.id, number, version: 1 } as const;
    }),
  );
}

/**
 * Nova versão: copia tudo, mantém o número, soma 1 à versão mais alta da cadeia e aponta `rootId` para a
 * primeira proposta. A versão anterior fica como está (histórico do que o cliente recebeu).
 */
export async function createProposalVersion(id: number, userId: number): Promise<CopyResult | { ok: false; reason: "is_template" }> {
  const [source] = await db.select().from(proposals).where(eq(proposals.id, id));
  if (!source) return { ok: false, reason: "not_found" };
  if (source.isTemplate) return { ok: false, reason: "is_template" };
  const settings = await getSetting("proposal");
  const rootId = source.rootId ?? source.id;

  for (let attempt = 0; ; attempt++) {
    try {
      return await db.transaction(async (tx) => {
        const [{ last }] = await tx
          .select({ last: max(proposals.version) })
          .from(proposals)
          .where(and(eq(proposals.isTemplate, false), eq(proposals.number, source.number)));
        const version = (last ?? source.version) + 1;
        const [created] = await tx
          .insert(proposals)
          .values({
            ...contentOf(source),
            number: source.number,
            version,
            rootId,
            isTemplate: false,
            status: "rascunho",
            clientId: source.clientId,
            clientDisplayName: source.clientDisplayName,
            contactName: source.contactName,
            ownerId: source.ownerId ?? userId,
            eventDate: source.eventDate,
            eventLocation: source.eventLocation,
            validUntil: addDays(todayISO(), settings.validityDays),
            internalNotes: source.internalNotes,
            createdBy: userId,
          })
          .returning({ id: proposals.id });
        await insertChildren(tx, created.id, await loadChildren(tx, source.id));
        return { ok: true, id: created.id, number: source.number, version } as const;
      });
    } catch (error) {
      if (attempt >= 4 || !isUniqueViolation(error)) throw error;
    }
  }
}

/** Salva a proposta como modelo reutilizável (sem cliente, datas, validade nem notas internas). */
export async function saveProposalAsTemplate(id: number, templateName: string, userId: number): Promise<CopyResult> {
  const [source] = await db.select().from(proposals).where(eq(proposals.id, id));
  if (!source) return { ok: false, reason: "not_found" };
  return db.transaction(async (tx) => {
    const newId = await insertTemplate(tx, { ...contentOf(source), templateName, status: "rascunho", createdBy: userId });
    await insertChildren(tx, newId, await loadChildren(tx, source.id));
    return { ok: true, id: newId, number: "", version: 1 } as const;
  });
}

// ------------------------------------------------------------------ status
export type StatusResult =
  | { ok: true; proposal: Proposal; /** O cliente andou no funil por causa desta mudança (`null` = ficou onde estava). */ clientMoved: FunnelMove | null }
  | { ok: false; reason: "not_found" | "is_template" | "needs_client" };

const versionSuffix = (proposal: Pick<Proposal, "version">) => (proposal.version > 1 ? ` (versão ${proposal.version})` : "");
/** "2026-001" ou "2026-001 v2" — como a proposta é citada no histórico do cliente. */
const shortLabel = (proposal: Pick<Proposal, "number" | "version">) => `${proposal.number}${proposal.version > 1 ? ` v${proposal.version}` : ""}`;

/**
 * Muda o status. "Enviada" grava `sentAt` e registra a interação no histórico do cliente; "Aceita" e "Recusada"
 * gravam `respondedAt` (e também ficam no histórico).
 *
 * "Enviada" e "Aceita" também fazem o cliente andar no funil ("Em orçamento" / "Fechado"), só para a frente e só
 * se ele estiver no funil ativo — ver `funnel-logic.ts`. Voltar para rascunho, recusar ou expirar não mexe no cliente.
 */
export async function setProposalStatus(id: number, status: ProposalStatus, userId: number): Promise<StatusResult> {
  return db.transaction(async (tx) => {
    const [current] = await tx.select().from(proposals).where(eq(proposals.id, id));
    if (!current) return { ok: false, reason: "not_found" } as const;
    if (current.isTemplate) return { ok: false, reason: "is_template" } as const;
    if (status === "enviada" && !current.clientId) return { ok: false, reason: "needs_client" } as const;
    if (current.status === status) return { ok: true, proposal: current, clientMoved: null } as const;

    const now = new Date();
    const [proposal] = await tx
      .update(proposals)
      .set({
        status,
        ...(status === "enviada" ? { sentAt: now, respondedAt: null } : {}),
        ...(status === "aceita" || status === "recusada" ? { respondedAt: now } : {}),
        updatedAt: now,
      })
      .where(eq(proposals.id, id))
      .returning();

    if (proposal.clientId && (status === "enviada" || status === "aceita" || status === "recusada")) {
      const items = await tx
        .select({ kind: proposalItems.kind, quantity: proposalItems.quantity, unitPriceCents: proposalItems.unitPriceCents })
        .from(proposalItems)
        .where(eq(proposalItems.proposalId, id));
      const numbers = clientNumbers({ ...proposal, items });
      const name = `Proposta ${proposal.number}${versionSuffix(proposal)} — ${proposal.title}`;
      const content =
        status === "enviada"
          ? `${name}: enviada ao cliente. Total ${formatBRL(numbers.totalCents)}${proposal.validUntil ? `, válida até ${formatDate(proposal.validUntil)}` : ""}.`
          : status === "aceita"
            ? `${name}: aceita pelo cliente. Total ${formatBRL(numbers.totalCents)}.`
            : `${name}: recusada pelo cliente.`;
      await tx.insert(clientInteractions).values({ clientId: proposal.clientId, userId, kind: "nota", content, occurredAt: now });
    }
    const clientMoved =
      status === "enviada" || status === "aceita"
        ? await advanceClientInFunnel(tx, {
            clientId: proposal.clientId,
            event: status === "enviada" ? "proposta_enviada" : "proposta_aceita",
            reason: `proposta ${shortLabel(proposal)} ${status}`,
            userId,
            at: now,
          })
        : null;
    return { ok: true, proposal, clientMoved } as const;
  });
}

// ------------------------------------------------------------------ projeto e contrato
/** Tipo de serviço coerente com a modalidade da proposta. */
export const SERVICE_BY_MODALITY: Record<ProposalModality, ServiceInterest> = {
  casamento: "casamentos",
  mensal: "pacote_mensal",
  diaria_evento: "eventos",
  personalizada: "outro",
};

export type ConvertResult =
  | { ok: true; projectId: number; created: boolean; /** O cliente andou no funil (`null` = ficou onde estava). */ clientMoved: FunnelMove | null }
  | { ok: false; reason: "not_found" | "not_accepted" };

/**
 * Proposta aceita → projeto (uma vez só: se já existe projeto vinculado, devolve o mesmo).
 * Ao criar o projeto, o cliente vai para "Em produção" no funil (só para a frente — ver `funnel-logic.ts`).
 */
export async function convertProposalToProject(id: number, userId: number): Promise<ConvertResult> {
  return db.transaction(async (tx) => {
    const [proposal] = await tx.select().from(proposals).where(eq(proposals.id, id));
    if (!proposal || proposal.isTemplate) return { ok: false, reason: "not_found" } as const;
    if (proposal.projectId) {
      const [existing] = await tx.select({ id: projects.id }).from(projects).where(eq(projects.id, proposal.projectId));
      if (existing) return { ok: true, projectId: existing.id, created: false, clientMoved: null } as const;
    }
    if (proposal.status !== "aceita") return { ok: false, reason: "not_accepted" } as const;

    let clientName = proposal.clientDisplayName.trim();
    if (!clientName && proposal.clientId) {
      const [client] = await tx.select({ name: clients.name }).from(clients).where(eq(clients.id, proposal.clientId));
      clientName = client?.name ?? "";
    }
    const [project] = await tx
      .insert(projects)
      .values({
        clientId: proposal.clientId,
        proposalId: proposal.id,
        title: clientName ? `${proposal.title} — ${clientName}` : proposal.title,
        serviceType: SERVICE_BY_MODALITY[proposal.modality],
        ownerId: proposal.ownerId ?? userId,
        location: proposal.eventLocation,
        eventDate: proposal.eventDate,
      })
      .returning({ id: projects.id });
    await tx.update(proposals).set({ projectId: project.id, updatedAt: new Date() }).where(eq(proposals.id, id));
    const clientMoved = await advanceClientInFunnel(tx, {
      clientId: proposal.clientId,
      event: "projeto_criado",
      reason: `projeto criado a partir da proposta ${shortLabel(proposal)}`,
      userId,
    });
    return { ok: true, projectId: project.id, created: true, clientMoved } as const;
  });
}

export type LinkContractResult = { ok: true; proposal: Proposal } | { ok: false; reason: "not_found" | "contract_not_found" };

/** Vincula (ou desvincula, com `null`) um contrato do mesmo cliente. */
export async function linkProposalContract(id: number, contractId: number | null): Promise<LinkContractResult> {
  const [current] = await db.select().from(proposals).where(eq(proposals.id, id));
  if (!current || current.isTemplate) return { ok: false, reason: "not_found" };
  if (contractId) {
    const [contract] = await db
      .select({ id: contracts.id, clientId: contracts.clientId })
      .from(contracts)
      .where(and(eq(contracts.id, contractId), eq(contracts.isTemplate, false)));
    if (!contract || !current.clientId || contract.clientId !== current.clientId) return { ok: false, reason: "contract_not_found" };
  }
  const [proposal] = await db.update(proposals).set({ contractId, updatedAt: new Date() }).where(eq(proposals.id, id)).returning();
  return { ok: true, proposal };
}

// ------------------------------------------------------------------ excluir
export type DeleteResult = { ok: true; deleted: Pick<Proposal, "id" | "number" | "version" | "isTemplate"> } | { ok: false; reason: "not_found" | "not_draft" };

/** Exclusão definitiva — só rascunhos e modelos (propostas enviadas ficam como histórico). */
export async function deleteProposal(id: number): Promise<DeleteResult> {
  return db.transaction(async (tx) => {
    const [current] = await tx
      .select({ id: proposals.id, number: proposals.number, version: proposals.version, isTemplate: proposals.isTemplate, status: proposals.status })
      .from(proposals)
      .where(eq(proposals.id, id));
    if (!current) return { ok: false, reason: "not_found" } as const;
    if (!current.isTemplate && current.status !== "rascunho") return { ok: false, reason: "not_draft" } as const;
    await tx.delete(proposals).where(eq(proposals.id, id));
    return { ok: true, deleted: { id: current.id, number: current.number, version: current.version, isTemplate: current.isTemplate } } as const;
  });
}

/** Modelos para o seletor de "novo orçamento". */
export async function getTemplateOptions(): Promise<{ id: number; name: string; modality: ProposalModality; title: string }[]> {
  const rows = await db
    .select({ id: proposals.id, templateName: proposals.templateName, modality: proposals.modality, title: proposals.title })
    .from(proposals)
    .where(eq(proposals.isTemplate, true))
    .orderBy(asc(proposals.templateName), asc(proposals.id));
  return rows.map((row) => ({ id: row.id, name: row.templateName || row.title, modality: row.modality, title: row.title }));
}
