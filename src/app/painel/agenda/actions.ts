"use server";

/** Server Actions da Agenda: criar, editar e excluir compromissos (os prazos de projeto são editados no projeto). */
import { redirect } from "next/navigation";
import { z } from "zod";
import { flashToast } from "@/components/ui/flash";
import { actionError, type ActionState } from "@/lib/action-state";
import { logAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/auth";
import { AGENDA_KINDS } from "@/lib/domain";
import { f, formToObject, parseForm } from "@/server/action";
import {
  checkEventRefs,
  createEvent,
  deleteEvent,
  updateEvent,
  type EventInput,
} from "@/server/agenda/admin";
import { normalizeEventTimes, validateEventTimes } from "@/server/agenda/logic";

const eventSchema = z
  .object({
    title: f.text(160, "Dê um título ao compromisso."),
    kind: z.enum(AGENDA_KINDS, { error: "Selecione o tipo." }),
    date: f.date("Informe a data."),
    allDay: f.checkbox(),
    startTime: f.optionalTime(),
    endTime: f.optionalTime(),
    location: f.optionalText(200),
    clientId: f.optionalId(),
    projectId: f.optionalId(),
    ownerId: f.optionalId(),
    notes: f.optionalText(4000),
  })
  .superRefine((data, ctx) => {
    for (const [path, message] of Object.entries(validateEventTimes(data)))
      ctx.addIssue({ code: "custom", path: [path], message });
  });

function toInput(data: z.infer<typeof eventSchema>): EventInput {
  const { allDay, ...rest } = data;
  return {
    ...rest,
    ...normalizeEventTimes({
      allDay,
      startTime: data.startTime,
      endTime: data.endTime,
    }),
  };
}

const monthOf = (date: string) => `/painel/agenda?mes=${date.slice(0, 7)}`;

/** O que a pessoa digitou, para repopular o formulário quando o erro não vem da validação do zod. */
function typedValues(formData: FormData): Record<string, string> {
  return Object.fromEntries(
    Object.entries(formToObject(formData)).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  );
}

// ---------------------------------------------------------------------- criar
export async function createEventAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requirePermission("agenda", "editar");
  const parsed = parseForm(eventSchema, formData);
  if (!parsed.ok) return parsed.state;
  const input = toInput(parsed.data);
  const refsError = await checkEventRefs(input);
  if (refsError)
    return actionError(refsError, { values: typedValues(formData) });

  const event = await createEvent(input);
  await logAudit({
    user,
    action: "create",
    entity: "agenda_event",
    entityId: event.id,
    summary: "Criou um compromisso na agenda",
  });
  await flashToast("Compromisso criado.");
  redirect(monthOf(event.date));
}

// --------------------------------------------------------------------- editar
const updateSchema = z.object({ id: f.id("Compromisso inválido.") });

export async function updateEventAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requirePermission("agenda", "editar");
  const idParsed = parseForm(updateSchema, formData);
  if (!idParsed.ok) return idParsed.state;
  const parsed = parseForm(eventSchema, formData);
  if (!parsed.ok) return parsed.state;
  const input = toInput(parsed.data);
  const refsError = await checkEventRefs(input);
  if (refsError)
    return actionError(refsError, { values: typedValues(formData) });

  const event = await updateEvent(idParsed.data.id, input);
  if (!event) return actionError("Este compromisso não existe mais.");
  await logAudit({
    user,
    action: "update",
    entity: "agenda_event",
    entityId: event.id,
    summary: "Editou um compromisso da agenda",
  });
  await flashToast("Compromisso salvo.");
  redirect(monthOf(event.date));
}

// -------------------------------------------------------------------- excluir
export async function deleteEventAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requirePermission("agenda", "excluir");
  const parsed = parseForm(updateSchema, formData);
  if (!parsed.ok) return parsed.state;
  const deleted = await deleteEvent(parsed.data.id);
  if (deleted)
    await logAudit({
      user,
      action: "delete",
      entity: "agenda_event",
      entityId: deleted.id,
      summary: "Excluiu um compromisso da agenda",
    });
  await flashToast("Compromisso excluído.");
  redirect(deleted ? monthOf(deleted.date) : "/painel/agenda");
}
