import { ButtonLink } from "@/components/ui/button";
import {
  ActionForm,
  Field,
  FieldRow,
  FormActions,
  SubmitButton,
  type FormAction,
} from "@/components/ui/form";
import { DateInput, Input, Select, Textarea } from "@/components/ui/input";
import { AGENDA_KIND_LABELS } from "@/lib/domain";
import type { Option } from "@/server/options";
import { EventTimeFields } from "./event-time-fields";

export type EventFormValues = {
  title: string;
  kind: string;
  date: string;
  startTime: string | null;
  endTime: string | null;
  location: string;
  clientId: number | null;
  projectId: number | null;
  ownerId: number | null;
  notes: string;
};

type Props = {
  action: FormAction;
  /** Só na edição. */
  id?: number;
  values: EventFormValues;
  clients: Option[];
  projects: Option[];
  users: Option[];
  submitLabel: string;
  cancelHref: string;
};

/** Formulário de compromisso (criar e editar). Server Component: só o kit e os horários são "use client". */
export function EventForm({
  action,
  id,
  values,
  clients,
  projects,
  users,
  submitLabel,
  cancelHref,
}: Props) {
  return (
    <ActionForm action={action} hidden={{ id }}>
      <Field name="title" label="Título" required>
        <Input
          autoComplete="off"
          maxLength={160}
          defaultValue={values.title}
          placeholder="Ex.: Gravação do casamento da Ana e do Bruno"
        />
      </Field>
      <FieldRow>
        <Field name="kind" label="Tipo" required>
          <Select options={AGENDA_KIND_LABELS} defaultValue={values.kind} />
        </Field>
        <Field name="date" label="Data" required>
          <DateInput defaultValue={values.date} />
        </Field>
      </FieldRow>
      <EventTimeFields
        defaultAllDay={values.startTime === null}
        defaultStart={values.startTime}
        defaultEnd={values.endTime}
      />
      <Field name="location" label="Local" optional>
        <Input
          autoComplete="off"
          maxLength={200}
          defaultValue={values.location}
          placeholder="Endereço ou link da reunião"
        />
      </Field>
      <FieldRow cols={3}>
        <Field name="clientId" label="Cliente" optional>
          <Select
            options={clients}
            placeholder="Nenhum"
            defaultValue={values.clientId ?? ""}
          />
        </Field>
        <Field name="projectId" label="Projeto" optional>
          <Select
            options={projects}
            placeholder="Nenhum"
            defaultValue={values.projectId ?? ""}
          />
        </Field>
        <Field name="ownerId" label="Responsável" optional>
          <Select
            options={users}
            placeholder="Ninguém"
            defaultValue={values.ownerId ?? ""}
          />
        </Field>
      </FieldRow>
      <Field
        name="notes"
        label="Observações"
        optional
        hint="Combinados, o que levar, contato no local…"
      >
        <Textarea rows={3} maxLength={4000} defaultValue={values.notes} />
      </Field>
      <FormActions>
        <SubmitButton pendingLabel="Salvando…">{submitLabel}</SubmitButton>
        <ButtonLink href={cancelHref} variant="ghost">
          Cancelar
        </ButtonLink>
      </FormActions>
    </ActionForm>
  );
}
