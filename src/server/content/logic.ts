/**
 * Regras puras do módulo de Conteúdo (sem banco): validação de datas, itens do calendário e cópia de item.
 * Fica separado de `admin.ts` para ser testado sem banco (`logic.test.ts`).
 */
import { addDays, endOfMonth, startOfMonth, type ISODate } from "@/lib/dates";
import type { ContentStatus } from "@/lib/domain";

export type ContentDates = { recordDate: string | null; editDeadline: string | null; publishDate: string | null };

/**
 * A ordem natural de um conteúdo é gravar → editar → publicar (no mesmo dia vale).
 * Devolve erros por campo (chaves = `name` dos campos do formulário).
 */
export function validateContentDates(dates: ContentDates): Record<string, string> {
  const errors: Record<string, string> = {};
  const { recordDate, editDeadline, publishDate } = dates;
  if (recordDate && editDeadline && editDeadline < recordDate) {
    errors.editDeadline = "O prazo de edição não pode ser antes da gravação.";
  }
  if (editDeadline && publishDate && publishDate < editDeadline) {
    errors.publishDate = "A publicação não pode ser antes do prazo de edição.";
  } else if (recordDate && publishDate && publishDate < recordDate) {
    errors.publishDate = "A publicação não pode ser antes da gravação.";
  }
  return errors;
}

export type CalendarSource = {
  id: number;
  title: string;
  status: ContentStatus;
  publishDate: string | null;
  recordDate: string | null;
  editDeadline: string | null;
};

export type ContentCalendarEntry = {
  key: string;
  id: number;
  date: ISODate;
  kind: "publicacao" | "gravacao" | "edicao";
  title: string;
  status: ContentStatus;
};

/**
 * Transforma itens em marcações do calendário: a publicação (cor pelo status) e, com estilo distinto,
 * a gravação e o prazo de edição. Conteúdo já publicado só mostra a publicação (o resto já aconteceu).
 * Só entram datas dentro de `[from, to]`.
 */
export function buildCalendarEntries(items: readonly CalendarSource[], from: ISODate, to: ISODate): ContentCalendarEntry[] {
  const entries: ContentCalendarEntry[] = [];
  const inRange = (date: string | null): date is string => Boolean(date) && date! >= from && date! <= to;
  for (const item of items) {
    const base = { id: item.id, title: item.title, status: item.status };
    if (inRange(item.publishDate)) entries.push({ ...base, key: `p${item.id}`, date: item.publishDate, kind: "publicacao" });
    if (item.status === "publicado") continue;
    if (inRange(item.recordDate)) entries.push({ ...base, key: `g${item.id}`, date: item.recordDate, kind: "gravacao" });
    if (inRange(item.editDeadline)) entries.push({ ...base, key: `e${item.id}`, date: item.editDeadline, kind: "edicao" });
  }
  return entries;
}

/** Janela buscada para o mês exibido: a grade mostra dias dos meses vizinhos (uma semana de cada lado basta). */
export function calendarWindow(month: ISODate): { from: ISODate; to: ISODate } {
  return { from: addDays(startOfMonth(month), -7), to: addDays(endOfMonth(month), 7) };
}

/** Título da cópia: "Tema (cópia)"; copiar a cópia não empilha "(cópia) (cópia)". */
export function copyTitle(title: string, max = 160): string {
  const suffix = " (cópia)";
  const base = title.endsWith(suffix) ? title.slice(0, -suffix.length) : title;
  const trimmed = base.length + suffix.length > max ? base.slice(0, max - suffix.length).trimEnd() : base;
  return `${trimmed}${suffix}`;
}

/** Ao chegar em "Publicado" sem data de publicação, usa hoje. */
export function publishDateForStatus(status: ContentStatus, current: string | null, today: ISODate): string | null {
  return status === "publicado" && !current ? today : current;
}
