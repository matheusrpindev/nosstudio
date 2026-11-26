/**
 * Tarefas no PAINEL: consultas e mutações. Só fala com o banco; autorização, validação e auditoria ficam nas
 * Server Actions (`src/app/painel/tarefas/actions.ts`).
 */
import "server-only";
import { and, desc, eq, gte, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { clients, projects, tasks, users, type Task } from "@/db/schema";
import type { TaskPriority } from "@/lib/domain";
import { inScope, type IdScope } from "@/server/access/scope";
import type { TaskView } from "./logic";

export type TaskFilters = {
  ownerId?: number;
  clientId?: number;
  projectId?: number;
};

/** Quantas concluídas aparecem em "Concluídas recentemente" e até quantos dias atrás. */
const RECENT_DONE_LIMIT = 20;
const RECENT_DONE_DAYS = 14;

const taskSelect = {
  task: tasks,
  ownerName: users.name,
  clientName: clients.name,
  projectTitle: projects.title,
};

type Row = {
  task: Task;
  ownerName: string | null;
  clientName: string | null;
  projectTitle: string | null;
};

function toView({ task, ownerName, clientName, projectTitle }: Row): TaskView {
  return {
    id: task.id,
    title: task.title,
    description: task.description,
    dueDate: task.dueDate,
    priority: task.priority,
    done: task.done,
    doneAt: task.doneAt ? task.doneAt.getTime() : null,
    ownerId: task.ownerId,
    ownerName,
    clientId: task.clientId,
    clientName,
    projectId: task.projectId,
    projectTitle,
  };
}

function filterConditions(filters: TaskFilters): (SQL | undefined)[] {
  return [
    filters.ownerId ? eq(tasks.ownerId, filters.ownerId) : undefined,
    filters.clientId ? eq(tasks.clientId, filters.clientId) : undefined,
    filters.projectId ? eq(tasks.projectId, filters.projectId) : undefined,
  ];
}

/**
 * Tarefas em aberto (todas) e as concluídas há pouco (mais recentes primeiro).
 * `scope` = em quais projetos esta pessoa vê tarefas (`moduleScope(user, "tarefas", "ver")`): `"todos"` não
 * filtra; uma lista de projetos mostra só as tarefas DELES (tarefa sem projeto fica de fora). É obrigatório de
 * propósito: quem chama precisa decidir o escopo.
 */
export async function listTasks(
  filters: TaskFilters,
  scope: IdScope,
): Promise<{ open: TaskView[]; recentDone: TaskView[] }> {
  const base = () =>
    db
      .select(taskSelect)
      .from(tasks)
      .leftJoin(users, eq(users.id, tasks.ownerId))
      .leftJoin(clients, eq(clients.id, tasks.clientId))
      .leftJoin(projects, eq(projects.id, tasks.projectId))
      .$dynamic();
  const since = new Date(Date.now() - RECENT_DONE_DAYS * 86_400_000);
  const [open, recentDone] = await Promise.all([
    base().where(and(eq(tasks.done, false), inScope(tasks.projectId, scope), ...filterConditions(filters))),
    base()
      .where(
        and(
          eq(tasks.done, true),
          gte(tasks.doneAt, since),
          inScope(tasks.projectId, scope),
          ...filterConditions(filters),
        ),
      )
      .orderBy(desc(tasks.doneAt))
      .limit(RECENT_DONE_LIMIT),
  ]);
  return { open: open.map(toView), recentDone: recentDone.map(toView) };
}

/** Nome de um cliente/projeto (para o aviso "mostrando só as tarefas de…"). */
export async function getClientName(id: number): Promise<string | null> {
  const [row] = await db
    .select({ name: clients.name })
    .from(clients)
    .where(eq(clients.id, id));
  return row?.name ?? null;
}
export async function getProjectInfo(
  id: number,
): Promise<{ title: string; clientId: number | null } | null> {
  const [row] = await db
    .select({ title: projects.title, clientId: projects.clientId })
    .from(projects)
    .where(eq(projects.id, id));
  return row ?? null;
}

/** O mínimo de uma tarefa para decidir o acesso: os vínculos LIDOS DO BANCO (nunca os do formulário). */
export async function getTaskRefs(id: number): Promise<Pick<Task, "id" | "projectId" | "clientId" | "ownerId"> | null> {
  const [row] = await db
    .select({ id: tasks.id, projectId: tasks.projectId, clientId: tasks.clientId, ownerId: tasks.ownerId })
    .from(tasks)
    .where(eq(tasks.id, id));
  return row ?? null;
}

export type TaskInput = {
  title: string;
  description: string;
  dueDate: string | null;
  priority: TaskPriority;
  ownerId: number | null;
  clientId: number | null;
  projectId: number | null;
};

/** Confere se cliente, projeto e responsável ainda existem (evita erro de chave estrangeira). */
export async function checkTaskRefs(
  input: Pick<TaskInput, "clientId" | "projectId" | "ownerId">,
): Promise<string | null> {
  if (input.clientId) {
    const [row] = await db
      .select({ id: clients.id })
      .from(clients)
      .where(eq(clients.id, input.clientId));
    if (!row) return "O cliente selecionado não existe mais.";
  }
  if (input.projectId) {
    const [row] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(eq(projects.id, input.projectId));
    if (!row) return "O projeto selecionado não existe mais.";
  }
  if (input.ownerId) {
    const [row] = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.id, input.ownerId), eq(users.active, true)));
    if (!row) return "O responsável selecionado não está disponível.";
  }
  return null;
}

export async function createTask(input: TaskInput): Promise<Task> {
  const [task] = await db.insert(tasks).values(input).returning();
  return task;
}

export async function updateTask(
  id: number,
  input: TaskInput,
): Promise<Task | null> {
  const [task] = await db
    .update(tasks)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(tasks.id, id))
    .returning();
  return task ?? null;
}

/** Conclui ou reabre. Concluir de novo uma tarefa já concluída mantém a data original. */
export async function setTaskDone(
  id: number,
  done: boolean,
): Promise<Task | null> {
  const [current] = await db.select().from(tasks).where(eq(tasks.id, id));
  if (!current) return null;
  if (current.done === done) return current;
  const [task] = await db
    .update(tasks)
    .set({ done, doneAt: done ? new Date() : null, updatedAt: new Date() })
    .where(eq(tasks.id, id))
    .returning();
  return task ?? null;
}

export async function deleteTask(id: number): Promise<Task | null> {
  const [task] = await db.delete(tasks).where(eq(tasks.id, id)).returning();
  return task ?? null;
}
