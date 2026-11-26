/**
 * DISPONIBILIDADE DA EQUIPE — o que cada pessoa tem marcado num período e as janelas livres em comum.
 *
 * Só para quem tem a agenda no módulo inteiro: a consulta mostra a ocupação de outras pessoas. O conteúdo passa
 * pela privacidade (`toVisibleEvent`): particular de outra pessoa aparece como "Ocupado". Cancelados não ocupam.
 * Compromisso de dia inteiro só ocupa a pessoa quando a categoria bloqueia o dia (férias, indisponibilidade);
 * os outros aparecem como lembrete do dia, sem tirar disponibilidade.
 */
import "server-only";
import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { agendaCalendars, agendaCategories, users } from "@/db/schema";
import { commonFreeWindows, type Workday } from "@/lib/agenda/availability";
import { busySlots } from "@/lib/agenda/busy";
import type { BusySlot, FreeWindow } from "@/lib/agenda/conflicts";
import { expandEvent } from "@/lib/agenda/expand";
import type { ISODate } from "@/lib/dates";
import { AGENDA_WORKDAY, type AgendaColor } from "@/lib/domain";
import { agendaAccess, type AgendaViewer } from "./access";
import { busyPeople } from "./conflicts";
import { createEvent } from "./mutations";
import { toVisibleEvent } from "./privacy";
import { AGENDA_PANEL_ROLES, eventHref } from "./queries";
import { loadEventRecords, windowCondition } from "./records";

export type AvailabilityBlock = {
  key: string;
  title: string;
  startTime: string | null;
  endTime: string | null;
  /** Ocupa o dia inteiro (bloqueio, ou dia do meio de um compromisso de vários dias). */
  wholeDay: boolean;
  masked: boolean;
  tentative: boolean;
  color: AgendaColor;
  href: string;
};

export type AvailabilityDay = {
  date: ISODate;
  /** Por pessoa (id): o que a ocupa e os lembretes de dia inteiro que não ocupam. */
  people: Record<number, { busy: AvailabilityBlock[]; notes: AvailabilityBlock[] }>;
  /** Janelas em que todas as pessoas selecionadas estão livres, dentro do expediente. */
  free: FreeWindow[];
};

export type Availability = { people: { id: number; name: string }[]; days: AvailabilityDay[]; workday: Workday };

/** Pessoas que podem entrar na consulta: contas ativas do painel. */
export async function listAvailabilityPeople(): Promise<{ id: number; name: string }[]> {
  return db
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(and(eq(users.active, true), inArray(users.role, [...AGENDA_PANEL_ROLES])))
    .orderBy(asc(users.name));
}

