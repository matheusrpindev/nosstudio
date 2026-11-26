/** Opções do formulário de compromisso, carregadas uma vez por página (criar e editar). */
import "server-only";
import type { AgendaCalendar } from "@/db/schema";
import { listCalendars, listCategories, listChecklistTemplates } from "@/server/agenda/queries";
import { getClientOptions, getProjectOptions, getUserOptions } from "@/server/options";
import type { EventFormCategory } from "./event-form";

export const calendarLabel = (calendar: Pick<AgendaCalendar, "name" | "kind">) => (calendar.kind === "pessoal" ? `${calendar.name} (pessoal)` : calendar.name);

/**
 * `userId`: só a agenda pessoal de quem está usando entra na lista (as dos outros, não).
 * `keep`: categoria e agenda atuais do compromisso, mesmo desativadas (ou de outra pessoa), continuam escolhidas.
 */
export async function loadFormOptions(userId: number, keep: { categoryId?: number | null; calendarId?: number | null } = {}) {
  const [categories, calendars, templates, clients, projects, people] = await Promise.all([
    listCategories({ includeInactive: true }),
    listCalendars({ includeInactive: true }),
    listChecklistTemplates(),
    getClientOptions(),
    getProjectOptions(),
    getUserOptions(),
  ]);
  return {
    categories: categories
      .filter((category) => category.active || category.id === keep.categoryId)
      .map((category): EventFormCategory => ({ id: category.id, name: category.name, isProduction: category.isProduction, blocksDay: category.blocksDay })),
    calendars: calendars
      .filter((calendar) => (calendar.active && (calendar.kind !== "pessoal" || calendar.userId === userId)) || calendar.id === keep.calendarId)
      .map((calendar) => ({ value: calendar.id, label: calendarLabel(calendar) })),
    rawCategories: categories,
    rawCalendars: calendars,
    templates: templates.map((template) => ({ id: template.id, name: template.name, categoryId: template.categoryId, items: template.items })),
    clients,
    projects,
    people,
  };
}
