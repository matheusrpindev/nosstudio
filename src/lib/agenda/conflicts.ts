/**
 * Conflito de horários e posição dos compromissos na grade de dia/semana (lógica pura).
 * Horários são `HH:mm` no mesmo dia; compromisso sem fim vale `DEFAULT_DURATION_MIN`.
 */
import type { ISODate } from "@/lib/dates";

export const DEFAULT_DURATION_MIN = 60;
const DAY_MIN = 24 * 60;

export function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

export function minutesToTime(minutes: number): string {
  const clamped = Math.max(0, Math.min(DAY_MIN - 1, Math.round(minutes)));
  return `${String(Math.floor(clamped / 60)).padStart(2, "0")}:${String(clamped % 60).padStart(2, "0")}`;
}

/** Intervalo em minutos do dia. Dia inteiro (sem início) ocupa o dia todo. */
export function minuteRange(startTime: string | null, endTime: string | null): [number, number] {
  if (!startTime) return [0, DAY_MIN];
  const start = timeToMinutes(startTime);
  const end = endTime ? timeToMinutes(endTime) : start + DEFAULT_DURATION_MIN;
  return [start, Math.min(DAY_MIN, Math.max(end, start + 1))];
}

export type BusySlot = {
  key: string;
  title: string;
  date: ISODate;
  startTime: string | null;
  endTime: string | null;
  /** Pessoas ocupadas por este compromisso (responsáveis e participantes). */
  people: readonly number[];
  /**
   * Compromisso de dia inteiro só ocupa a pessoa quando é um bloqueio (férias, indisponibilidade, evento que
   * toma o dia). Feriados e lembretes de dia inteiro não geram conflito.
   */
  blocksDay?: boolean;
};

export type Conflict = {
  key: string;
  title: string;
  date: ISODate;
  startTime: string | null;
  endTime: string | null;
  /** Pessoas em comum, que estariam em dois lugares ao mesmo tempo. */
  people: number[];
};

const occupies = (slot: BusySlot) => slot.startTime !== null || slot.blocksDay === true;

/**
 * Compromissos que chocam com o candidato: mesmo dia, horários sobrepostos e ao menos uma pessoa em comum.
 * Encostar (um termina 10:00, outro começa 10:00) não é conflito.
 */
export function findConflicts(candidate: BusySlot, others: readonly BusySlot[]): Conflict[] {
  if (!occupies(candidate) || candidate.people.length === 0) return [];
  const [cStart, cEnd] = minuteRange(candidate.startTime, candidate.endTime);
  const conflicts: Conflict[] = [];
  for (const other of others) {
    if (other.key === candidate.key || other.date !== candidate.date || !occupies(other)) continue;
    const shared = other.people.filter((p) => candidate.people.includes(p));
    if (shared.length === 0) continue;
    const [oStart, oEnd] = minuteRange(other.startTime, other.endTime);
    if (cStart < oEnd && oStart < cEnd) {
      conflicts.push({
        key: other.key,
        title: other.title,
        date: other.date,
        startTime: other.startTime,
        endTime: other.endTime,
        people: shared,
      });
    }
  }
  return conflicts.sort((a, b) => (a.startTime ?? "").localeCompare(b.startTime ?? ""));
}

export type FreeWindow = { start: string; end: string };

/** Janelas livres de uma pessoa (ou grupo) num dia, dentro do expediente informado. */
export function freeWindows(
  slots: readonly Pick<BusySlot, "startTime" | "endTime" | "blocksDay">[],
  dayStart = "08:00",
  dayEnd = "20:00",
  minMinutes = 30,
): FreeWindow[] {
  const from = timeToMinutes(dayStart);
  const to = timeToMinutes(dayEnd);
  const busy = slots
    .filter((s) => s.startTime !== null || s.blocksDay)
    .map((s) => minuteRange(s.startTime, s.endTime))
    .sort((a, b) => a[0] - b[0]);
  const windows: FreeWindow[] = [];
  let cursor = from;
  for (const [start, end] of busy) {
    if (start - cursor >= minMinutes && start > cursor) {
      windows.push({ start: minutesToTime(cursor), end: minutesToTime(Math.min(start, to)) });
    }
    cursor = Math.max(cursor, end);
    if (cursor >= to) break;
  }
  if (to - cursor >= minMinutes) windows.push({ start: minutesToTime(cursor), end: minutesToTime(to) });
  return windows.filter((w) => w.start < w.end);
}

export type TimedItem = { key: string; startTime: string; endTime: string | null };

export type Placement = {
  key: string;
  /** Minutos desde 00:00 e duração, para posicionar na coluna do dia. */
  top: number;
  height: number;
  /** Coluna dentro do grupo de sobrepostos e total de colunas do grupo (largura = 1 / columns). */
  column: number;
  columns: number;
};

/**
 * Distribui os compromissos com hora de um dia em colunas lado a lado quando se sobrepõem (como no
 * Google Agenda). `minHeight` evita blocos invisíveis para compromissos muito curtos.
 */
export function layoutDay(items: readonly TimedItem[], minHeight = 20): Placement[] {
  const sorted = items
    .map((item) => {
      const [start, end] = minuteRange(item.startTime, item.endTime);
      return { key: item.key, start, end: Math.max(end, start + minHeight) };
    })
    .sort((a, b) => a.start - b.start || b.end - a.end || a.key.localeCompare(b.key));

  const placements: Placement[] = [];
  let group: { key: string; start: number; end: number; column: number }[] = [];
  let groupEnd = -1;
  let columnEnds: number[] = [];

  const flush = () => {
    for (const item of group) {
      placements.push({
        key: item.key,
        top: item.start,
        height: item.end - item.start,
        column: item.column,
        columns: columnEnds.length,
      });
    }
    group = [];
    columnEnds = [];
  };

  for (const item of sorted) {
    if (group.length > 0 && item.start >= groupEnd) flush();
    let column = columnEnds.findIndex((end) => end <= item.start);
    if (column === -1) {
      column = columnEnds.length;
      columnEnds.push(item.end);
    } else {
      columnEnds[column] = item.end;
    }
    group.push({ ...item, column });
    groupEnd = group.length === 1 ? item.end : Math.max(groupEnd, item.end);
  }
  flush();
  return placements;
}

/** Arredonda minutos para o passo da grade (arrastar e soltar, criação rápida). */
export function snapMinutes(minutes: number, step = 15): number {
  return Math.max(0, Math.min(DAY_MIN - step, Math.round(minutes / step) * step));
}

/** Novo horário ao arrastar: mantém a duração; devolve `HH:mm` de início e fim. */
export function moveTimes(
  startTime: string,
  endTime: string | null,
  newStartMinutes: number,
): { startTime: string; endTime: string | null } {
  const [start, end] = minuteRange(startTime, endTime);
  const duration = end - start;
  const snapped = Math.min(snapMinutes(newStartMinutes), DAY_MIN - duration);
  return {
    startTime: minutesToTime(Math.max(0, snapped)),
    endTime: endTime ? minutesToTime(Math.max(0, snapped) + duration) : null,
  };
}
