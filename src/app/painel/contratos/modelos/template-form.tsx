import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ActionForm, Field, FieldRow, FormActions, SubmitButton, type FormAction } from "@/components/ui/form";
import { Input, Select } from "@/components/ui/input";
import { MarkdownField } from "@/components/ui/markdown-field";
import { CONTRACT_KIND_LABELS, type ContractKind } from "@/lib/domain";
import { ContractFieldsHelp } from "../fields-help";

/** Formulário de modelo de contrato (criar e editar). */
export function TemplateForm({
  action,
  template,
  submitLabel,
}: {
  action: FormAction;
  template?: { id: number; title: string; kind: ContractKind; versionLabel: string; body: string };
  submitLabel: string;
}) {
  return (
    <ActionForm action={action} hidden={template ? { id: template.id } : undefined}>
      <Card className="space-y-5">
        <Field name="title" label="Nome do modelo" hint="Só aparece no painel. Ex.: Contrato mensal de social media" required>
          <Input autoComplete="off" maxLength={160} defaultValue={template?.title} />
        </Field>
        <FieldRow>
          <Field name="kind" label="Tipo" required>
            <Select options={CONTRACT_KIND_LABELS} defaultValue={template?.kind ?? "mensal"} />
          </Field>
          <Field name="versionLabel" label="Versão" hint="Ex.: v1, revisado em 2026" optional>
            <Input autoComplete="off" maxLength={40} defaultValue={template?.versionLabel} />
          </Field>
        </FieldRow>
        <MarkdownField name="body" label="Texto do modelo" defaultValue={template?.body} rows={18} required maxLength={80000} hint="Use ## para títulos de cláusulas e listas para itens. Para o que muda a cada contrato, use os campos automáticos abaixo, como {{cliente}} e {{valor_total}}." />
        <ContractFieldsHelp />
        <FormActions>
          <SubmitButton pendingLabel="Salvando…">{submitLabel}</SubmitButton>
          <ButtonLink href="/painel/contratos/modelos" variant="ghost">
            Cancelar
          </ButtonLink>
        </FormActions>
      </Card>
    </ActionForm>
  );
}
