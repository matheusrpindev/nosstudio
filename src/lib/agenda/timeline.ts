/**
 * Linha do tempo de projetos (lógica pura): os marcos que existem no cadastro do projeto e a posição de cada
 * coisa na faixa de datas mostrada. Testada em `timeline.test.ts`.
 */
import { diffDays, type ISODate } from "@/lib/dates";

export type MilestoneKind = "inicio" | "evento" | "gravacao" | "entrega" | "entregue";

export const MILESTONE_LABELS: Record<MilestoneKind, string> = {
  inicio: "Início (briefing)",
  evento: "Data do evento",
  gravacao: "Prazo de gravação",
  entrega: "Prazo de entrega",
  entregue: "Entrega feita",
};

export type ProjectDates = {
  /** Dia em que o projeto foi aberto (começo do briefing). */
  startedOn: ISODate | null;
  eventDate: ISODate | null;
  shootDeadline: ISODate | null;
  deliveryDeadline: ISODate | null;
  deliveredAt: ISODate | null;
};

export type Milestone = { kind: MilestoneKind; date: ISODate; label: string; late: boolean };

/**
 * Marcos de um projeto, em ordem de data — só os que estão preenchidos no cadastro. Um prazo de entrega vencido
 * sem "entrega feita" sai marcado como atrasado.
 */
export function projectMilestones(project: ProjectDates, today: ISODate): Milestone[] {
  const entries: [MilestoneKind, ISODate | null][] = [
    ["inicio", project.startedOn],
    ["evento", project.eventDate],
    ["gravacao", project.shootDeadline],
    ["entrega", project.deliveryDeadline],
    ["entregue", project.deliveredAt],
  ];
  return entries
    .filter((entry): entry is [MilestoneKind, ISODate] => entry[1] !== null && entry[1] !== "")
    .map(([kind, date]) => ({ kind, date, label: MILESTONE_LABELS[kind], late: kind === "entrega" && !project.deliveredAt && date < today }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** Posição horizontal (0–100 %) do começo do dia `date` numa janela `[from, to]`. Fora da janela: < 0 ou > 100. */
export function dayOffset(from: ISODate, to: ISODate, date: ISODate): number {
  const total = diffDays(from, to) + 1;
  return (diffDays(from, date) / total) * 100;
}

/** Faixa (em %) que `[start, end]` ocupa na janela, cortada nas bordas; `null` se fica toda de fora. */
export function spanInWindow(from: ISODate, to: ISODate, start: ISODate, end: ISODate): { left: number; width: number } | null {
  if (end < from || start > to) return null;
  const total = diffDays(from, to) + 1;
  const first = Math.max(0, diffDays(from, start));
  const last = Math.min(total - 1, diffDays(from, end));
  return { left: (first / total) * 100, width: ((last - first + 1) / total) * 100 };
}
