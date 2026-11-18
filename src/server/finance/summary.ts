/**
 * Resumo do financeiro — funções PURAS (sem banco), testadas em `summary.test.ts`.
 *
 * Regras (visão gerencial, não contábil):
 * - `paidAt` nulo = PREVISTO (ainda não aconteceu); preenchido = REALIZADO (recebido/pago).
 * - Data de referência de um lançamento: `paidAt` se já foi pago, senão `dueDate`. Ou seja, o que foi pago conta no
 *   mês em que o dinheiro entrou/saiu; o que está em aberto conta no mês do vencimento.
 *   Assim, "previsto" de um mês = realizado + em aberto, sempre fechando a conta.
 * - Vencido = em aberto com `dueDate` anterior a hoje.
 * - Resultado realizado = recebido − pago. Resultado previsto = receitas previstas − despesas previstas.
 */
import { addMonths, type ISODate } from "@/lib/dates";
import type { FinanceType } from "@/lib/domain";

export type EntryLike = {
  type: FinanceType;
  amountCents: number;
  dueDate: ISODate;
  paidAt: ISODate | null;
};

export type EntryStatus = "previsto" | "realizado" | "vencido";

/** Data que decide em qual mês o lançamento aparece. */
export function referenceDate(entry: Pick<EntryLike, "dueDate" | "paidAt">): ISODate {
  return entry.paidAt ?? entry.dueDate;
}

/** `YYYY-MM` de uma data ou de um mês (`YYYY-MM` / `YYYY-MM-01`). */
export const monthKey = (value: string): string => value.slice(0, 7);

export function entryStatus(entry: Pick<EntryLike, "dueDate" | "paidAt">, today: ISODate): EntryStatus {
  if (entry.paidAt) return "realizado";
  return entry.dueDate < today ? "vencido" : "previsto";
}

/** Valores de um lado (receitas ou despesas). */
export type Side = {
  /** Tudo que estava previsto para o mês (realizado + em aberto). */
  previstoCents: number;
  /** Já recebido / já pago. */
  realizadoCents: number;
  /** Ainda a receber / a pagar. */
  abertoCents: number;
  count: number;
};

const emptySide = (): Side => ({ previstoCents: 0, realizadoCents: 0, abertoCents: 0, count: 0 });

function addTo(side: Side, entry: EntryLike) {
  side.previstoCents += entry.amountCents;
  if (entry.paidAt) side.realizadoCents += entry.amountCents;
  else side.abertoCents += entry.amountCents;
  side.count += 1;
}

export type Totals = {
  receitas: Side;
  despesas: Side;
  /** Recebido − pago. */
  resultadoRealizadoCents: number;
  /** Receitas previstas − despesas previstas. */
  resultadoPrevistoCents: number;
};

/** Soma uma lista de lançamentos (já filtrada) em totais de receitas e despesas. */
export function totalize(entries: readonly EntryLike[]): Totals {
  const receitas = emptySide();
  const despesas = emptySide();
  for (const entry of entries) addTo(entry.type === "receita" ? receitas : despesas, entry);
  return {
    receitas,
    despesas,
    resultadoRealizadoCents: receitas.realizadoCents - despesas.realizadoCents,
    resultadoPrevistoCents: receitas.previstoCents - despesas.previstoCents,
  };
}

/** Resumo de um mês: considera só os lançamentos cuja data de referência cai nele. */
export function summarizeMonth(entries: readonly EntryLike[], month: string): Totals & { month: string } {
  const key = monthKey(month);
  return { month: key, ...totalize(entries.filter((entry) => monthKey(referenceDate(entry)) === key)) };
}

export type OverdueTotals = {
  /** A receber vencido. */
  receber: { cents: number; count: number };
  /** A pagar vencido. */
  pagar: { cents: number; count: number };
};

/** Vencidos de qualquer mês (em aberto com vencimento antes de hoje). */
export function overdueTotals(entries: readonly EntryLike[], today: ISODate): OverdueTotals {
  const result: OverdueTotals = { receber: { cents: 0, count: 0 }, pagar: { cents: 0, count: 0 } };
  for (const entry of entries) {
    if (entryStatus(entry, today) !== "vencido") continue;
    const side = entry.type === "receita" ? result.receber : result.pagar;
    side.cents += entry.amountCents;
    side.count += 1;
  }
  return result;
}

export type MonthPoint = {
  /** `YYYY-MM` */
  month: string;
  receitasCents: number;
  despesasCents: number;
  resultadoCents: number;
};

/** Os `count` meses terminando em `endMonth` (do mais antigo ao mais novo), `YYYY-MM`. */
export function lastMonths(endMonth: string, count = 6): string[] {
  const end = `${monthKey(endMonth)}-01`;
  return Array.from({ length: count }, (_, i) => monthKey(addMonths(end, i - (count - 1))));
}

/** Série de receitas × despesas REALIZADAS (por data de pagamento) nos últimos `count` meses. */
export function monthlySeries(entries: readonly EntryLike[], endMonth: string, count = 6): MonthPoint[] {
  const months = lastMonths(endMonth, count);
  const points = new Map<string, MonthPoint>(months.map((month) => [month, { month, receitasCents: 0, despesasCents: 0, resultadoCents: 0 }]));
  for (const entry of entries) {
    if (!entry.paidAt) continue;
    const point = points.get(monthKey(entry.paidAt));
    if (!point) continue;
    if (entry.type === "receita") point.receitasCents += entry.amountCents;
    else point.despesasCents += entry.amountCents;
  }
  for (const point of points.values()) point.resultadoCents = point.receitasCents - point.despesasCents;
  return months.map((month) => points.get(month)!);
}

/** Percentual (0–100) da reserva em relação à meta; `null` sem meta. Não passa de 100. */
export function reserveProgress(valueCents: number, goalCents: number): number | null {
  if (goalCents <= 0) return null;
  return Math.max(0, Math.min(100, Math.round((valueCents / goalCents) * 100)));
}

/** Próximo vencimento ao duplicar um lançamento recorrente: mesmo dia no mês seguinte (ajusta fim de mês). */
export function nextMonthDueDate(dueDate: ISODate): ISODate {
  return addMonths(dueDate, 1);
}
