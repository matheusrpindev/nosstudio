import { ButtonLink } from "@/components/ui/button";
import { ActionForm, Field, FieldRow, FormActions, SubmitButton, type FormAction } from "@/components/ui/form";
import { DateInput, Input, Select, Textarea } from "@/components/ui/input";
import { MarkdownField } from "@/components/ui/markdown-field";
import { APPROVAL_STATUS_LABELS, CONTENT_FORMAT_LABELS, CONTENT_NETWORK_LABELS, CONTENT_STATUS_LABELS } from "@/lib/domain";
import type { Option } from "@/server/options";
import { CaptionField } from "./caption-field";
import { NOS_ACCOUNT_LABEL } from "./ui";

export type ContentFormValues = {
  title: string;
  clientId: number | null;
  network: string;
  format: string;
  status: string;
  ideaNotes: string;
  script: string;
  caption: string;
  cta: string;
  recordDate: string | null;
  editDeadline: string | null;
  publishDate: string | null;
  approvalStatus: string;
  ownerId: number | null;
  assetUrl: string;
  notes: string;
};

type Props = {
  action: FormAction;
  /** Só na edição. */
  id?: number;
  values: ContentFormValues;
  clients: Option[];
  users: Option[];
  submitLabel: string;
  cancelHref: string;
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-5">
      <h2 className="text-grafite border-areia border-b pb-2 text-base font-bold">{title}</h2>
      {children}
    </section>
  );
}

/** Formulário de item de conteúdo (criar e editar). Server Component: só o kit e o contador da legenda são "use client". */
export function ContentForm({ action, id, values, clients, users, submitLabel, cancelHref }: Props) {
  return (
    <ActionForm action={action} hidden={{ id }} className="space-y-8">
      <Section title="Tema e conta">
        <Field name="title" label="Tema" required>
          <Input autoComplete="off" maxLength={160} defaultValue={values.title} placeholder="Ex.: Bastidores da gravação de um casamento" />
        </Field>
        <FieldRow>
          <Field name="clientId" label="Conta" hint="De quem é: da própria NÓS ou de um cliente.">
            <Select
              options={[{ value: "", label: NOS_ACCOUNT_LABEL }, ...clients]}
              defaultValue={values.clientId === null ? "" : String(values.clientId)}
            />
          </Field>
          <Field name="ownerId" label="Responsável" optional>
            <Select options={users} placeholder="Sem responsável" defaultValue={values.ownerId === null ? "" : String(values.ownerId)} />
          </Field>
        </FieldRow>
        <FieldRow>
          <Field name="network" label="Rede" required>
            <Select options={CONTENT_NETWORK_LABELS} defaultValue={values.network} />
          </Field>
          <Field name="format" label="Formato" required>
            <Select options={CONTENT_FORMAT_LABELS} defaultValue={values.format} />
          </Field>
        </FieldRow>
      </Section>

      <Section title="Andamento">
        <FieldRow>
          <Field name="status" label="Status" required hint="Ao marcar como Publicado sem data, usamos a de hoje.">
            <Select options={CONTENT_STATUS_LABELS} defaultValue={values.status} />
          </Field>
          <Field name="approvalStatus" label="Aprovação" required>
            <Select options={APPROVAL_STATUS_LABELS} defaultValue={values.approvalStatus} />
          </Field>
        </FieldRow>
        <FieldRow cols={3}>
          <Field name="recordDate" label="Gravação" optional>
            <DateInput defaultValue={values.recordDate ?? ""} />
          </Field>
          <Field name="editDeadline" label="Prazo de edição" optional>
            <DateInput defaultValue={values.editDeadline ?? ""} />
          </Field>
          <Field name="publishDate" label="Publicação" optional hint="Sem data, o item fica só na lista de ideias.">
            <DateInput defaultValue={values.publishDate ?? ""} />
          </Field>
        </FieldRow>
      </Section>

      <Section title="Ideia, roteiro e legenda">
        <Field name="ideaNotes" label="Anotações da ideia" optional hint="Referências, por que esse tema, ideias soltas.">
          <Textarea rows={3} maxLength={4000} defaultValue={values.ideaNotes} />
        </Field>
        <MarkdownField name="script" label="Roteiro" optional rows={8} maxLength={10000} defaultValue={values.script} hint="Cena a cena, falas, tempo de cada trecho." />
        <CaptionField defaultValue={values.caption} />
        <Field name="cta" label="Chamada para ação (CTA)" optional hint="O que a pessoa deve fazer depois: chamar no WhatsApp, salvar, comentar…">
          <Input autoComplete="off" maxLength={300} defaultValue={values.cta} />
        </Field>
      </Section>

      <Section title="Material e observações">
        <Field name="assetUrl" label="Link do material" optional hint="Canva, Google Drive, CapCut… Cole o link da pasta ou do arquivo.">
          <Input type="text" inputMode="url" autoComplete="off" autoCapitalize="none" maxLength={500} defaultValue={values.assetUrl} placeholder="https://" />
        </Field>
        <Field name="notes" label="Observações" optional>
          <Textarea rows={3} maxLength={4000} defaultValue={values.notes} />
        </Field>
      </Section>

      <p className="text-cinza text-[0.8125rem]">Este espaço é só para organização interna: nada é publicado nas redes sociais a partir do painel.</p>

      <FormActions>
        <SubmitButton pendingLabel="Salvando…">{submitLabel}</SubmitButton>
        <ButtonLink href={cancelHref} variant="ghost">
          Cancelar
        </ButtonLink>
      </FormActions>
    </ActionForm>
  );
}
