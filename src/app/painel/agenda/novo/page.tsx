import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/page-header";
import { firstParam, paramId, type PageSearchParams } from "@/components/ui/search-params";
import { requirePermission } from "@/lib/auth";
import { minutesToTime, timeToMinutes } from "@/lib/agenda/conflicts";
import { isISODate, isTime, todayISO } from "@/lib/dates";
import { AGENDA_DEFAULT_CATEGORY_SLUG } from "@/lib/domain";
import { getProjectClientId } from "@/server/agenda/queries";
import { createEventAction } from "../actions";
import { EventForm } from "../event-form";
import { loadFormOptions } from "../form-data";
import { AGENDA_PATH } from "../url";

export const metadata: Metadata = { title: "Novo compromisso" };
export const instant = false;

/** Só caminhos da própria agenda (o valor vem da URL). */
const safeReturn = (value: string | undefined) => (value && /^\/painel\/agenda(\?[^\\\s]*)?$/.test(value) ? value : undefined);

export default async function NewEventPage({ searchParams }: { searchParams: PageSearchParams }) {
  const user = await requirePermission("agenda", "editar");
  const params = await searchParams;
  const dateParam = firstParam(params.data);
  const date = dateParam && isISODate(dateParam) ? dateParam : todayISO();
  const startParam = firstParam(params.inicio);
  const endParam = firstParam(params.fim);
  const allDay = firstParam(params.diaInteiro) === "1";
  const startTime = allDay ? null : startParam && isTime(startParam) ? startParam : "09:00";
  const endTime = allDay || !startTime ? null : endParam && isTime(endParam) && endParam > startTime ? endParam : minutesToTime(Math.min(timeToMinutes(startTime) + 60, 23 * 60 + 59));
  const projectId = paramId(params.projeto) ?? null;
  // Vindo de um projeto sem ?cliente=, aproveita o cliente do projeto.
  const clientId = paramId(params.cliente) ?? (projectId ? await getProjectClientId(projectId) : null);
  const options = await loadFormOptions(user.id);
  const returnTo = safeReturn(firstParam(params.voltar));
  const wantedCategory = paramId(params.categoria);
  const wantedCalendar = paramId(params.agenda);

  return (
    <div className="max-w-3xl">
      <PageHeader title="Novo compromisso" back={{ href: returnTo ?? AGENDA_PATH, label: "Agenda" }} />
      <EventForm
        action={createEventAction}
        values={{
          title: (firstParam(params.titulo) ?? "").slice(0, 160),
          categoryId:
            options.categories.find((category) => category.id === wantedCategory)?.id ??
            options.rawCategories.find((category) => category.slug === AGENDA_DEFAULT_CATEGORY_SLUG && category.active)?.id ??
            options.categories[0]?.id ??
            null,
          calendarId:
            options.calendars.find((calendar) => calendar.value === wantedCalendar)?.value ??
            options.rawCalendars.find((calendar) => calendar.kind === "geral" && calendar.active)?.id ??
            options.calendars[0]?.value ??
            null,
          description: "",
          date,
          endDate: null,
          startTime,
          endTime,
          location: "",
          mapUrl: "",
          meetingUrl: "",
          clientId: options.clients.some((option) => option.value === clientId) ? clientId : null,
          projectId: options.projects.some((option) => option.value === projectId) ? projectId : null,
          priority: "normal",
          status: "confirmado",
          particular: false,
          checklist: [],
          notes: "",
          reminders: [],
          recurrence: null,
          responsibleIds: options.people.some((option) => option.value === user.id) ? [user.id] : [],
          participantIds: [],
          externalPeople: [],
          production: null,
        }}
        categories={options.categories}
        calendars={options.calendars}
        clients={options.clients}
        projects={options.projects}
        people={options.people}
        templates={options.templates}
        attachments={[]}
        submitLabel="Criar compromisso"
        cancelHref={returnTo ?? AGENDA_PATH}
        returnTo={returnTo}
      />
    </div>
  );
}
