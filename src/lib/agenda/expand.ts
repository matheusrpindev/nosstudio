/**
 * Expansão de compromissos em OCORRÊNCIAS dentro de uma janela de datas (lógica pura).
 *
 * No banco, uma série é uma linha só (a primeira data + a regra). Aqui ela vira uma ocorrência por dia em que
 * acontece. Dias em `recurrenceExceptions` não acontecem: foram excluídos ("só este") ou substituídos por uma
 * linha própria (`seriesId` + `originalDate`), que entra na janela como um compromisso comum.
 */
import { addDays, type ISODate } from "@/lib/dates";
import { normalizeRecurrence, occurrencesBetween, spanDays, type Recurrence } from "./recurrence";

export type Expandable = {
  date: ISODate;
  endDate: ISODate | null;
  /** Como veio do banco/JSON: é normalizada aqui. */
  recurrence: unknown;
  recurrenceExceptions: readonly ISODate[] | null;
};

export type Occurrence<T> = {
  event: T;
  /** Primeiro e último dia DESTA ocorrência. */
  date: ISODate;
  endDate: ISODate;
  /** Faz parte de uma série (a linha tem regra de repetição). */
  recurring: boolean;
};

export const ruleOf = (event: Pick<Expandable, "recurrence">): Recurrence | null => normalizeRecurrence(event.recurrence);

/** Ocorrências de um compromisso que tocam `[from, to]` (um compromisso de vários dias entra se algum dia tocar). */
export function expandEvent<T extends Expandable>(event: T, from: ISODate, to: ISODate): Occurrence<T>[] {
  const span = spanDays(event.date, event.endDate);
  const rule = ruleOf(event);
  // uma ocorrência que começou até `span - 1` dias antes da janela ainda a alcança
  const dates = occurrencesBetween(event.date, rule, addDays(from, -(span - 1)), to, event.recurrenceExceptions ?? []);
  return dates.map((date) => ({ event, date, endDate: addDays(date, span - 1), recurring: rule !== null }));
}

export function expandEvents<T extends Expandable>(events: readonly T[], from: ISODate, to: ISODate): Occurrence<T>[] {
  return events.flatMap((event) => expandEvent(event, from, to));
}

/** `date` é um dia em que a série realmente acontece (respeitando as exceções)? */
export function isOccurrence(event: Expandable, date: ISODate): boolean {
  return occurrencesBetween(event.date, ruleOf(event), date, date, event.recurrenceExceptions ?? []).length === 1;
}

/** Primeira ocorrência da série em ou depois de `from` (para abrir o detalhe sem dia na URL). */
export function nextOccurrence(event: Expandable, from: ISODate, horizonDays = 730): ISODate | null {
  const rule = ruleOf(event);
  if (!rule) return event.date;
  return occurrencesBetween(event.date, rule, from, addDays(from, horizonDays), event.recurrenceExceptions ?? [])[0] ?? null;
}
