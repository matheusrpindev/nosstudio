/**
 * Regras puras da visão geral (sem banco, sem Next) — fáceis de testar.
 */
import { addDays, diffDays, formatDate, type ISODate } from "@/lib/dates";

/** Janela (em dias) para considerar um orçamento "vencendo". */
export const PROPOSAL_SOON_DAYS = 3;

export type DeadlineState = "vencido" | "vence_logo" | "ok" | "sem_prazo";

/** Situação do prazo de validade de um orçamento enviado. */
export function proposalDeadlineState(validUntil: ISODate | null, today: ISODate): DeadlineState {
  if (!validUntil) return "sem_prazo";
  if (validUntil < today) return "vencido";
  if (validUntil <= addDays(today, PROPOSAL_SOON_DAYS)) return "vence_logo";
  return "ok";
}

/** "venceu há 3 dias", "vence hoje", "vence amanhã", "vence em 2 dias". */
export function describeDeadline(date: ISODate, today: ISODate, verb: "vence" | "prazo" = "vence"): string {
  const diff = diffDays(today, date);
  if (diff === 0) return verb === "vence" ? "vence hoje" : "prazo é hoje";
  if (diff === 1) return verb === "vence" ? "vence amanhã" : "prazo é amanhã";
  if (diff > 1) return verb === "vence" ? `vence em ${diff} dias` : `prazo em ${diff} dias`;
  const ago = -diff;
  const unit = ago === 1 ? "dia" : "dias";
  if (ago > 30) return verb === "vence" ? `venceu em ${formatDate(date)}` : `prazo era ${formatDate(date)}`;
  return verb === "vence" ? `venceu há ${ago} ${unit}` : `atrasada há ${ago} ${unit}`;
}

/** "1 orçamento" / "3 orçamentos". */
export function plural(count: number, singular: string, pluralForm: string): string {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

export type DayGroup<T extends { date: ISODate }> = { date: ISODate; items: T[] };

/** Agrupa por dia mantendo a ordem de entrada (a consulta já vem ordenada por data e horário). */
export function groupByDay<T extends { date: ISODate }>(items: T[]): DayGroup<T>[] {
  const groups: DayGroup<T>[] = [];
  for (const item of items) {
    const last = groups[groups.length - 1];
    if (last && last.date === item.date) last.items.push(item);
    else groups.push({ date: item.date, items: [item] });
  }
  return groups;
}

export type TaskLike = { dueDate: ISODate | null; priority: "baixa" | "normal" | "alta"; id: number };

/** Atrasadas primeiro (mais antigas antes), depois as de hoje, depois as de prioridade alta sem urgência de prazo. */
export function sortImportantTasks<T extends TaskLike>(rows: T[], today: ISODate): T[] {
  const bucket = (t: T) => (t.dueDate && t.dueDate < today ? 0 : t.dueDate === today ? 1 : 2);
  return [...rows].sort((a, b) => {
    const diff = bucket(a) - bucket(b);
    if (diff) return diff;
    if (a.dueDate !== b.dueDate) return (a.dueDate ?? "9999-99-99") < (b.dueDate ?? "9999-99-99") ? -1 : 1;
    return a.id - b.id;
  });
}

export type TaskState = "atrasada" | "hoje" | "futura";
export function taskState(dueDate: ISODate | null, today: ISODate): TaskState {
  if (!dueDate || dueDate > today) return "futura";
  return dueDate < today ? "atrasada" : "hoje";
}
