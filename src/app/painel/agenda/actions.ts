"use server";

/**
 * Server Actions da Agenda: criar (formulário completo e criação rápida), editar, reagendar, mover (arrastar e
 * redimensionar, com desfazer), mudar o status (cancelar/concluir), duplicar, bloquear um período e excluir
 * compromissos — com a pergunta de série ("só este", "este e os seguintes", "todos") e o aviso de conflito de
 * horários (avisa, não proíbe: grava quando a pessoa confirma).
 * As camadas derivadas (prazos de projeto, financeiro, editorial) são editadas nos módulos de origem.
 *
 * ACESSO: toda action começa por `requireScopedPermission("agenda", "editar")` — passa quem tem a agenda no
 * módulo inteiro e, quando a agenda estiver em `PROJECT_SCOPED_PANEL_MODULES`, o funcionário. O que cada um pode
 * tocar vem de `agendaAccess` (`src/server/agenda/access.ts`): `getMutableEvent(access, id)` só devolve o que é
 * da pessoa para alterar, e `restrictEventInput(access, …)` ajusta o que o funcionário pode gravar. Excluir é
 * sempre do módulo inteiro.
 */
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { flashToast } from "@/components/ui/flash";
import { actionError, actionOk, type ActionState } from "@/lib/action-state";
import { logAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/auth";
import { addDays, diffDays, isISODate } from "@/lib/dates";
import { AGENDA_STATUSES } from "@/lib/domain";
import { requireScopedPermission } from "@/server/access/guards";
import { f, parseForm } from "@/server/action";
import { agendaAccess, type AgendaAccess } from "@/server/agenda/access";
import { createBlock } from "@/server/agenda/availability";
import { busyPeople, findEventConflicts, type ConflictNotice } from "@/server/agenda/conflicts";
import { parseEventForm, scopeSchema, typedValues, type EventInput } from "@/server/agenda/input";
import { moveEvent, moveInput, undoMove } from "@/server/agenda/move";
import {
  checkEventRefs,
  createEvent,
  deleteEventScoped,
  duplicateEvent,
  getMutableEvent,
  recordToInput,
  restrictEventInput,
  setEventStatus,
  toggleChecklistItem,
  updateEventScoped,
} from "@/server/agenda/mutations";
import type { EventRecord } from "@/server/agenda/privacy";
import { ensurePersonalCalendars } from "@/server/agenda/settings";

/** Dados extras devolvidos ao formulário: os choques de horário encontrados. */
export type EventActionData = { conflicts: ConflictNotice[]; total: number };
type EventActionState = ActionState<EventActionData>;

const GONE = "Este compromisso não existe mais.";
const idSchema = z.object({ id: f.id("Compromisso inválido.") });

/** Para onde voltar depois de salvar: só caminhos da própria agenda (o valor vem do formulário). */
function backTo(formData: FormData, date: string): string {
  const raw = formData.get("voltar");
  const fallback = `/painel/agenda?data=${date}`;
  if (typeof raw !== "string" || !/^\/painel\/agenda(\?[^\\\s]*)?$/.test(raw)) return fallback;
  const [path, query = ""] = raw.split("?");
  const params = new URLSearchParams(query);
  params.delete("mes");
  if (isISODate(date)) params.set("data", date);
  return `${path}?${params}`;
}

/** Confere os choques de horário, a menos que a pessoa já tenha confirmado ("Salvar mesmo assim"). */
async function conflictState(
  formData: FormData,
  access: AgendaAccess,
  input: EventInput,
  blocksDay: boolean,
  options: { excludeIds?: number[]; fallbackPerson: number | null; exceptions?: readonly string[] },
): Promise<EventActionState | null> {
  if (formData.get("ignoreConflicts") === "1") return null;
  const people = [...new Set([...input.responsibleIds, ...input.participantIds])];
  const report = await findEventConflicts(
    access,
    {
      date: input.date,
      endDate: input.endDate,
      startTime: input.startTime,
      endTime: input.endTime,
      recurrence: input.recurrence,
      exceptions: options.exceptions,
      status: input.status,
      people: people.length > 0 ? people : options.fallbackPerson ? [options.fallbackPerson] : [],
      blocksDay,
    },
    options.excludeIds,
  );
  if (report.total === 0) return null;
  return {
    ...actionError<EventActionData>(
      report.total === 1 ? "Há um conflito de horário. Confira abaixo e, se for isso mesmo, salve mesmo assim." : `Há ${report.total} conflitos de horário. Confira abaixo e, se for isso mesmo, salve mesmo assim.`,
      { values: typedValues(formData) },
    ),
    data: report,
  };
}

// ---------------------------------------------------------------------- criar
export async function createEventAction(_prev: EventActionState, formData: FormData): Promise<EventActionState> {
  const { user } = await requireScopedPermission("agenda", "editar");
  const access = await agendaAccess(user);
  const parsed = parseEventForm(formData);
  if (!parsed.ok) return parsed.state;
  const allowed = await restrictEventInput(access, parsed.data);
  if (allowed.error !== null) return actionError(allowed.error, { values: typedValues(formData) });
  const input = allowed.input;
  const refs = await checkEventRefs(input, user.id);
  if (refs.error !== null) return actionError(refs.error, { values: typedValues(formData) });
  if (!refs.category.isProduction) input.production = null;
  const conflict = await conflictState(formData, access, input, refs.category.blocksDay, { fallbackPerson: user.id });
  if (conflict) return conflict;

  const event = await createEvent(input, user.id);
  await logAudit({ user, action: "create", entity: "agenda_event", entityId: event.id, summary: "Criou um compromisso na agenda" });
  await flashToast("Compromisso criado.");
  redirect(backTo(formData, event.date));
}

/** Criação rápida (título, data, horário, categoria e agenda): fica na tela e atualiza o calendário. */
export async function quickCreateEventAction(_prev: EventActionState, formData: FormData): Promise<EventActionState> {
  const { user } = await requireScopedPermission("agenda", "editar");
  const access = await agendaAccess(user);
  const parsed = parseEventForm(formData);
  if (!parsed.ok) return parsed.state;
  const allowed = await restrictEventInput(access, { ...parsed.data, responsibleIds: [user.id], participantIds: [], production: null, clientId: null, projectId: null });
  if (allowed.error !== null) return actionError(allowed.error, { values: typedValues(formData) });
  const input = allowed.input;
  const refs = await checkEventRefs(input, user.id);
  if (refs.error !== null) return actionError(refs.error, { values: typedValues(formData) });
  const conflict = await conflictState(formData, access, input, refs.category.blocksDay, { fallbackPerson: user.id });
  if (conflict) return conflict;

  const event = await createEvent(input, user.id);
  await logAudit({ user, action: "create", entity: "agenda_event", entityId: event.id, summary: "Criou um compromisso na agenda (criação rápida)" });
  refresh();
  return actionOk("Compromisso criado.");
}

// --------------------------------------------------------------------- editar
export async function updateEventAction(_prev: EventActionState, formData: FormData): Promise<EventActionState> {
  const { user } = await requireScopedPermission("agenda", "editar");
  const access = await agendaAccess(user);
  const target = parseForm(idSchema.extend(scopeSchema.shape), formData);
  if (!target.ok) return target.state;
  const parsed = parseEventForm(formData);
  if (!parsed.ok) return parsed.state;
  const record = await getMutableEvent(access, target.data.id);
  if (!record) return actionError(GONE);
  const allowed = await restrictEventInput(access, parsed.data, record);
  if (allowed.error !== null) return actionError(allowed.error, { values: typedValues(formData) });
  const input = allowed.input;
  const refs = await checkEventRefs(input, user.id, record);
  if (refs.error !== null) return actionError(refs.error, { values: typedValues(formData) });
  if (!refs.category.isProduction) input.production = null;
  const { scope, occurrence } = target.data;
  const single = scope === "este" && record.recurrence !== null;
  const conflict = await conflictState(formData, access, single ? { ...input, recurrence: null } : input, refs.category.blocksDay, {
    excludeIds: [record.id],
    fallbackPerson: record.createdBy ?? user.id,
    exceptions: single ? [] : record.recurrenceExceptions,
  });
  if (conflict) return conflict;

  const saved = await updateEventScoped(record, input, scope, occurrence, user.id);
  await logAudit({ user, action: "update", entity: "agenda_event", entityId: saved.id, summary: `Editou um compromisso da agenda${seriesNote(record, scope)}` });
  await flashToast("Compromisso salvo.");
  redirect(backTo(formData, saved.date));
}

const seriesNote = (record: EventRecord, scope: string) =>
  record.recurrence ? (scope === "este" ? " (só uma ocorrência da série)" : scope === "seguintes" ? " (esta ocorrência e as seguintes)" : " (toda a série)") : "";

// ------------------------------------------------------------------ reagendar
const rescheduleSchema = idSchema.extend(scopeSchema.shape).extend({
  date: f.date("Informe a nova data."),
  allDay: f.checkbox(),
  startTime: f.optionalTime(),
  endTime: f.optionalTime(),
});

export async function rescheduleEventAction(_prev: EventActionState, formData: FormData): Promise<EventActionState> {
  const { user } = await requireScopedPermission("agenda", "editar");
  const access = await agendaAccess(user);
  const parsed = parseForm(rescheduleSchema, formData);
  if (!parsed.ok) return parsed.state;
  const { id, scope, occurrence, date, allDay, startTime, endTime } = parsed.data;
  const record = await getMutableEvent(access, id);
  if (!record) return actionError(GONE);
  const base = recordToInput(record, occurrence);
  if (!allDay && !startTime) return actionError("Confira os campos destacados.", { fieldErrors: { startTime: "Informe o horário de início ou marque “Dia inteiro”." }, values: typedValues(formData) });
  const multiDay = base.endDate !== null;
  if (!allDay && startTime && endTime && !multiDay && endTime <= startTime) {
    return actionError("Confira os campos destacados.", { fieldErrors: { endTime: "O fim precisa ser depois do início." }, values: typedValues(formData) });
  }
  // mantém a duração em dias: o último dia anda junto com o primeiro
  const span = base.endDate ? diffDays(base.date, base.endDate) : 0;
  const endDate = span > 0 ? addDays(date, span) : null;
  const input: EventInput = { ...base, date, endDate, startTime: allDay ? null : startTime, endTime: allDay ? null : endTime };
  const single = scope === "este" && record.recurrence !== null;
  const conflict = await conflictState(formData, access, single ? { ...input, recurrence: null } : input, record.categoryBlocksDay, {
    excludeIds: [record.id],
    fallbackPerson: busyPeople(record)[0] ?? user.id,
    exceptions: single ? [] : record.recurrenceExceptions,
  });
  if (conflict) return conflict;

  const saved = await updateEventScoped(record, input, scope, occurrence, user.id);
  await logAudit({ user, action: "update", entity: "agenda_event", entityId: saved.id, summary: `Reagendou um compromisso da agenda${seriesNote(record, scope)}` });
  await flashToast("Compromisso reagendado.");
  redirect(`/painel/agenda/${saved.id}${record.recurrence && saved.id === record.id ? `?dia=${saved.date}` : ""}`);
}

// ------------------------------------------------- mover (arrastar e soltar)
/** O que a tela recebe depois de mover: os choques (se houver) ou o recibo para desfazer. */
export type MoveActionData = { conflicts?: ConflictNotice[]; total?: number; undo?: string };

const moveSchema = idSchema.extend(scopeSchema.shape).extend({
  date: f.date("Data inválida."),
  startTime: f.optionalTime(),
  endTime: f.optionalTime(),
});

/**
 * Arrastar para outro dia/horário ou puxar a borda (nova duração). Não sai da tela: devolve o recibo de
 * "desfazer". Conflito devolve a lista e não grava — a tela pergunta e reenvia com `ignoreConflicts=1`.
 */
export async function moveEventAction(_prev: ActionState<MoveActionData>, formData: FormData): Promise<ActionState<MoveActionData>> {
  const { user } = await requireScopedPermission("agenda", "editar");
  const access = await agendaAccess(user);
  const parsed = parseForm(moveSchema, formData);
  if (!parsed.ok) return parsed.state;
  const { id, scope, occurrence, date, startTime, endTime } = parsed.data;
  const record = await getMutableEvent(access, id);
  if (!record) return actionError(GONE);
  if (record.status === "cancelado") return actionError("Compromisso cancelado não pode ser movido. Reative-o antes.");
  const moved = moveInput(record, occurrence, { date, startTime, endTime });
  if (moved.error !== null) return actionError(moved.error);
  const input = moved.input;
  const single = scope === "este" && record.recurrence !== null;
  const conflict = await conflictState(formData, access, single ? { ...input, recurrence: null } : input, record.categoryBlocksDay, {
    excludeIds: [record.id],
    fallbackPerson: busyPeople(record)[0] ?? user.id,
    exceptions: single ? [] : record.recurrenceExceptions,
  });
  if (conflict) return { ok: false, message: conflict.message, nonce: conflict.nonce, data: conflict.data };

  const { saved, undo } = await moveEvent(record, input, scope, occurrence, user.id);
  await logAudit({ user, action: "update", entity: "agenda_event", entityId: saved.id, summary: `Moveu um compromisso na agenda${seriesNote(record, scope)}` });
  refresh();
  return actionOk("Compromisso movido.", { undo });
}

const UNDO_MESSAGES = {
  invalido: "Não foi possível desfazer.",
  expirado: "O tempo para desfazer acabou. Use “Reagendar” no compromisso.",
  mudou: "O compromisso foi alterado depois do movimento: não dá mais para desfazer por aqui.",
  sem_acesso: "Você não pode mais alterar este compromisso.",
} as const;

export async function undoMoveEventAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { user } = await requireScopedPermission("agenda", "editar");
  const access = await agendaAccess(user);
  const parsed = parseForm(z.object({ undo: z.string().min(20).max(6000) }), formData);
  if (!parsed.ok) return actionError(UNDO_MESSAGES.invalido);
  const result = await undoMove(access, parsed.data.undo);
  if (!result.ok) return actionError(UNDO_MESSAGES[result.reason]);
  await logAudit({ user, action: "update", entity: "agenda_event", entityId: result.id, summary: "Desfez o movimento de um compromisso na agenda" });
  refresh();
  return actionOk("Movimento desfeito.");
}

