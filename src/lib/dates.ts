/**
 * Datas no sistema:
 * - datas de calendário são strings ISO `YYYY-MM-DD` (sem fuso);
 * - horários de agenda são strings `HH:mm`;
 * - "agora" e "hoje" são calculados no fuso do estúdio (APP_TIMEZONE, padrão America/Sao_Paulo).
 * Arquivo puro: pode ser usado no servidor e no cliente.
 *
 * Atenção (Next.js Cache Components): em Server Components públicos, `todayISO()`/`nowLocal()` só podem ser
 * chamados dentro de funções com "use cache" ou depois de `await connection()`.
 */
export type ISODate = string; // YYYY-MM-DD

const DEFAULT_TZ = "America/Sao_Paulo";
const timezone = () => (typeof process !== "undefined" && process.env.APP_TIMEZONE) || DEFAULT_TZ;

function partsInTz(date: Date, tz = timezone()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  return { year: get("year"), month: get("month"), day: get("day"), hour: get("hour"), minute: get("minute") };
}

/** Data de hoje no fuso do estúdio. */
export function todayISO(now: Date = new Date()): ISODate {
  const p = partsInTz(now);
  return `${p.year}-${p.month}-${p.day}`;
}

/** Data e hora locais do estúdio no formato dos campos datetime-local: `YYYY-MM-DDTHH:mm`. */
export function nowLocal(now: Date = new Date()): string {
  const p = partsInTz(now);
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

/** Converte um instante (Date) para a data de calendário no fuso do estúdio. */
export function toISODate(date: Date): ISODate {
  return todayISO(date);
}

export function isISODate(value: unknown): value is ISODate {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

const toUTC = (iso: ISODate) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};
const fromUTC = (date: Date): ISODate => date.toISOString().slice(0, 10);

export function addDays(iso: ISODate, days: number): ISODate {
  const date = toUTC(iso);
  date.setUTCDate(date.getUTCDate() + days);
  return fromUTC(date);
}

export function addMonths(iso: ISODate, months: number): ISODate {
  const [y, m, d] = iso.split("-").map(Number);
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, lastDay));
  return fromUTC(target);
}

/** Diferença em dias (b - a). */
export function diffDays(a: ISODate, b: ISODate): number {
  return Math.round((toUTC(b).getTime() - toUTC(a).getTime()) / 86_400_000);
}

/** 0 = domingo … 6 = sábado. */
export function weekday(iso: ISODate): number {
  return toUTC(iso).getUTCDay();
}

export function startOfMonth(iso: ISODate): ISODate {
  return `${iso.slice(0, 7)}-01`;
}

export function endOfMonth(iso: ISODate): ISODate {
  const [y, m] = iso.split("-").map(Number);
  return fromUTC(new Date(Date.UTC(y, m, 0)));
}

/** Domingo da semana que contém a data (calendários no Brasil começam no domingo). */
export function startOfWeek(iso: ISODate): ISODate {
  return addDays(iso, -weekday(iso));
}

/** Grade de um mês para calendários: semanas completas (domingo a sábado) cobrindo o mês. */
export function monthGrid(monthISO: ISODate): ISODate[][] {
  const first = startOfWeek(startOfMonth(monthISO));
  const last = endOfMonth(monthISO);
  const weeks: ISODate[][] = [];
  let cursor = first;
  while (cursor <= last) {
    const week: ISODate[] = [];
    for (let i = 0; i < 7; i++) {
      week.push(cursor);
      cursor = addDays(cursor, 1);
    }
    weeks.push(week);
  }
  return weeks;
}

const MONTHS = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];
const WEEKDAYS = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];
export const WEEKDAYS_SHORT = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

/** `17/11/2026` */
export function formatDate(iso: ISODate | null | undefined): string {
  if (!iso || !isISODate(iso)) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

/** `17 de novembro de 2026` */
export function formatDateLong(iso: ISODate | null | undefined): string {
  if (!iso || !isISODate(iso)) return "";
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} de ${MONTHS[m - 1]} de ${y}`;
}

/** `17 nov` */
export function formatDateShort(iso: ISODate | null | undefined): string {
  if (!iso || !isISODate(iso)) return "";
  const [, m, d] = iso.split("-").map(Number);
  return `${d} ${MONTHS[m - 1].slice(0, 3)}`;
}

/** `novembro de 2026` */
export function formatMonth(iso: ISODate): string {
  const [y, m] = iso.split("-").map(Number);
  return `${MONTHS[m - 1]} de ${y}`;
}

/** `terça-feira` */
export function formatWeekday(iso: ISODate, short = false): string {
  return short ? WEEKDAYS_SHORT[weekday(iso)] : WEEKDAYS[weekday(iso)];
}

/** Instante → `17/11/2026 14:30` no fuso do estúdio. */
export function formatDateTime(date: Date | null | undefined): string {
  if (!date) return "";
  const p = partsInTz(date);
  return `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}`;
}

/** `hoje`, `amanhã`, `em 3 dias`, `há 2 dias`, ou a data curta. */
export function formatRelativeDay(iso: ISODate, today: ISODate): string {
  const diff = diffDays(today, iso);
  if (diff === 0) return "hoje";
  if (diff === 1) return "amanhã";
  if (diff === -1) return "ontem";
  if (diff > 1 && diff <= 14) return `em ${diff} dias`;
  if (diff < -1 && diff >= -14) return `há ${-diff} dias`;
  return formatDate(iso);
}

/** Valida `HH:mm`. */
export function isTime(value: unknown): value is string {
  return typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}
