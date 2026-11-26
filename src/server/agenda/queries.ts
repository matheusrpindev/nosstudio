/**
 * Agenda no PAINEL — LEITURA. Tudo o que sai daqui já passou por `toVisibleEvent` (privacy.ts): um compromisso
 * particular de outra pessoa chega às telas só como "Ocupado" no horário.
 *
 * As consultas por janela EXPANDEM as séries (regra de repetição + exceções) em ocorrências.
 */
import "server-only";
import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { agendaCalendars, agendaCategories, agendaChecklistTemplates, projects, type AgendaCalendar, type AgendaCategory, type AgendaChecklistTemplate } from "@/db/schema";
import { expandEvent, isOccurrence, nextOccurrence, ruleOf } from "@/lib/agenda/expand";
import { compareItems, type AgendaItem } from "@/lib/agenda/view";
import { addDays, diffDays, type ISODate } from "@/lib/dates";
import { AGENDA_DERIVED_CALENDAR_KINDS, AGENDA_FALLBACK_CATEGORY_SLUG, USER_ROLES, type AgendaLayer, type UserRole } from "@/lib/domain";
import { hasEnvironment } from "@/lib/permissions";
import { agendaAccess, canMutateEvent, inViewScope, type AgendaAccess, type AgendaViewer } from "./access";
import { listLayerItems } from "./layers";
import { toVisibleEvent, type EventRecord, type FullEvent, type MaskedEvent, type VisibleEvent } from "./privacy";
import { loadEventRecord, loadEventRecords, windowCondition } from "./records";

export type { AgendaViewer } from "./access";

export type AgendaFilters = {
  /** Agendas mostradas. `null`/ausente = todas. */
  calendarIds?: readonly number[] | null;
  /** Categorias mostradas. `null`/ausente = todas. */
  categoryIds?: readonly number[] | null;
  clientId?: number | null;
  projectId?: number | null;
  /** Responsável ou participante. */
  personId?: number | null;
  /** Busca por texto (título, descrição, local, cliente, projeto, pessoas). */
  q?: string | null;
  /** Camadas derivadas ligadas. */
  layers?: readonly AgendaLayer[];
};

const normalize = (text: string) =>
  text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

/** Roles que usam o painel: têm agenda pessoal e podem ser responsáveis. */
export const AGENDA_PANEL_ROLES: readonly UserRole[] = USER_ROLES.filter((role) => hasEnvironment(role, "painel"));

// ------------------------------------------------------------ categorias e agendas
export async function listCategories(options: { includeInactive?: boolean } = {}): Promise<AgendaCategory[]> {
  return db
    .select()
    .from(agendaCategories)
    .where(options.includeInactive ? undefined : eq(agendaCategories.active, true))
    .orderBy(asc(agendaCategories.sortOrder), asc(agendaCategories.id));
}

export async function listCalendars(options: { includeInactive?: boolean; includeDerived?: boolean } = {}): Promise<AgendaCalendar[]> {
  const rows = await db
    .select()
    .from(agendaCalendars)
    .where(options.includeInactive ? undefined : eq(agendaCalendars.active, true))
    .orderBy(asc(agendaCalendars.sortOrder), asc(agendaCalendars.id));
  return options.includeDerived ? rows : rows.filter((row) => !AGENDA_DERIVED_CALENDAR_KINDS.includes(row.kind));
}

export async function listChecklistTemplates(options: { includeInactive?: boolean } = {}): Promise<AgendaChecklistTemplate[]> {
  return db
    .select()
    .from(agendaChecklistTemplates)
    .where(options.includeInactive ? undefined : eq(agendaChecklistTemplates.active, true))
    .orderBy(asc(agendaChecklistTemplates.sortOrder), asc(agendaChecklistTemplates.id));
}

// ------------------------------------------------------------------- janela
function matchesText(event: EventRecord, needle: string): boolean {
  const haystack = normalize(
    [event.title, event.description, event.location, event.clientName, event.projectTitle, event.categoryName, ...event.people.map((person) => person.name)]
      .filter(Boolean)
      .join(" \n "),
  );
  return needle.split(/\s+/).every((word) => haystack.includes(word));
}

