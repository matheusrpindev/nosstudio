/**
 * Clientes (CRM) no PAINEL: consultas e mutações. Só fala com o banco — quem autoriza, valida, audita e navega
 * são as Server Actions em `src/app/painel/clientes/actions.ts`.
 */
import "server-only";
import { and, asc, count, desc, eq, gte, inArray, or, sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import { db } from "@/db";
import {
  agendaEvents,
  clientInteractions,
  clients,
  contracts,
  financeEntries,
  leads,
  projects,
  proposalItems,
  proposals,
  tasks,
  users,
  type Client,
  type LabeledDate,
} from "@/db/schema";
import {
  CLIENT_KIND_LABELS,
  CLIENT_STATUS_LABELS,
  CONTACT_SOURCE_LABELS,
  SERVICE_INTEREST_LABELS,
  type ClientKind,
  type ClientStatus,
  type ContactSource,
  type InteractionKind,
  type ServiceInterest,
} from "@/lib/domain";
import { formatDate, formatDateTime } from "@/lib/dates";
import { formatPhone, onlyDigits } from "@/lib/format";
import { clientNumbers } from "@/lib/proposals/calc";
import { buildCsv } from "./csv";
import { subjectLeadsWhere } from "./subject-data";

export const CLIENTS_PAGE_SIZE = 20;
/** Teto de cartões no funil (o quadro não pagina). */
export const FUNNEL_LIMIT = 300;

// ------------------------------------------------------------------ filtros
export type ClientFilters = {
  status?: ClientStatus;
  /** id do responsável */
  owner?: number;
  service?: ServiceInterest;
  source?: ContactSource;
  /** Busca livre: nome/empresa, contato, e-mail ou WhatsApp. */
  q?: string;
  page?: number;
};

/** `%` e `_` digitados pelo usuário não podem virar curingas do LIKE. */
const likePattern = (term: string) => `%${term.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;

function clientWhere(filters: ClientFilters): SQL | undefined {
  const conditions: (SQL | undefined)[] = [];
  if (filters.status) conditions.push(eq(clients.status, filters.status));
  if (filters.owner) conditions.push(eq(clients.ownerId, filters.owner));
  if (filters.service) conditions.push(eq(clients.serviceInterest, filters.service));
  if (filters.source) conditions.push(eq(clients.source, filters.source));
  const q = filters.q?.trim().slice(0, 80);
  if (q) {
    const text = likePattern(q.toLowerCase());
    const digits = onlyDigits(q);
    conditions.push(
      or(
        sql`lower(${clients.name}) like ${text} escape '\\'`,
        sql`lower(${clients.contactName}) like ${text} escape '\\'`,
        sql`lower(${clients.email}) like ${text} escape '\\'`,
        // o WhatsApp é gravado só com dígitos
        digits.length >= 3 ? sql`${clients.whatsapp} like ${likePattern(digits)} escape '\\'` : undefined,
      ),
    );
  }
  return and(...conditions);
}

const listColumns = {
  id: clients.id,
  name: clients.name,
  contactName: clients.contactName,
  kind: clients.kind,
  whatsapp: clients.whatsapp,
  email: clients.email,
  city: clients.city,
  source: clients.source,
  serviceInterest: clients.serviceInterest,
  status: clients.status,
  ownerId: clients.ownerId,
  ownerName: users.name,
  nextStep: clients.nextStep,
  nextStepDate: clients.nextStepDate,
  updatedAt: clients.updatedAt,
};

export type ClientListItem = {
  id: number;
  name: string;
  contactName: string;
  kind: ClientKind;
  whatsapp: string;
  email: string;
  city: string;
  source: ContactSource;
  serviceInterest: ServiceInterest;
  status: ClientStatus;
  ownerId: number | null;
  ownerName: string | null;
  nextStep: string;
  nextStepDate: string | null;
  updatedAt: Date;
};

/** Lista paginada, atualizados mais recentemente primeiro. */
export async function listClients(filters: ClientFilters = {}): Promise<{ rows: ClientListItem[]; total: number; page: number; pageSize: number }> {
  const where = clientWhere(filters);
  const [{ total }] = await db.select({ total: count() }).from(clients).where(where);
  const pageCount = Math.max(1, Math.ceil(total / CLIENTS_PAGE_SIZE));
  const page = Math.min(Math.max(1, filters.page ?? 1), pageCount);
  const rows = await db
    .select(listColumns)
    .from(clients)
    .leftJoin(users, eq(users.id, clients.ownerId))
    .where(where)
    .orderBy(desc(clients.updatedAt), desc(clients.id))
    .limit(CLIENTS_PAGE_SIZE)
    .offset((page - 1) * CLIENTS_PAGE_SIZE);
  return { rows, total, page, pageSize: CLIENTS_PAGE_SIZE };
}

/** Cartões do funil (sem paginação; o filtro de status não se aplica — as colunas JÁ são os status). */
export async function listClientsForBoard(filters: Omit<ClientFilters, "status" | "page"> = {}): Promise<{ rows: ClientListItem[]; truncated: boolean }> {
  const rows = await db
    .select(listColumns)
    .from(clients)
    .leftJoin(users, eq(users.id, clients.ownerId))
    .where(clientWhere(filters))
    .orderBy(desc(clients.updatedAt), desc(clients.id))
    .limit(FUNNEL_LIMIT + 1);
  return { rows: rows.slice(0, FUNNEL_LIMIT), truncated: rows.length > FUNNEL_LIMIT };
}

// ---------------------------------------------------------------- exportação
export const CLIENT_CSV_HEADER = [
  "Nome / empresa",
  "Pessoa de contato",
  "Tipo",
  "WhatsApp",
  "E-mail",
  "CPF/CNPJ",
  "Cidade",
  "Segmento",
  "Origem",
  "Serviço de interesse",
  "Responsável",
  "Status",
  "Motivo da perda",
  "Primeiro contato",
  "Próximo passo",
  "Data do próximo passo",
  "Observações internas",
  "Cadastrado em",
  "Atualizado em",
] as const;

/** Todos os clientes do filtro (sem paginação), já no formato do CSV. */
export async function exportClientsCsv(filters: Omit<ClientFilters, "page"> = {}): Promise<{ csv: string; count: number }> {
  const rows = await db
    .select({ client: clients, ownerName: users.name })
    .from(clients)
    .leftJoin(users, eq(users.id, clients.ownerId))
    .where(clientWhere(filters))
    .orderBy(asc(clients.name), asc(clients.id));
  const csv = buildCsv(
    CLIENT_CSV_HEADER,
    rows.map(({ client: c, ownerName }) => [
      c.name,
      c.contactName,
      CLIENT_KIND_LABELS[c.kind],
      formatPhone(c.whatsapp),
      c.email,
      formatDocument(c.document),
      c.city,
      c.segment,
      CONTACT_SOURCE_LABELS[c.source],
      SERVICE_INTEREST_LABELS[c.serviceInterest],
      ownerName ?? "",
      CLIENT_STATUS_LABELS[c.status],
      c.lostReason,
      formatDate(c.firstContactAt),
      c.nextStep,
      formatDate(c.nextStepDate),
      c.notes,
      formatDateTime(c.createdAt),
      formatDateTime(c.updatedAt),
    ]),
  );
  return { csv, count: rows.length };
}

/** CPF `000.000.000-00` / CNPJ `00.000.000/0000-00`; qualquer outra coisa volta como veio. */
export function formatDocument(value: string): string {
  const d = onlyDigits(value);
  if (d.length === 11) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
  if (d.length === 14) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
  return value;
}

// ------------------------------------------------------------------- detalhe
export type ClientDetail = Client & { ownerName: string | null };

export async function getClient(id: number): Promise<ClientDetail | null> {
  const [row] = await db.select({ client: clients, ownerName: users.name }).from(clients).leftJoin(users, eq(users.id, clients.ownerId)).where(eq(clients.id, id));
  return row ? { ...row.client, ownerName: row.ownerName } : null;
}

export type InteractionItem = {
  id: number;
  kind: InteractionKind;
  content: string;
  occurredAt: Date;
  authorName: string | null;
};

export async function listInteractions(clientId: number): Promise<InteractionItem[]> {
  return db
    .select({
      id: clientInteractions.id,
      kind: clientInteractions.kind,
      content: clientInteractions.content,
      occurredAt: clientInteractions.occurredAt,
      authorName: users.name,
    })
    .from(clientInteractions)
    .leftJoin(users, eq(users.id, clientInteractions.userId))
    .where(eq(clientInteractions.clientId, clientId))
    .orderBy(desc(clientInteractions.occurredAt), desc(clientInteractions.id));
}

export type ClientProposalRow = {
  id: number;
  number: string;
  version: number;
  title: string;
  status: (typeof proposals.$inferSelect)["status"];
  totalCents: number;
  validUntil: string | null;
  createdAt: Date;
};

/** Orçamentos do cliente com o total que o CLIENTE vê (`clientNumbers`: respeita desconto aprovado). Sem custos internos. */
async function listClientProposals(clientId: number): Promise<ClientProposalRow[]> {
  const rows = await db
    .select({
      id: proposals.id,
      number: proposals.number,
      version: proposals.version,
      title: proposals.title,
      status: proposals.status,
      validUntil: proposals.validUntil,
      createdAt: proposals.createdAt,
      discountCents: proposals.discountCents,
      discountApproved: proposals.discountApproved,
      entryMode: proposals.entryMode,
      entryPercent: proposals.entryPercent,
      entryCents: proposals.entryCents,
    })
    .from(proposals)
    .where(and(eq(proposals.clientId, clientId), eq(proposals.isTemplate, false)))
    .orderBy(desc(proposals.createdAt), desc(proposals.id));
  if (rows.length === 0) return [];
  const items = await db
    .select({ proposalId: proposalItems.proposalId, kind: proposalItems.kind, quantity: proposalItems.quantity, unitPriceCents: proposalItems.unitPriceCents })
    .from(proposalItems)
    .where(
      inArray(
        proposalItems.proposalId,
        rows.map((row) => row.id),
      ),
    );
  return rows.map((row) => {
    const numbers = clientNumbers({
      items: items.filter((item) => item.proposalId === row.id),
      discountCents: row.discountCents,
      discountApproved: row.discountApproved,
      entryMode: row.entryMode,
      entryPercent: row.entryPercent,
      entryCents: row.entryCents,
    });
    return { id: row.id, number: row.number, version: row.version, title: row.title, status: row.status, totalCents: numbers.totalCents, validUntil: row.validUntil, createdAt: row.createdAt };
  });
}

export type FinanceSummary = {
  /** receitas previstas (todas) / recebidas / em aberto */
  incomePlanned: number;
  incomeReceived: number;
  incomeOpen: number;
  /** despesas ligadas ao cliente: previstas / pagas */
  expensePlanned: number;
  expensePaid: number;
};

export type ClientRelated = {
  proposals: ClientProposalRow[];
  projects: { id: number; title: string; stage: (typeof projects.$inferSelect)["stage"]; deliveryDeadline: string | null; eventDate: string | null }[];
  contracts: { id: number; title: string; kind: (typeof contracts.$inferSelect)["kind"]; status: (typeof contracts.$inferSelect)["status"]; signedAt: string | null }[];
  finance: {
    summary: FinanceSummary;
    entries: { id: number; type: "receita" | "despesa"; description: string; amountCents: number; dueDate: string; paidAt: string | null; installmentLabel: string }[];
    total: number;
  };
  events: { id: number; title: string; kind: (typeof agendaEvents.$inferSelect)["kind"]; date: string; startTime: string | null }[];
  tasks: { id: number; title: string; dueDate: string | null; priority: (typeof tasks.$inferSelect)["priority"]; ownerName: string | null }[];
};

/** Quais blocos de OUTROS módulos a ficha pode mostrar a quem está olhando (decidido pela matriz de permissões). */
export type ClientRelatedAccess = { proposals: boolean; projects: boolean; contracts: boolean; finance: boolean; events: boolean; tasks: boolean };
const ALL_RELATED: ClientRelatedAccess = { proposals: true, projects: true, contracts: true, finance: true, events: true, tasks: true };

/**
 * Tudo o que a ficha mostra ligado ao cliente — só leitura, consultas simples às tabelas dos outros módulos.
 * `include` diz o que a pessoa pode ver: o que não pode NÃO É CONSULTADO e volta vazio (o gestor, por exemplo,
 * não recebe os lançamentos financeiros do cliente).
 */
export async function getClientRelated(clientId: number, today: string, include: ClientRelatedAccess = ALL_RELATED): Promise<ClientRelated> {
  const taskOwner = alias(users, "task_owner");
  const [proposalRows, projectRows, contractRows, financeAgg, financeRows, eventRows, taskRows] = await Promise.all([
    include.proposals ? listClientProposals(clientId) : [],
    !include.projects
      ? []
      : db
        .select({ id: projects.id, title: projects.title, stage: projects.stage, deliveryDeadline: projects.deliveryDeadline, eventDate: projects.eventDate })
        .from(projects)
        .where(eq(projects.clientId, clientId))
        .orderBy(desc(projects.createdAt), desc(projects.id)),
    !include.contracts
      ? []
      : db
        .select({ id: contracts.id, title: contracts.title, kind: contracts.kind, status: contracts.status, signedAt: contracts.signedAt })
        .from(contracts)
        .where(and(eq(contracts.clientId, clientId), eq(contracts.isTemplate, false)))
        .orderBy(desc(contracts.createdAt), desc(contracts.id)),
    !include.finance
      ? []
      : db
        .select({
          type: financeEntries.type,
          planned: sql<number>`coalesce(sum(${financeEntries.amountCents}), 0)`,
          done: sql<number>`coalesce(sum(case when ${financeEntries.paidAt} is not null then ${financeEntries.amountCents} else 0 end), 0)`,
          total: count(),
        })
        .from(financeEntries)
        .where(eq(financeEntries.clientId, clientId))
        .groupBy(financeEntries.type),
    !include.finance
      ? []
      : db
        .select({
          id: financeEntries.id,
          type: financeEntries.type,
          description: financeEntries.description,
          amountCents: financeEntries.amountCents,
          dueDate: financeEntries.dueDate,
          paidAt: financeEntries.paidAt,
          installmentLabel: financeEntries.installmentLabel,
        })
        .from(financeEntries)
        .where(eq(financeEntries.clientId, clientId))
        .orderBy(asc(financeEntries.dueDate), asc(financeEntries.id))
        .limit(30),
    !include.events
      ? []
      : db
        .select({ id: agendaEvents.id, title: agendaEvents.title, kind: agendaEvents.kind, date: agendaEvents.date, startTime: agendaEvents.startTime })
        .from(agendaEvents)
        .where(and(eq(agendaEvents.clientId, clientId), gte(agendaEvents.date, today)))
        .orderBy(asc(agendaEvents.date), asc(sql`coalesce(${agendaEvents.startTime}, '')`))
        .limit(10),
    !include.tasks
      ? []
      : db
        .select({ id: tasks.id, title: tasks.title, dueDate: tasks.dueDate, priority: tasks.priority, ownerName: taskOwner.name })
        .from(tasks)
        .leftJoin(taskOwner, eq(taskOwner.id, tasks.ownerId))
        .where(and(eq(tasks.clientId, clientId), eq(tasks.done, false)))
        // sem prazo por último
        .orderBy(asc(sql`${tasks.dueDate} is null`), asc(tasks.dueDate), asc(tasks.id))
        .limit(10),
  ]);

  const income = financeAgg.find((row) => row.type === "receita");
  const expense = financeAgg.find((row) => row.type === "despesa");
  const incomePlanned = Number(income?.planned ?? 0);
  const incomeReceived = Number(income?.done ?? 0);
  return {
    proposals: proposalRows,
    projects: projectRows,
    contracts: contractRows,
    finance: {
      summary: {
        incomePlanned,
        incomeReceived,
        incomeOpen: incomePlanned - incomeReceived,
        expensePlanned: Number(expense?.planned ?? 0),
        expensePaid: Number(expense?.done ?? 0),
      },
      entries: financeRows,
      total: financeAgg.reduce((sum, row) => sum + row.total, 0),
    },
    events: eventRows,
    tasks: taskRows,
  };
}

// ------------------------------------------------------------------ mutações
export type ClientInput = {
  name: string;
  contactName: string;
  kind: ClientKind;
  whatsapp: string;
  email: string;
  document: string;
  city: string;
  segment: string;
  source: ContactSource;
  serviceInterest: ServiceInterest;
  ownerId: number | null;
  status: ClientStatus;
  lostReason: string;
  firstContactAt: string | null;
  nextStep: string;
  nextStepDate: string | null;
  importantDates: LabeledDate[];
  notes: string;
};

const toRow = (input: ClientInput) => ({
  ...input,
  whatsapp: onlyDigits(input.whatsapp),
  document: onlyDigits(input.document),
  // o motivo só faz sentido (e só fica guardado) enquanto o cliente está como "Perdido"
  lostReason: input.status === "perdido" ? input.lostReason : "",
});

/** Texto da interação gerada automaticamente quando o status muda. */
export function statusChangeText(from: ClientStatus, to: ClientStatus, lostReason?: string): string {
  const base = `Status: ${CLIENT_STATUS_LABELS[from]} → ${CLIENT_STATUS_LABELS[to]}`;
  return to === "perdido" && lostReason?.trim() ? `${base}\nMotivo: ${lostReason.trim()}` : base;
}

export async function createClient(input: ClientInput, userId: number): Promise<Client> {
  return db.transaction(async (tx) => {
    const [client] = await tx.insert(clients).values(toRow(input)).returning();
    await tx.insert(clientInteractions).values({ clientId: client.id, userId, kind: "nota", content: "Cliente cadastrado no painel." });
    return client;
  });
}

export type UpdateResult = { client: Client; statusChanged: { from: ClientStatus; to: ClientStatus } | null };

/** Atualiza a ficha. Se o status mudou, grava a interação "Status: X → Y" na mesma transação. */
export async function updateClient(id: number, input: ClientInput, userId: number): Promise<UpdateResult | null> {
  return db.transaction(async (tx) => {
    const [before] = await tx.select({ status: clients.status }).from(clients).where(eq(clients.id, id));
    if (!before) return null;
    const [client] = await tx.update(clients).set(toRow(input)).where(eq(clients.id, id)).returning();
    const changed = before.status !== client.status;
    if (changed) {
      await tx.insert(clientInteractions).values({
        clientId: id,
        userId,
        kind: "status",
        content: statusChangeText(before.status, client.status, client.lostReason),
      });
    }
    return { client, statusChanged: changed ? { from: before.status, to: client.status } : null };
  });
}

/** Só o status (funil e ficha). Sem mudança real: não grava nada e devolve `statusChanged: null`. */
export async function setClientStatus(id: number, status: ClientStatus, userId: number, lostReason = ""): Promise<UpdateResult | null> {
  return db.transaction(async (tx) => {
    const [before] = await tx.select().from(clients).where(eq(clients.id, id));
    if (!before) return null;
    const reason = status === "perdido" ? lostReason.trim() || before.lostReason : "";
    if (before.status === status && before.lostReason === reason) return { client: before, statusChanged: null };
    const [client] = await tx.update(clients).set({ status, lostReason: reason }).where(eq(clients.id, id)).returning();
    if (before.status === status) return { client, statusChanged: null };
    await tx.insert(clientInteractions).values({ clientId: id, userId, kind: "status", content: statusChangeText(before.status, status, reason) });
    return { client, statusChanged: { from: before.status, to: status } };
  });
}

export async function addInteraction(input: { clientId: number; userId: number; kind: InteractionKind; content: string; occurredAt: Date }): Promise<{ id: number } | null> {
  return db.transaction(async (tx) => {
    const [exists] = await tx.select({ id: clients.id }).from(clients).where(eq(clients.id, input.clientId));
    if (!exists) return null;
    const [row] = await tx.insert(clientInteractions).values(input).returning({ id: clientInteractions.id });
    // o atendimento conta como atividade: o cliente sobe na lista (ordenada por atualização)
    await tx.update(clients).set({ updatedAt: new Date() }).where(eq(clients.id, input.clientId));
    return row;
  });
}

/**
 * Exclui o cliente. O histórico de atendimento e os itens do calendário de conteúdo dele são apagados (cascata);
 * orçamentos, projetos, contratos, lançamentos, compromissos e tarefas ficam sem cliente (set null).
 * `withLeads`: apaga também os pedidos que a pessoa enviou pelo site (leads ligados ao cadastro ou com o mesmo
 * WhatsApp/e-mail — ver `subjectLeadsWhere`) — necessário para atender a um pedido de eliminação (LGPD); sem
 * isso eles continuam em Leads, só que sem vínculo.
 */
export async function deleteClient(id: number, options: { withLeads?: boolean } = {}): Promise<{ id: number; leadsDeleted: number } | null> {
  return db.transaction(async (tx) => {
    const [existing] = await tx.select({ id: clients.id, whatsapp: clients.whatsapp, email: clients.email }).from(clients).where(eq(clients.id, id));
    if (!existing) return null;
    // os leads primeiro: depois de excluir o cliente o vínculo (client_id) já teria virado nulo
    const removedLeads = options.withLeads ? await tx.delete(leads).where(subjectLeadsWhere(existing)).returning({ id: leads.id }) : [];
    await tx.delete(clients).where(eq(clients.id, id));
    return { id, leadsDeleted: removedLeads.length };
  });
}

/** Para a tela: sem prazo nem passo definido? (usado para sugerir "defina o próximo passo"). */
export const hasNextStep = (client: Pick<Client, "nextStep" | "nextStepDate">) => Boolean(client.nextStep.trim() || client.nextStepDate);

