"use client";

import { useState } from "react";
import { ButtonLink } from "@/components/ui/button";
import { ActionForm, Field, FieldRow, FormActions, SubmitButton } from "@/components/ui/form";
import { Input, RadioCards, Select } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/masked-inputs";
import { PROPOSAL_MODALITIES, PROPOSAL_MODALITY_LABELS, type ProposalModality } from "@/lib/domain";
import { formatPercent } from "@/lib/format";
import { createProposalAction } from "../actions";
import { DEFAULT_TITLES } from "../draft";

const MODALITY_HINTS: Record<ProposalModality, string> = {
  mensal: "Plano recorrente de comunicação e conteúdo.",
  diaria_evento: "Diária de gravação ou cobertura de evento.",
  casamento: "Cobertura de casamento, foto e filme.",
  personalizada: "Escopo sob medida.",
};

type Props = {
  clients: { value: number; label: string }[];
  templates: { id: number; name: string; modality: ProposalModality; title: string }[];
  defaultClientId: number | null;
  defaultTemplateId: number | null;
  defaults: { validUntil: string; entryPercent: number };
};

export function NewProposalForm({ clients, templates, defaultClientId, defaultTemplateId, defaults }: Props) {
  const initialTemplate = templates.find((template) => template.id === defaultTemplateId) ?? null;
  const [templateId, setTemplateId] = useState<string>(initialTemplate ? String(initialTemplate.id) : "");
  const [modality, setModality] = useState<ProposalModality>(initialTemplate?.modality ?? "casamento");
  const [clientMode, setClientMode] = useState<"existente" | "novo">(clients.length === 0 ? "novo" : "existente");
  const template = templates.find((item) => String(item.id) === templateId) ?? null;

  return (
    <ActionForm action={createProposalAction}>
      <Field group name="modality" label="Modalidade" required>
        <RadioCards
          name="modality"
          cols={2}
          value={modality}
          onValueChange={(value) => setModality(value as ProposalModality)}
          options={PROPOSAL_MODALITIES.map((value) => ({ value, label: PROPOSAL_MODALITY_LABELS[value], description: MODALITY_HINTS[value] }))}
        />
      </Field>

      <Field
        name="templateId"
        label="Modelo"
        optional
        hint={
          template
            ? `Copia itens, parcelas e textos de “${template.name}”. Você ajusta tudo no editor.`
            : templates.length > 0
              ? "Sem modelo, a proposta começa em branco."
              : "Ainda não há modelos. Você pode criar um em Orçamentos › Modelos."
        }
      >
        <Select
          value={templateId}
          onChange={(event) => {
            setTemplateId(event.target.value);
            const next = templates.find((item) => String(item.id) === event.target.value);
            if (next) setModality(next.modality);
          }}
        >
          <option value="">Começar em branco</option>
          {templates.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </Select>
      </Field>

      <Field group name="clientMode" label="Cliente" required>
        <RadioCards
          name="clientMode"
          compact
          cols={2}
          value={clientMode}
          onValueChange={(value) => setClientMode(value as "existente" | "novo")}
          options={[
            { value: "existente", label: "Já cadastrado", disabled: clients.length === 0 },
            { value: "novo", label: "Cadastro rápido" },
          ]}
        />
      </Field>

      {clientMode === "existente" ? (
        <Field name="clientId" label="Selecione o cliente" required>
          <Select options={clients} placeholder="Escolha…" defaultValue={defaultClientId ?? ""} />
        </Field>
      ) : (
        <FieldRow>
          <Field name="newClientName" label="Nome do cliente" hint="Pessoa, casal ou empresa." required>
            <Input maxLength={120} autoComplete="off" />
          </Field>
          <Field name="newClientWhatsapp" label="WhatsApp" hint="Com DDD. O restante do cadastro você completa depois em Clientes." required>
            <PhoneInput />
          </Field>
        </FieldRow>
      )}

      <Field
        name="title"
        label="Título da proposta"
        optional
        hint={`Aparece na capa do PDF. Em branco, usamos “${template?.title ?? DEFAULT_TITLES[modality]}”.`}
      >
        <Input maxLength={160} autoComplete="off" placeholder={template?.title ?? DEFAULT_TITLES[modality]} />
      </Field>

      <p className="text-cinza border-areia rounded-campo border bg-white px-3 py-2.5 text-sm leading-relaxed">
        Padrões aplicados: validade até <strong className="text-grafite">{defaults.validUntil}</strong>
        {template ? null : (
          <>
            {" "}
            e sinal de <strong className="text-grafite">{formatPercent(defaults.entryPercent)}</strong>
          </>
        )}
        . Dá para mudar tudo no editor (os padrões ficam em Configurações › Propostas).
      </p>

      <FormActions>
        <SubmitButton pendingLabel="Criando…">Criar rascunho e abrir o editor</SubmitButton>
        <ButtonLink href="/painel/orcamentos" variant="ghost">
          Cancelar
        </ButtonLink>
      </FormActions>
    </ActionForm>
  );
}
