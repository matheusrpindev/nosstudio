/**
 * Edição de séries (lógica pura): o que muda na regra quando a pessoa escolhe "este e os seguintes".
 *
 * - "Só este": a série ganha uma exceção naquele dia e nasce uma linha avulsa (ou nenhuma, se for exclusão).
 * - "Este e os seguintes": a série original termina na véspera (cabeça) e nasce outra a partir do dia (cauda).
 * - "Todos": a própria linha da série é alterada.
 */
import { addDays, diffDays, type ISODate } from "@/lib/dates";
import { endSeriesBefore, occurrencesBetween, type Recurrence } from "./recurrence";

export type SeriesSplit = {
  /** A série original, encerrada na véspera de `at`. `null` = não sobra nada antes (o corte é na 1ª ocorrência). */
  head: { rule: Recurrence; exceptions: ISODate[] } | null;
  /** A série nova, que começa em `at` com o que restava da regra. */
  tail: { rule: Recurrence; exceptions: ISODate[] };
};

/**
 * Corta a série em `at` (que deve ser um dia da série). O limite "N vezes" é repartido: a cauda fica com as
 * ocorrências que ainda faltavam (as exceções contam, como na expansão).
 */
export function splitSeries(start: ISODate, rule: Recurrence, exceptions: readonly ISODate[], at: ISODate): SeriesSplit {
  // datas geradas pela regra antes do corte (sem descontar exceções: elas consomem o `count`)
  const before = at > start ? occurrencesBetween(start, rule, start, addDays(at, -1)) : [];
  const tailRule: Recurrence = { ...rule };
  if (rule.count) tailRule.count = Math.max(1, rule.count - before.length);
  const tail = { rule: tailRule, exceptions: exceptions.filter((date) => date >= at) };
  // sobra cabeça só se alguma ocorrência de verdade acontece antes do corte
  const happensBefore = before.some((date) => !exceptions.includes(date));
  if (!happensBefore) return { head: null, tail: { rule: tailRule, exceptions: [...exceptions] } };
  return { head: { rule: endSeriesBefore(rule, at), exceptions: exceptions.filter((date) => date < at) }, tail };
}

/** Desloca datas (exceções, por exemplo) quando a série inteira muda de dia. */
export function shiftDates(dates: readonly ISODate[], from: ISODate, to: ISODate): ISODate[] {
  const delta = diffDays(from, to);
  return delta === 0 ? [...dates] : dates.map((date) => addDays(date, delta));
}

/** Duas regras são a mesma? (comparação estável, ignorando a ordem das chaves) */
export function sameRule(a: Recurrence | null, b: Recurrence | null): boolean {
  if (!a || !b) return a === b;
  const key = (rule: Recurrence) =>
    JSON.stringify([rule.freq, rule.interval, [...(rule.weekdays ?? [])].sort(), rule.until ?? null, rule.count ?? null]);
  return key(a) === key(b);
}
