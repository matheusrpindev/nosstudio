/**
 * Agenda no PAINEL — GRAVAÇÃO. Só fala com o banco: autorização, validação (zod), conferência de privacidade
 * (`canSeeEvent`) e auditoria ficam nas Server Actions (`src/app/painel/agenda/actions.ts`).
 *
 * Séries: "só este" cria uma exceção na série e uma linha avulsa; "este e os seguintes" encerra a série na
 * véspera e cria outra a partir do dia; "todos" altera a própria série (ver `src/lib/agenda/series.ts`).
 */
import "server-only";
import { and, eq, gte, inArray, sql } from "drizzle-orm";
import { db, type DbOrTx } from "@/db";
import { agendaCalendars, agendaCategories, agendaEventPeople, agendaEvents, clients, media, projects, users } from "@/db/schema";
import { ruleOf } from "@/lib/agenda/expand";
import { sameRule, shiftDates, splitSeries } from "@/lib/agenda/series";
import { addDays, diffDays, type ISODate } from "@/lib/dates";
import { AGENDA_DEFAULT_CATEGORIES, AGENDA_DERIVED_CALENDAR_KINDS, type AgendaKind, type AgendaSeriesScope, type AgendaStatus } from "@/lib/domain";
import { releaseMedia } from "@/server/media";
import type { EventInput } from "./input";
import { canSeeEvent, type EventRecord } from "./privacy";
import { AGENDA_PANEL_ROLES } from "./queries";
import { loadEventRecord } from "./records";

const LEGACY_KIND = new Map<string, AgendaKind>(AGENDA_DEFAULT_CATEGORIES.map((category) => [category.slug, category.legacyKind]));

/**
 * Confere o que o formulário aponta: categoria e agenda existentes (e que aceitam compromissos), cliente,
 * projeto, pessoas ativas do painel e anexos privados enviados pela própria pessoa (ou já presos ao compromisso).
 * Devolve a mensagem de erro, ou `null` + o que a gravação precisa saber da categoria.
 */
export async function checkEventRefs(
  input: EventInput,
  userId: number,
  current?: Pick<EventRecord, "categoryId" | "calendarId" | "attachments"> | null,
): Promise<{ error: string } | { error: null; category: { isProduction: boolean; blocksDay: boolean; slug: string | null } }> {
  const [category] = await db.select().from(agendaCategories).where(eq(agendaCategories.id, input.categoryId));
  if (!category || (!category.active && current?.categoryId !== category.id)) return { error: "A categoria selecionada não está disponível." };
  const [calendar] = await db.select().from(agendaCalendars).where(eq(agendaCalendars.id, input.calendarId));
  if (!calendar || AGENDA_DERIVED_CALENDAR_KINDS.includes(calendar.kind) || (!calendar.active && current?.calendarId !== calendar.id)) {
    return { error: "A agenda selecionada não está disponível." };
  }
  if (input.clientId) {
    const [row] = await db.select({ id: clients.id }).from(clients).where(eq(clients.id, input.clientId));
    if (!row) return { error: "O cliente selecionado não existe mais." };
  }
  if (input.projectId) {
    const [row] = await db.select({ id: projects.id }).from(projects).where(eq(projects.id, input.projectId));
    if (!row) return { error: "O projeto selecionado não existe mais." };
  }
  const peopleIds = [...new Set([...input.responsibleIds, ...input.participantIds])];
  if (peopleIds.length > 0) {
    const rows = await db
      .select({ id: users.id })
      .from(users)
      .where(and(inArray(users.id, peopleIds), eq(users.active, true), inArray(users.role, [...AGENDA_PANEL_ROLES])));
    if (rows.length !== peopleIds.length) return { error: "Uma das pessoas selecionadas não está mais disponível." };
  }
  const newAttachments = input.attachments.filter((id) => !(current?.attachments ?? []).includes(id));
  if (newAttachments.length > 0) {
    const rows = await db.select({ id: media.id, visibility: media.visibility, uploadedBy: media.uploadedBy }).from(media).where(inArray(media.id, newAttachments));
    const valid = rows.filter((row) => row.visibility === "private" && row.uploadedBy === userId);
    if (valid.length !== newAttachments.length) return { error: "Um dos anexos não pôde ser usado. Envie o arquivo de novo." };
  }
  return { error: null, category: { isProduction: category.isProduction, blocksDay: category.blocksDay, slug: category.slug } };
}

