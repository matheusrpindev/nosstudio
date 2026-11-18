/**
 * Agenda no PAINEL: consultas e mutações dos compromissos (`agenda_events`) e leitura dos prazos dos projetos.
 * Só fala com o banco; autorização, validação e auditoria ficam nas Server Actions (`src/app/painel/agenda/actions.ts`).
 */
import "server-only";
import { and, asc, between, eq, or, type SQL } from "drizzle-orm";
import { db } from "@/db";
import {
  agendaEvents,
  clients,
  projects,
  users,
  type AgendaEvent,
} from "@/db/schema";
import type { AgendaKind } from "@/lib/domain";
import type { ISODate } from "@/lib/dates";
import {
  projectDeadlineEntries,
  sortAgenda,
  type AgendaEntry,
  type ProjectDeadlineRow,
} from "./logic";

export type AgendaFilters = { ownerId?: number; kind?: AgendaKind };

/** Compromissos e prazos de projeto entre duas datas (inclusive), já ordenados. */
export async function listAgenda(
  from: ISODate,
  to: ISODate,
  filters: AgendaFilters = {},
): Promise<AgendaEntry[]> {
  const eventConditions: (SQL | undefined)[] = [
    between(agendaEvents.date, from, to),
  ];
  if (filters.ownerId)
    eventConditions.push(eq(agendaEvents.ownerId, filters.ownerId));
  if (filters.kind) eventConditions.push(eq(agendaEvents.kind, filters.kind));

  const projectConditions: (SQL | undefined)[] = [
    or(
      between(projects.eventDate, from, to),
      between(projects.shootDeadline, from, to),
      between(projects.deliveryDeadline, from, to),
    ),
  ];
  if (filters.ownerId)
    projectConditions.push(eq(projects.ownerId, filters.ownerId));

  const [eventRows, projectRows] = await Promise.all([
    db
      .select({
        event: agendaEvents,
        clientName: clients.name,
        ownerName: users.name,
      })
      .from(agendaEvents)
      .leftJoin(clients, eq(clients.id, agendaEvents.clientId))
      .leftJoin(users, eq(users.id, agendaEvents.ownerId))
      .where(and(...eventConditions))
      .orderBy(asc(agendaEvents.date), asc(agendaEvents.startTime)),
    db
      .select({
        id: projects.id,
        title: projects.title,
        stage: projects.stage,
        eventDate: projects.eventDate,
        shootDeadline: projects.shootDeadline,
        deliveryDeadline: projects.deliveryDeadline,
        deliveredAt: projects.deliveredAt,
        location: projects.location,
        clientName: clients.name,
        ownerName: users.name,
      })
      .from(projects)
      .leftJoin(clients, eq(clients.id, projects.clientId))
      .leftJoin(users, eq(users.id, projects.ownerId))
      .where(and(...projectConditions)),
  ]);

  const events: AgendaEntry[] = eventRows.map(
    ({ event, clientName, ownerName }) => ({
      key: `e-${event.id}`,
      source: "event",
      id: event.id,
      title: event.title,
      kind: event.kind,
      date: event.date,
      startTime: event.startTime,
      endTime: event.endTime,
      location: event.location,
      clientName,
      ownerName,
      href: `/painel/agenda/${event.id}`,
    }),
  );
  const deadlines = projectDeadlineEntries(
    projectRows satisfies ProjectDeadlineRow[],
    from,
    to,
    filters.kind,
  );
  return sortAgenda([...events, ...deadlines]);
}

export type AgendaEventDetail = AgendaEvent & {
  clientName: string | null;
  projectTitle: string | null;
};

export async function getEvent(id: number): Promise<AgendaEventDetail | null> {
  const [row] = await db
    .select({
      event: agendaEvents,
      clientName: clients.name,
      projectTitle: projects.title,
    })
    .from(agendaEvents)
    .leftJoin(clients, eq(clients.id, agendaEvents.clientId))
    .leftJoin(projects, eq(projects.id, agendaEvents.projectId))
    .where(eq(agendaEvents.id, id));
  return row
    ? {
        ...row.event,
        clientName: row.clientName,
        projectTitle: row.projectTitle,
      }
    : null;
}

export type EventInput = {
  title: string;
  kind: AgendaKind;
  date: ISODate;
  startTime: string | null;
  endTime: string | null;
  location: string;
  clientId: number | null;
  projectId: number | null;
  ownerId: number | null;
  notes: string;
};

/** Confere se cliente, projeto e responsável ainda existem (evita erro de chave estrangeira). */
export async function checkEventRefs(
  input: Pick<EventInput, "clientId" | "projectId" | "ownerId">,
): Promise<string | null> {
  if (input.clientId) {
    const [row] = await db
      .select({ id: clients.id })
      .from(clients)
      .where(eq(clients.id, input.clientId));
    if (!row) return "O cliente selecionado não existe mais.";
  }
  if (input.projectId) {
    const [row] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(eq(projects.id, input.projectId));
    if (!row) return "O projeto selecionado não existe mais.";
  }
  if (input.ownerId) {
    const [row] = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.id, input.ownerId), eq(users.active, true)));
    if (!row) return "O responsável selecionado não está disponível.";
  }
  return null;
}

export async function createEvent(input: EventInput): Promise<AgendaEvent> {
  const [event] = await db.insert(agendaEvents).values(input).returning();
  return event;
}

export async function updateEvent(
  id: number,
  input: EventInput,
): Promise<AgendaEvent | null> {
  const [event] = await db
    .update(agendaEvents)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(agendaEvents.id, id))
    .returning();
  return event ?? null;
}

export async function deleteEvent(id: number): Promise<AgendaEvent | null> {
  const [event] = await db
    .delete(agendaEvents)
    .where(eq(agendaEvents.id, id))
    .returning();
  return event ?? null;
}

/** Cliente de um projeto (para pré-preencher "novo compromisso" vindo de um projeto). */
export async function getProjectClientId(
  projectId: number,
): Promise<number | null> {
  const [row] = await db
    .select({ clientId: projects.clientId })
    .from(projects)
    .where(eq(projects.id, projectId));
  return row?.clientId ?? null;
}
