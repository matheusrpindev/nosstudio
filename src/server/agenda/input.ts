/**
 * Validação (zod) do formulário de compromisso. Tudo o que vem do navegador passa por aqui antes de chegar às
 * mutações: campos simples, e as listas enviadas em JSON (pessoas, checklist, lembretes, repetição, anexos).
 */
import "server-only";
import { z } from "zod";
import type { AgendaProductionPlan, AgendaReminder, ChecklistItem } from "@/db/schema";
import { normalizeRecurrence, type Recurrence } from "@/lib/agenda/recurrence";
import { isISODate, isTime, type ISODate } from "@/lib/dates";
import {
  AGENDA_PRIORITIES,
  AGENDA_REMINDER_CHANNELS,
  AGENDA_REMINDER_MAX_MINUTES,
  AGENDA_SERIES_SCOPES,
  AGENDA_STATUSES,
  type AgendaPriority,
  type AgendaSeriesScope,
  type AgendaStatus,
  type AgendaVisibility,
} from "@/lib/domain";
import { safeUrl } from "@/lib/format";
import { f, formToObject, jsonField, zodFieldErrors } from "@/server/action";
import { actionError, type ActionState } from "@/lib/action-state";

export type EventInput = {
  title: string;
  categoryId: number;
  calendarId: number;
  description: string;
  date: ISODate;
  /** Último dia (vários dias). `null` = termina no mesmo dia. */
  endDate: ISODate | null;
  startTime: string | null;
  endTime: string | null;
  location: string;
  mapUrl: string;
  meetingUrl: string;
  clientId: number | null;
  projectId: number | null;
  priority: AgendaPriority;
  status: AgendaStatus;
  visibility: AgendaVisibility;
  checklist: ChecklistItem[];
  notes: string;
  reminders: AgendaReminder[];
  recurrence: Recurrence | null;
  attachments: number[];
  production: AgendaProductionPlan | null;
  responsibleIds: number[];
  participantIds: number[];
  externalPeople: string[];
};

const checklistSchema = z
  .array(z.object({ id: z.string().trim().min(1).max(60), text: z.string().trim().max(200), done: z.boolean().default(false) }))
  .max(60, "Máximo de 60 itens.")
  .transform((items) => items.filter((item) => item.text !== ""));

const idList = (max: number) =>
  z
    .array(z.coerce.number().int().positive())
    .max(max)
    .transform((ids) => [...new Set(ids)]);

const link = (message: string) =>
  z
    .string()
    .trim()
    .max(500, "Máximo de 500 caracteres.")
    .optional()
    .transform((value) => value ?? "")
    .refine((value) => value === "" || safeUrl(value) !== "", message)
    .transform((value) => safeUrl(value));

const optionalInt = (max: number, message: string) =>
  z
    .string()
    .optional()
    .transform((value) => (value && value.trim() ? Number(value.trim()) : null))
    .refine((value) => value === null || (Number.isInteger(value) && value >= 0 && value <= max), message);

const eventSchema = z
  .object({
    title: f.text(160, "Dê um título ao compromisso."),
    categoryId: f.id("Selecione a categoria."),
    calendarId: f.id("Selecione a agenda."),
    description: f.optionalText(6000),
    date: f.date("Informe a data."),
    endDate: f.optionalDate(),
    allDay: f.checkbox(),
    startTime: f.optionalTime(),
    endTime: f.optionalTime(),
    location: f.optionalText(300),
    mapUrl: link("Informe um link válido (ex.: https://maps.app.goo.gl/…)."),
    meetingUrl: link("Informe um link válido (ex.: https://meet.google.com/…)."),
    clientId: f.optionalId(),
    projectId: f.optionalId(),
    priority: z.enum(AGENDA_PRIORITIES).default("normal"),
    status: z.enum(AGENDA_STATUSES).default("confirmado"),
    particular: f.checkbox(),
    notes: f.optionalText(6000),
    checklist: checklistSchema,
    reminders: z
      .array(z.object({ minutes: z.number().int().min(0).max(AGENDA_REMINDER_MAX_MINUTES), channel: z.enum(AGENDA_REMINDER_CHANNELS) }))
      .max(6, "Máximo de 6 lembretes."),
    recurrence: z.unknown(),
    attachments: idList(12),
    responsibleIds: idList(20),
    participantIds: idList(40),
    externalPeople: z.array(z.string().trim().max(120)).max(30),
    // planejamento de gravação
    prodAddress: f.optionalText(300),
    prodArrival: f.optionalTime(),
    prodScript: f.optionalText(10000),
    prodReferences: f.optionalText(4000),
    prodEquipment: f.optionalText(4000),
    prodContentCount: optionalInt(9999, "Informe um número inteiro."),
    prodEstimatedHours: z
      .string()
      .optional()
      .transform((value) => (value && value.trim() ? Number(value.trim().replace(",", ".")) : null))
      .refine((value) => value === null || (Number.isFinite(value) && value >= 0 && value <= 240), "Informe as horas (ex.: 3 ou 2,5)."),
    prodEditDeadline: f.optionalDate(),
    prodDeliveryDate: f.optionalDate(),
    prodChecklist: checklistSchema,
  })
  .superRefine((data, ctx) => {
    if (data.endDate && data.endDate < data.date) {
      ctx.addIssue({ code: "custom", path: ["endDate"], message: "O último dia não pode ser antes do início." });
    }
    if (!data.allDay) {
      if (!data.startTime || !isTime(data.startTime)) {
        ctx.addIssue({ code: "custom", path: ["startTime"], message: "Informe o horário de início ou marque “Dia inteiro”." });
      } else if (data.endTime && (!data.endDate || data.endDate === data.date) && data.endTime <= data.startTime) {
        ctx.addIssue({ code: "custom", path: ["endTime"], message: "O fim precisa ser depois do início." });
      }
    }
    if (data.recurrence !== null && data.recurrence !== undefined) {
      const rule = normalizeRecurrence(data.recurrence);
      if (!rule) ctx.addIssue({ code: "custom", path: ["recurrence"], message: "Repetição inválida." });
      else if (rule.until && isISODate(data.date) && rule.until < data.date) {
        ctx.addIssue({ code: "custom", path: ["recurrence"], message: "A repetição termina antes da data do compromisso." });
      }
    }
  });

