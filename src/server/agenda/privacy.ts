/**
 * PRIVACIDADE DA AGENDA — a única porta de saída de um compromisso.
 *
 * Um compromisso `particular` só é visto por inteiro por quem o criou e por quem está nele (responsáveis e
 * participantes). Para todas as outras pessoas — inclusive administradores e sócios — ele existe apenas como
 * "Ocupado" naquele horário: sem título, descrição, local, links, cliente, projeto, categoria, agenda, anexos,
 * checklist, observações, lembretes, planejamento nem pessoas.
 *
 * Regra de uso: NENHUMA consulta de `src/server/agenda` devolve uma linha do banco para fora; todas passam por
 * `toVisibleEvent`, que monta o objeto mascarado campo a campo (lista de permitidos, não de proibidos — um campo
 * novo na tabela nasce escondido). No espírito de `toPublicProposal`. Testes: `privacy.test.ts` (função) e
 * `agenda.db.test.ts` (nenhuma consulta deixa passar as sentinelas).
 *
 * Arquivo puro: sem banco.
 */
import type { AgendaEvent } from "@/db/schema";
import { AGENDA_BUSY_LABEL, type AgendaCalendarKind, type AgendaColor, type AgendaIcon, type AgendaPersonRole } from "@/lib/domain";

export type EventPerson = { userId: number | null; role: AgendaPersonRole; name: string };

/** O compromisso completo, como sai do banco (com os nomes já juntados). Uso interno de `src/server/agenda`. */
export type EventRecord = AgendaEvent & {
  categoryName: string | null;
  categoryColor: AgendaColor | null;
  categoryIcon: AgendaIcon | null;
  categoryBlocksDay: boolean;
  categoryIsProduction: boolean;
  calendarName: string | null;
  calendarKind: AgendaCalendarKind | null;
  clientName: string | null;
  projectTitle: string | null;
  creatorName: string | null;
  people: EventPerson[];
};

/** O que quem NÃO participa de um compromisso particular pode saber: quando, e que alguém está ocupado. */
export type MaskedEvent = {
  masked: true;
  id: number;
  title: typeof AGENDA_BUSY_LABEL;
  date: string;
  endDate: string | null;
  startTime: string | null;
  endTime: string | null;
  /** A repetição define QUANDO a pessoa está ocupada; não revela o conteúdo. */
  recurrence: AgendaEvent["recurrence"];
  recurrenceExceptions: string[];
  /** Cancelado deixa de ocupar: a tela precisa saber para não desenhar o bloco. */
  cancelled: boolean;
  /** Quem está ocupado (o dono do compromisso). */
  ownerId: number | null;
  ownerName: string | null;
};

export type FullEvent = EventRecord & { masked: false };
export type VisibleEvent = FullEvent | MaskedEvent;

/** Usuários do painel envolvidos num compromisso (criador, responsáveis e participantes). */
export function eventUserIds(event: Pick<EventRecord, "createdBy" | "people">): number[] {
  const ids = event.people.map((person) => person.userId).filter((id): id is number => typeof id === "number");
  if (typeof event.createdBy === "number") ids.push(event.createdBy);
  return [...new Set(ids)];
}

/** Esta pessoa vê o compromisso por inteiro? (também decide quem pode editar, cancelar ou excluir um particular) */
export function canSeeEvent(event: Pick<EventRecord, "visibility" | "createdBy" | "people">, viewerId: number): boolean {
  if (event.visibility !== "particular") return true;
  return eventUserIds(event).includes(viewerId);
}

/** A ÚNICA saída de um compromisso para uma tela, busca, exportação ou aviso de conflito. */
export function toVisibleEvent(event: EventRecord, viewerId: number): VisibleEvent {
  if (canSeeEvent(event, viewerId)) return { ...event, masked: false };
  return {
    masked: true,
    id: event.id,
    title: AGENDA_BUSY_LABEL,
    date: event.date,
    endDate: event.endDate,
    startTime: event.startTime,
    endTime: event.endTime,
    recurrence: event.recurrence,
    recurrenceExceptions: [...(event.recurrenceExceptions ?? [])],
    cancelled: event.status === "cancelado",
    ownerId: event.createdBy,
    ownerName: event.creatorName,
  };
}