/** `null` para quem não tem a agenda no módulo inteiro. `days` precisa ser um intervalo contínuo e ordenado. */
export async function getAvailability(viewer: AgendaViewer, days: readonly ISODate[], personIds: readonly number[]): Promise<Availability | null> {
  const access = await agendaAccess(viewer);
  if (access.view !== "todos" || days.length === 0) return null;
  const everyone = await listAvailabilityPeople();
  const people = everyone.filter((person) => personIds.includes(person.id));
  const selected = people.map((person) => person.id);
  const from = days[0];
  const to = days[days.length - 1];
  const workday: Workday = AGENDA_WORKDAY;

  const byDay = new Map<ISODate, AvailabilityDay>(
    days.map((date) => [date, { date, people: Object.fromEntries(selected.map((id) => [id, { busy: [], notes: [] }])), free: [] }]),
  );
  const slotsByDay = new Map<ISODate, BusySlot[]>(days.map((date) => [date, []]));

  const records = selected.length ? (await loadEventRecords(windowCondition(from, to))).filter((record) => record.status !== "cancelado") : [];
  for (const record of records) {
    const busy = busyPeople(record).filter((id) => selected.includes(id));
    if (busy.length === 0) continue;
    const visible = toVisibleEvent(record, viewer.id);
    // particular de outra pessoa: não se sabe a categoria — o dia inteiro conta como ocupado
    const blocksDay = visible.masked ? true : record.categoryBlocksDay;
    const color: AgendaColor = visible.masked ? "cinza" : (record.categoryColor ?? "cinza");
    for (const occurrence of expandEvent(record, from, to)) {
      const key = `e-${record.id}@${occurrence.date}`;
      const href = eventHref(record.id, occurrence.recurring ? occurrence.date : null);
      for (const slot of busySlots({ key, title: visible.title, date: occurrence.date, endDate: occurrence.endDate, startTime: record.startTime, endTime: record.endTime, people: busy, blocksDay })) {
        const day = byDay.get(slot.date);
        if (!day) continue;
        const occupies = slot.startTime !== null || slot.blocksDay === true;
        const block: AvailabilityBlock = {
          key: `${key}|${slot.date}`,
          title: visible.title,
          startTime: slot.startTime,
          endTime: slot.endTime,
          wholeDay: slot.startTime === null && occupies,
          masked: visible.masked,
          tentative: record.status === "a_confirmar",
          color,
          href,
        };
        for (const id of busy) (occupies ? day.people[id].busy : day.people[id].notes).push(block);
        if (occupies) slotsByDay.get(slot.date)?.push(slot);
      }
    }
  }

  for (const day of byDay.values()) {
    for (const entry of Object.values(day.people)) entry.busy.sort((a, b) => (a.startTime ?? "").localeCompare(b.startTime ?? ""));
    day.free = commonFreeWindows(slotsByDay.get(day.date) ?? [], selected, workday);
  }
  return { people, days: [...byDay.values()], workday };
}

// ---------------------------------------------------------------- bloqueios
export type BlockInput = { personId: number; date: ISODate; endDate: ISODate; title: string; createdBy: number };

/**
 * Cria o bloqueio: compromisso de dia inteiro numa categoria que bloqueia o dia ("Férias e indisponibilidade" de
 * preferência), na agenda pessoal da pessoa (ou na geral), com ela como responsável.
 */
export async function createBlock(input: BlockInput): Promise<{ id: number } | { error: string }> {
  const [person] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.id, input.personId), eq(users.active, true), inArray(users.role, [...AGENDA_PANEL_ROLES])));
  if (!person) return { error: "A pessoa selecionada não está mais disponível." };
  const categories = await db.select().from(agendaCategories).where(and(eq(agendaCategories.active, true), eq(agendaCategories.blocksDay, true))).orderBy(asc(agendaCategories.sortOrder));
  const category = categories.find((row) => row.slug === "ferias") ?? categories[0];
  if (!category) return { error: "Nenhuma categoria ativa bloqueia o dia. Em Agenda › Configurar, ative “Férias e indisponibilidade” (ou marque “bloqueia o dia” em outra categoria)." };
  const calendars = await db.select().from(agendaCalendars).where(eq(agendaCalendars.active, true)).orderBy(asc(agendaCalendars.sortOrder));
  const calendar = calendars.find((row) => row.kind === "pessoal" && row.userId === input.personId) ?? calendars.find((row) => row.kind === "geral") ?? calendars.find((row) => row.kind !== "financeira" && row.kind !== "editorial" && row.kind !== "pessoal");
  if (!calendar) return { error: "Não há uma agenda ativa para receber o bloqueio." };

  const event = await createEvent(
    {
      title: input.title.trim() || "Indisponível",
      categoryId: category.id,
      calendarId: calendar.id,
      description: "",
      date: input.date,
      endDate: input.endDate > input.date ? input.endDate : null,
      startTime: null,
      endTime: null,
      location: "",
      mapUrl: "",
      meetingUrl: "",
      clientId: null,
      projectId: null,
      priority: "normal",
      status: "confirmado",
      visibility: "normal",
      checklist: [],
      notes: "",
      reminders: [],
      recurrence: null,
      attachments: [],
      production: null,
      responsibleIds: [input.personId],
      participantIds: [],
      externalPeople: [],
    },
    input.createdBy,
  );
  return { id: event.id };
}
