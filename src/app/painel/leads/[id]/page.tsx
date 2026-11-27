import { CalendarSearch, MessageCircle, Trash2, UserRoundCheck, UserRoundPlus } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { StatusBadge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { DescriptionList } from "@/components/ui/description-list";
import { ConfirmDialog } from "@/components/ui/dialog";
import { ActionForm, Field, SubmitButton } from "@/components/ui/form";
import { Select } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { DateText } from "@/components/ui/text";
import { requirePermission } from "@/lib/auth";
import { CONTACT_SOURCE_LABELS, LEAD_STATUS_LABELS, leadFieldGroup, SERVICE_INTEREST_LABELS } from "@/lib/domain";
import { canEverywhere } from "@/lib/permissions";
import { formatPhone, mailtoHref, whatsAppLink } from "@/lib/format";
import { getLead } from "@/server/leads/admin";
import { convertLeadAction, deleteLeadAction, updateLeadStatusAction } from "../actions";
import { LEAD_STATUS_TONES } from "../ui";
import { MarkLeadRead } from "./mark-read";

export const metadata: Metadata = { title: "Lead" };
export const instant = false;

type Props = { params: Promise<{ id: string }> };

export default async function LeadPage({ params }: Props) {
  const user = await requirePermission("leads", "ver");
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const lead = await getLead(id);
  if (!lead) notFound();

  const details = lead.details ?? {};
  const firstName = lead.name.trim().split(/\s+/)[0];
  const whatsapp = whatsAppLink(
    lead.whatsapp,
    `Olá, ${firstName}! Aqui é ${user.name.split(" ")[0]}, da NÓS Studio. Recebemos seu contato sobre ${SERVICE_INTEREST_LABELS[lead.serviceInterest].toLowerCase()} e queremos entender melhor o que você precisa. Podemos conversar por aqui?`,
  );
  const extras = Object.entries(details.extras ?? {}).map(([label, value]) => ({ label, value }));
  // pedido de evento com data: atalho para conferir a agenda — o envio do site NÃO cria compromisso nem reserva a data
  const isEventRequest = leadFieldGroup(lead.serviceInterest) === "evento";
  const agendaHref = lead.eventDate && canEverywhere(user, "agenda", "ver") ? `/painel/agenda?vista=dia&data=${lead.eventDate}` : null;
  const time = details.startTime && details.endTime ? `${details.startTime} – ${details.endTime}` : details.startTime || (details.endTime ? `até ${details.endTime}` : null);

  return (
    <>
      {lead.readAt === null ? <MarkLeadRead id={lead.id} /> : null}
      <PageHeader
        title={lead.name}
        badge={<StatusBadge value={lead.status} labels={LEAD_STATUS_LABELS} tones={LEAD_STATUS_TONES} />}
        description={
          <>
            Recebido em <DateText value={lead.createdAt} format="datetime" /> · {CONTACT_SOURCE_LABELS[lead.source]}
          </>
        }
        back={{ href: "/painel/leads", label: "Leads" }}
        actions={
          <>
            {whatsapp ? (
              <ButtonLink href={whatsapp} external variant="accent" icon={<MessageCircle />}>
                Chamar no WhatsApp
              </ButtonLink>
            ) : null}
            {lead.client ? (
              <ButtonLink href={`/painel/clientes/${lead.client.id}`} variant="secondary" icon={<UserRoundCheck />}>
                Abrir cliente
              </ButtonLink>
            ) : (
              <ConfirmDialog
                trigger={<Button icon={<UserRoundPlus />}>Converter em cliente</Button>}
                title="Converter em cliente?"
                description={
                  <>
                    Vamos criar o cadastro de <strong className="text-texto">{lead.name}</strong> em Clientes com estes dados, registrar o pedido no histórico e marcar o
                    lead como convertido. Você fica como responsável.
                  </>
                }
                confirmLabel="Converter"
                tone="primary"
                action={convertLeadAction}
                hidden={{ id: lead.id }}
              />
            )}
          </>
        }
      />

      {lead.client ? (
        <Alert tone="sucesso" className="mb-4">
          Este lead virou o cliente <strong>{lead.client.name}</strong>. O atendimento continua na ficha do cliente.
        </Alert>
      ) : null}

      {/* Duas colunas no desktop. No celular as colunas se desfazem (`contents`) e `order-*` põe contato e andamento logo depois do pedido. */}
      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr] lg:items-start">
        <div className="contents lg:flex lg:flex-col lg:gap-4">
          <Card as="section" aria-labelledby="pedido-titulo" className="order-1">
            <CardHeader id="pedido-titulo" title="Pedido" />
            {lead.message.trim() ? (
              <p className="border-detalhe-medio text-texto mb-5 border-l-4 pl-4 text-[0.9375rem] leading-relaxed break-words whitespace-pre-line">{lead.message}</p>
            ) : (
              <p className="text-texto-suave mb-5 text-sm">Sem mensagem.</p>
            )}
            <DescriptionList
              hideEmpty
              items={[
                { label: "Interesse", value: SERVICE_INTEREST_LABELS[lead.serviceInterest] },
                { label: "Plano / serviço de origem", value: details.packageName },
                { label: "Empresa", value: details.company },
                { label: "Objetivo", value: details.objective },
                // marketing
                { label: "Segmento", value: details.segment },
                { label: "Perfil da marca", value: details.profile },
                // audiovisual
                { label: "Tipo de produção", value: details.productionType },
                { label: "Previsão", value: details.timeframe },
                // evento
                { label: "Tipo de evento", value: details.eventType },
                { label: "Data do evento", value: lead.eventDate ? <DateText value={lead.eventDate} format="long" /> : null },
                { label: "Horário", value: time },
                { label: "Cidade", value: lead.city },
                { label: "Local do evento", value: details.eventLocation },
                { label: "Convidados", value: details.guests },
                { label: "Serviços desejados", value: details.services },
                { label: "Cobertura", value: details.coverage },
                { label: "Storymaker", value: details.storymaker },
                ...extras,
              ]}
            />
            {isEventRequest && lead.eventDate ? (
              <div className="border-borda mt-5 flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-texto-suave text-sm leading-relaxed">
                  Este pedido é uma consulta de disponibilidade: nada foi criado na agenda e a data não está reservada. A confirmação é de vocês.
                </p>
                {agendaHref ? (
                  <ButtonLink href={agendaHref} variant="secondary" size="sm" icon={<CalendarSearch />} className="shrink-0">
                    Ver a agenda neste dia
                  </ButtonLink>
                ) : null}
              </div>
            ) : null}
          </Card>

          <Card as="section" aria-labelledby="registro-titulo" className="order-4">
            <CardHeader id="registro-titulo" title="Origem e consentimento" />
            <DescriptionList
              items={[
                { label: "Origem", value: CONTACT_SOURCE_LABELS[lead.source] },
                { label: "Página de origem", value: lead.originPath ? <code className="text-[0.8125rem]">{lead.originPath}</code> : null },
                { label: "Recebido em", value: <DateText value={lead.createdAt} format="datetime" /> },
                {
                  label: "Consentimento (LGPD)",
                  value: lead.consentAt ? (
                    <>
                      Aceito em <DateText value={lead.consentAt} format="datetime" />
                      {lead.consentVersion ? <> · política versão {lead.consentVersion}</> : null}
                    </>
                  ) : (
                    "Não registrado (cadastro manual)"
                  ),
                },
                { label: "Lido em", value: lead.readAt ? <DateText value={lead.readAt} format="datetime" /> : "Agora" },
              ]}
            />
          </Card>
        </div>

        <div className="contents lg:flex lg:flex-col lg:gap-4">
          <Card as="section" aria-labelledby="contato-titulo" className="order-2">
            <CardHeader id="contato-titulo" title="Contato" />
            <DescriptionList
              items={[
                { label: "WhatsApp", value: <span className="tabular-nums">{formatPhone(lead.whatsapp)}</span> },
                {
                  label: "E-mail",
                  // só vira link se for um e-mail simples: nada de `?bcc=…` embutido pelo visitante
                  value: !lead.email ? null : mailtoHref(lead.email) ? (
                    <a href={mailtoHref(lead.email)} className="link break-all">
                      {lead.email}
                    </a>
                  ) : (
                    <span className="break-all">{lead.email}</span>
                  ),
                },
                { label: "Cidade", value: lead.city },
              ]}
            />
          </Card>

          <Card as="section" aria-labelledby="status-titulo" className="order-3">
            <CardHeader id="status-titulo" title="Andamento" />
            <ActionForm action={updateLeadStatusAction} hidden={{ id: lead.id }} className="space-y-4">
              <Field name="status" label="Status do lead">
                <Select options={LEAD_STATUS_LABELS} defaultValue={lead.status} />
              </Field>
              <SubmitButton variant="secondary" pendingLabel="Salvando…">
                Salvar status
              </SubmitButton>
            </ActionForm>
          </Card>

          <Card as="section" aria-labelledby="excluir-titulo" className="order-5">
            <CardHeader id="excluir-titulo" title="Excluir lead" description="Apaga os dados deste contato de forma definitiva — use para pedidos de eliminação (LGPD), testes e spam." />
            <ConfirmDialog
              trigger={
                <Button variant="danger-ghost" icon={<Trash2 />} className="-ml-2">
                  Excluir lead
                </Button>
              }
              title="Excluir este lead?"
              description={
                <>
                  Os dados de <strong className="text-texto">{lead.name}</strong> serão apagados e não dá para desfazer.
                  {lead.client ? " O cadastro do cliente criado a partir dele continua existindo." : ""}
                </>
              }
              confirmLabel="Excluir lead"
              action={deleteLeadAction}
              hidden={{ id: lead.id }}
            />
          </Card>
        </div>
      </div>
    </>
  );
}
