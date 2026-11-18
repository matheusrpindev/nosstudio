/**
 * Lógica pura das tarefas (sem banco): agrupamento por prazo e classificação de atraso.
 * Importável também em Client Components. Testada em `logic.test.ts`.
 */
import type { TaskPriority } from "@/lib/domain";
import { addDays, diffDays, type ISODate } from "@/lib/dates";

/** Tarefa pronta para exibir (serializável: pode atravessar Server → Client Component). */
export type TaskView = {
  id: number;
  title: string;
  description: string;
  dueDate: ISODate | null;
  priority: TaskPriority;
  done: boolean;
  /** Instante da conclusão (ms). */
  doneAt: number | null;
  ownerId: number | null;
  ownerName: string | null;
  clientId: number | null;
  clientName: string | null;
  projectId: number | null;
  projectTitle: string | null;
};

export const TASK_GROUP_KEYS = [
  "atrasadas",
  "hoje",
  "semana",
  "depois",
  "sem_data",
] as const;
export type TaskGroupKey = (typeof TASK_GROUP_KEYS)[number];

export const TASK_GROUP_LABELS: Record<TaskGroupKey, string> = {
  atrasadas: "Atrasadas",
  hoje: "Hoje",
  semana: "Próximos 7 dias",
  depois: "Depois",
  sem_data: "Sem data",
};

/** Em qual grupo uma tarefa em aberto cai. "Próximos 7 dias" = de amanhã até hoje + 7. */
export function taskGroupKey(
  dueDate: ISODate | null,
  today: ISODate,
): TaskGroupKey {
  if (!dueDate) return "sem_data";
  if (dueDate < today) return "atrasadas";
  if (dueDate === today) return "hoje";
  return dueDate <= addDays(today, 7) ? "semana" : "depois";
}

const PRIORITY_RANK: Record<TaskPriority, number> = {
  alta: 0,
  normal: 1,
  baixa: 2,
};

/** Prazo mais antigo primeiro; no mesmo dia, prioridade alta antes; depois a mais antiga criada (id). */
function byUrgency(a: TaskView, b: TaskView): number {
  return (
    (a.dueDate ?? "9999-12-31").localeCompare(b.dueDate ?? "9999-12-31") ||
    PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] ||
    a.id - b.id
  );
}

export type TaskGroup = { key: TaskGroupKey; label: string; tasks: TaskView[] };

/** Agrupa as tarefas EM ABERTO na ordem Atrasadas → Hoje → Próximos 7 dias → Depois → Sem data (grupos vazios ficam de fora). */
export function groupTasks(
  open: readonly TaskView[],
  today: ISODate,
): TaskGroup[] {
  const buckets = new Map<TaskGroupKey, TaskView[]>(
    TASK_GROUP_KEYS.map((key) => [key, []]),
  );
  for (const task of open) {
    if (task.done) continue;
    buckets.get(taskGroupKey(task.dueDate, today))!.push(task);
  }
  return TASK_GROUP_KEYS.map((key) => ({
    key,
    label: TASK_GROUP_LABELS[key],
    tasks: buckets.get(key)!.sort(byUrgency),
  })).filter((group) => group.tasks.length > 0);
}

/** Dias de atraso (0 se não estiver atrasada ou for concluída). */
export function overdueDays(
  task: Pick<TaskView, "dueDate" | "done">,
  today: ISODate,
): number {
  if (task.done || !task.dueDate || task.dueDate >= today) return 0;
  return diffDays(task.dueDate, today);
}

/** "Atrasada há 1 dia" / "Atrasada há 3 dias". */
export function overdueLabel(days: number): string {
  return `Atrasada há ${days} ${days === 1 ? "dia" : "dias"}`;
}
