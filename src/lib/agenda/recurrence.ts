/**
 * Recorrência de compromissos (lógica pura, usável no servidor e no cliente).
 *
 * A regra fica gravada no compromisso "pai"; as ocorrências são calculadas na leitura, para a janela pedida.
 * Datas são de calendário (`YYYY-MM-DD`), sem fuso. Dias que não existem são pulados, como no Google Agenda:
 * um mensal no dia 31 não acontece em meses de 30 dias; um anual em 29/02 só acontece em ano bissexto.
 */
import { addDays, diffDays, isISODate, weekday, type ISODate } from "@/lib/dates";

export const RECURRENCE_FREQS = ["diaria", "semanal", "mensal", "anual"] as const;
export type RecurrenceFreq = (typeof RECURRENCE_FREQS)[number];

export type Recurrence = {
  freq: RecurrenceFreq;
  /** A cada N dias/semanas/meses/anos (1 = todo). */
  interval: number;
  /** Só para semanal: dias da semana (0 = domingo … 6 = sábado). Vazio = o dia da semana da data inicial. */
  weekdays?: readonly number[];
  /** Termina nesta data (inclusive). */
  until?: ISODate | null;
  /** Ou termina depois de N ocorrências (contando a primeira). `until` e `count` juntos: vale o que vier antes. */
  count?: number | null;
};

/** Limite de segurança: nenhuma série gera mais do que isto numa consulta. */
export const MAX_OCCURRENCES = 1500;
export const MAX_INTERVAL = 99;
export const MAX_COUNT = 730;

const pad = (n: number) => String(n).padStart(2, "0");
const parts = (iso: ISODate) => iso.split("-").map(Number) as [number, number, number];
const daysInMonth = (year: number, month: number) => new Date(Date.UTC(year, month, 0)).getUTCDate();

/** Valida e normaliza o que vem de formulário/banco. Devolve `null` quando não há recorrência válida. */
export function normalizeRecurrence(input: unknown): Recurrence | null {
  if (!input || typeof input !== "object") return null;
  const raw = input as Record<string, unknown>;
  if (!RECURRENCE_FREQS.includes(raw.freq as RecurrenceFreq)) return null;
  const freq = raw.freq as RecurrenceFreq;
  const interval = Math.min(MAX_INTERVAL, Math.max(1, Math.trunc(Number(raw.interval) || 1)));
  const rule: Recurrence = { freq, interval };
  if (freq === "semanal" && Array.isArray(raw.weekdays)) {
    const days = [...new Set(raw.weekdays.map(Number).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))].sort();
    if (days.length > 0) rule.weekdays = days;
  }
  if (isISODate(raw.until)) rule.until = raw.until;
  const count = Math.trunc(Number(raw.count));
  if (Number.isFinite(count) && count >= 1) rule.count = Math.min(MAX_COUNT, count);
  return rule;
}

/**
 * Gera, em ordem, as datas da série a partir de `start`. O gerador é infinito quando a regra não tem fim:
 * quem consome decide onde parar.
 */
function* series(start: ISODate, rule: Recurrence): Generator<ISODate> {
  const interval = Math.max(1, rule.interval);
  if (rule.freq === "diaria") {
    for (let date = start; ; date = addDays(date, interval)) yield date;
  }
  if (rule.freq === "semanal") {
    const days = rule.weekdays?.length ? rule.weekdays : [weekday(start)];
    // Semana-base = a semana (dom–sáb) da data inicial; a cada `interval` semanas, os dias marcados.
    let weekStart = addDays(start, -weekday(start));
    for (;;) {
      for (const day of days) {
        const date = addDays(weekStart, day);
        if (date >= start) yield date;
      }
      weekStart = addDays(weekStart, 7 * interval);
    }
  }
  const [year, month, day] = parts(start);
  if (rule.freq === "mensal") {
    for (let i = 0; ; i += interval) {
      const y = year + Math.floor((month - 1 + i) / 12);
      const m = ((month - 1 + i) % 12) + 1;
      if (day <= daysInMonth(y, m)) yield `${y}-${pad(m)}-${pad(day)}`;
      if (y > year + 400) return;
    }
  }
  for (let y = year; y <= year + 400; y += interval) {
    if (day <= daysInMonth(y, month)) yield `${y}-${pad(month)}-${pad(day)}`;
  }
}

