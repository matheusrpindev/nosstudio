import { ButtonLink } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { ActionForm, Field, FieldRow, FormActions, SubmitButton, type FormAction } from "@/components/ui/form";
import { DateInput, Input, Select, Textarea } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/masked-inputs";
import { CLIENT_KIND_LABELS, CONTACT_SOURCE_LABELS, SERVICE_INTEREST_LABELS } from "@/lib/domain";
import type { Option } from "@/server/options";
import type { ClientDetail } from "@/server/clients/admin";
import { formatDocument } from "@/server/clients/admin";
import { ImportantDatesField } from "./important-dates-field";
import { StatusFields } from "./status-fields";

/** Formulário de cadastro e de edição (mesma tela; com `client` ele edita). Server Component: só o kit é "use client". */
export function ClientForm({
  action,
  client,
  owners,
  defaultOwnerId,
  cancelHref,
  submitLabel,
}: {
  action: FormAction;
  client?: ClientDetail;
  owners: Option[];
  defaultOwnerId?: number;
  cancelHref: string;
  submitLabel: string;
}) {
  // um responsável que foi desativado continua aparecendo na própria ficha (senão salvar apagaria o vínculo sem querer)
  const ownerOptions = client?.ownerId && !owners.some((o) => o.value === client.ownerId) ? [...owners, { value: client.ownerId, label: `${client.ownerName ?? "Usuário removido"} (inativo)` }] : owners;
  return (
    <ActionForm action={action} hidden={client ? { id: client.id } : undefined} className="space-y-4">
      <Card as="section" aria-labelledby="id-titulo" className="space-y-5">
        <CardHeader id="id-titulo" title="Quem é" />
        <FieldRow>
          <Field name="name" label="Nome ou empresa" required>
            <Input autoComplete="off" maxLength={120} defaultValue={client?.name} />
          </Field>
          <Field name="contactName" label="Pessoa de contato" hint="Quando o cliente é uma empresa." optional>
            <Input autoComplete="off" maxLength={120} defaultValue={client?.contactName} />
          </Field>
        </FieldRow>
        <FieldRow>
          <Field name="kind" label="Tipo" required>
            <Select options={CLIENT_KIND_LABELS} defaultValue={client?.kind ?? "pf"} />
          </Field>
          <Field name="document" label="CPF ou CNPJ" optional>
            <Input inputMode="numeric" autoComplete="off" maxLength={30} defaultValue={client ? formatDocument(client.document) : undefined} />
          </Field>
        </FieldRow>
        <FieldRow>
          <Field name="city" label="Cidade" optional>
            <Input autoComplete="off" maxLength={120} defaultValue={client?.city} />
          </Field>
          <Field name="segment" label="Segmento" hint="Ex.: moda, gastronomia, saúde, casamento." optional>
            <Input autoComplete="off" maxLength={120} defaultValue={client?.segment} />
          </Field>
        </FieldRow>
      </Card>

      <Card as="section" aria-labelledby="contato-titulo" className="space-y-5">
        <CardHeader id="contato-titulo" title="Contato" />
        <FieldRow>
          <Field name="whatsapp" label="WhatsApp" hint="Com DDD." optional>
            <PhoneInput autoComplete="off" defaultValue={client?.whatsapp} />
          </Field>
          <Field name="email" label="E-mail" optional>
            <Input type="email" inputMode="email" autoComplete="off" autoCapitalize="none" maxLength={160} defaultValue={client?.email} />
          </Field>
        </FieldRow>
      </Card>

      <Card as="section" aria-labelledby="atendimento-titulo" className="space-y-5">
        <CardHeader id="atendimento-titulo" title="Atendimento" />
        <FieldRow>
          <Field name="source" label="Por onde chegou" required>
            <Select options={CONTACT_SOURCE_LABELS} defaultValue={client?.source ?? "outro"} />
          </Field>
          <Field name="serviceInterest" label="Serviço de interesse" required>
            <Select options={SERVICE_INTEREST_LABELS} defaultValue={client?.serviceInterest ?? "outro"} />
          </Field>
        </FieldRow>
        <FieldRow>
          <Field name="ownerId" label="Responsável" optional>
            <Select options={ownerOptions} placeholder="Sem responsável" defaultValue={client?.ownerId ?? defaultOwnerId ?? ""} />
          </Field>
          <Field name="firstContactAt" label="Primeiro contato" optional>
            <DateInput defaultValue={client?.firstContactAt ?? undefined} />
          </Field>
        </FieldRow>
        <StatusFields defaultStatus={client?.status ?? "novo_contato"} defaultLostReason={client?.lostReason} />
        <FieldRow>
          <Field name="nextStep" label="Próximo passo" hint="O que precisa acontecer agora. Ex.: enviar proposta." optional>
            <Input autoComplete="off" maxLength={300} defaultValue={client?.nextStep} />
          </Field>
          <Field name="nextStepDate" label="Data do próximo passo" optional>
            <DateInput defaultValue={client?.nextStepDate ?? undefined} />
          </Field>
        </FieldRow>
      </Card>

      <Card as="section" aria-labelledby="extra-titulo" className="space-y-5">
        <CardHeader id="extra-titulo" title="Datas e observações" />
        <ImportantDatesField defaultValue={client?.importantDates ?? []} />
        <Field name="notes" label="Observações internas" hint="Só os sócios veem isto — nunca vai para o orçamento nem para o site." optional>
          <Textarea rows={4} maxLength={5000} defaultValue={client?.notes} />
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