function fullItems(event: FullEvent, from: ISODate, to: ISODate, editable: boolean): AgendaItem[] {
  const seriesStart = ruleOf(event) ? event.date : null;
  return expandEvent(event, from, to).map((occurrence) => ({
    key: occurrence.recurring ? `e-${event.id}@${occurrence.date}` : `e-${event.id}`,
    source: "event",
    id: event.id,
    title: event.title,
    date: occurrence.date,
    endDate: occurrence.endDate,
    startTime: event.startTime,
    endTime: event.endTime,
    color: event.categoryColor ?? "cinza",
    icon: event.categoryIcon,
    href: eventHref(event.id, occurrence.recurring ? occurrence.date : null),
    masked: false,
    status: event.status,
    priority: event.priority,
    recurring: occurrence.recurring || event.seriesId !== null,
    label: event.categoryName ?? "Sem categoria",
    categoryId: event.categoryId,
    calendarId: event.calendarId,
    location: event.location,
    clientName: event.clientName,
    people: event.people.map((person) => person.name).filter(Boolean),
    ownerName: null,
    editable,
    seriesStart,
    projectId: event.projectId,
  }));
}

function maskedItems(event: MaskedEvent, from: ISODate, to: ISODate): AgendaItem[] {
  return expandEvent(event, from, to).map((occurrence) => ({
    key: occurrence.recurring ? `e-${event.id}@${occurrence.date}` : `e-${event.id}`,
    source: "event",
    id: event.id,
    title: event.title,
    date: occurrence.date,
    endDate: occurrence.endDate,
    startTime: event.startTime,
    endTime: event.endTime,
    color: "cinza",
    icon: null,
    href: eventHref(event.id, occurrence.recurring ? occurrence.date : null),
    masked: true,
    status: null,
    priority: null,
    recurring: false,
    label: "",
    categoryId: null,
    calendarId: null,
    location: "",
    clientName: null,
    people: [],
    ownerName: event.ownerName,
    editable: false,
    seriesStart: null,
    projectId: null,
  }));
}

export function eventHref(id: number, occurrence: ISODate | null): string {
  return `/painel/agenda/${id}${occurrence ? `?dia=${occurrence}` : ""}`;
}

/**
 * Compromissos (expandidos) e camadas entre duas datas, já ordenados.
 *
 * Um compromisso MASCARADO não pode servir de oráculo: se ele aparecesse ou sumisse conforme o filtro de
 * cliente, projeto, categoria ou texto, o filtro revelaria o conteúdo. Por isso, com qualquer desses filtros
 * ligado, os mascarados ficam de fora; e, para o filtro de agendas, ele conta como sendo da agenda PESSOAL do
 * dono (onde quer que esteja gravado). No filtro por pessoa, só aparece quando a pessoa é o próprio dono.
 *
 * ALCANCE (`access.ts`): quem só vê a agenda "nos projetos em que está" recebe apenas os compromissos em que
 * participa e os desses projetos — e nenhum mascarado. Sem alcance, a lista vem vazia. O alcance é calculado
 * aqui, a partir de `viewer`: quem chama não tem como pular o filtro.
 */
export async function listAgenda(viewer: AgendaViewer, from: ISODate, to: ISODate, filters: AgendaFilters = {}): Promise<AgendaItem[]> {
  const access = await agendaAccess(viewer);
  if (access.view === "nenhum") return [];
  const needle = filters.q ? normalize(filters.q.trim()) : "";
  const [records, calendars, categories, layerItems] = await Promise.all([
    loadEventRecords(windowCondition(from, to)),
    db.select({ id: agendaCalendars.id, userId: agendaCalendars.userId, kind: agendaCalendars.kind }).from(agendaCalendars),
    db.select({ id: agendaCategories.id, slug: agendaCategories.slug }).from(agendaCategories),
    listLayerItems(viewer, from, to, filters.layers ?? [], filters),
  ]);
  const personalCalendar = new Map(calendars.filter((row) => row.kind === "pessoal" && row.userId).map((row) => [row.userId as number, row.id]));
  const fallbackCategoryId = categories.find((row) => row.slug === AGENDA_FALLBACK_CATEGORY_SLUG)?.id ?? null;
  // compromisso sem agenda (a agenda dele foi apagada com a conta do dono) conta como da agenda geral
  const generalCalendarId = calendars.find((row) => row.kind === "geral")?.id ?? null;
  const calendarIds = filters.calendarIds ? new Set(filters.calendarIds) : null;
  const categoryIds = filters.categoryIds ? new Set(filters.categoryIds) : null;
  const contentFilter = Boolean(categoryIds || filters.clientId || filters.projectId || needle);

  const items: AgendaItem[] = [];
  for (const record of records) {
    if (!inViewScope(access, record)) continue;
    const event = toVisibleEvent(record, viewer.id);
    if (event.masked) {
      if (event.cancelled || contentFilter || access.view !== "todos") continue;
      if (filters.personId && event.ownerId !== filters.personId) continue;
      if (calendarIds) {
        const calendarId = event.ownerId ? personalCalendar.get(event.ownerId) : undefined;
        if (!calendarId || !calendarIds.has(calendarId)) continue;
      }
      items.push(...maskedItems(event, from, to));
      continue;
    }
    if (calendarIds && !calendarIds.has(event.calendarId ?? generalCalendarId ?? -1)) continue;
    if (categoryIds && !categoryIds.has(event.categoryId ?? fallbackCategoryId ?? -1)) continue;
    if (filters.clientId && event.clientId !== filters.clientId) continue;
    if (filters.projectId && event.projectId !== filters.projectId) continue;
    if (filters.personId && !event.people.some((person) => person.userId === filters.personId)) continue;
    if (needle && !matchesText(event, needle)) continue;
    items.push(...fullItems(event, from, to, canMutateEvent(access, record)));
  }

  const layers = needle ? layerItems.filter((item) => needle.split(/\s+/).every((word) => normalize(`${item.title} ${item.clientName ?? ""} ${item.label}`).includes(word))) : layerItems;
  return [...items, ...layers].sort(compareItems);
}

