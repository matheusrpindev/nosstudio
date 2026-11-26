/**
 * Leitura CRUA dos compromissos (linha do banco + nomes). USO INTERNO de `src/server/agenda`: quem lê daqui
 * precisa passar o resultado por `toVisibleEvent` (privacy.ts) antes de devolver qualquer coisa a uma tela.
 * Não importe este arquivo de páginas, actions ou outros módulos — use `queries.ts`.
 */
import "server-only";
import { and, asc, eq, gte, inArray, isNotNull, lte, or, sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import { db, type DbOrTx } from "@/db";
import { agendaCalendars, agendaCategories, agendaEventPeople, agendaEvents, clients, projects, users } from "@/db/schema";
import type { ISODate } from "@/lib/dates";
import type { EventPerson, EventRecord } from "./privacy";

const creator = alias(users, "creator");

/** Compromissos que podem tocar `[from, to]`: os avulsos que cruzam a janela e toda série que já começou. */
export function windowCondition(from: ISODate, to: ISODate): SQL {
  return and(
    lte(agendaEvents.date, to),
    or(isNotNull(agendaEvents.recurrence), gte(sql`coalesce(${agendaEvents.endDate}, ${agendaEvents.date})`, from)),
  ) as SQL;
}

export async function loadEventRecords(where: SQL | undefined, executor: DbOrTx = db): Promise<EventRecord[]> {
  const rows = await executor
    .select({
      event: agendaEvents,
      categoryName: agendaCategories.name,
      categoryColor: agendaCategories.color,
      categoryIcon: agendaCategories.icon,
      categoryBlocksDay: agendaCategories.blocksDay,
      categoryIsProduction: agendaCategories.isProduction,
      calendarName: agendaCalendars.name,
      calendarKind: agendaCalendars.kind,
      clientName: clients.name,
      projectTitle: projects.title,
      creatorName: creator.name,
    })
    .from(agendaEvents)
    .leftJoin(agendaCategories, eq(agendaCategories.id, agendaEvents.categoryId))
    .leftJoin(agendaCalendars, eq(agendaCalendars.id, agendaEvents.calendarId))
    .leftJoin(clients, eq(clients.id, agendaEvents.clientId))
    .leftJoin(projects, eq(projects.id, agendaEvents.projectId))
    .leftJoin(creator, eq(creator.id, agendaEvents.createdBy))
    .where(where)
    .orderBy(asc(agendaEvents.date), asc(agendaEvents.startTime), asc(agendaEvents.id));
  if (rows.length === 0) return [];

  const ids = rows.map((row) => row.event.id);
  const peopleRows = await executor
    .select({
      eventId: agendaEventPeople.eventId,
      userId: agendaEventPeople.userId,
      role: agendaEventPeople.role,
      externalName: agendaEventPeople.externalName,
      userName: users.name,
    })
    .from(agendaEventPeople)
    .leftJoin(users, eq(users.id, agendaEventPeople.userId))
    .where(inArray(agendaEventPeople.eventId, ids))
    .orderBy(asc(agendaEventPeople.sortOrder), asc(agendaEventPeople.id));
  const peopleByEvent = new Map<number, EventPerson[]>();
  for (const row of peopleRows) {
    const list = peopleByEvent.get(row.eventId) ?? [];
    list.push({ userId: row.userId, role: row.role, name: row.userId ? (row.userName ?? "") : row.externalName });
    peopleByEvent.set(row.eventId, list);
  }

  return rows.map(({ event, ...names }) => ({
    ...event,
    ...names,
    categoryBlocksDay: names.categoryBlocksDay ?? false,
    categoryIsProduction: names.categoryIsProduction ?? false,
    people: peopleByEvent.get(event.id) ?? [],
  }));
}

export async function loadEventRecord(id: number, executor: DbOrTx = db): Promise<EventRecord | null> {
  const [record] = await loadEventRecords(eq(agendaEvents.id, id), executor);
  return record ?? null;
}
