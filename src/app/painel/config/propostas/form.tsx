"use client";

import { ActionForm, Field, FieldRow, FormActions, SubmitButton } from "@/components/ui/form";
import { Input, Textarea } from "@/components/ui/input";
import { MarkdownField } from "@/components/ui/markdown-field";
import { Card, CardHeader, CardSection } from "@/components/ui/card";
import { saveProposalDefaultsAction } from "./actions";

type Defaults = {
  validityDays: number;
  entryPercent: number;
  aboutText: string;
  paymentNotes: string;
  conditions: string;
  taxPercent: number;
  targetMarginPercent: number;
};

const FORMAT_HINT = "Uma linha em branco separa parágrafos; linhas começando com “- ” viram tópicos; **negrito** entre asteriscos.";

/** 12.5 → "12,5" (o campo aceita vírgula). */
const asInput = (value: number) => String(value).replace(".", ",");

export function ProposalDefaultsForm({ defaults }: { defaults: Defaults }) {
  return (
    <ActionForm action={saveProposalDefaultsAction} className="space-y-4">
      <Card flush as="section" aria-labelledby="padroes-titulo">
        <CardHeader id="padroes-titulo" title="Condições de cada orçamento novo" description="Já vêm preenchidas ao criar um orçamento; dá para ajustar em cada um." />
        <CardSection className="space-y-5">
          <FieldRow>
            <Field name="validityDays" label="Validade da proposta (dias)" required hint="Contada a partir da data de emissão.">
              <Input inputMode="numeric" defaultValue={String(defaults.validityDays)} maxLength={3} />
            </Field>
            <Field name="entryPercent" label="Entrada (%)" required hint="Parte paga para reservar a data ou iniciar o trabalho.">
              <Input inputMode="decimal" defaultValue={asInput(defaults.entryPercent)} maxLength={6} />
            </Field>
          </FieldRow>
          <Field name="paymentNotes" label="Condições de pagamento" optional hint={`Formas de pagamento, chave Pix, multa por atraso… ${FORMAT_HINT}`}>
            <Textarea rows={4} maxLength={3000} defaultValue={defaults.paymentNotes} />
          </Field>
          <Field name="conditions" label="Observações e condições comerciais" optional hint={`Remarcação, cancelamento, direitos de uso de imagem, prazos. ${FORMAT_HINT}`}>
            <Textarea rows={6} maxLength={6000} defaultValue={defaults.conditions} />
          </Field>
        </CardSection>
      </Card>

      <Card flush as="section" aria-labelledby="quem-somos-titulo">
        <CardHeader id="quem-somos-titulo" title="Quem somos (página 2 do PDF)" description="Apresentação curta da NÓS que aparece em toda proposta." />
        <CardSection>
          <MarkdownField name="aboutText" label="Texto de apresentação" optional defaultValue={defaults.aboutText} rows={8} maxLength={3000} hint="Separe os parágrafos com uma linha em branco." />
        </CardSection>
      </Card>

      <Card flush as="section" aria-labelledby="premissas-titulo">
        <CardHeader title="Premissas do cálculo interno" description="Usadas só para calcular margem no painel. Nunca aparecem no PDF nem no site." id="premissas-titulo" />
        <CardSection>
          <FieldRow>
            <Field name="taxPercent" label="Tributos estimados (%)" required hint="Percentual sobre o valor vendido. Use 0 se não quiser considerar.">
              <Input inputMode="decimal" defaultValue={asInput(defaults.taxPercent)} maxLength={6} />
            </Field>
            <Field name="targetMarginPercent" label="Margem-alvo (%)" required hint="O painel avisa quando uma proposta fica abaixo dela. Use 0 para não avisar.">
              <Input inputMode="decimal" defaultValue={asInput(defaults.targetMarginPercent)} maxLength={6} />
            </Field>
          </FieldRow>
        </CardSection>
      </Card>

      <FormActions>
        <SubmitButton pendingLabel="Salvando…">Salvar padrões</SubmitButton>
      </FormActions>
    </ActionForm>
  );
}
