"use client";

import { Lock } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Alert } from "@/components/ui/alert";
import { ButtonLink } from "@/components/ui/button";
import { ActionForm, Field, FieldRow, SubmitButton, type FormAction } from "@/components/ui/form";
import { DateInput, Input, RadioCards, Select, Textarea, TimeInput } from "@/components/ui/input";
import { StringListField } from "@/components/ui/list-fields";
import type { MediaValue } from "@/components/ui/media-fields";
import { Switch } from "@/components/ui/switch";
import type { Recurrence } from "@/lib/agenda/recurrence";
import { formatDate, type ISODate } from "@/lib/dates";
import { AGENDA_PRIORITY_LABELS, AGENDA_SERIES_SCOPE_LABELS, AGENDA_STATUS_LABELS, type AgendaPriority, type AgendaSeriesScope, type AgendaStatus } from "@/lib/domain";
import type { EventActionData } from "./actions";
import { FormFeedback } from "./feedback";
import { AttachmentsField, ChecklistField, PeopleField, RecurrenceField, RemindersField, type ChecklistItem, type ChecklistTemplate, type Reminder } from "./form-fields";

type Option = { value: number; label: string };

export type EventFormValues = {
  title: string;
  categoryId: number | null;
  calendarId: number | null;
  description: string;
  date: ISODate;
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
  particular: boolean;
  checklist: ChecklistItem[];
  notes: string;
  reminders: Reminder[];
  recurrence: Recurrence | null;
  responsibleIds: number[];
  participantIds: number[];
  externalPeople: string[];
  production: {
    address: string;
    crewArrival: string | null;
    script: string;
    references: string;
    equipment: string;
    contentCount: number | null;
    estimatedMinutes: number | null;
    editDeadline: string | null;
    deliveryDate: string | null;
    prepChecklist: ChecklistItem[];
  } | null;
};

export type EventFormCategory = { id: number; name: string; isProduction: boolean; blocksDay: boolean };

type Props = {
  action: FormAction<EventActionData>;
  /** Só na edição. */
  id?: number;
  values: EventFormValues;
  categories: EventFormCategory[];
  calendars: Option[];
  clients: Option[];
  projects: Option[];
  people: Option[];
  templates: ChecklistTemplate[];
  attachments: MediaValue[];
  /** Edição de uma série: o dia da ocorrência aberta e o resumo da repetição. */
  series?: { occurrence: ISODate; summary: string; first: boolean } | null;
  /** Ocorrência já separada de uma série (não vira outra série). */
  detached?: boolean;
  submitLabel: string;
  cancelHref: string;
  /** Para onde voltar depois de salvar (URL da agenda). */
  returnTo?: string;
};

function Section({ title, description, children, id }: { title: string; description?: ReactNode; children: ReactNode; id: string }) {
  return (
    <section id={id} aria-labelledby={`${id}-titulo`} className="card card-pad scroll-mt-4">
      <div className="mb-4">
        <h2 id={`${id}-titulo`} className="text-texto text-base leading-snug font-bold">
          {title}
        </h2>
        {description ? <p className="text-texto-suave mt-0.5 text-sm leading-relaxed">{description}</p> : null}
      </div>
      <div className="space-y-5">{children}</div>
    </section>
  );
}

const hoursOf = (minutes: number | null) => (minutes === null ? "" : String(Math.round((minutes / 60) * 100) / 100).replace(".", ","));

