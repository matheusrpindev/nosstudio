import { ButtonLink } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { ActionForm, Field, FieldRow, FormActions, SubmitButton, type FormAction } from "@/components/ui/form";
import { DateInput, Input, Select, Textarea } from "@/components/ui/input";
import { FileField } from "@/components/ui/media-fields";
import { MarkdownField } from "@/components/ui/markdown-field";
import { CONTRACT_KIND_LABELS, CONTRACT_STATUS_LABELS, type ContractKind, type ContractStatus } from "@/lib/domain";
import type { MediaValue } from "@/server/media";
import type { Option } from "@/server/options";

export type ContractFormValues = {
  title: string;
  kind: ContractKind;
  versionLabel: string;
  clientId: number | null;
  projectId: number | null;
  proposalId: number | null;
  status: ContractStatus;
  signedAt: string | null;
  validFrom: string | null;
  validUntil: string | null;
  externalUrl: string;
  body: string;
  notes: string;
};

const asOptions = (list: Option[]) => list.map((o) => ({ value: String(o.value), label: o.label }));

/** Formulário de cadastro e edição de contrato. Server Component: só o kit é "use client". */
export function ContractForm({
  action,
  id,
  values,
  file,
  clients,
  projects,
  proposals,
  cancelHref,
  submitLabel,
  formKey,
}: {
  action: FormAction;
  id?: number;
  values: ContractFormValues;
  file: MediaValue | null;
  clients: Option[];
  projects: Option[];
  proposals: Option[];
  cancelHref: string;
  submitLabel: string;
  formKey?: string;
}) {
  return (
    <ActionForm key={formKey} action={action} hidden={id ? { id } : undefined} className="space-y-4">
      <Card as="section" aria-labelledby="dados-titulo" className="space-y-5">
        <CardHeader id="dados-titulo" title="Dados do contrato" />
        <Field name="title" label="Título" hint="Ex.: Contrato mensal — Studio Aurora" required>
          <Input autoComplete="off" maxLength={160} defaultValue={values.title} />
        </Field>
        <FieldRow>
          <Field name="kind" label="Tipo" required>
            <Select options={CONTRACT_KIND_LABELS} defaultValue={values.kind} />
          </Field>
          <Field name="versionLabel" label="Versão" hint="Ex.: v1, 2026-A" optional>
            <Input autoComplete="off" maxLength={40} defaultValue={values.versionLabel} />
          </Field>
        </FieldRow>
        <FieldRow>
          <Field name="status" label="Status" required>
            <Select options={CONTRACT_STATUS_LABELS} defaultValue={values.status} />
          </Field>
          <Field name="signedAt" label="Data da assinatura" optional>
            <DateInput defaultValue={values.signedAt ?? ""} />
          </Field>
        </FieldRow>
        <FieldRow>
          <Field name="validFrom" label="Vigência: de" optional>
            <DateInput defaultValue={values.validFrom ?? ""} />
          </Field>
          <Field name="validUntil" label="Vigência: até" optional>
            <DateInput defaultValue={values.validUntil ?? ""} />
          </Field>
        </FieldRow>
      </Card>

      <Card as="section" aria-labelledby="vinculos-titulo" className="space-y-5">
        <CardHeader id="vinculos-titulo" title="Vínculos" description="O cliente é obrigatório, exceto no acordo entre sócios." />
        <Field name="clientId" label="Cliente" optional>
          <Select options={asOptions(clients)} placeholder="Sem cliente" defaultValue={values.clientId ? String(values.clientId) : ""} />
        </Field>
        <FieldRow>
          <Field name="projectId" label="Projeto" optional>
            <Select options={asOptions(projects)} placeholder="Sem projeto" defaultValue={values.projectId ? String(values.projectId) : ""} />
          </Field>
          <Field name="proposalId" label="Proposta" optional>
            <Select options={asOptions(proposals)} placeholder="Sem proposta" defaultValue={values.proposalId ? String(values.proposalId) : ""} />
          </Field>
        </FieldRow>
      </Card>

      <Card as="section" aria-labelledby="arquivo-titulo" className="space-y-5">
        <CardHeader id="arquivo-titulo" title="Documento assinado" description="Anexe o PDF assinado (fica privado, só abre com login) e/ou informe o link da pasta ou do documento." />
        <FileField name="fileMediaId" label="Arquivo assinado" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg" defaultValue={file} />
        <Field name="externalUrl" label="Link externo" hint="Google Drive, ClickSign, e-mail com o PDF… Opcional." optional>
          <Input type="url" inputMode="url" autoComplete="off" autoCapitalize="none" maxLength={500} placeholder="https://" defaultValue={values.externalUrl} />
        </Field>
      </Card>

      <Card as="section" aria-labelledby="texto-titulo" className="space-y-5">
        <CardHeader id="texto-titulo" title="Texto do contrato" description="Escolha um modelo no topo da página para copiar o texto, ou escreva à mão. Dá para imprimir na tela do contrato." />
        <MarkdownField name="body" label="Texto" defaultValue={values.body} rows={16} optional maxLength={80000} />
        <Field name="notes" label="Observações internas" hint="Só você e seu sócio veem isto." optional>
          <Textarea rows={3} maxLength={4000} defaultValue={values.notes} />
        </Field>
      </Card>

      <FormActions>
        <SubmitButton pendingLabel="Salvando…">{submitLabel}</SubmitButton>
        <ButtonLink href={cancelHref} variant="ghost">
          Cancelar
        </ButtonLink>
      </FormActions>
    </ActionForm>
  );
}
