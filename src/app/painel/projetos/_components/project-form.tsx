import Link from "next/link";
import { Alert } from "@/components/ui/alert";
import { ButtonLink } from "@/components/ui/button";
import { ActionForm, Field, FieldRow, FormActions, SubmitButton } from "@/components/ui/form";
import { DateInput, Input, Select } from "@/components/ui/input";
import { MarkdownField } from "@/components/ui/markdown-field";
import { BACKUP_STATUS_LABELS, PROJECT_STAGE_LABELS, SERVICE_INTEREST_LABELS } from "@/lib/domain";
import type { ActionState } from "@/lib/action-state";
import type { LabeledLink } from "@/db/schema";
import type { Option } from "@/server/options";
import type { ProjectInput } from "@/server/projects/admin";
import { ExtraLinksField } from "./links-field";

type Defaults = Omit<ProjectInput, "proposalId"> & { proposalId?: number | null };

type Props = {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  defaults: Defaults;
  clients: Option[];
  users: Option[];
  /** Presente na edição. */
  projectId?: number;
  cancelHref: string;
  submitLabel: string;
  /** Aviso acima do formulário (ex.: "Dados trazidos da proposta 2026-007"). */
  notice?: React.ReactNode;
};

/** Formulário de projeto (criação e edição). Server Component: só monta os campos; o envio é do `ActionForm`. */
export function ProjectForm({ action, defaults, clients, users, projectId, cancelHref, submitLabel, notice }: Props) {
  return (
    <ActionForm action={action} hidden={{ id: projectId, proposalId: defaults.proposalId }} className="space-y-6" success="none">
      {notice}

      <section aria-labelledby="dados-titulo" className="card space-y-4 p-4 sm:p-6">
        <h2 id="dados-titulo" className="text-texto text-lg font-bold">
          Dados do projeto
        </h2>
        <Field name="title" label="Nome do projeto" required>
          <Input maxLength={160} defaultValue={defaults.title} placeholder="Ex.: Casamento Ana e Bruno" />
        </Field>
        <FieldRow>
          <Field name="clientId" label="Cliente" hint={projectId ? undefined : "Ao criar o projeto, o cliente passa para “Em produção” no funil."} optional>
            <Select options={clients} placeholder="Sem cliente" defaultValue={defaults.clientId ? String(defaults.clientId) : ""} />
          </Field>
          <Field name="serviceType" label="Tipo de serviço" required>
            <Select options={SERVICE_INTEREST_LABELS} defaultValue={defaults.serviceType} />
          </Field>
        </FieldRow>
        <FieldRow>
          <Field name="stage" label="Etapa" required>
            <Select options={PROJECT_STAGE_LABELS} defaultValue={defaults.stage} />
          </Field>
          <Field name="ownerId" label="Responsável" optional>
            <Select options={users} placeholder="Sem responsável" defaultValue={defaults.ownerId ? String(defaults.ownerId) : ""} />
          </Field>
        </FieldRow>
        <Field name="location" label="Local" optional>
          <Input maxLength={200} defaultValue={defaults.location} placeholder="Ex.: Espaço Villa, Belo Horizonte" />
        </Field>
        <FieldRow cols={2}>
          <Field name="eventDate" label="Data do evento / gravação principal" optional>
            <DateInput defaultValue={defaults.eventDate ?? ""} />
          </Field>
          <Field name="shootDeadline" label="Prazo de gravação" optional>
            <DateInput defaultValue={defaults.shootDeadline ?? ""} />
          </Field>
        </FieldRow>
        <FieldRow cols={2}>
          <Field name="deliveryDeadline" label="Prazo de entrega" optional>
            <DateInput defaultValue={defaults.deliveryDeadline ?? ""} />
          </Field>
          <Field name="deliveredAt" label="Entregue em" optional hint="Preenchida sozinha ao marcar a etapa como Entregue.">
            <DateInput defaultValue={defaults.deliveredAt ?? ""} />
          </Field>
        </FieldRow>
      </section>

      <section aria-labelledby="arquivos-titulo" className="card space-y-4 p-4 sm:p-6">
        <div>
          <h2 id="arquivos-titulo" className="text-texto text-lg font-bold">
            Arquivos e entregas
          </h2>
          <p className="text-texto-suave mt-1 text-sm">Não guardamos vídeos aqui: cole os links do Google Drive, da galeria, etc.</p>
        </div>
        <Field name="driveUrl" label="Pasta no Google Drive" optional>
          <Input type="url" inputMode="url" maxLength={500} defaultValue={defaults.driveUrl} placeholder="https://drive.google.com/…" />
        </Field>
        <FieldRow>
          <Field name="galleryUrl" label="Galeria" optional>
            <Input type="url" inputMode="url" maxLength={500} defaultValue={defaults.galleryUrl} placeholder="https://…" />
          </Field>
          <Field name="referencesUrl" label="Referências" optional>
            <Input type="url" inputMode="url" maxLength={500} defaultValue={defaults.referencesUrl} placeholder="https://…" />
          </Field>
        </FieldRow>
        <Field name="finalFilesUrl" label="Arquivos finais" optional>
          <Input type="url" inputMode="url" maxLength={500} defaultValue={defaults.finalFilesUrl} placeholder="https://…" />
        </Field>
        <ExtraLinksField defaultValue={defaults.links as LabeledLink[]} />
        <FieldRow>
          <Field name="backupStatus" label="Situação do backup" required>
            <Select options={BACKUP_STATUS_LABELS} defaultValue={defaults.backupStatus} />
          </Field>
          <Field name="backupNote" label="Nota do backup" optional hint="Ex.: HD externo do Pedro + nuvem.">
            <Input maxLength={500} defaultValue={defaults.backupNote} />
          </Field>
        </FieldRow>
      </section>

      <section aria-labelledby="obs-titulo" className="card p-4 sm:p-6">
        <h2 id="obs-titulo" className="sr-only">
          Observações
        </h2>
        <MarkdownField name="notes" label="Observações" optional defaultValue={defaults.notes} rows={6} maxLength={5000} hint="Combinados com o cliente, detalhes de produção, lembretes." />
      </section>

      <FormActions>
        <SubmitButton pendingLabel="Salvando…">{submitLabel}</SubmitButton>
        <ButtonLink href={cancelHref} variant="ghost">
          Cancelar
        </ButtonLink>
      </FormActions>
    </ActionForm>
  );
}

export function ProposalNotice({ number, title, existing }: { number: string; title: string; existing: { id: number; title: string } | null }) {
  return (
    <>
      <Alert tone="info" title="Dados trazidos da proposta">
        Preenchemos o formulário com as informações da proposta {number} ({title}). Confira e ajuste o que precisar.
      </Alert>
      {existing ? (
        <Alert tone="alerta" title="Esta proposta já tem um projeto">
          <Link href={`/painel/projetos/${existing.id}`} className="link">
            {existing.title}
          </Link>{" "}
          foi criado a partir dela. Só crie outro se for de fato um trabalho separado.
        </Alert>
      ) : null}
    </>
  );
}