// ---------------------------------------------------------- bloquear período
const blockSchema = z
  .object({
    personId: f.id("Selecione a pessoa."),
    date: f.date("Informe o primeiro dia."),
    endDate: f.date("Informe o último dia."),
    title: f.optionalText(160),
  })
  .refine((data) => data.endDate >= data.date, { path: ["endDate"], message: "O último dia não pode ser antes do primeiro." })
  .refine((data) => diffDays(data.date, data.endDate) <= 366, { path: ["endDate"], message: "O bloqueio pode ter no máximo um ano." });

/**
 * "Bloquear período" (férias, indisponibilidade): cria um compromisso de dia inteiro, com data final, numa
 * categoria que bloqueia o dia — a pessoa fica indisponível na consulta de disponibilidade e nos avisos de
 * conflito. Quem só altera os próprios compromissos só bloqueia a própria agenda.
 */
export async function blockPeriodAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { user } = await requireScopedPermission("agenda", "editar");
  const access = await agendaAccess(user);
  const parsed = parseForm(blockSchema, formData);
  if (!parsed.ok) return parsed.state;
  if (access.edit !== "todos" && parsed.data.personId !== user.id) return actionError("Você só pode bloquear a sua própria agenda.");
  const created = await createBlock({ ...parsed.data, createdBy: user.id });
  if ("error" in created) return actionError(created.error, { values: typedValues(formData) });
  await logAudit({ user, action: "create", entity: "agenda_event", entityId: created.id, summary: "Bloqueou um período na agenda" });
  refresh();
  return actionOk("Período bloqueado.");
}

