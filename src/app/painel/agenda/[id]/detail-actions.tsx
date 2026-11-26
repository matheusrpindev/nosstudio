"use client";

import { Ban, CalendarClock, CircleCheck, Copy, Pencil, RotateCcw, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { Button, ButtonLink } from "@/components/ui/button";
import { ConfirmDialog, Dialog, DialogClose } from "@/components/ui/dialog";
import { ActionForm, Field, FieldRow, SubmitButton } from "@/components/ui/form";
import { DateInput, RadioCards, TimeInput } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/toast";
import { initialActionState } from "@/lib/action-state";
import { cn } from "@/lib/cn";
import type { ISODate } from "@/lib/dates";
import { AGENDA_SERIES_SCOPE_LABELS, type AgendaStatus } from "@/lib/domain";
import { deleteEventAction, duplicateEventAction, rescheduleEventAction, setEventStatusAction, toggleChecklistItemAction, type EventActionData } from "../actions";
import { FormFeedback } from "../feedback";

/** "Só este / este e os seguintes / todos" — só aparece em séries. */
function ScopeChoice({ first, legend }: { first: boolean; legend: string }) {
  return (
    <Field name="scope" label={legend} group>
      <RadioCards
        defaultValue="este"
        cols={1}
        compact
        className="!grid-cols-1"
        options={[
          { value: "este", label: AGENDA_SERIES_SCOPE_LABELS.este },
          { value: "seguintes", label: AGENDA_SERIES_SCOPE_LABELS.seguintes, disabled: first },
          { value: "todos", label: AGENDA_SERIES_SCOPE_LABELS.todos },
        ]}
      />
    </Field>
  );
}

type Props = {
  id: number;
  /** Dia da ocorrência aberta. */
  occurrence: ISODate;
  /** É uma série? (mostra a pergunta de série) */
  recurring: boolean;
  /** A ocorrência aberta é a primeira da série. */
  first: boolean;
  status: AgendaStatus;
  startTime: string | null;
  endTime: string | null;
  canEdit: boolean;
  canDelete: boolean;
  editHref: string;
};

/** Ações do detalhe: editar, reagendar, duplicar, concluir, cancelar e excluir. */
export function DetailActions({ id, occurrence, recurring, first, status, startTime, endTime, canEdit, canDelete, editHref }: Props) {
  const [allDay, setAllDay] = useState(startTime === null);
  const hidden = { id, occurrence };
  const scope = (legend: string) => (recurring ? <ScopeChoice first={first} legend={legend} /> : null);
  if (!canEdit && !canDelete) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 max-sm:[&>*]:flex-1">
      {canEdit ? (
        <>
          <ButtonLink href={editHref} icon={<Pencil />}>
            Editar
          </ButtonLink>
          <Dialog
            trigger={
              <Button variant="secondary" icon={<CalendarClock />}>
                Reagendar
              </Button>
            }
            title="Reagendar compromisso"
            description="Escolha a nova data e o novo horário. O resto continua igual."
          >
            <ActionForm<EventActionData> action={rescheduleEventAction} hidden={hidden} hideError className="space-y-4">
              <Field name="date" label="Nova data" required>
                <DateInput defaultValue={occurrence} />
              </Field>
              <Switch name="allDay" label="Dia inteiro" checked={allDay} onCheckedChange={setAllDay} />
              {allDay ? null : (
                <FieldRow className="!grid-cols-2 gap-3">
                  <Field name="startTime" label="Início" required>
                    <TimeInput defaultValue={startTime ?? "09:00"} />
                  </Field>
                  <Field name="endTime" label="Fim" optional>
                    <TimeInput defaultValue={endTime ?? ""} />
                  </Field>
                </FieldRow>
              )}
              {scope("Reagendar")}
              <FormFeedback confirmLabel="Reagendar mesmo assim" />
              <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
                <DialogClose>
                  <Button variant="secondary">Voltar</Button>
                </DialogClose>
                <SubmitButton pendingLabel="Salvando…">Reagendar</SubmitButton>
              </div>
            </ActionForm>
          </Dialog>
          <ConfirmDialog
            trigger={
              <Button variant="secondary" icon={<Copy />}>
                Duplicar
              </Button>
            }
            title="Duplicar este compromisso?"
            description="Cria uma cópia avulsa (sem repetição e sem anexos) no mesmo dia, marcada como “a confirmar”, e abre a edição para você ajustar."
            confirmLabel="Duplicar"
            tone="primary"
            action={duplicateEventAction}
            hidden={hidden}
          />
          {status !== "concluido" && status !== "cancelado" ? (
            <ConfirmDialog
              trigger={
                <Button variant="ghost" icon={<CircleCheck />}>
                  Concluir
                </Button>
              }
              title="Marcar como concluído?"
              confirmLabel="Marcar como concluído"
              tone="primary"
              action={setEventStatusAction}
              hidden={{ ...hidden, status: "concluido" }}
            >
              {scope("Concluir")}
            </ConfirmDialog>
          ) : null}
          {status === "cancelado" ? (
            <ConfirmDialog
              trigger={
                <Button variant="ghost" icon={<RotateCcw />}>
                  Reativar
                </Button>
              }
              title="Reativar este compromisso?"
              description="Ele volta para a agenda como confirmado."
              confirmLabel="Reativar"
              tone="primary"
              action={setEventStatusAction}
              hidden={{ ...hidden, status: "confirmado" }}
            >
              {scope("Reativar")}
            </ConfirmDialog>
          ) : (
            <ConfirmDialog
              trigger={
                <Button variant="danger-ghost" icon={<Ban />}>
                  Cancelar
                </Button>
              }
              title="Cancelar este compromisso?"
              description="Ele continua na agenda, riscado, e deixa de contar como horário ocupado. Dá para reativar depois."
              confirmLabel="Cancelar compromisso"
              cancelLabel="Voltar"
              action={setEventStatusAction}
              hidden={{ ...hidden, status: "cancelado" }}
            >
              {scope("Cancelar")}
            </ConfirmDialog>
          )}
        </>
      ) : null}
      {canDelete ? (
        <ConfirmDialog
          trigger={
            <Button variant="danger-ghost" icon={<Trash2 />}>
              Excluir
            </Button>
          }
          title="Excluir este compromisso?"
          description="Ele sai da agenda e não dá para desfazer. Se a ideia é só registrar que não vai acontecer, prefira cancelar."
          confirmLabel="Excluir"
          cancelLabel="Voltar"
          action={deleteEventAction}
          hidden={hidden}
        >
          {scope("Excluir")}
        </ConfirmDialog>
      ) : null}
    </div>
  );
}

