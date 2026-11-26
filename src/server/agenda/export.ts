/**
 * EXPORTAÇÃO .ics — os compromissos de um período como eventos iCalendar, já pelo alcance e pela privacidade:
 * fora do alcance de quem exporta, o compromisso não sai; particular de outra pessoa sai só como "Ocupado" no
 * horário (sem título, local, descrição, cliente, categoria nem lembretes) — e some quando há filtro de
 * conteúdo (cliente, projeto, categoria, busca), como na tela: o filtro não pode revelar o que ele é.
 *
 * Uma série sai como UM evento com `RRULE`/`EXDATE` (não uma linha por ocorrência); entra no arquivo quando
 * alguma ocorrência cai no período. As camadas derivadas (prazos, financeiro, editorial) não são exportadas.
 */
import "server-only";
import { db } from "@/db";
import { agendaCalendars, agendaCategories } from "@/db/schema";
import { expandEvent, ruleOf } from "@/lib/agenda/expand";
import type { IcsEvent, IcsStatus } from "@/lib/agenda/ics";
import type { ISODate } from "@/lib/dates";
import { AGENDA_FALLBACK_CATEGORY_SLUG, type AgendaStatus } from "@/lib/domain";
import { env } from "@/lib/env";
import { inViewScope, type AgendaAccess } from "./access";
import { toVisibleEvent } from "./privacy";
import { eventHref, type AgendaFilters } from "./queries";
import { loadEventRecords, windowCondition } from "./records";

const STATUS: Record<AgendaStatus, IcsStatus> = { confirmado: "CONFIRMED", concluido: "CONFIRMED", a_confirmar: "TENTATIVE", cancelado: "CANCELLED" };

const host = () => {
  try {
    return new URL(env.siteUrl).hostname || "nosstudio";
  } catch {
    return "nosstudio";
  }
};

export async function listIcsEvents(access: AgendaAccess, from: ISODate, to: ISODate, filters: Omit<AgendaFilters, "layers" | "q"> = {}): Promise<IcsEvent[]> {
  if (access.view === "nenhum") return [];
  const [records, calendars, categories] = await Promise.all([
    loadEventRecords(windowCondition(from, to)),
    db.select({ id: agendaCalendars.id, userId: agendaCalendars.userId, kind: agendaCalendars.kind }).from(agendaCalendars),
    db.select({ id: agendaCategories.id, slug: agendaCategories.slug }).from(agendaCategories),
  ]);
  const personalCalendar = new Map(calendars.filter((row) => row.kind === "pessoal" && row.userId).map((row) => [row.userId as number, row.id]));
  const generalCalendarId = calendars.find((row) => row.kind === "geral")?.id ?? null;
  const fallbackCategoryId = categories.find((row) => row.slug === AGENDA_FALLBACK_CATEGORY_SLUG)?.id ?? null;
  const calendarIds = filters.calendarIds ? new Set(filters.calendarIds) : null;
  const categoryIds = filters.categoryIds ? new Set(filters.categoryIds) : null;
  const contentFilter = Boolean(categoryIds || filters.clientId || filters.projectId);
  const domain = host();

  const events: IcsEvent[] = [];
  for (const record of records) {
    if (!inViewScope(access, record)) continue;
    // a série só entra se alguma ocorrência cai no período pedido
    if (expandEvent(record, from, to).length === 0) continue;
    const event = toVisibleEvent(record, access.userId);
    const shape = { uid: `agenda-${record.id}@${domain}`, date: event.date, endDate: event.endDate && event.endDate > event.date ? event.endDate : event.date, startTime: event.startTime, endTime: event.endTime, recurrence: ruleOf(event), exceptions: event.recurrenceExceptions ?? [] };
    if (event.masked) {
      if (event.cancelled || contentFilter || access.view !== "todos") continue;
      if (filters.personId && event.ownerId !== filters.personId) continue;
      if (calendarIds) {
        const calendarId = event.ownerId ? personalCalendar.get(event.ownerId) : undefined;
        if (!calendarId || !calendarIds.has(calendarId)) continue;
      }
      events.push({ ...shape, title: event.title, status: "CONFIRMED", private: true });
      continue;
    }
    if (calendarIds && !calendarIds.has(event.calendarId ?? generalCalendarId ?? -1)) continue;
    if (categoryIds && !categoryIds.has(event.categoryId ?? fallbackCategoryId ?? -1)) continue;
    if (filters.clientId && event.clientId !== filters.clientId) continue;
    if (filters.projectId && event.projectId !== filters.projectId) continue;
    if (filters.personId && !event.people.some((person) => person.userId === filters.personId)) continue;
    const people = event.people.map((person) => person.name).filter(Boolean);
    const description = [event.description, event.clientName ? `Cliente: ${event.clientName}` : "", event.projectTitle ? `Projeto: ${event.projectTitle}` : "", people.length ? `Pessoas: ${people.join(", ")}` : "", event.meetingUrl ? `Reunião: ${event.meetingUrl}` : ""]
      .filter(Boolean)
      .join("\n");
    events.push({
      ...shape,
      title: event.title,
      description,
      location: event.location,
      status: STATUS[event.status],
      private: event.visibility === "particular",
      url: `${env.siteUrl}${eventHref(event.id, null)}`,
      categories: event.categoryName ?? undefined,
      updatedAt: event.updatedAt,
      alarms: [...new Set((event.reminders ?? []).map((reminder) => reminder.minutes))],
    });
  }
  return events;
}