// --------------------------------------------------------- cancelar / concluir
const statusSchema = idSchema.extend(scopeSchema.shape).extend({ status: z.enum(AGENDA_STATUSES, { error: "Status inválido." }) });

export async function setEventStatusAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { user } = await requireScopedPermission("agenda", "editar");
  const access = await agendaAccess(user);
  const parsed = parseForm(statusSchema, formData);
  if (!parsed.ok) return parsed.state;
  const { id, scope, occurrence, status } = parsed.data;
  const record = await getMutableEvent(access, id);
  if (!record) return actionError(GONE);
  const saved = await setEventStatus(record, status, scope, occurrence, user.id);
  const verb = status === "cancelado" ? "Cancelou" : status === "concluido" ? "Concluiu" : "Mudou o status de";
  await logAudit({ user, action: "status", entity: "agenda_event", entityId: saved.id, summary: `${verb} um compromisso da agenda${seriesNote(record, scope)}` });
  await flashToast(status === "cancelado" ? "Compromisso cancelado." : status === "concluido" ? "Compromisso concluído." : "Status atualizado.");
  redirect(`/painel/agenda/${saved.id}${record.recurrence && saved.id === record.id ? `?dia=${saved.date}` : ""}`);
}

// ------------------------------------------------------------------- duplicar
export async function duplicateEventAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { user } = await requireScopedPermission("agenda", "editar");
  const access = await agendaAccess(user);
  const parsed = parseForm(idSchema.extend({ occurrence: f.optionalDate() }), formData);
  if (!parsed.ok) return parsed.state;
  const record = await getMutableEvent(access, parsed.data.id);
  if (!record) return actionError(GONE);
  const copy = await duplicateEvent(record, parsed.data.occurrence, user.id);
  await logAudit({ user, action: "create", entity: "agenda_event", entityId: copy.id, summary: "Duplicou um compromisso da agenda" });
  await flashToast("Cópia criada como “a confirmar”. Ajuste a data e salve.");
  redirect(`/painel/agenda/${copy.id}/editar`);
}

