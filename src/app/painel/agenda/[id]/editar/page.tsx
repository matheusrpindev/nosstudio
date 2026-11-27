import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { firstParam, type PageSearchParams } from "@/components/ui/search-params";
import { ruleOf } from "@/lib/agenda/expand";
import { describeRecurrence } from "@/lib/agenda/recurrence";
import { diffDays, isISODate, todayISO } from "@/lib/dates";
import { requireScopedPermission } from "@/server/access/guards";
import { agendaAccess } from "@/server/agenda/access";
import { getEditableEvent, getEventView } from "@/server/agenda/queries";
import { getMediaValues } from "@/server/media";
import { updateEventAction } from "../../actions";
import { EventForm } from "../../event-form";
import { loadFormOptions } from "../../form-data";

export const metadata: Metadata = { title: "Editar compromisso" };
export const instant = false;

export default async function EditEventPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: PageSearchParams }) {
  const { user } = await requireScopedPermission("agenda", "editar");
  const access = await agendaAccess(user);
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const dayParam = firstParam((await searchParams).dia);
  const today = todayISO();
  // particular de outra pessoa (ou compromisso que não é dela para alterar): não há tela de edição — 404
  const [event, view] = await Promise.all([getEditableEvent(user, id), getEventView(user, id, dayParam && isISODate(dayParam) ? dayParam : null, today)]);
  if (!event || !view) notFound();

  const rule = ruleOf(event);
  const occurrence = view.occurrence;
  const span = event.endDate && event.endDate > event.date ? diffDays(event.date, event.endDate) : 0;
  const [options, attachments] = await Promise.all([loadFormOptions(access, { categoryId: event.categoryId, calendarId: event.calendarId, projectId: event.projectId }), getMediaValues(event.attachments ?? [])]);
  const detail = `/painel/agenda/${event.id}${rule ? `?dia=${occurrence}` : ""}`;
  const ids = (role: "responsavel" | "participante") => event.people.filter((person) => person.role === role && person.userId).map((person) => person.userId as number);

  return (
    <div className="max-w-3xl">
      <PageHeader title="Editar compromisso" description={event.title} back={{ href: detail, label: "Compromisso" }} />
      <EventForm
        action={updateEventAction}
        id={event.id}
        values={{
          title: event.title,
          categoryId: event.categoryId,
          calendarId: event.calendarId,
          description: event.description,
          date: occurrence,
          endDate: span > 0 ? view.occurrenceEnd : null,
          startTime: event.startTime,
          endTime: event.endTime,
          location: event.location,
          mapUrl: event.mapUrl,
          meetingUrl: event.meetingUrl,
          clientId: event.clientId,
          projectId: event.projectId,
          priority: event.priority,
          status: event.status,
          particular: event.visibility === "particular",
          checklist: event.checklist ?? [],
          notes: event.notes,
          reminders: event.reminders ?? [],
          recurrence: rule,
          responsibleIds: ids("responsavel"),
          participantIds: ids("participante"),
          externalPeople: event.people.filter((person) => person.role === "externo").map((person) => person.name),
          production: event.production ?? null,
        }}
        categories={options.categories}
        calendars={options.calendars}
        clients={options.clients}
        projects={options.projects}
        people={options.people}
        templates={options.templates}
        attachments={attachments}
        series={rule ? { occurrence, summary: describeRecurrence(event.date, rule), first: occurrence === event.date } : null}
        detached={event.seriesId !== null}
        submitLabel="Salvar alterações"
        cancelHref={detail}
      />
    </div>
  );
}