type Item = { id: string; text: string; done: boolean };

/** Checklist marcável direto no detalhe (grava na hora). Sem permissão de edição, só mostra. */
export function ChecklistToggles({ eventId, list, items, canEdit, label }: { eventId: number; list: "checklist" | "prep"; items: Item[]; canEdit: boolean; label: string }) {
  const [state, setState] = useState(items);
  const [pending, startTransition] = useTransition();
  const done = state.filter((item) => item.done).length;

  const toggle = (item: Item, checked: boolean) => {
    const before = state;
    setState(state.map((other) => (other.id === item.id ? { ...other, done: checked } : other)));
    startTransition(async () => {
      const data = new FormData();
      data.set("id", String(eventId));
      data.set("list", list);
      data.set("itemId", item.id);
      if (checked) data.set("done", "on");
      const result = await toggleChecklistItemAction(initialActionState, data);
      if (!result.ok) {
        setState(before);
        toast.error(result.message ?? "Não foi possível salvar. Tente de novo.");
      }
    });
  };

  return (
    <div>
      <p className="text-texto-suave mb-2 text-[0.8125rem] font-semibold" aria-live="polite">
        {done} de {state.length} {state.length === 1 ? "item feito" : "itens feitos"}
      </p>
      <ul aria-label={label} className={cn("divide-borda border-borda divide-y rounded-campo border", pending && "opacity-80")}>
        {state.map((item) => (
          <li key={item.id}>
            <label className={cn("flex min-h-11 items-start gap-3 px-3 py-2.5", canEdit && "hover:bg-superficie-alta cursor-pointer")}>
              <input type="checkbox" className="checkbox mt-px" checked={item.done} disabled={!canEdit} onChange={(event) => toggle(item, event.target.checked)} />
              <span className={cn("text-texto min-w-0 text-sm leading-snug break-words", item.done && "text-texto-suave line-through")}>{item.text}</span>
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}