// ------------------------------------------------------------------ checklist
const checklistSchema = idSchema.extend({ list: z.enum(["checklist", "prep"]), itemId: f.text(60), done: f.checkbox() });

export async function toggleChecklistItemAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { user } = await requireScopedPermission("agenda", "editar");
  const access = await agendaAccess(user);
  const parsed = parseForm(checklistSchema, formData);
  if (!parsed.ok) return parsed.state;
  const record = await getMutableEvent(access, parsed.data.id);
  if (!record) return actionError(GONE);
  const changed = await toggleChecklistItem(record, parsed.data.list, parsed.data.itemId, parsed.data.done);
  if (!changed) return actionError("Este item não existe mais.");
  refresh();
  return actionOk();
}

// -------------------------------------------------------------------- excluir
export async function deleteEventAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission("agenda", "excluir");
  const access = await agendaAccess(user);
  const parsed = parseForm(idSchema.extend(scopeSchema.shape), formData);
  if (!parsed.ok) return parsed.state;
  const record = await getMutableEvent(access, parsed.data.id);
  if (record) {
    await deleteEventScoped(record, parsed.data.scope, parsed.data.occurrence);
    await logAudit({ user, action: "delete", entity: "agenda_event", entityId: record.id, summary: `Excluiu um compromisso da agenda${seriesNote(record, parsed.data.scope)}` });
  }
  await flashToast("Compromisso excluído.");
  redirect(backTo(formData, parsed.data.occurrence ?? record?.date ?? ""));
}

// ----------------------------------------------------------- agendas pessoais
/** Cria a agenda pessoal de quem ainda não tem (chamada pela tela quando percebe que falta). */
export async function ensureCalendarsAction(_prev: ActionState, _formData: FormData): Promise<ActionState> {
  await requireScopedPermission("agenda", "editar");
  const created = await ensurePersonalCalendars();
  if (created > 0) refresh();
  return actionOk();
}
