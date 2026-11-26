/**
 * Configurações da agenda: categorias, agendas (calendários) e modelos de checklist.
 * Nada é apagado (compromissos antigos continuam apontando para a categoria/agenda): desativar tira das listas
 * de escolha. Só modelos de checklist podem ser excluídos.
 */
import "server-only";
import { and, asc, eq, inArray, isNull, max } from "drizzle-orm";
import { db } from "@/db";
import { agendaCalendars, agendaCategories, agendaChecklistTemplates, users } from "@/db/schema";
import {
  AGENDA_DEFAULT_CALENDARS,
  AGENDA_DEFAULT_CATEGORIES,
  AGENDA_FALLBACK_CATEGORY_SLUG,
  AGENDA_PERSONAL_COLORS,
  type AgendaCalendarKind,
  type AgendaColor,
  type AgendaIcon,
} from "@/lib/domain";
import { AGENDA_PANEL_ROLES } from "./queries";

type OrderedTable = typeof agendaCategories | typeof agendaCalendars | typeof agendaChecklistTemplates;

async function nextSortOrder(table: OrderedTable): Promise<number> {
  const [row] = await db.select({ value: max(table.sortOrder) }).from(table);
  return (row?.value ?? 0) + 10;
}

/** Troca de lugar com o vizinho de cima/baixo (a ordem é a de `sortOrder`, desempate por id). */
async function move(table: OrderedTable, id: number, direction: "up" | "down"): Promise<boolean> {
  const rows = await db.select({ id: table.id, sortOrder: table.sortOrder }).from(table).orderBy(asc(table.sortOrder), asc(table.id));
  const index = rows.findIndex((row) => row.id === id);
  const target = direction === "up" ? index - 1 : index + 1;
  if (index < 0 || target < 0 || target >= rows.length) return false;
  const reordered = [...rows];
  [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
  await db.transaction(async (tx) => {
    for (const [position, row] of reordered.entries()) {
      const sortOrder = (position + 1) * 10;
      if (row.sortOrder !== sortOrder) await tx.update(table).set({ sortOrder }).where(eq(table.id, row.id));
    }
  });
  return true;
}

// ---------------------------------------------------------------- categorias
export type CategoryInput = { name: string; color: AgendaColor; icon: AgendaIcon; blocksDay: boolean; isProduction: boolean };

export async function saveCategory(id: number | null, input: CategoryInput): Promise<number | null> {
  if (id) {
    const [row] = await db.update(agendaCategories).set({ ...input, updatedAt: new Date() }).where(eq(agendaCategories.id, id)).returning({ id: agendaCategories.id });
    return row?.id ?? null;
  }
  const [row] = await db
    .insert(agendaCategories)
    .values({ ...input, sortOrder: await nextSortOrder(agendaCategories) })
    .returning({ id: agendaCategories.id });
  return row.id;
}

/** Desativar a categoria "Outros" não é permitido: é para ela que vai o que fica sem categoria. */
export async function setCategoryActive(id: number, active: boolean): Promise<"ok" | "inexistente" | "protegida"> {
  const [row] = await db.select({ slug: agendaCategories.slug }).from(agendaCategories).where(eq(agendaCategories.id, id));
  if (!row) return "inexistente";
  if (!active && row.slug === AGENDA_FALLBACK_CATEGORY_SLUG) return "protegida";
  await db.update(agendaCategories).set({ active, updatedAt: new Date() }).where(eq(agendaCategories.id, id));
  return "ok";
}

export const moveCategory = (id: number, direction: "up" | "down") => move(agendaCategories, id, direction);

// -------------------------------------------------------------------- agendas
/** Tipos que o cliente pode escolher ao criar uma agenda (pessoais nascem com a conta; derivadas são fixas). */
export const CREATABLE_CALENDAR_KINDS: readonly AgendaCalendarKind[] = ["geral", "producoes", "comercial", "colaboradores"];
export type CalendarInput = { name: string; color: AgendaColor; kind?: AgendaCalendarKind };

export async function saveCalendar(id: number | null, input: CalendarInput): Promise<number | null> {
  if (id) {
    // o tipo de uma agenda existente não muda (pessoal continua pessoal; financeira continua derivada)
    const [row] = await db
      .update(agendaCalendars)
      .set({ name: input.name, color: input.color, updatedAt: new Date() })
      .where(eq(agendaCalendars.id, id))
      .returning({ id: agendaCalendars.id });
    return row?.id ?? null;
  }
  const kind = input.kind && CREATABLE_CALENDAR_KINDS.includes(input.kind) ? input.kind : "geral";
  const [row] = await db
    .insert(agendaCalendars)
    .values({ name: input.name, color: input.color, kind, sortOrder: await nextSortOrder(agendaCalendars) })
    .returning({ id: agendaCalendars.id });
  return row.id;
}

/** A agenda geral não pode ser desativada. */
export async function setCalendarActive(id: number, active: boolean): Promise<"ok" | "inexistente" | "protegida"> {
  const [row] = await db.select({ slug: agendaCalendars.slug }).from(agendaCalendars).where(eq(agendaCalendars.id, id));
  if (!row) return "inexistente";
  if (!active && row.slug === "geral") return "protegida";
  await db.update(agendaCalendars).set({ active, updatedAt: new Date() }).where(eq(agendaCalendars.id, id));
  return "ok";
}

export const moveCalendar = (id: number, direction: "up" | "down") => move(agendaCalendars, id, direction);

/** Usuários ativos do painel que ainda não têm agenda pessoal. */
export async function usersWithoutCalendar(): Promise<{ id: number; name: string }[]> {
  const rows = await db
    .select({ id: users.id, name: users.name, calendarUser: agendaCalendars.userId })
    .from(users)
    .leftJoin(agendaCalendars, and(eq(agendaCalendars.userId, users.id), eq(agendaCalendars.kind, "pessoal")))
    .where(and(eq(users.active, true), inArray(users.role, [...AGENDA_PANEL_ROLES]), isNull(agendaCalendars.id)))
    .orderBy(asc(users.id));
  return rows.map((row) => ({ id: row.id, name: row.name }));
}

/** Cria a agenda pessoal de quem ainda não tem (idempotente). Devolve quantas criou. */
export async function ensurePersonalCalendars(): Promise<number> {
  const missing = await usersWithoutCalendar();
  if (missing.length === 0) return 0;
  const [existing] = await db.select({ value: max(agendaCalendars.sortOrder) }).from(agendaCalendars).where(eq(agendaCalendars.kind, "pessoal"));
  let sortOrder = existing?.value ?? 20;
  let created = 0;
  for (const user of missing) {
    sortOrder += 1;
    const rows = await db
      .insert(agendaCalendars)
      .values({ name: user.name, kind: "pessoal", userId: user.id, color: AGENDA_PERSONAL_COLORS[(user.id - 1) % AGENDA_PERSONAL_COLORS.length], sortOrder })
      .onConflictDoNothing()
      .returning({ id: agendaCalendars.id });
    created += rows.length;
  }
  return created;
}

/**
 * Garante as categorias e agendas iniciais (por `slug`) — usado pelo seed. A migration 0002 já as insere; isto
 * só repõe o que faltar num banco em que alguém as tenha apagado à mão. Idempotente.
 */
export async function ensureAgendaDefaults(): Promise<number> {
  let created = 0;
  const categorySlugs = AGENDA_DEFAULT_CATEGORIES.map((category) => category.slug);
  const presentCategories = new Set((await db.select({ slug: agendaCategories.slug }).from(agendaCategories).where(inArray(agendaCategories.slug, categorySlugs))).map((row) => row.slug));
  for (const [index, category] of AGENDA_DEFAULT_CATEGORIES.entries()) {
    if (presentCategories.has(category.slug)) continue;
    await db.insert(agendaCategories).values({
      slug: category.slug,
      name: category.name,
      color: category.color,
      icon: category.icon,
      blocksDay: category.blocksDay ?? false,
      isProduction: category.isProduction ?? false,
      sortOrder: (index + 1) * 10,
    });
    created += 1;
  }
  const calendarSlugs = AGENDA_DEFAULT_CALENDARS.map((calendar) => calendar.slug);
  const presentCalendars = new Set((await db.select({ slug: agendaCalendars.slug }).from(agendaCalendars).where(inArray(agendaCalendars.slug, calendarSlugs))).map((row) => row.slug));
  for (const [index, calendar] of AGENDA_DEFAULT_CALENDARS.entries()) {
    if (presentCalendars.has(calendar.slug)) continue;
    await db.insert(agendaCalendars).values({ slug: calendar.slug, name: calendar.name, kind: calendar.kind, color: calendar.color, sortOrder: index === 0 ? 10 : 90 + index * 10 });
    created += 1;
  }
  return created + (await ensurePersonalCalendars());
}

// --------------------------------------------------------- modelos de checklist
export type TemplateInput = { name: string; categoryId: number | null; items: string[] };

export async function saveChecklistTemplate(id: number | null, input: TemplateInput): Promise<number | null> {
  if (input.categoryId) {
    const [category] = await db.select({ id: agendaCategories.id }).from(agendaCategories).where(eq(agendaCategories.id, input.categoryId));
    if (!category) return null;
  }
  if (id) {
    const [row] = await db
      .update(agendaChecklistTemplates)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(agendaChecklistTemplates.id, id))
      .returning({ id: agendaChecklistTemplates.id });
    return row?.id ?? null;
  }
  const [row] = await db
    .insert(agendaChecklistTemplates)
    .values({ ...input, sortOrder: await nextSortOrder(agendaChecklistTemplates) })
    .returning({ id: agendaChecklistTemplates.id });
  return row.id;
}

export async function deleteChecklistTemplate(id: number): Promise<boolean> {
  const rows = await db.delete(agendaChecklistTemplates).where(eq(agendaChecklistTemplates.id, id)).returning({ id: agendaChecklistTemplates.id });
  return rows.length > 0;
}

export const moveChecklistTemplate = (id: number, direction: "up" | "down") => move(agendaChecklistTemplates, id, direction);