/**
 * Datas em que a série acontece dentro de `[from, to]`. Sem regra, é só a própria data inicial.
 * `exceptions` são ocorrências removidas ("excluir só este dia"); elas contam para o limite `count`.
 */
export function occurrencesBetween(
  start: ISODate,
  rule: Recurrence | null,
  from: ISODate,
  to: ISODate,
  exceptions: readonly ISODate[] = [],
): ISODate[] {
  if (!rule) return start >= from && start <= to && !exceptions.includes(start) ? [start] : [];
  const skip = new Set(exceptions);
  const out: ISODate[] = [];
  let generated = 0;
  for (const date of series(start, rule)) {
    if (date > to) break;
    if (rule.until && date > rule.until) break;
    generated += 1;
    if (rule.count && generated > rule.count) break;
    if (generated > MAX_OCCURRENCES * 4) break;
    if (date >= from && !skip.has(date)) {
      out.push(date);
      if (out.length >= MAX_OCCURRENCES) break;
    }
  }
  return out;
}

/** Última data da série, ou `null` quando ela não tem fim. */
export function lastOccurrence(start: ISODate, rule: Recurrence | null): ISODate | null {
  if (!rule) return start;
  if (!rule.until && !rule.count) return null;
  let last: ISODate | null = null;
  let generated = 0;
  for (const date of series(start, rule)) {
    if (rule.until && date > rule.until) break;
    generated += 1;
    if (rule.count && generated > rule.count) break;
    if (generated > MAX_OCCURRENCES * 4) break;
    last = date;
  }
  return last;
}

/** "Encerrar a série a partir deste dia": a regra passa a terminar na véspera. */
export function endSeriesBefore(rule: Recurrence, date: ISODate): Recurrence {
  const { count: _count, ...rest } = rule;
  return { ...rest, until: addDays(date, -1) };
}

const WEEKDAY_NAMES = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
const UNIT: Record<RecurrenceFreq, [string, string]> = {
  diaria: ["dia", "dias"],
  semanal: ["semana", "semanas"],
  mensal: ["mês", "meses"],
  anual: ["ano", "anos"],
};

const joinList = (items: string[]) =>
  items.length <= 1 ? (items[0] ?? "") : `${items.slice(0, -1).join(", ")} e ${items[items.length - 1]}`;

/** Texto curto em pt-BR: "Toda semana, segunda e quarta, até 20/12/2026". */
export function describeRecurrence(start: ISODate, rule: Recurrence | null): string {
  if (!rule) return "Não se repete";
  const [one, many] = UNIT[rule.freq];
  const feminine = rule.freq === "semanal";
  let text =
    rule.interval === 1
      ? `${feminine ? "Toda" : "Todo"} ${one}`
      : `A cada ${rule.interval} ${many}`;
  if (rule.freq === "semanal") {
    const days = rule.weekdays?.length ? rule.weekdays : [weekday(start)];
    text += `, ${days.length === 7 ? "todos os dias" : joinList(days.map((d) => WEEKDAY_NAMES[d]))}`;
  } else if (rule.freq === "mensal") {
    text += `, no dia ${parts(start)[2]}`;
  }
  if (rule.until) {
    const [y, m, d] = parts(rule.until);
    text += `, até ${pad(d)}/${pad(m)}/${y}`;
  } else if (rule.count) {
    text += `, ${rule.count} ${rule.count === 1 ? "vez" : "vezes"}`;
  }
  return text;
}

/** Quantos dias um compromisso de vários dias ocupa (1 = só o dia inicial). */
export function spanDays(date: ISODate, endDate: ISODate | null | undefined): number {
  if (!endDate || endDate <= date) return 1;
  return diffDays(date, endDate) + 1;
}