type EventValues = Omit<typeof agendaEvents.$inferInsert, "id" | "createdAt" | "updatedAt">;

/** Colunas gravadas a partir do formulário (sem as de série, decididas por quem chama). */
function valuesOf(input: EventInput, categorySlug: string | null): EventValues {
  return {
    title: input.title,
    kind: (categorySlug && LEGACY_KIND.get(categorySlug)) || "outro",
    categoryId: input.categoryId,
    calendarId: input.calendarId,
    description: input.description,
    date: input.date,
    endDate: input.endDate,
    startTime: input.startTime,
    endTime: input.endTime,
    location: input.location,
    mapUrl: input.mapUrl,
    meetingUrl: input.meetingUrl,
    clientId: input.clientId,
    projectId: input.projectId,
    ownerId: input.responsibleIds[0] ?? null,
    priority: input.priority,
    status: input.status,
    visibility: input.visibility,
    checklist: input.checklist,
    notes: input.notes,
    reminders: input.reminders,
    recurrence: input.recurrence,
    attachments: input.attachments,
    production: input.production,
  };
}

async function writePeople(tx: DbOrTx, eventId: number, input: Pick<EventInput, "responsibleIds" | "participantIds" | "externalPeople">) {
  await tx.delete(agendaEventPeople).where(eq(agendaEventPeople.eventId, eventId));
  const rows = [
    ...input.responsibleIds.map((userId) => ({ eventId, userId, role: "responsavel" as const, externalName: "" })),
    ...input.participantIds.filter((id) => !input.responsibleIds.includes(id)).map((userId) => ({ eventId, userId, role: "participante" as const, externalName: "" })),
    ...input.externalPeople.map((externalName) => ({ eventId, userId: null, role: "externo" as const, externalName })),
  ].map((row, sortOrder) => ({ ...row, sortOrder }));
  if (rows.length > 0) await tx.insert(agendaEventPeople).values(rows);
}

async function categorySlug(tx: DbOrTx, categoryId: number): Promise<string | null> {
  const [row] = await tx.select({ slug: agendaCategories.slug }).from(agendaCategories).where(eq(agendaCategories.id, categoryId));
  return row?.slug ?? null;
}

export async function createEvent(input: EventInput, userId: number): Promise<{ id: number; date: ISODate }> {
  return db.transaction(async (tx) => {
    const [event] = await tx
      .insert(agendaEvents)
      .values({ ...valuesOf(input, await categorySlug(tx, input.categoryId)), createdBy: userId })
      .returning({ id: agendaEvents.id, date: agendaEvents.date });
    await writePeople(tx, event.id, input);
    return event;
  });
}

/** O conteúdo de um compromisso no formato do formulário, posicionado no dia `occurrence` (em séries). */
export function recordToInput(record: EventRecord, occurrence?: ISODate | null): EventInput {
  const date = occurrence ?? record.date;
  const span = record.endDate && record.endDate > record.date ? diffDays(record.date, record.endDate) : 0;
  return {
    title: record.title,
    categoryId: record.categoryId ?? 0,
    calendarId: record.calendarId ?? 0,
    description: record.description,
    date,
    endDate: span > 0 ? addDays(date, span) : null,
    startTime: record.startTime,
    endTime: record.endTime,
    location: record.location,
    mapUrl: record.mapUrl,
    meetingUrl: record.meetingUrl,
    clientId: record.clientId,
    projectId: record.projectId,
    priority: record.priority,
    status: record.status,
    visibility: record.visibility,
    checklist: record.checklist ?? [],
    notes: record.notes,
    reminders: record.reminders ?? [],
    recurrence: ruleOf(record),
    attachments: record.attachments ?? [],
    production: record.production ?? null,
    responsibleIds: record.people.filter((person) => person.role === "responsavel" && person.userId).map((person) => person.userId as number),
    participantIds: record.people.filter((person) => person.role === "participante" && person.userId).map((person) => person.userId as number),
    externalPeople: record.people.filter((person) => person.role === "externo").map((person) => person.name),
  };
}

