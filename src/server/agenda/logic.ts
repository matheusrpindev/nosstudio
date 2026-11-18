/**
 * Lógica pura da agenda (sem banco): validação de horários, montagem dos prazos de projeto como itens do
 * calendário e agrupamento por dia. Testada em `logic.test.ts`.
 */
import type { AgendaKind, ProjectStage } from "@/lib/domain";
import { addDays, isTime, type ISODate } from "@/lib/dates";

/** Um item da agenda: compromisso cadastrado OU prazo de projeto (somente leitura). */
export type AgendaEntry = {
  /** Chave estável: `e-12` (compromisso) ou `p-3-entrega` (prazo do projeto 3). */
  key: string;
  source: "event" | "deadline";
  /** Id do compromisso ou do projeto. */
  id: number;
  title: string;
  kind: AgendaKind;
  date: ISODate;
  startTime: string | null;
  endTime: string | null;
  location: string;
  clientName: string | null;
  ownerName: string | null;
  /** Só para prazos: "Prazo de entrega", "Prazo de gravação", "Data do evento". */
  deadlineLabel?: string;
  href: string;
};

export type EventTimeInput = {
  allDay: boolean;
  startTime: string | null;
  endTime: string | null;
};

/** Erros de horário por campo (vazio = válido). Fim precisa ser depois do início; sem início não há fim. */
export function validateEventTimes({
  allDay,
  startTime,
  endTime,
}: EventTimeInput): Partial<Record<"startTime" | "endTime", string>> {
  if (allDay) return {};
  const errors: Partial<Record<"startTime" | "endTime", string>> = {};
  if (!startTime || !isTime(startTime)) {
    errors.startTime = "Informe o horário de início ou marque “Dia inteiro”.";
    return errors;
  }
  if (endTime) {
    if (!isTime(endTime)) errors.endTime = "Horário inválido.";
    else if (endTime <= startTime)
      errors.endTime = "O fim precisa ser depois do início.";
  }
  return errors;
}

/** Dia inteiro zera os horários gravados. */
export function normalizeEventTimes({
  allDay,
  startTime,
  endTime,
}: EventTimeInput): { startTime: string | null; endTime: string | null } {
  if (allDay) return { startTime: null, endTime: null };
  return {
    startTime: startTime || null,
    endTime: startTime && endTime ? endTime : null,
  };
}

export type ProjectDeadlineRow = {
  id: number;
  title: string;
  stage: ProjectStage;
  eventDate: string | null;
  shootDeadline: string | null;
  deliveryDeadline: string | null;
  deliveredAt: string | null;
  location: string;
  clientName: string | null;
  ownerName: string | null;
};

const DEADLINE_FIELDS = [
  {
    field: "eventDate",
    kind: "evento",
    label: "Data do evento",
    slug: "evento",
  },
  {
    field: "shootDeadline",
    kind: "gravacao",
    label: "Prazo de gravação",
    slug: "gravacao",
  },
  {
    field: "deliveryDeadline",
    kind: "entrega",
    label: "Prazo de entrega",
    slug: "entrega",
  },
] as const satisfies readonly {
  field: keyof ProjectDeadlineRow;
  kind: AgendaKind;
  label: string;
  slug: string;
}[];

/**
 * Prazos dos projetos como itens somente leitura. Projetos cancelados não aparecem; o prazo de entrega some
 * quando o projeto já foi entregue. Só entram datas dentro de `[from, to]` (e do tipo filtrado, se houver).
 */
export function projectDeadlineEntries(
  rows: readonly ProjectDeadlineRow[],
  from: ISODate,
  to: ISODate,
  kind?: AgendaKind,
): AgendaEntry[] {
  const entries: AgendaEntry[] = [];
  for (const row of rows) {
    if (row.stage === "cancelado") continue;
    for (const def of DEADLINE_FIELDS) {
      if (kind && def.kind !== kind) continue;
      const date = row[def.field];
      if (!date || date < from || date > to) continue;
      if (
        def.field === "deliveryDeadline" &&
        (row.stage === "entregue" || row.deliveredAt)
      )
        continue;
      entries.push({
        key: `p-${row.id}-${def.slug}`,
        source: "deadline",
        id: row.id,
        title: row.title,
        kind: def.kind,
        date,
        startTime: null,
        endTime: null,
        location: row.location,
        clientName: row.clientName,
        ownerName: row.ownerName,
        deadlineLabel: def.label,
        href: `/painel/projetos/${row.id}`,
      });
    }
  }
  return entries;
}

/** Ordena por data; no dia, itens sem horário primeiro, depois por horário; compromissos antes de prazos. */
export function sortAgenda(entries: readonly AgendaEntry[]): AgendaEntry[] {
  return [...entries].sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      (a.startTime ?? "").localeCompare(b.startTime ?? "") ||
      (a.source === b.source ? 0 : a.source === "event" ? -1 : 1) ||
      a.title.localeCompare(b.title, "pt-BR"),
  );
}

/** Agrupa (já ordenado) por dia, preservando a ordem. */
export function groupByDay(
  entries: readonly AgendaEntry[],
): { date: ISODate; entries: AgendaEntry[] }[] {
  const groups: { date: ISODate; entries: AgendaEntry[] }[] = [];
  for (const entry of entries) {
    const last = groups[groups.length - 1];
    if (last && last.date === entry.date) last.entries.push(entry);
    else groups.push({ date: entry.date, entries: [entry] });
  }
  return groups;
}

/** Último dia da janela "próximos N dias" a partir de hoje (hoje conta como o 1º dia). */
export function upcomingEnd(today: ISODate, days = 14): ISODate {
  return addDays(today, days - 1);
}
