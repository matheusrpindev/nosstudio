/**
 * Arrastar e redimensionar compromissos na grade (lógica pura, testada em `drag.test.ts`).
 * A tela só converte pixels em minutos/dias; o que vira o novo horário é decidido aqui — e conferido de novo no
 * servidor (`src/server/agenda/move.ts`).
 */
import { addDays, diffDays, type ISODate } from "@/lib/dates";
import { DEFAULT_DURATION_MIN, minuteRange, minutesToTime, moveTimes, snapMinutes, timeToMinutes } from "./conflicts";
import { isOvernight, type AgendaItem } from "./view";

export const DRAG_STEP_MIN = 15;
const DAY_MIN = 24 * 60;

type Draggable = Pick<AgendaItem, "source" | "masked" | "status" | "editable">;
type Timed = Pick<AgendaItem, "date" | "endDate" | "startTime" | "endTime">;

/** Dá para arrastar? Só compromisso de verdade (não camada), visível por inteiro, não cancelado e que a pessoa pode alterar. */
export function canDrag(item: Draggable): boolean {
  return item.source === "event" && !item.masked && item.editable && item.status !== "cancelado";
}

/** Dá para puxar a borda de baixo? Só compromisso com hora, de um dia só. */
export function canResize(item: Draggable & Timed): boolean {
  return canDrag(item) && item.startTime !== null && item.endDate === item.date;
}

export type DragPlacement = { date: ISODate; endDate: ISODate; startTime: string | null; endTime: string | null };

const span = (item: Timed) => Math.max(0, diffDays(item.date, item.endDate));

/** Novo dia (visão de mês, faixa de dia inteiro): o horário e a duração em dias continuam os mesmos. */
export function moveToDay(item: Timed, day: ISODate): DragPlacement {
  return { date: day, endDate: addDays(day, span(item)), startTime: item.startTime, endTime: item.endTime };
}

/**
 * Novo dia e horário ao soltar na grade de horas. `deltaMinutes` é o quanto o bloco andou na vertical; o início
 * encaixa no passo de 15 minutos e a duração é mantida. Compromisso de um dia só nunca atravessa a meia-noite
 * (para o que vira a noite, só o início se move: o fim acompanha, no dia seguinte).
 */
export function moveInGrid(item: Timed, day: ISODate, deltaMinutes: number): DragPlacement {
  if (item.startTime === null) return moveToDay(item, day);
  const wanted = timeToMinutes(item.startTime) + deltaMinutes;
  if (isOvernight(item)) {
    const start = snapMinutes(wanted, DRAG_STEP_MIN);
    const duration = DAY_MIN - timeToMinutes(item.startTime) + timeToMinutes(item.endTime as string);
    const end = start + duration;
    // se, com o novo início, ele deixa de virar a noite, termina no mesmo dia
    return end < DAY_MIN
      ? { date: day, endDate: day, startTime: minutesToTime(start), endTime: minutesToTime(end) }
      : { date: day, endDate: addDays(day, 1), startTime: minutesToTime(start), endTime: minutesToTime(end - DAY_MIN) };
  }
  const times = moveTimes(item.startTime, item.endTime, wanted);
  return { date: day, endDate: addDays(day, span(item)), ...times };
}

/**
 * Nova duração ao puxar a borda de baixo: o fim anda `deltaMinutes`, encaixa em 15 minutos, fica ao menos 15
 * minutos depois do início e não passa de 23:59. Compromisso sem hora de fim passa a ter uma.
 */
export function resizeEnd(item: Timed, deltaMinutes: number): DragPlacement {
  if (item.startTime === null) return { date: item.date, endDate: item.endDate, startTime: null, endTime: null };
  const [start, end] = minuteRange(item.startTime, item.endTime ?? minutesToTime(timeToMinutes(item.startTime) + DEFAULT_DURATION_MIN));
  const snapped = Math.round((end + deltaMinutes) / DRAG_STEP_MIN) * DRAG_STEP_MIN;
  const next = Math.min(DAY_MIN - 1, Math.max(start + DRAG_STEP_MIN, snapped));
  return { date: item.date, endDate: item.endDate, startTime: item.startTime, endTime: minutesToTime(next) };
}

/** Mudou alguma coisa? (soltar no mesmo lugar não chama o servidor) */
export function samePlacement(item: Timed, placement: DragPlacement): boolean {
  return item.date === placement.date && item.endDate === placement.endDate && item.startTime === placement.startTime && item.endTime === placement.endTime;
}

/** Aplica os movimentos ainda não confirmados pelo servidor (atualização otimista). */
export function applyPlacements<T extends Timed & { key: string }>(items: readonly T[], placements: ReadonlyMap<string, DragPlacement>): T[] {
  if (placements.size === 0) return [...items];
  return items.map((item) => {
    const placement = placements.get(item.key);
    return placement ? { ...item, ...placement } : item;
  });
}

export type GridSegment = { startMinutes: number; endMinutes: number; continues: boolean; continued: boolean };

/**
 * O trecho de um compromisso com hora que cabe no dia `day` da grade: o compromisso de um dia só é um trecho; o
 * que vira a noite tem um trecho até 24:00 no primeiro dia e outro a partir de 00:00 no seguinte.
 */
export function gridSegment(item: Timed, day: ISODate): GridSegment | null {
  if (item.startTime === null) return null;
  if (item.date === item.endDate) {
    if (day !== item.date) return null;
    const [start, end] = minuteRange(item.startTime, item.endTime);
    return { startMinutes: start, endMinutes: end, continues: false, continued: false };
  }
  if (!isOvernight(item)) return null;
  if (day === item.date) return { startMinutes: timeToMinutes(item.startTime), endMinutes: DAY_MIN, continues: true, continued: false };
  if (day === item.endDate) {
    const end = timeToMinutes(item.endTime as string);
    return end > 0 ? { startMinutes: 0, endMinutes: end, continues: false, continued: true } : null;
  }
  return null;
}