/** Anexos que nenhum compromisso usa mais: apaga o arquivo (se nenhum outro módulo o usar). */
async function releaseAttachments(ids: readonly number[]) {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return;
  const stillUsed = new Set<number>();
  for (const id of unique) {
    const [row] = await db
      .select({ id: agendaEvents.id })
      .from(agendaEvents)
      .where(sql`exists (select 1 from json_each(${agendaEvents.attachments}) where json_each.value = ${id})`)
      .limit(1);
    if (row) stillUsed.add(id);
  }
  await releaseMedia(unique.filter((id) => !stillUsed.has(id)));
}

export type ScopedResult = { id: number; date: ISODate };

/**
 * Grava `input` sobre o compromisso `record`. Em séries, `scope` diz a quem se aplica e `occurrence` é o dia em
 * que a pessoa estava (obrigatório para "este" e "seguintes").
 */
export async function updateEventScoped(
  record: EventRecord,
  input: EventInput,
  scope: AgendaSeriesScope,
  occurrence: ISODate | null,
  userId: number,
): Promise<ScopedResult> {
  const rule = ruleOf(record);
  const exceptions = record.recurrenceExceptions ?? [];
  const dropped = (record.attachments ?? []).filter((id) => !input.attachments.includes(id));

  const result = await db.transaction(async (tx): Promise<ScopedResult> => {
    const values = valuesOf(input, await categorySlug(tx, input.categoryId));

    // avulso (ou ocorrência já separada da série, que não vira uma série dentro da outra)
    if (!rule) {
      const recurrence = record.seriesId ? null : input.recurrence;
      await tx.update(agendaEvents).set({ ...values, recurrence, updatedAt: new Date() }).where(eq(agendaEvents.id, record.id));
      await writePeople(tx, record.id, input);
      return { id: record.id, date: input.date };
    }

    const day = occurrence ?? record.date;

    if (scope === "este") {
      await tx
        .update(agendaEvents)
        .set({ recurrenceExceptions: [...new Set([...exceptions, day])].sort(), updatedAt: new Date() })
        .where(eq(agendaEvents.id, record.id));
      const [child] = await tx
        .insert(agendaEvents)
        .values({ ...values, recurrence: null, recurrenceExceptions: [], seriesId: record.id, originalDate: day, createdBy: record.createdBy ?? userId })
        .returning({ id: agendaEvents.id });
      await writePeople(tx, child.id, input);
      return { id: child.id, date: input.date };
    }

    if (scope === "seguintes") {
      const split = splitSeries(record.date, rule, exceptions, day);
      if (split.head) {
        await tx
          .update(agendaEvents)
          .set({ recurrence: split.head.rule, recurrenceExceptions: split.head.exceptions, updatedAt: new Date() })
          .where(eq(agendaEvents.id, record.id));
        // a mesma regra continua na série nova, só com o que restava do limite de vezes
        const tailRule = input.recurrence ? (sameRule(input.recurrence, rule) ? split.tail.rule : input.recurrence) : null;
        const [tail] = await tx
          .insert(agendaEvents)
          .values({
            ...values,
            recurrence: tailRule,
            recurrenceExceptions: tailRule ? shiftDates(split.tail.exceptions, day, input.date) : [],
            createdBy: record.createdBy ?? userId,
          })
          .returning({ id: agendaEvents.id });
        await writePeople(tx, tail.id, input);
        // ocorrências já editadas sozinhas dali em diante passam a pertencer à série nova
        await tx
          .update(agendaEvents)
          .set({ seriesId: tail.id })
          .where(and(eq(agendaEvents.seriesId, record.id), gte(agendaEvents.originalDate, day)));
        return { id: tail.id, date: input.date };
      }
      // o corte é na primeira ocorrência: equivale a "todos"
    }

    // todos: a série inteira anda junto com a mudança de dia feita nesta ocorrência
    const start = input.recurrence ? addDays(record.date, diffDays(day, input.date)) : input.date;
    const span = input.endDate ? diffDays(input.date, input.endDate) : 0;
    await tx
      .update(agendaEvents)
      .set({
        ...values,
        date: start,
        endDate: span > 0 ? addDays(start, span) : null,
        recurrenceExceptions: input.recurrence ? shiftDates(exceptions, record.date, start) : [],
        updatedAt: new Date(),
      })
      .where(eq(agendaEvents.id, record.id));
    await writePeople(tx, record.id, input);
    // deixou de se repetir: as ocorrências editadas à parte somem junto com a série
    if (!input.recurrence) await tx.delete(agendaEvents).where(eq(agendaEvents.seriesId, record.id));
    return { id: record.id, date: input.date };
  });

  await releaseAttachments(dropped);
  return result;
}