/** Lembretes sem repetição (mesma antecedência e canal), do mais próximo para o mais distante. */
function tidyReminders(reminders: AgendaReminder[]): AgendaReminder[] {
  const seen = new Set<string>();
  return reminders
    .filter((reminder) => {
      const key = `${reminder.minutes}:${reminder.channel}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => a.minutes - b.minutes || a.channel.localeCompare(b.channel));
}

const JSON_FIELDS = ["checklist", "reminders", "attachments", "responsibleIds", "participantIds", "externalPeople", "prodChecklist"] as const;

type Parsed<T> = { ok: true; data: T } | { ok: false; state: ActionState<never> };

/** O que a pessoa digitou (texto), para repopular os campos quando a action devolve erro ou aviso. */
export function typedValues(formData: FormData): Record<string, string> {
  return Object.fromEntries(Object.entries(formToObject(formData)).filter((entry): entry is [string, string] => typeof entry[1] === "string"));
}

export function parseEventForm(formData: FormData): Parsed<EventInput> {
  const object: Record<string, unknown> = formToObject(formData);
  for (const name of JSON_FIELDS) object[name] = jsonField(formData, name) ?? [];
  object.recurrence = jsonField(formData, "recurrence") ?? null;
  const parsed = eventSchema.safeParse(object);
  if (!parsed.success) {
    const fieldErrors = zodFieldErrors(parsed.error);
    return { ok: false, state: actionError(fieldErrors._form ?? "Confira os campos destacados.", { fieldErrors, values: typedValues(formData) }) };
  }
  const data = parsed.data;
  const allDay = data.allDay;
  const endDate = data.endDate && data.endDate > data.date ? data.endDate : null;
  const hasProduction =
    Boolean(data.prodAddress || data.prodArrival || data.prodScript || data.prodReferences || data.prodEquipment || data.prodEditDeadline || data.prodDeliveryDate) ||
    data.prodContentCount !== null ||
    data.prodEstimatedHours !== null ||
    data.prodChecklist.length > 0;
  const responsibleIds = data.responsibleIds;
  return {
    ok: true,
    data: {
      title: data.title,
      categoryId: data.categoryId,
      calendarId: data.calendarId,
      description: data.description,
      date: data.date,
      endDate,
      startTime: allDay ? null : data.startTime,
      endTime: allDay || !data.startTime ? null : data.endTime,
      location: data.location,
      mapUrl: data.mapUrl,
      meetingUrl: data.meetingUrl,
      clientId: data.clientId,
      projectId: data.projectId,
      priority: data.priority,
      status: data.status,
      visibility: data.particular ? "particular" : "normal",
      checklist: data.checklist,
      notes: data.notes,
      reminders: tidyReminders(data.reminders),
      recurrence: normalizeRecurrence(data.recurrence),
      attachments: data.attachments,
      production: hasProduction
        ? {
            address: data.prodAddress,
            crewArrival: data.prodArrival,
            script: data.prodScript,
            references: data.prodReferences,
            equipment: data.prodEquipment,
            contentCount: data.prodContentCount,
            estimatedMinutes: data.prodEstimatedHours === null ? null : Math.round(data.prodEstimatedHours * 60),
            editDeadline: data.prodEditDeadline,
            deliveryDate: data.prodDeliveryDate,
            prepChecklist: data.prodChecklist,
          }
        : null,
      responsibleIds,
      participantIds: data.participantIds.filter((id) => !responsibleIds.includes(id)),
      externalPeople: [...new Set(data.externalPeople.filter((name) => name !== ""))],
    },
  };
}

/** A quem a mudança se aplica numa série + o dia da ocorrência em que a pessoa estava. */
export const scopeSchema = z.object({
  scope: z.enum(AGENDA_SERIES_SCOPES).default("este"),
  occurrence: f.optionalDate(),
});
export type ScopeInput = { scope: AgendaSeriesScope; occurrence: ISODate | null };