// ------------------------------------------------------------------- detalhe
export type EventView = {
  event: VisibleEvent;
  /** O dia desta ocorrência (em séries, o dia pedido; senão, a data do compromisso). */
  occurrence: ISODate;
  occurrenceEnd: ISODate;
  /** É uma série (tem regra de repetição)? */
  recurring: boolean;
  /** Quem está vendo pode alterar este compromisso? */
  canEdit: boolean;
  /** Quem está vendo tem a agenda no módulo inteiro (vê cliente, observações internas e anexos de qualquer compromisso). */
  fullAccess: boolean;
};

/** O compromisso como esta pessoa o enxerga: `null` fora do alcance dela (ou mascarado, para quem é restrito). */
function visibleRecord(access: AgendaAccess, record: EventRecord | null): VisibleEvent | null {
  if (!record || !inViewScope(access, record)) return null;
  const event = toVisibleEvent(record, access.userId);
  return event.masked && access.view !== "todos" ? null : event;
}

/**
 * Um compromisso para a tela de detalhe. `occurrence` escolhe o dia de uma série; se o dia pedido não for um dia
 * da série, vale a próxima ocorrência a partir de `today`. Compromisso particular de outra pessoa volta mascarado.
 * Fora do alcance de quem vê (`access.ts`), é como se não existisse: `null`.
 */
export async function getEventView(viewer: AgendaViewer, id: number, occurrence: ISODate | null, today: ISODate): Promise<EventView | null> {
  const [access, record] = await Promise.all([agendaAccess(viewer), loadEventRecord(id)]);
  const event = visibleRecord(access, record);
  if (!event || !record) return null;
  const recurring = ruleOf(event) !== null;
  let day = event.date;
  if (recurring) {
    const shape = { date: event.date, endDate: event.endDate, recurrence: event.recurrence, recurrenceExceptions: event.recurrenceExceptions };
    day = occurrence && isOccurrence(shape, occurrence) ? occurrence : (nextOccurrence(shape, today) ?? event.date);
  }
  const span = event.endDate && event.endDate > event.date ? diffDays(event.date, event.endDate) : 0;
  return { event, occurrence: day, occurrenceEnd: addDays(day, span), recurring, canEdit: canMutateEvent(access, record), fullAccess: access.view === "todos" };
}

/**
 * O compromisso completo para EDITAR — `null` se não existe, se a pessoa não participa de um particular ou se
 * não é dela para alterar (alcance restrito: só os próprios).
 */
export async function getEditableEvent(viewer: AgendaViewer, id: number): Promise<FullEvent | null> {
  const [access, record] = await Promise.all([agendaAccess(viewer), loadEventRecord(id)]);
  if (!record || !canMutateEvent(access, record)) return null;
  const event = toVisibleEvent(record, viewer.id);
  return event.masked ? null : event;
}

/** Cliente de um projeto (para pré-preencher "novo compromisso" vindo de um projeto). */
export async function getProjectClientId(projectId: number): Promise<number | null> {
  const [row] = await db.select({ clientId: projects.clientId }).from(projects).where(eq(projects.id, projectId));
  return row?.clientId ?? null;
}

/** Ids válidos entre os pedidos na URL (a URL é entrada do usuário). */
export async function existingCalendarIds(ids: readonly number[]): Promise<number[]> {
  if (ids.length === 0) return [];
  const rows = await db.select({ id: agendaCalendars.id }).from(agendaCalendars).where(and(inArray(agendaCalendars.id, [...ids]), eq(agendaCalendars.active, true)));
  return rows.map((row) => row.id);
}