/** Exclui o compromisso; em séries, conforme `scope` ("só este" vira uma exceção na série). */
export async function deleteEventScoped(record: EventRecord, scope: AgendaSeriesScope, occurrence: ISODate | null): Promise<void> {
  const rule = ruleOf(record);
  const exceptions = record.recurrenceExceptions ?? [];
  const attachments: number[] = [];

  await db.transaction(async (tx) => {
    const removeRows = async (where: ReturnType<typeof eq>) => {
      const rows = await tx.delete(agendaEvents).where(where).returning({ attachments: agendaEvents.attachments });
      for (const row of rows) attachments.push(...(row.attachments ?? []));
    };
    const removeSeries = async () => {
      await removeRows(eq(agendaEvents.seriesId, record.id));
      await removeRows(eq(agendaEvents.id, record.id));
    };

    if (!rule) return removeSeries();
    const day = occurrence ?? record.date;
    if (scope === "este") {
      await tx
        .update(agendaEvents)
        .set({ recurrenceExceptions: [...new Set([...exceptions, day])].sort(), updatedAt: new Date() })
        .where(eq(agendaEvents.id, record.id));
      return;
    }
    if (scope === "seguintes") {
      const split = splitSeries(record.date, rule, exceptions, day);
      if (split.head) {
        await tx
          .update(agendaEvents)
          .set({ recurrence: split.head.rule, recurrenceExceptions: split.head.exceptions, updatedAt: new Date() })
          .where(eq(agendaEvents.id, record.id));
        const rows = await tx
          .delete(agendaEvents)
          .where(and(eq(agendaEvents.seriesId, record.id), gte(agendaEvents.originalDate, day)))
          .returning({ attachments: agendaEvents.attachments });
        for (const row of rows) attachments.push(...(row.attachments ?? []));
        return;
      }
    }
    return removeSeries();
  });

  await releaseAttachments(attachments);
}

/** Muda só o status (cancelar, concluir, reativar), respeitando o escopo da série. */
export function setEventStatus(record: EventRecord, status: AgendaStatus, scope: AgendaSeriesScope, occurrence: ISODate | null, userId: number) {
  return updateEventScoped(record, { ...recordToInput(record, occurrence), status }, scope, occurrence, userId);
}

/** Cópia avulsa (sem repetição nem anexos — os arquivos pertencem ao original), no mesmo dia da ocorrência. */
export async function duplicateEvent(record: EventRecord, occurrence: ISODate | null, userId: number): Promise<{ id: number; date: ISODate }> {
  const input = recordToInput(record, occurrence);
  return createEvent({ ...input, title: `${input.title} (cópia)`.slice(0, 160), recurrence: null, attachments: [], status: "a_confirmar" }, userId);
}

/**
 * O compromisso para ALTERAR: `null` se não existe ou se é um particular de que a pessoa não participa
 * (para ela, ele é só "Ocupado": não edita, não cancela, não exclui, não duplica).
 */
export async function getMutableEvent(viewerId: number, id: number): Promise<EventRecord | null> {
  const record = await loadEventRecord(id);
  return record && canSeeEvent(record, viewerId) ? record : null;
}

/** Marca/desmarca um item do checklist do compromisso (`checklist`) ou da preparação da gravação (`prep`). */
export async function toggleChecklistItem(record: EventRecord, list: "checklist" | "prep", itemId: string, done: boolean): Promise<boolean> {
  if (list === "checklist") {
    if (!record.checklist.some((item) => item.id === itemId)) return false;
    const checklist = record.checklist.map((item) => (item.id === itemId ? { ...item, done } : item));
    await db.update(agendaEvents).set({ checklist, updatedAt: new Date() }).where(eq(agendaEvents.id, record.id));
    return true;
  }
  const production = record.production;
  if (!production || !production.prepChecklist.some((item) => item.id === itemId)) return false;
  const prepChecklist = production.prepChecklist.map((item) => (item.id === itemId ? { ...item, done } : item));
  await db.update(agendaEvents).set({ production: { ...production, prepChecklist }, updatedAt: new Date() }).where(eq(agendaEvents.id, record.id));
  return true;
}