/** Formulário completo de compromisso (criar e editar), em seções. */
export function EventForm({ action, id, values, categories, calendars, clients, projects, people, templates, attachments, series, detached, submitLabel, cancelHref, returnTo }: Props) {
  const [categoryId, setCategoryId] = useState<number | null>(values.categoryId);
  const [date, setDate] = useState(values.date);
  const [allDay, setAllDay] = useState(values.startTime === null);
  const [multiDay, setMultiDay] = useState(values.endDate !== null);
  const [particular, setParticular] = useState(values.particular);
  const [scope, setScope] = useState<AgendaSeriesScope>("este");
  const category = categories.find((item) => item.id === categoryId) ?? null;
  const production = values.production;
  const editingOne = Boolean(series) && scope === "este";

  return (
    <ActionForm<EventActionData> action={action} hidden={{ id, occurrence: series?.occurrence, voltar: returnTo }} hideError className="space-y-4">
      {series ? (
        <Alert tone="info" title="Este compromisso se repete">
          <p>
            {series.summary}. Você abriu a ocorrência de <strong>{formatDate(series.occurrence)}</strong>. Aplicar as alterações a:
          </p>
          <Field name="scope" label="Aplicar as alterações a" group hideLabel className="mt-3">
            <RadioCards
              value={scope}
              onValueChange={(value) => setScope(value as AgendaSeriesScope)}
              cols={3}
              compact
              options={[
                { value: "este", label: AGENDA_SERIES_SCOPE_LABELS.este },
                { value: "seguintes", label: AGENDA_SERIES_SCOPE_LABELS.seguintes, disabled: series.first },
                { value: "todos", label: AGENDA_SERIES_SCOPE_LABELS.todos },
              ]}
            />
          </Field>
        </Alert>
      ) : null}

      <Section id="sec-essencial" title="Essencial">
        <Field name="title" label="Título" required>
          <Input autoComplete="off" maxLength={160} defaultValue={values.title} placeholder="Ex.: Gravação do casamento da Ana e do Bruno" />
        </Field>
        <FieldRow>
          <Field name="categoryId" label="Categoria" required hint={category?.blocksDay ? "Em dia inteiro, esta categoria deixa as pessoas ocupadas (entra no aviso de conflito)." : undefined}>
            <Select
              options={categories.map((item) => ({ value: item.id, label: item.name }))}
              value={categoryId ?? ""}
              onChange={(event) => setCategoryId(Number(event.target.value) || null)}
            />
          </Field>
          <Field name="calendarId" label="Agenda" required>
            <Select options={calendars} defaultValue={values.calendarId ?? ""} />
          </Field>
        </FieldRow>
        <FieldRow>
          <Field name="date" label={multiDay ? "Primeiro dia" : "Data"} required>
            <DateInput value={date} onChange={(event) => setDate(event.target.value)} />
          </Field>
          {multiDay ? (
            <Field name="endDate" label="Último dia" required>
              <DateInput defaultValue={values.endDate ?? date} min={date || undefined} />
            </Field>
          ) : null}
        </FieldRow>
        <div className="grid gap-x-6 sm:grid-cols-2">
          <Switch name="allDay" label="Dia inteiro" hint="Sem horário marcado." checked={allDay} onCheckedChange={setAllDay} />
          <Switch label="Dura mais de um dia" hint="Viagem, evento de fim de semana, férias." checked={multiDay} onCheckedChange={setMultiDay} />
        </div>
        {allDay ? null : (
          <FieldRow className="!grid-cols-2">
            <Field name="startTime" label="Início" required>
              <TimeInput defaultValue={values.startTime ?? "09:00"} />
            </Field>
            <Field name="endTime" label="Fim" optional>
              <TimeInput defaultValue={values.endTime ?? ""} />
            </Field>
          </FieldRow>
        )}
        <Field name="description" label="Descrição" optional>
          <Textarea rows={3} maxLength={6000} defaultValue={values.description} placeholder="Pauta, combinados, o que levar…" />
        </Field>
        <FieldRow>
          <Field name="status" label="Status">
            <Select options={AGENDA_STATUS_LABELS} defaultValue={values.status} />
          </Field>
          <Field name="priority" label="Prioridade">
            <Select options={AGENDA_PRIORITY_LABELS} defaultValue={values.priority} />
          </Field>
        </FieldRow>
      </Section>

      <Section id="sec-pessoas" title="Pessoas">
        <PeopleField options={people} defaultResponsible={values.responsibleIds} defaultParticipants={values.participantIds} />
        <StringListField
          name="externalPeople"
          label="Participantes externos"
          defaultValue={values.externalPeople}
          placeholder="Nome (ex.: Ana, noiva)"
          addLabel="Adicionar"
          max={30}
          maxLength={120}
          hint="Clientes, fornecedores, convidados: só o nome, sem acesso ao painel."
        />
      </Section>

      <Section id="sec-local" title="Local e links">
        <Field name="location" label="Local" optional>
          <Input autoComplete="off" maxLength={300} defaultValue={values.location} placeholder="Endereço ou nome do lugar" />
        </Field>
        <FieldRow>
          <Field name="mapUrl" label="Link do mapa" optional>
            <Input type="url" inputMode="url" autoComplete="off" maxLength={500} defaultValue={values.mapUrl} placeholder="https://maps.app.goo.gl/…" />
          </Field>
          <Field name="meetingUrl" label="Link da reunião virtual" optional>
            <Input type="url" inputMode="url" autoComplete="off" maxLength={500} defaultValue={values.meetingUrl} placeholder="https://meet.google.com/…" />
          </Field>
        </FieldRow>
      </Section>

      <Section id="sec-cliente" title="Cliente e projeto">
        <FieldRow>
          <Field name="clientId" label="Cliente" optional>
            <Select options={clients} placeholder="Nenhum" defaultValue={values.clientId ?? ""} />
          </Field>
          <Field name="projectId" label="Projeto" optional>
            <Select options={projects} placeholder="Nenhum" defaultValue={values.projectId ?? ""} />
          </Field>
        </FieldRow>
      </Section>

      {detached || editingOne ? (
        <section className="card card-pad">
          <h2 className="text-texto text-base font-bold">Repetição</h2>
          <p className="text-texto-suave mt-1 text-sm leading-relaxed">
            {detached
              ? "Esta é uma ocorrência que foi separada de uma série: ela não se repete."
              : "Você está alterando só esta ocorrência: ela se separa da série e as outras continuam como estão. Para mudar a repetição, escolha “Este e os seguintes” ou “Todos da série” no topo."}
          </p>
          {/* a regra continua indo no formulário (o servidor a ignora para "só este") */}
          {values.recurrence && !detached ? <input type="hidden" name="recurrence" value={JSON.stringify(values.recurrence)} /> : null}
        </section>
      ) : (
        <Section id="sec-repeticao" title="Repetição">
          <RecurrenceField defaultValue={values.recurrence} date={date} />
        </Section>
      )}

      <Section id="sec-lembretes" title="Lembretes" description="Na hora marcada, os responsáveis e participantes recebem o aviso no sino do painel — e também por e-mail, quando o canal for e-mail.">
        <RemindersField defaultValue={values.reminders} />
      </Section>

      <Section id="sec-checklist" title="Checklist">
        <ChecklistField name="checklist" label="Itens" defaultValue={values.checklist} templates={templates} categoryId={categoryId} />
      </Section>

      {category?.isProduction ? (
        <Section id="sec-gravacao" title="Planejamento de gravação" description={`Aparece porque a categoria “${category.name}” é de produção.`}>
          <FieldRow>
            <Field name="prodAddress" label="Endereço da gravação" optional>
              <Input autoComplete="off" maxLength={300} defaultValue={production?.address ?? ""} placeholder="Rua, número, bairro, cidade" />
            </Field>
            <Field name="prodArrival" label="Chegada da equipe" optional hint="Horário em que a equipe precisa estar no local.">
              <TimeInput defaultValue={production?.crewArrival ?? ""} />
            </Field>
          </FieldRow>
          <Field name="prodScript" label="Roteiro" optional>
            <Textarea rows={4} maxLength={10000} defaultValue={production?.script ?? ""} placeholder="Cenas, falas, ordem do dia…" />
          </Field>
          <FieldRow>
            <Field name="prodReferences" label="Referências" optional>
              <Textarea rows={3} maxLength={4000} defaultValue={production?.references ?? ""} placeholder="Links e descrições de referência" />
            </Field>
            <Field name="prodEquipment" label="Equipamentos" optional>
              <Textarea rows={3} maxLength={4000} defaultValue={production?.equipment ?? ""} placeholder="Câmeras, lentes, áudio, luz, baterias, cartões…" />
            </Field>
          </FieldRow>
          <FieldRow>
            <Field name="prodContentCount" label="Conteúdos previstos" optional hint="Quantidade de vídeos, fotos ou peças.">
              <Input type="number" inputMode="numeric" min={0} max={9999} defaultValue={production?.contentCount ?? ""} />
            </Field>
            <Field name="prodEstimatedHours" label="Tempo estimado (horas)" optional>
              <Input inputMode="decimal" maxLength={6} defaultValue={hoursOf(production?.estimatedMinutes ?? null)} placeholder="Ex.: 3 ou 2,5" />
            </Field>
          </FieldRow>
          <FieldRow>
            <Field name="prodEditDeadline" label="Prazo de edição" optional>
              <DateInput defaultValue={production?.editDeadline ?? ""} />
            </Field>
            <Field name="prodDeliveryDate" label="Data de entrega" optional>
              <DateInput defaultValue={production?.deliveryDate ?? ""} />
            </Field>
          </FieldRow>
          <ChecklistField name="prodChecklist" label="Checklist de preparação" defaultValue={production?.prepChecklist ?? []} templates={templates} categoryId={categoryId} placeholder="Ex.: Carregar baterias" />
        </Section>
      ) : null}

      <Section id="sec-anexos" title="Anexos">
        <AttachmentsField defaultValue={attachments} />
      </Section>

      <Section id="sec-privacidade" title="Privacidade">
        <Switch
          name="particular"
          label="Compromisso particular"
          hint="As outras pessoas veem só “Ocupado” no horário — sem título, local, cliente, links, anexos nem participantes. Quem está no compromisso vê tudo."
          checked={particular}
          onCheckedChange={setParticular}
        />
        {particular ? (
          <p className="text-texto-suave flex items-start gap-2 text-sm">
            <Lock aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            Só você e as pessoas marcadas em “Pessoas” conseguem abrir, editar ou excluir este compromisso.
          </p>
        ) : null}
      </Section>

      <Section id="sec-notas" title="Observações internas">
        <Field name="notes" label="Observações internas" hideLabel hint="Só a equipe do painel vê.">
          <Textarea rows={3} maxLength={6000} defaultValue={values.notes} placeholder="Combinados internos, pendências, contato no local…" />
        </Field>
      </Section>

      <div className="border-borda sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-10 space-y-3 rounded-cartao border bg-superficie-alta p-3 lg:bottom-4">
        <FormFeedback />
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <SubmitButton pendingLabel="Salvando…">{submitLabel}</SubmitButton>
          <ButtonLink href={cancelHref} variant="ghost">
            Cancelar
          </ButtonLink>
        </div>
      </div>
    </ActionForm>
  );
}
