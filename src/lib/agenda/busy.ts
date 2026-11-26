/**
 * De ocorrências para "faixas ocupadas" (`BusySlot`), a entrada de `findConflicts` (lógica pura).
 * Um compromisso de vários dias vira uma faixa por dia: com horário, o primeiro dia vai do início até o fim do
 * dia, os do meio ocupam o dia todo e o último vai da meia-noite até o fim marcado.
 */
import { addDays, diffDays, type ISODate } from "@/lib/dates";
import type { BusySlot } from "./conflicts";

export type BusySource = {
  key: string;
  title: string;
  date: ISODate;
  endDate: ISODate;
  startTime: string | null;
  endTime: string | null;
  people: readonly number[];
  /** Dia inteiro que ocupa a pessoa (categoria com `blocksDay`). */
  blocksDay: boolean;
};

const END_OF_DAY = "23:59";

export function busySlots(source: BusySource): BusySlot[] {
  const days = Math.max(0, diffDays(source.date, source.endDate));
  const base = { key: source.key, title: source.title, people: source.people };
  if (days === 0) {
    return [{ ...base, date: source.date, startTime: source.startTime, endTime: source.endTime, blocksDay: source.blocksDay }];
  }
  const slots: BusySlot[] = [];
  for (let i = 0; i <= days; i++) {
    const date = addDays(source.date, i);
    if (!source.startTime) {
      slots.push({ ...base, date, startTime: null, endTime: null, blocksDay: source.blocksDay });
    } else if (i === 0) {
      slots.push({ ...base, date, startTime: source.startTime, endTime: END_OF_DAY });
    } else if (i === days) {
      // sem horário de fim, o último dia fica ocupado por inteiro
      if (source.endTime && source.endTime > "00:00") slots.push({ ...base, date, startTime: "00:00", endTime: source.endTime });
      else if (!source.endTime) slots.push({ ...base, date, startTime: null, endTime: null, blocksDay: true });
    } else {
      // dia do meio de um compromisso com horário: ocupado o dia todo
      slots.push({ ...base, date, startTime: null, endTime: null, blocksDay: true });
    }
  }
  return slots;
}
