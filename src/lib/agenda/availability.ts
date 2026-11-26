/**
 * Disponibilidade da equipe (lógica pura): janelas livres EM COMUM de um grupo de pessoas num dia.
 * A tela e o servidor montam as faixas ocupadas de cada pessoa (`BusySlot`, já com bloqueios de dia inteiro);
 * aqui elas viram as janelas em que todo mundo está livre dentro do expediente.
 */
import { freeWindows, minutesToTime, timeToMinutes, type BusySlot, type FreeWindow } from "./conflicts";

export type Workday = { start: string; end: string };
type Slot = Pick<BusySlot, "startTime" | "endTime" | "blocksDay" | "people">;

/**
 * Janelas em que TODAS as pessoas de `people` estão livres. Uma faixa só conta se ocupa alguém do grupo; com o
 * grupo vazio não há o que cruzar (lista vazia).
 */
export function commonFreeWindows(slots: readonly Slot[], people: readonly number[], workday: Workday, minMinutes = 30): FreeWindow[] {
  if (people.length === 0) return [];
  const relevant = slots.filter((slot) => slot.people.some((id) => people.includes(id)));
  return freeWindows(relevant, workday.start, workday.end, minMinutes);
}

/** Horário sugerido ao clicar numa janela livre: começa no início dela e dura até `minutes` (ou a janela inteira, se menor). */
export function suggestSlot(window: FreeWindow, minutes = 60): FreeWindow {
  const start = timeToMinutes(window.start);
  return { start: window.start, end: minutesToTime(Math.min(start + minutes, timeToMinutes(window.end))) };
}

/** Posição (em %) de um intervalo dentro do expediente, para as barras da visão semanal. Corta o que sai do expediente. */
export function barSegment(startTime: string | null, endTime: string | null, workday: Workday): { left: number; width: number } | null {
  const from = timeToMinutes(workday.start);
  const to = timeToMinutes(workday.end);
  const start = startTime === null ? from : Math.max(from, timeToMinutes(startTime));
  const end = startTime === null ? to : Math.min(to, endTime ? timeToMinutes(endTime) : timeToMinutes(startTime) + 60);
  if (end <= start) return null;
  return { left: ((start - from) / (to - from)) * 100, width: ((end - start) / (to - from)) * 100 };
}
