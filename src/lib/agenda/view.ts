/**
 * Modelo de apresentação da agenda (puro; serve ao servidor e aos Client Components das visões).
 * Um `AgendaItem` é o que as telas desenham: uma ocorrência de compromisso — já passada pela função de
 * privacidade — ou um item de camada derivada (prazo de projeto, vencimento, publicação).
 */
import {
  addDays,
  addMonths,
  endOfMonth,
  formatDateLong,
  formatDateShort,
  formatMonth,
  formatWeekday,
  startOfMonth,
  startOfWeek,
  type ISODate,
} from "@/lib/dates";
import type { AgendaColor, AgendaIcon, AgendaPriority, AgendaStatus, AgendaView } from "@/lib/domain";

export type AgendaItemSource = "event" | "deadline" | "finance" | "editorial";

export type AgendaItem = {
  /** Chave estável: `e-12` · `e-12@2026-12-01` (ocorrência de série) · `p-3-entrega` · `f-9` · `c-4` · `k-2`. */
  key: string;
  source: AgendaItemSource;
  /** Id do compromisso (ou do registro de origem, nas camadas). */
  id: number;
  title: string;
  /** Primeiro e último dia desta ocorrência. */
  date: ISODate;
  endDate: ISODate;
  startTime: string | null;
  endTime: string | null;
  color: AgendaColor;
  icon: AgendaIcon | null;
  href: string;
  /** Particular de outra pessoa: só "Ocupado" e o horário. */
  masked: boolean;
  status: AgendaStatus | null;
  priority: AgendaPriority | null;
  recurring: boolean;
  /** Texto curto de apoio: categoria, "Prazo de entrega", "A receber"… */
  label: string;
  categoryId: number | null;
  calendarId: number | null;
  location: string;
  clientName: string | null;
  /** Nomes dos responsáveis e participantes (vazio em item mascarado: só `ownerName`). */
  people: string[];
  /** Em item mascarado: quem está ocupado. */
  ownerName: string | null;
  /** Quem está vendo pode alterar este compromisso (reagendar, arrastar)? Sempre `false` em camadas e mascarados. */
  editable: boolean;
  /** Em séries: a data da primeira ocorrência (a pergunta "só este / seguintes / todos" depende dela). */
  seriesStart: ISODate | null;
  /** Projeto ligado (nulo em item mascarado). */
  projectId: number | null;
};

/** `09:00 – 10:30` · `09:00` · `Dia inteiro`. */
export function timeLabel(item: Pick<AgendaItem, "startTime" | "endTime">): string {
  if (!item.startTime) return "Dia inteiro";
  return item.endTime ? `${item.startTime} – ${item.endTime}` : item.startTime;
}

/**
 * Compromisso COM HORA que vira a noite e dura menos de um dia (22:00 de um dia às 02:00 do seguinte): é
 * desenhado na grade de horas, um trecho em cada dia. Sem hora de fim, ou de 24 h para cima, vai para a faixa do topo.
 */
export const isOvernight = (item: Pick<AgendaItem, "startTime" | "endTime" | "date" | "endDate">) =>
  item.startTime !== null && item.endTime !== null && addDays(item.date, 1) === item.endDate && item.endTime <= item.startTime;

/** Vai para a faixa "dia inteiro" (sem hora, ou de vários dias que não cabe na grade de horas). */
export const isAllDay = (item: Pick<AgendaItem, "startTime" | "endTime" | "date" | "endDate">) =>
  item.startTime === null || (item.endDate > item.date && !isOvernight(item));

/** Ordem dentro do dia: dia inteiro primeiro, depois por horário; compromissos antes das camadas. */
export function compareItems(a: AgendaItem, b: AgendaItem): number {
  return (
    a.date.localeCompare(b.date) ||
    (a.startTime ?? "").localeCompare(b.startTime ?? "") ||
    (a.source === b.source ? 0 : a.source === "event" ? -1 : b.source === "event" ? 1 : 0) ||
    a.title.localeCompare(b.title, "pt-BR")
  );
}

