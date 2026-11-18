"use client";

import { useState } from "react";
import { ButtonLink } from "@/components/ui/button";
import { ActionForm, Field, FieldRow, FormActions, SubmitButton, type FormAction } from "@/components/ui/form";
import { DateInput, Input, RadioCards, Select, Textarea, type SelectOption } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/masked-inputs";
import { FileField, type MediaValue } from "@/components/ui/media-fields";
import { FINANCE_CATEGORIES_BY_TYPE, FINANCE_CATEGORY_LABELS, FINANCE_TYPE_LABELS, FINANCE_TYPES, PAYMENT_METHOD_LABELS, type FinanceCategory, type FinanceType, type PaymentMethod } from "@/lib/domain";

export type EntryFormDefaults = {
  id?: number;
  type: FinanceType;
  category: FinanceCategory | "";
  description: string;
  amountCents: number | null;
  dueDate: string;
  paidAt: string | null;
  installmentLabel: string;
  method: PaymentMethod | null;
  supplier: string;
  clientId: number | null;
  projectId: number | null;
  proposalId: number | null;
  receiptUrl: string;
  notes: string;
};

type Props = {
  action: FormAction;
  defaults: EntryFormDefaults;
  clients: SelectOption[];
  projects: SelectOption[];
  proposals: SelectOption[];
  receipt: MediaValue | null;
  cancelHref: string;
};

const TYPE_OPTIONS = FINANCE_TYPES.map((type) => ({
  value: type,
  label: FINANCE_TYPE_LABELS[type],
  description: type === "receita" ? "Dinheiro que entra: pagamento de cliente." : "Dinheiro que sai: custos, equipe, impostos.",
}));

/** Formulário de lançamento (novo e edição). A categoria e o fornecedor dependem do tipo, por isso é um Client Component. */
export function EntryForm({ action, defaults, clients, projects, proposals, receipt, cancelHref }: Props) {
  const [type, setType] = useState<FinanceType>(defaults.type);
  const categories = FINANCE_CATEGORIES_BY_TYPE[type].map((category) => ({ value: category, label: FINANCE_CATEGORY_LABELS[category] }));
  const category = (FINANCE_CATEGORIES_BY_TYPE[type] as readonly string[]).includes(defaults.category) ? defaults.category : "";
  const receita = type === "receita";

  return (
    <ActionForm action={action} hidden={{ id: defaults.id }}>
      <Field name="type" label="Tipo" group required>
        <RadioCards options={TYPE_OPTIONS} value={type} onValueChange={(value) => setType(value as FinanceType)} cols={2} compact />
      </Field>

      <FieldRow>
        <Field name="category" label="Categoria" required>
          <Select key={type} options={categories} placeholder="Selecione…" defaultValue={category} />
        </Field>
        <Field name="amount" label="Valor" required>
          <MoneyInput defaultValue={defaults.amountCents} />
        </Field>
      </FieldRow>

      <Field name="description" label="Descrição" required hint={receita ? "Ex.: Entrada — cobertura de casamento" : "Ex.: Aluguel de lente para a gravação"}>
        <Input maxLength={200} autoComplete="off" defaultValue={defaults.description} />
      </Field>

      <FieldRow cols={3}>
        <Field name="dueDate" label="Vencimento" hint="Data prevista para receber ou pagar." required>
          <DateInput defaultValue={defaults.dueDate} />
        </Field>
        <Field name="installmentLabel" label="Parcela" optional hint="Ex.: Entrada, 2/3">
          <Input maxLength={60} autoComplete="off" defaultValue={defaults.installmentLabel} />
        </Field>
        <Field name="method" label="Método" optional>
          <Select options={PAYMENT_METHOD_LABELS} placeholder="Não informar" defaultValue={defaults.method ?? ""} />
        </Field>
      </FieldRow>

      <Field
        name="paidAt"
        label={receita ? "Data do recebimento" : "Data do pagamento"}
        optional
        hint={receita ? "Preencha só se o dinheiro já entrou. Vazio = previsto (a receber)." : "Preencha só se já foi pago. Vazio = previsto (a pagar)."}
      >
        <DateInput defaultValue={defaults.paidAt ?? ""} />
      </Field>

      {!receita ? (
        <Field name="supplier" label="Fornecedor ou freelancer" optional>
          <Input maxLength={160} autoComplete="off" defaultValue={defaults.supplier} />
        </Field>
      ) : null}

      <FieldRow cols={3}>
        <Field name="clientId" label="Cliente" optional>
          <Select options={clients} placeholder="Nenhum" defaultValue={defaults.clientId ?? ""} />
        </Field>
        <Field name="projectId" label="Projeto" optional>
          <Select options={projects} placeholder="Nenhum" defaultValue={defaults.projectId ?? ""} />
        </Field>
        <Field name="proposalId" label="Proposta" optional>
          <Select options={proposals} placeholder="Nenhuma" defaultValue={defaults.proposalId ?? ""} />
        </Field>
      </FieldRow>

      <FileField name="receipt" label="Comprovante" hint="Arquivo privado: só quem tem acesso ao painel abre. PDF, imagem ou planilha." defaultValue={receipt} accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx" />
      <Field name="receiptUrl" label="Ou link do comprovante" optional hint="Se estiver no Drive ou em outro lugar.">
        <Input type="url" inputMode="url" autoCapitalize="none" placeholder="https://…" maxLength={500} defaultValue={defaults.receiptUrl} />
      </Field>

      <Field name="notes" label="Observações" optional>
        <Textarea rows={3} maxLength={2000} defaultValue={defaults.notes} />
      </Field>

      <FormActions>
        <SubmitButton pendingLabel="Salvando…">{defaults.id ? "Salvar alterações" : "Criar lançamento"}</SubmitButton>
        <ButtonLink href={cancelHref} variant="ghost">
          Cancelar
        </ButtonLink>
      </FormActions>
    </ActionForm>
  );
}
