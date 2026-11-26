/** Opções do formulário de compromisso, carregadas uma vez por página (criar e editar). */
import "server-only";
import type { AgendaCalendar } from "@/db/schema";
import type { AgendaAccess } from "@/server/agenda/access";
import { listCalendars, listCategories, listChecklistTemplates } from "@/server/agenda/queries";
import { getClientOptions, getProjectOptions, getUserOptions } from "@/server/options";
import type { EventFormCategory } from "./event-form";

export const calendarLabel = (calendar: Pick<AgendaCalendar, "name" | "kind">) => (calendar.kind === "pessoal" ? `${calendar.name} (pessoal)` : calendar.name);

/**
 * `userId`: só a agenda pessoal de quem está usando entra na lista (as dos outros, não).
 * `keep`: categoria, agenda e projeto atuais do compromisso, mesmo desativados (ou de outra pessoa), continuam escolhidos.
 * `access`: quem só altera os próprios compromissos não escolhe cliente (a lista vem vazia: o cliente acompanha o
 * projeto) e só vê os projetos em que pode editar.
 */
export async function loadFormOptions(access: AgendaAccess, keep: { categoryId?: number | null; calendarId?: number | null; projectId?: number | null } = {}) {
  const userId = access.userId;
  const full = access.edit === "todos";
  const [categories, calendars, templates, clients, projects, people] = await Promise.all([
    listCategories({ includeInactive: true }),
    listCalendars({ includeInactive: true }),
    listChecklistTemplates(),
    full ? getClientOptions() : Promise.resolve([]),
    getProjectOptions(null, full ? "todos" : [...new Set([...access.editProjectIds, ...(keep.projectId ? [keep.projectId] : [])])]),
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
