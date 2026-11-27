/**
 * Período da tela de métricas: leitura segura da URL (entrada do usuário), período anterior para comparação e
 * rótulos. Usado pela página `/painel/site/metricas` e pelo CSV — os dois respeitam o mesmo filtro. Arquivo puro.
 *
 *   ?periodo=7|30|90            últimos N dias (padrão: 30), terminando hoje
 *   ?periodo=mes&mes=YYYY-MM    um mês do calendário (o mês corrente vai até hoje)
 *   ?periodo=intervalo&de=…&ate=…   intervalo livre (no máximo 366 dias)
 */
import { addDays, addMonths, diffDays, endOfMonth, formatDate, formatMonth, isISODate, startOfMonth, type ISODate } from "@/lib/dates";

export const PERIOD_DAY_PRESETS = [7, 30, 90] as const;
export type PeriodDays = (typeof PERIOD_DAY_PRESETS)[number];
export const MAX_RANGE_DAYS = 366;

export type MetricsPeriod = {
  kind: "dias" | "mes" | "intervalo";
  /** Só em `dias`. */
  days?: PeriodDays;
  from: ISODate;
  to: ISODate;
};

type Raw = Record<string, string | string[] | undefined>;
const first = (value: string | string[] | undefined): string | undefined => (Array.isArray(value) ? value[0] : value);

function lastDays(days: PeriodDays, today: ISODate): MetricsPeriod {
  return { kind: "dias", days, from: addDays(today, -(days - 1)), to: today };
}

export function parseMetricsPeriod(raw: Raw, today: ISODate): MetricsPeriod {
  const kind = first(raw.periodo);
  if (kind === "mes") {
    const value = first(raw.mes);
    const valid = value && /^\d{4}-\d{2}$/.test(value) && isISODate(`${value}-01`) && Number(value.slice(0, 4)) >= 2000;
    // mês futuro não existe na medição: cai no mês corrente
    const from = valid && `${value}-01` <= today ? `${value}-01` : startOfMonth(today);
    const end = endOfMonth(from);
    return { kind: "mes", from, to: end > today ? today : end };
  }
  if (kind === "intervalo") {
    const de = first(raw.de);
    const ate = first(raw.ate);
    let from = de && isISODate(de) ? de : undefined;
    let to = ate && isISODate(ate) ? ate : undefined;
    if (!from && !to) return lastDays(30, today);
    if (to && to > today) to = today;
    if (from && from > today) from = today;
    to ??= today;
    from ??= addDays(to, -29);
    if (from > to) [from, to] = [to, from];
    if (diffDays(from, to) + 1 > MAX_RANGE_DAYS) from = addDays(to, -(MAX_RANGE_DAYS - 1));
    return { kind: "intervalo", from, to };
  }
  const days = PERIOD_DAY_PRESETS.find((preset) => String(preset) === kind);
  return lastDays(days ?? 30, today);
}

/** Quantos dias o período cobre. */
export function periodLength(period: Pick<MetricsPeriod, "from" | "to">): number {
  return diffDays(period.from, period.to) + 1;
}

/**
 * Período de comparação: o mesmo número de dias, imediatamente antes. Para um mês do calendário, o mês anterior —
 * inteiro se o mês escolhido já fechou; só os mesmos primeiros dias se ele ainda está em curso.
 */
export function previousPeriod(period: MetricsPeriod): { from: ISODate; to: ISODate } {
  const length = periodLength(period);
  if (period.kind === "mes") {
    const from = startOfMonth(addMonths(period.from, -1));
    const end = endOfMonth(from);
    if (period.to >= endOfMonth(period.from)) return { from, to: end };
    const to = addDays(from, length - 1);
    return { from, to: to > end ? end : to };
  }
  const to = addDays(period.from, -1);
  return { from: addDays(to, -(length - 1)), to };
}

export function periodLabel(period: MetricsPeriod): string {
  if (period.kind === "dias") return `Últimos ${period.days} dias`;
  if (period.kind === "mes") return formatMonth(period.from);
  return period.from === period.to ? formatDate(period.from) : `${formatDate(period.from)} a ${formatDate(period.to)}`;
}

/** Querystring (sem `?`) que reproduz o período — para o link do CSV e a navegação entre meses. */
export function periodQuery(period: MetricsPeriod): string {
  const params = new URLSearchParams();
  if (period.kind === "dias") params.set("periodo", String(period.days));
  else if (period.kind === "mes") {
    params.set("periodo", "mes");
    params.set("mes", period.from.slice(0, 7));
  } else {
    params.set("periodo", "intervalo");
    params.set("de", period.from);
    params.set("ate", period.to);
  }
  return params.toString();
}

/** Sufixo de nome de arquivo: `2026-11-01_a_2026-11-30`. */
export function periodFileSuffix(period: Pick<MetricsPeriod, "from" | "to">): string {
  return period.from === period.to ? period.from : `${period.from}_a_${period.to}`;
}

/** Todos os dias do período, em ordem. */
export function periodDays(period: Pick<MetricsPeriod, "from" | "to">): ISODate[] {
  const out: ISODate[] = [];
  for (let day = period.from; day <= period.to; day = addDays(day, 1)) out.push(day);
  return out;
}