/** Itens por dia; um item de vários dias aparece em cada dia que ocupa (dentro de `days`). */
export function itemsByDay(items: readonly AgendaItem[], days: readonly ISODate[]): Map<ISODate, AgendaItem[]> {
  const map = new Map<ISODate, AgendaItem[]>(days.map((day) => [day, []]));
  for (const item of items) {
    for (let day = item.date; day <= item.endDate; day = addDays(day, 1)) map.get(day)?.push(item);
  }
  for (const list of map.values()) list.sort((a, b) => compareItems({ ...a, date: "" }, { ...b, date: "" }));
  return map;
}

export type ViewRange = {
  /** Janela consultada no banco. */
  from: ISODate;
  to: ISODate;
  /** Dias mostrados (dia, semana); vazio nas outras visões. */
  days: ISODate[];
  title: string;
  /** Data-âncora ao clicar em anterior / próximo. */
  previous: ISODate;
  next: ISODate;
};

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
export const LIST_DAYS = 60;

/** Semanas mostradas na linha do tempo, por escala (3 ou 6 meses). */
export const TIMELINE_WEEKS: Record<3 | 6, number> = { 3: 13, 6: 26 };

export type ViewOptions = {
  /** Disponibilidade: um dia (colunas por pessoa) ou a semana (linhas por pessoa). */
  mode?: "dia" | "semana";
  /** Linha do tempo: 3 ou 6 meses. */
  months?: 3 | 6;
};

/** Janela, título e vizinhos de cada visão a partir da data-âncora. */
export function viewRange(view: AgendaView, date: ISODate, options: ViewOptions = {}): ViewRange {
  if (view === "disponibilidade") return viewRange(options.mode === "semana" ? "semana" : "dia", date);
  if (view === "linha") {
    // começa uma semana antes da semana da data: o que acabou de passar continua à vista
    const from = addDays(startOfWeek(date), -7);
    const to = addDays(from, TIMELINE_WEEKS[options.months ?? 3] * 7 - 1);
    // "Nov 2026 – fev 2027": curto, para caber ao lado dos controles
    const short = (iso: ISODate) => `${formatDateShort(iso).split(" ")[1]} ${iso.slice(0, 4)}`;
    const title = `${capitalize(short(from))} – ${short(to)}`;
    return { from, to, days: [], title, previous: addDays(date, -28), next: addDays(date, 28) };
  }
  if (view === "dia") {
    return { from: date, to: date, days: [date], title: `${capitalize(formatWeekday(date, true))}, ${formatDateLong(date)}`, previous: addDays(date, -1), next: addDays(date, 1) };
  }
  if (view === "semana") {
    const first = startOfWeek(date);
    const days = Array.from({ length: 7 }, (_, i) => addDays(first, i));
    const last = days[6];
    const title =
      first.slice(0, 7) === last.slice(0, 7)
        ? capitalize(formatMonth(first))
        : `${capitalize(formatDateShort(first).split(" ")[1])} – ${formatDateShort(last).split(" ")[1]} de ${last.slice(0, 4)}`;
    return { from: first, to: last, days, title, previous: addDays(date, -7), next: addDays(date, 7) };
  }
  if (view === "mes") {
    const first = startOfMonth(date);
    return {
      from: startOfWeek(first),
      to: addDays(startOfWeek(endOfMonth(first)), 6),
      days: [],
      title: capitalize(formatMonth(first)),
      previous: addMonths(first, -1),
      next: addMonths(first, 1),
    };
  }
  if (view === "ano") {
    const year = date.slice(0, 4);
    return { from: `${year}-01-01`, to: `${year}-12-31`, days: [], title: year, previous: addMonths(`${year}-01-01`, -12), next: addMonths(`${year}-01-01`, 12) };
  }
  const to = addDays(date, LIST_DAYS - 1);
  return {
    from: date,
    to,
    days: [],
    title: `${formatDateShort(date)} – ${formatDateShort(to)} de ${to.slice(0, 4)}`,
    previous: addDays(date, -LIST_DAYS),
    next: addDays(date, LIST_DAYS),
  };
}
