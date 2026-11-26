/**
 * Conflito de horários ANTES de salvar: a mesma pessoa em dois lugares ao mesmo tempo.
 * Conflito avisa, não proíbe — a action devolve a lista e só grava quando a pessoa confirma.
 *
 * Considera as repetições (do candidato e dos outros), compromissos de vários dias e os bloqueios de dia
 * inteiro (categoria com `blocksDay`, como férias). Os títulos dos compromissos em choque passam pela função de
 * privacidade: um particular de outra pessoa aparece como "Ocupado".
 */
import "server-only";
import { inArray } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { busySlots } from "@/lib/agenda/busy";
import { findConflicts, type BusySlot } from "@/lib/agenda/conflicts";
import { expandEvent } from "@/lib/agenda/expand";
import { lastOccurrence, type Recurrence } from "@/lib/agenda/recurrence";
import { addDays, diffDays, type ISODate } from "@/lib/dates";
import type { AgendaStatus } from "@/lib/domain";
import { toVisibleEvent, type EventRecord } from "./privacy";
import { loadEventRecords, windowCondition } from "./records";

export type ConflictNotice = {
  date: ISODate;
  startTime: string | null;
  endTime: string | null;
  title: string;
  /** Nomes das pessoas que estariam em dois lugares. */
  people: string[];
};
export type ConflictReport = { conflicts: ConflictNotice[]; total: number };

export type ConflictCandidate = {
  date: ISODate;
  endDate: ISODate | null;
  startTime: string | null;
  endTime: string | null;
  recurrence: Recurrence | null;
  exceptions?: readonly ISODate[];
  status: AgendaStatus;
  /** Responsáveis e participantes (usuários). Vazio = quem está criando. */
  people: readonly number[];
  /** A categoria faz o dia inteiro ocupar a pessoa? */
  blocksDay: boolean;
};

/** Até onde olhar numa série sem fim, e quantas ocorrências conferir no máximo. */
const HORIZON_DAYS = 366;
const MAX_CANDIDATE_OCCURRENCES = 120;
const MAX_NOTICES = 8;

/** Quem um compromisso ocupa: responsáveis e participantes; se não houver ninguém, quem o criou. */
export function busyPeople(event: Pick<EventRecord, "people" | "createdBy">): number[] {
  const ids = event.people.filter((person) => person.role !== "externo" && person.userId).map((person) => person.userId as number);
  if (ids.length > 0) return [...new Set(ids)];
  return typeof event.createdBy === "number" ? [event.createdBy] : [];
}

/**
 * Choques do candidato com o que já está na agenda. `excludeIds`: compromissos a ignorar (o próprio, ao editar).
 * `viewerId` decide o que aparece no aviso (particulares de terceiros viram "Ocupado").
 */
export async function findEventConflicts(viewerId: number, candidate: ConflictCandidate, excludeIds: readonly number[] = []): Promise<ConflictReport> {
  if (candidate.status === "cancelado" || candidate.people.length === 0) return { conflicts: [], total: 0 };
  const span = candidate.endDate && candidate.endDate > candidate.date ? diffDays(candidate.date, candidate.endDate) : 0;
  const last = lastOccurrence(candidate.date, candidate.recurrence);
  const horizon = addDays(candidate.date, HORIZON_DAYS);
  const until = last && last < horizon ? last : horizon;
  const shape = { date: candidate.date, endDate: candidate.endDate, recurrence: candidate.recurrence, recurrenceExceptions: [...(candidate.exceptions ?? [])] };
  const occurrences = expandEvent(shape, candidate.date, until).slice(0, MAX_CANDIDATE_OCCURRENCES);
  if (occurrences.length === 0) return { conflicts: [], total: 0 };
  const from = occurrences[0].date;
  const to = addDays(occurrences[occurrences.length - 1].date, span);

  const candidateSlots: BusySlot[] = occurrences.flatMap((occurrence) =>
    busySlots({
      key: "candidato",
      title: "",
      date: occurrence.date,
      endDate: occurrence.endDate,
      startTime: candidate.startTime,
      endTime: candidate.endTime,
      people: candidate.people,
      blocksDay: candidate.blocksDay,
    }),
  );
  const wantedDays = new Set(candidateSlots.map((slot) => slot.date));

  const records = (await loadEventRecords(windowCondition(from, to))).filter((record) => !excludeIds.includes(record.id) && record.status !== "cancelado");
  const others: BusySlot[] = [];
  for (const record of records) {
    const people = busyPeople(record).filter((id) => candidate.people.includes(id));
    if (people.length === 0) continue;
    const visible = toVisibleEvent(record, viewerId);
    for (const occurrence of expandEvent(record, from, to)) {
      for (const slot of busySlots({
        key: `e-${record.id}@${occurrence.date}`,
        title: visible.title,
        date: occurrence.date,
        endDate: occurrence.endDate,
        startTime: record.startTime,
        endTime: record.endTime,
        people,
        // particular de outra pessoa: o dia inteiro conta como ocupado (não se sabe a categoria)
        blocksDay: visible.masked ? true : record.categoryBlocksDay,
      })) {
        if (wantedDays.has(slot.date)) others.push(slot);
      }
    }
  }
  if (others.length === 0) return { conflicts: [], total: 0 };

  const found = new Map<string, { date: ISODate; startTime: string | null; endTime: string | null; title: string; people: Set<number> }>();
  for (const slot of candidateSlots) {
    for (const conflict of findConflicts(slot, others)) {
      const key = `${conflict.key}|${conflict.date}`;
      const entry = found.get(key) ?? { date: conflict.date, startTime: conflict.startTime, endTime: conflict.endTime, title: conflict.title, people: new Set<number>() };
      conflict.people.forEach((id) => entry.people.add(id));
      found.set(key, entry);
    }
  }
  const all = [...found.values()].sort((a, b) => a.date.localeCompare(b.date) || (a.startTime ?? "").localeCompare(b.startTime ?? ""));
  const shown = all.slice(0, MAX_NOTICES);
  const ids = [...new Set(shown.flatMap((entry) => [...entry.people]))];
  const names = new Map(ids.length ? (await db.select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, ids))).map((row) => [row.id, row.name]) : []);
  return {
    total: all.length,
    conflicts: shown.map((entry) => ({
      date: entry.date,
      startTime: entry.startTime,
      endTime: entry.endTime,
      title: entry.title,
      people: [...entry.people].map((id) => names.get(id) ?? "").filter(Boolean),
    })),
  };
}
