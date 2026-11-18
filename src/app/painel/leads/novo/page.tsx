import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ActionForm, Field, FieldRow, FormActions, SubmitButton } from "@/components/ui/form";
import { DateInput, Input, Select, Textarea } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { requireUser } from "@/lib/auth";
import { CONTACT_SOURCE_LABELS, CONTACT_SOURCES, SERVICE_INTEREST_LABELS } from "@/lib/domain";
import { createLeadAction } from "../actions";

export const metadata: Metadata = { title: "Cadastrar lead" };
export const instant = false;

// "Site" fica de fora: leads do site só nascem pelo formulário público (com consentimento registrado).
const MANUAL_SOURCES = CONTACT_SOURCES.filter((source) => source !== "site").map((source) => ({ value: source, label: CONTACT_SOURCE_LABELS[source] }));

export default async function NewLeadPage() {
  await requireUser();

  return (
    <div className="max-w-2xl">
      <PageHeader
        title="Cadastrar lead"
        description="Para contatos que chegaram fora do site — WhatsApp, Instagram, indicação, evento."
        back={{ href: "/painel/leads", label: "Leads" }}
      />
      <Card>
        {/* A action é passada direto: o formulário inteiro é renderizado no servidor; só o kit é "use client". */}
        <ActionForm action={createLeadAction}>
          <Field name="name" label="Nome" required>
            <Input autoComplete="off" maxLength={120} />
          </Field>
          <FieldRow>
            <Field name="whatsapp" label="WhatsApp" hint="Com DDD. Ex.: (11) 91234-5678" required>
              <Input type="tel" inputMode="tel" autoComplete="off" maxLength={20} />
            </Field>
            <Field name="email" label="E-mail" optional>
              <Input type="email" inputMode="email" autoComplete="off" autoCapitalize="none" maxLength={160} />
            </Field>
          </FieldRow>
          <FieldRow>
            <Field name="source" label="Por onde chegou" required>
              <Select options={MANUAL_SOURCES} defaultValue="whatsapp" />
            </Field>
            <Field name="serviceInterest" label="Serviço de interesse" required>
              <Select options={SERVICE_INTEREST_LABELS} defaultValue="outro" />
            </Field>
          </FieldRow>
          <FieldRow>
            <Field name="eventDate" label="Data do evento" optional>
              <DateInput />
            </Field>
            <Field name="city" label="Cidade" optional>
              <Input autoComplete="off" maxLength={120} />
            </Field>
          </FieldRow>
          <Field name="message" label="O que a pessoa pediu" hint="Resumo da conversa: o que precisa, prazo, orçamento que comentou…" optional>
            <Textarea rows={4} maxLength={4000} />
          </Field>
          <FormActions>
            <SubmitButton pendingLabel="Salvando…">Cadastrar lead</SubmitButton>
            <ButtonLink href="/painel/leads" variant="ghost">
              Cancelar
            </ButtonLink>
          </FormActions>
        </ActionForm>
      </Card>
    </div>
  );
}
