/**
 * Projetos no PAINEL: consultas e mutações (só falam com o banco; autorização, validação e auditoria ficam nas
 * Server Actions de `src/app/painel/projetos/actions.ts`). As regras puras (prazos, links) estão em `logic.ts`.
 *
 * Tarefas, agenda, contratos e financeiro têm módulos próprios: aqui só LEMOS essas tabelas para o detalhe do projeto
 * (e inserimos tarefas rápidas do projeto).
 */
import "server-only";
import { and, asc, count, desc, eq, inArray, isNull, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import {
  agendaEvents,
  clients,
  contracts,
  financeEntries,
  projects,
  proposals,
  tasks,
  users,
  type AgendaEvent,
  type ChecklistItem,
  type Contract,
  type FinanceEntry,
  type LabeledLink,
  type Project,
  type Task,
} from "@/db/schema";
import type { ISODate } from "@/lib/dates";
import { PROJECT_OPEN_STAGES, type BackupStatus, type ProjectStage, type ServiceInterest, type TaskPriority } from "@/lib/domain";
import { resolveDeliveredAt } from "./logic";

export const PROJECTS_PAGE_SIZE = 20;

// ------------------------------------------------------------------ consultas
export type ProjectFilters = {
  /** Busca livre: título do projeto ou nome do cliente. */
  q?: string;
  ownerId?: number;
  clientId?: number;
  service?: ServiceInterest;
  stage?: ProjectStage;
  backup?: BackupStatus;
  /** Página (começa em 1). Sem ela, devolve todos (quadro). */
  page?: number;
};

export type ProjectListItem = Project & { clientName: string | null; ownerName: string | null };

/** `%` e `_` digitados pelo usuário não podem virar curingas do LIKE. */
const likePattern = (term: string) => `%${term.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;

function projectWhere(filters: ProjectFilters): SQL | undefined {
  const conditions: (SQL | undefined)[] = [];
  if (filters.ownerId) conditions.push(eq(projects.ownerId, filters.ownerId));
  if (filters.clientId) conditions.push(eq(projects.clientId, filters.clientId));
  if (filters.service) conditions.push(eq(projects.serviceType, filters.service));
  if (filters.stage) conditions.push(eq(projects.stage, filters.stage));
  if (filters.backup) conditions.push(eq(projects.backupStatus, filters.backup));
  const q = filters.q?.trim().slice(0, 80);
  if (q) {
    const text = likePattern(q.toLowerCase());
    conditions.push(or(sql`lower(${projects.title}) like ${text} escape '\\'`, sql`lower(coalesce(${clients.name}, '')) like ${text} escape '\\'`));
  }
  return and(...conditions);
}

/**
 * Lista de projetos ordenada pelo prazo de entrega (sem prazo por último); entregues e cancelados vão para o fim.
 * Com `page`, pagina; sem `page`, devolve todos.
 */
export async function listProjects(filters: ProjectFilters = {}): Promise<{ rows: ProjectListItem[]; total: number; page: number; pageSize: number }> {
  const where = projectWhere(filters);
  const [{ total }] = await db.select({ total: count() }).from(projects).leftJoin(clients, eq(clients.id, projects.clientId)).where(where);

  const paginate = filters.page !== undefined;
  const pageCount = Math.max(1, Math.ceil(total / PROJECTS_PAGE_SIZE));
  const page = paginate ? Math.min(Math.max(1, filters.page ?? 1), pageCount) : 1;

  const query = db
    .select({ project: projects, clientName: clients.name, ownerName: users.name })
    .from(projects)
    .leftJoin(clients, eq(clients.id, projects.clientId))
    .leftJoin(users, eq(users.id, projects.ownerId))
    .where(where)
    .orderBy(
      sql`case when ${projects.stage} in ('entregue', 'cancelado') then 1 else 0 end`,
      sql`${projects.deliveryDeadline} is null`,
      asc(projects.deliveryDeadline),
      desc(projects.id),
    )
    .$dynamic();
  const rows = await (paginate ? query.limit(PROJECTS_PAGE_SIZE).offset((page - 1) * PROJECTS_PAGE_SIZE) : query);
  return {
    rows: rows.map((row) => ({ ...row.project, clientName: row.clientName, ownerName: row.ownerName })),
    total,
    page,
    pageSize: PROJECTS_PAGE_SIZE,
  };
}

/** Projetos em andamento (contador do menu / visão geral). */
export async function countOpenProjects(): Promise<number> {
  const [row] = await db
    .select({ total: count() })
    .from(projects)
    .where(inArray(projects.stage, [...PROJECT_OPEN_STAGES]));
  return row?.total ?? 0;
}

export type ProjectDetail = Project & {
  client: { id: number; name: string } | null;
  ownerName: string | null;
  proposal: { id: number; number: string; version: number; title: string } | null;
};

export async function getProject(id: number): Promise<ProjectDetail | null> {
  const [row] = await db
    .select({ project: projects, clientName: clients.name, ownerName: users.name })
    .from(projects)
    .leftJoin(clients, eq(clients.id, projects.clientId))
    .leftJoin(users, eq(users.id, projects.ownerId))
    .where(eq(projects.id, id));
  if (!row) return null;
  const project = row.project;
  let proposal: ProjectDetail["proposal"] = null;
  if (project.proposalId) {
    const [found] = await db
      .select({ id: proposals.id, number: proposals.number, version: proposals.version, title: proposals.title })
      .from(proposals)
      .where(eq(proposals.id, project.proposalId));
    proposal = found ?? null;
  }
  return {
    ...project,
    client: project.clientId && row.clientName != null ? { id: project.clientId, name: row.clientName } : null,
    ownerName: row.ownerName,
    proposal,
  };
}

/** Projeto já gerado a partir de uma proposta (para avisar antes de criar outro). */
export async function findProjectByProposal(proposalId: number): Promise<{ id: number; title: string } | null> {
  const [row] = await db.select({ id: projects.id, title: projects.title }).from(projects).where(eq(projects.proposalId, proposalId)).limit(1);
  return row ?? null;
}

/** Dados da proposta que pré-preenchem o formulário de novo projeto. */
export async function getProposalForProject(proposalId: number) {
  const [row] = await db
    .select({
      id: proposals.id,
      number: proposals.number,
      version: proposals.version,
      title: proposals.title,
      modality: proposals.modality,
      clientId: proposals.clientId,
      clientDisplayName: proposals.clientDisplayName,
      eventDate: proposals.eventDate,
      eventLocation: proposals.eventLocation,
      ownerId: proposals.ownerId,
      isTemplate: proposals.isTemplate,
    })
    .from(proposals)
    .where(eq(proposals.id, proposalId));
  return row && !row.isTemplate ? row : null;
}

export type ProjectTask = Pick<Task, "id" | "title" | "dueDate" | "done" | "priority"> & { ownerName: string | null };

/** Tarefas do projeto: abertas primeiro (pelo prazo), depois as concluídas. */
export async function listProjectTasks(projectId: number): Promise<ProjectTask[]> {
  const rows = await db
    .select({ id: tasks.id, title: tasks.title, dueDate: tasks.dueDate, done: tasks.done, priority: tasks.priority, ownerName: users.name })
    .from(tasks)
    .leftJoin(users, eq(users.id, tasks.ownerId))
    .where(eq(tasks.projectId, projectId))
    .orderBy(asc(tasks.done), sql`${tasks.dueDate} is null`, asc(tasks.dueDate), asc(tasks.id))
    .limit(50);
  return rows;
}

export type ProjectEvent = Pick<AgendaEvent, "id" | "title" | "kind" | "date" | "startTime" | "endTime" | "location">;

export async function listProjectEvents(projectId: number): Promise<ProjectEvent[]> {
  return db
    .select({
      id: agendaEvents.id,
      title: agendaEvents.title,
      kind: agendaEvents.kind,
      date: agendaEvents.date,
      startTime: agendaEvents.startTime,
      endTime: agendaEvents.endTime,
      location: agendaEvents.location,
    })
    .from(agendaEvents)
    .where(eq(agendaEvents.projectId, projectId))
    .orderBy(asc(agendaEvents.date), sql`${agendaEvents.startTime} is null`, asc(agendaEvents.startTime))
    .limit(50);
}

export type ProjectContract = Pick<Contract, "id" | "title" | "kind" | "status" | "signedAt">;

export async function listProjectContracts(projectId: number): Promise<ProjectContract[]> {
  return db
    .select({ id: contracts.id, title: contracts.title, kind: contracts.kind, status: contracts.status, signedAt: contracts.signedAt })
    .from(contracts)
    .where(and(eq(contracts.projectId, projectId), eq(contracts.isTemplate, false)))
    .orderBy(desc(contracts.id))
    .limit(50);
}

export type ProjectFinanceEntry = Pick<FinanceEntry, "id" | "type" | "description" | "amountCents" | "dueDate" | "paidAt" | "installmentLabel">;

export async function listProjectFinance(projectId: number): Promise<ProjectFinanceEntry[]> {
  return db
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
    .where(eq(financeEntries.projectId, projectId))
    .orderBy(asc(financeEntries.dueDate), asc(financeEntries.id))
    .limit(100);
}

// --------------------------------------------------------------- referências
/** Confere se cliente, responsável e proposta existem. Devolve um mapa campo → mensagem (vazio = tudo certo). */
export async function checkProjectRefs(refs: { clientId: number | null; ownerId: number | null; proposalId: number | null }): Promise<Record<string, string>> {
  const errors: Record<string, string> = {};
  if (refs.clientId) {
    const [row] = await db.select({ id: clients.id }).from(clients).where(eq(clients.id, refs.clientId));
    if (!row) errors.clientId = "Este cliente não existe mais.";
  }
  if (refs.ownerId) {
    const [row] = await db.select({ id: users.id }).from(users).where(and(eq(users.id, refs.ownerId), eq(users.active, true)));
    if (!row) errors.ownerId = "Este responsável não está disponível.";
  }
  if (refs.proposalId) {
    const [row] = await db.select({ id: proposals.id }).from(proposals).where(eq(proposals.id, refs.proposalId));
    if (!row) errors._form = "A proposta de origem não existe mais.";
  }
  return errors;
}

// ------------------------------------------------------------------ mutações
export type ProjectInput = {
  title: string;
  clientId: number | null;
  proposalId: number | null;
  serviceType: ServiceInterest;
  stage: ProjectStage;
  ownerId: number | null;
  location: string;
  eventDate: ISODate | null;
  shootDeadline: ISODate | null;
  deliveryDeadline: ISODate | null;
  deliveredAt: ISODate | null;
  driveUrl: string;
  galleryUrl: string;
  referencesUrl: string;
  finalFilesUrl: string;
  links: LabeledLink[];
  backupStatus: BackupStatus;
  backupNote: string;
  notes: string;
};

export async function createProject(input: ProjectInput, today: ISODate): Promise<Project> {
  const [project] = await db
    .insert(projects)
    .values({ ...input, deliveredAt: resolveDeliveredAt(input.stage, input.deliveredAt, today) })
    .returning();
  // a proposta passa a apontar para o projeto gerado (só se ainda não apontava para outro)
  if (project.proposalId) {
    await db
      .update(proposals)
      .set({ projectId: project.id })
      .where(and(eq(proposals.id, project.proposalId), isNull(proposals.projectId)));
  }
  return project;
}

/** Atualiza os dados do projeto. O checklist não passa por aqui (tem ações próprias). */
export async function updateProject(id: number, input: Omit<ProjectInput, "proposalId">, today: ISODate): Promise<Project | null> {
  const [project] = await db
    .update(projects)
    .set({ ...input, deliveredAt: resolveDeliveredAt(input.stage, input.deliveredAt, today), updatedAt: new Date() })
    .where(eq(projects.id, id))
    .returning();
  return project ?? null;
}

/** Muda a etapa. Ao marcar "Entregue" sem data de entrega, preenche com hoje. */
export async function setProjectStage(id: number, stage: ProjectStage, today: ISODate): Promise<Project | null> {
  const [current] = await db.select({ deliveredAt: projects.deliveredAt }).from(projects).where(eq(projects.id, id));
  if (!current) return null;
  const [project] = await db
    .update(projects)
    .set({ stage, deliveredAt: resolveDeliveredAt(stage, current.deliveredAt, today), updatedAt: new Date() })
    .where(eq(projects.id, id))
    .returning();
  return project ?? null;
}

/** Lê o checklist, aplica a mudança e grava — numa transação. Devolve `false` se o projeto não existe. */
async function mutateChecklist(projectId: number, change: (items: ChecklistItem[]) => ChecklistItem[]): Promise<boolean> {
  return db.transaction(async (tx) => {
    const [row] = await tx.select({ checklist: projects.checklist }).from(projects).where(eq(projects.id, projectId));
    if (!row) return false;
    await tx
      .update(projects)
      .set({ checklist: change(Array.isArray(row.checklist) ? [...row.checklist] : []), updatedAt: new Date() })
      .where(eq(projects.id, projectId));
    return true;
  });
}

export const addChecklistItem = (projectId: number, item: ChecklistItem) => mutateChecklist(projectId, (items) => [...items, item]);

export const toggleChecklistItem = (projectId: number, itemId: string, done: boolean) =>
  mutateChecklist(projectId, (items) => items.map((item) => (item.id === itemId ? { ...item, done } : item)));

export const removeChecklistItem = (projectId: number, itemId: string) => mutateChecklist(projectId, (items) => items.filter((item) => item.id !== itemId));

export type QuickTaskInput = { title: string; dueDate: ISODate | null; priority: TaskPriority };

/** Tarefa rápida do projeto (a tela completa de tarefas é de outro módulo). */
export async function addProjectTask(project: Pick<Project, "id" | "clientId" | "ownerId">, input: QuickTaskInput, userId: number): Promise<Task> {
  const [task] = await db
    .insert(tasks)
    .values({
      title: input.title,
      dueDate: input.dueDate,
      priority: input.priority,
      projectId: project.id,
      clientId: project.clientId,
      ownerId: project.ownerId ?? userId,
    })
    .returning();
  return task;
}

/**
 * Exclui o projeto e as tarefas dele. Compromissos, contratos, lançamentos e propostas ficam (só perdem o vínculo):
 * o dinheiro e os documentos não podem sumir junto com o projeto.
 */
export async function deleteProject(id: number): Promise<{ id: number; deletedTasks: number } | null> {
  return db.transaction(async (tx) => {
    const [project] = await tx.select({ id: projects.id }).from(projects).where(eq(projects.id, id));
    if (!project) return null;
    const removed = await tx.delete(tasks).where(eq(tasks.projectId, id)).returning({ id: tasks.id });
    await tx.update(agendaEvents).set({ projectId: null }).where(eq(agendaEvents.projectId, id));
    await tx.update(contracts).set({ projectId: null }).where(eq(contracts.projectId, id));
    await tx.update(financeEntries).set({ projectId: null }).where(eq(financeEntries.projectId, id));
    await tx.update(proposals).set({ projectId: null }).where(eq(proposals.projectId, id));
    await tx.delete(projects).where(eq(projects.id, id));
    return { id, deletedTasks: removed.length };
  });
}

/** Quantas tarefas serão apagadas junto (aviso na confirmação de exclusão). */
export async function countProjectTasks(projectId: number): Promise<number> {
  const [row] = await db.select({ total: count() }).from(tasks).where(eq(tasks.projectId, projectId));
  return row?.total ?? 0;
}
