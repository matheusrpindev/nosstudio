import { CalendarPlus, FileJson, FilePlus2, FolderPlus, ListPlus, MessageCircle, Pencil, Trash2, Wallet } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { DataList, type DataListColumn } from "@/components/ui/data-list";
import { DescriptionList } from "@/components/ui/description-list";
import { ConfirmDialog } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { ActionForm, Field, FieldRow, SubmitButton } from "@/components/ui/form";
import { Checkbox, Input, Select, Textarea } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { TabPanel, Tabs } from "@/components/ui/tabs";
import { DateText, Money } from "@/components/ui/text";
import { requireUser } from "@/lib/auth";
import { nowLocal, todayISO } from "@/lib/dates";
import {
  AGENDA_KIND_LABELS,
  CLIENT_KIND_LABELS,
  CLIENT_STATUS_LABELS,
  CONTACT_SOURCE_LABELS,
  CONTRACT_KIND_LABELS,
  CONTRACT_STATUS_LABELS,
  INTERACTION_KIND_LABELS,
  INTERACTION_KINDS,
  PROJECT_STAGE_LABELS,
  PROPOSAL_STATUS_LABELS,
  SERVICE_INTEREST_LABELS,
  TASK_PRIORITY_LABELS,
} from "@/lib/domain";
import { formatPhone, mailtoHref, whatsAppLink } from "@/lib/format";
import { formatDocument, getClient, getClientRelated, listInteractions, type ClientRelated } from "@/server/clients/admin";
import { describeRemaining, getClientFootprint } from "@/server/clients/subject-data";
import { addInteractionAction, deleteClientAction, updateClientStatusAction } from "../actions";
import { StatusFields } from "../status-fields";
import { CLIENT_STATUS_TONES, INTERACTION_TONES, PROPOSAL_STATUS_TONES } from "../ui";

export const metadata: Metadata = { title: "Cliente" };
export const instant = false;

type Props = { params: Promise<{ id: string }> };

const MANUAL_INTERACTION_KINDS = INTERACTION_KINDS.filter((kind) => kind !== "status").map((kind) => ({ value: kind, label: INTERACTION_KIND_LABELS[kind] }));

export default async function ClientPage({ params }: Props) {
  const user = await requireUser();
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const client = await getClient(id);
  if (!client) notFound();

  const today = todayISO();
  const [interactions, related, footprint] = await Promise.all([listInteractions(id), getClientRelated(id, today), getClientFootprint(id)]);
  if (!footprint) notFound();
  // o que continua existindo depois de excluir o cliente (o diálogo de exclusão diz a verdade sobre isso)
  const remaining = describeRemaining(footprint);
  const isAdmin = user.role === "admin";

  const contactFirstName = (client.contactName || client.name).trim().split(/\s+/)[0];
  const whatsapp = whatsAppLink(client.whatsapp, `Olá, ${contactFirstName}! Aqui é ${user.name.split(" ")[0]}, da NÓS Studio. Tudo bem?`);
  const nextStepLate = client.nextStepDate !== null && client.nextStepDate < today && !["finalizado", "perdido", "cancelado"].includes(client.status);

  return (
    <>
      <PageHeader
        title={client.name}
        badge={<StatusBadge value={client.status} labels={CLIENT_STATUS_LABELS} tones={CLIENT_STATUS_TONES} />}
        description={
          <>
            {CLIENT_KIND_LABELS[client.kind]}
            {client.ownerName ? ` · Responsável: ${client.ownerName}` : " · Sem responsável"}
            {" · "}Cadastrado em <DateText value={client.createdAt} format="date" />
          </>
        }
        back={{ href: "/painel/clientes", label: "Clientes" }}
        actions={
          <>
            {whatsapp ? (
              <ButtonLink href={whatsapp} external variant="accent" icon={<MessageCircle />}>
                Chamar no WhatsApp
              </ButtonLink>
            ) : null}
            <ButtonLink href={`/painel/orcamentos/novo?cliente=${client.id}`} icon={<FilePlus2 />}>
              Novo orçamento
            </ButtonLink>
            <ButtonLink href={`/painel/projetos/novo?cliente=${client.id}`} variant="secondary" icon={<FolderPlus />}>
              Novo projeto
            </ButtonLink>
            <ButtonLink href={`/painel/clientes/${client.id}/editar`} variant="secondary" icon={<Pencil />}>
              Editar
            </ButtonLink>
            <ConfirmDialog
              trigger={
                <Button variant="danger-ghost" icon={<Trash2 />}>
                  Excluir
                </Button>
              }
              title="Excluir este cliente?"
              description={
                <>
                  O cadastro de <strong className="text-texto">{client.name}</strong> e o <strong className="text-texto">histórico de atendimento</strong>
                  {footprint.interactions > 0 ? ` (${footprint.interactions} ${footprint.interactions === 1 ? "registro" : "registros"})` : ""}
                  {footprint.contentItems > 0 ? `, além de ${footprint.contentItems} ${footprint.contentItems === 1 ? "item" : "itens"} do calendário de conteúdo deste cliente,` : ""} serão apagados e não dá para desfazer.
                  <span className="mt-2 block">
                    {remaining ? (
                      <>
                        <strong className="text-texto">Continuam existindo</strong>, sem cliente vinculado: {remaining}. Eles podem citar o nome da pessoa.
                      </>
                    ) : (
                      "Não há orçamentos, projetos, contratos, lançamentos, compromissos nem tarefas ligados a este cliente."
                    )}
                  </span>
                  <span className="mt-2 block">
                    Pedido de <strong className="text-texto">eliminação de dados</strong> (LGPD)?{remaining ? " Antes, apague ou edite esses registros (abas desta ficha)." : ""} Os backups antigos ainda guardam os dados até serem substituídos.
                  </span>
                </>
              }
              confirmLabel="Excluir cliente"
              action={deleteClientAction}
              hidden={{ id: client.id }}
            >
              {footprint.leads > 0 ? (
                <Checkbox
                  name="deleteLeads"
                  label={footprint.leads === 1 ? "Excluir também o pedido que esta pessoa enviou pelo site" : `Excluir também os ${footprint.leads} pedidos que esta pessoa enviou pelo site`}
                  hint="Ficam em Leads (nome, WhatsApp, e-mail e mensagem), inclusive os de mesmo WhatsApp ou e-mail. Sem marcar, continuam lá, sem vínculo."
                />
              ) : null}
            </ConfirmDialog>
          </>
        }
      />

      {client.status === "perdido" && client.lostReason ? (
        <Alert tone="alerta" title="Cliente perdido" className="mb-4">
          {client.lostReason}
        </Alert>
      ) : null}

      <Tabs
        aria-label="Seções do cliente"
        items={[
          { value: "resumo", label: "Resumo" },
          { value: "historico", label: "Histórico", count: interactions.length },
          { value: "orcamentos", label: "Orçamentos", count: related.proposals.length },
          { value: "projetos", label: "Projetos", count: related.projects.length },
          { value: "contratos", label: "Contratos", count: related.contracts.length },
          { value: "financeiro", label: "Financeiro", count: related.finance.total },
          { value: "agenda", label: "Agenda e tarefas", count: related.events.length + related.tasks.length },
        ]}
      >
        <TabPanel value="resumo">
          <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr] lg:items-start">
            <div className="space-y-4">
              <Card as="section" aria-labelledby="proximo-titulo">
                <CardHeader id="proximo-titulo" title="Próximo passo" />
                {client.nextStep || client.nextStepDate ? (
                  <div className="space-y-1">
                    <p className="text-texto text-[0.9375rem] break-words whitespace-pre-line">{client.nextStep || "Sem descrição"}</p>
                    {client.nextStepDate ? (
                      <p className="text-sm">
                        <DateText value={client.nextStepDate} format="long" /> (<DateText value={client.nextStepDate} format="relative" />){" "}
                        {nextStepLate ? <Badge tone="alerta">Atrasado</Badge> : null}
                      </p>
                    ) : null}
                  </div>
                ) : (
                  <p className="text-texto-suave text-sm">
                    Nada definido. <Link href={`/painel/clientes/${client.id}/editar`} className="link">Defina o próximo passo</Link> para não esquecer este cliente.
                  </p>
                )}
              </Card>

              <Card as="section" aria-labelledby="dados-titulo">
                <CardHeader id="dados-titulo" title="Dados do cliente" />
                <DescriptionList
                  items={[
                    { label: "Pessoa de contato", value: client.contactName },
                    { label: "WhatsApp", value: client.whatsapp ? <span className="tabular-nums">{formatPhone(client.whatsapp)}</span> : null },
                    {
                      label: "E-mail",
                      value: !client.email ? null : mailtoHref(client.email) ? (
                        <a href={mailtoHref(client.email)} className="link break-all">
                          {client.email}
                        </a>
                      ) : (
                        <span className="break-all">{client.email}</span>
                      ),
                    },
                    { label: "CPF/CNPJ", value: client.document ? <span className="tabular-nums">{formatDocument(client.document)}</span> : null },
                    { label: "Cidade", value: client.city },
                    { label: "Segmento", value: client.segment },
                    { label: "Serviço de interesse", value: SERVICE_INTEREST_LABELS[client.serviceInterest] },
                    { label: "Origem", value: CONTACT_SOURCE_LABELS[client.source] },
                    { label: "Primeiro contato", value: client.firstContactAt ? <DateText value={client.firstContactAt} format="long" /> : null },
                  ]}
                />
                {/* LGPD (acesso/portabilidade): só administradores exportam dados — a rota confere de novo e registra na auditoria */}
                {isAdmin ? (
                  <div className="border-borda mt-4 border-t pt-4">
                    <ButtonLink href={`/painel/clientes/${client.id}/dados`} download prefetch={false} variant="secondary" size="sm" className="min-h-11 sm:min-h-9" icon={<FileJson />}>
                      Dados deste titular (JSON)
                    </ButtonLink>
                    <p className="hint mt-2">Baixa tudo o que o painel guarda ligado a este cadastro — para responder a um pedido de acesso aos dados (LGPD). Revise antes de entregar: inclui anotações internas.</p>
                  </div>
                ) : null}
              </Card>

              <Card as="section" aria-labelledby="notas-titulo">
                <CardHeader id="notas-titulo" title="Observações internas" description="Só os sócios veem." />
                {client.notes.trim() ? <p className="text-texto text-[0.9375rem] leading-relaxed break-words whitespace-pre-line">{client.notes}</p> : <p className="text-texto-suave text-sm">Nenhuma observação.</p>}
              </Card>
            </div>

            <div className="space-y-4">
              <Card as="section" aria-labelledby="status-titulo">
                <CardHeader id="status-titulo" title="Andamento" description="Cada mudança entra no histórico." />
                <ActionForm action={updateClientStatusAction} hidden={{ id: client.id }} className="space-y-4">
                  <StatusFields defaultStatus={client.status} defaultLostReason={client.lostReason} />
                  <SubmitButton variant="secondary" pendingLabel="Salvando…">
                    Salvar status
                  </SubmitButton>
                </ActionForm>
              </Card>

              <Card as="section" aria-labelledby="datas-titulo">
                <CardHeader id="datas-titulo" title="Datas importantes" />
                {client.importantDates.length > 0 ? (
                  <ul className="divide-borda divide-y">
                    {[...client.importantDates]
                      .sort((a, b) => a.date.localeCompare(b.date))
                      .map((item, index) => (
                        <li key={`${item.date}-${index}`} className="flex items-baseline justify-between gap-3 py-2 first:pt-0 last:pb-0">
                          <span className="text-texto min-w-0 text-[0.9375rem] break-words">{item.label}</span>
                          <DateText value={item.date} className="text-texto-suave shrink-0 text-sm" />
                        </li>
                      ))}
                  </ul>
                ) : (
                  <p className="text-texto-suave text-sm">
                    Nenhuma. <Link href={`/painel/clientes/${client.id}/editar`} className="link">Adicionar data</Link>
                  </p>
                )}
              </Card>
            </div>
          </div>
        </TabPanel>

        <TabPanel value="historico">
          <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr] lg:items-start">
            <Card as="section" aria-labelledby="registrar-titulo">
              <CardHeader id="registrar-titulo" title="Registrar atendimento" description="Anote conversas, ligações e reuniões para a equipe toda saber." />
              <ActionForm action={addInteractionAction} hidden={{ clientId: client.id }} resetOnSuccess className="space-y-4">
                <FieldRow>
                  <Field name="kind" label="Tipo" required>
                    <Select options={MANUAL_INTERACTION_KINDS} defaultValue="nota" />
                  </Field>
                  <Field name="occurredAt" label="Quando" required>
                    <Input type="datetime-local" defaultValue={nowLocal()} />
                  </Field>
                </FieldRow>
                <Field name="content" label="O que aconteceu" required>
                  <Textarea rows={4} maxLength={4000} placeholder="Ex.: Pediu orçamento para cobertura de 6 horas, envio até sexta." />
                </Field>
                <SubmitButton pendingLabel="Registrando…">Registrar atendimento</SubmitButton>
              </ActionForm>
            </Card>

            <Card as="section" aria-labelledby="linha-titulo">
              <CardHeader id="linha-titulo" title="Linha do tempo" />
              {interactions.length === 0 ? (
                <EmptyState variant="plain" title="Nenhum atendimento registrado" description="Use o formulário ao lado para registrar o primeiro contato." />
              ) : (
                <ol className="border-borda relative ml-2 space-y-5 border-l-2 pl-5">
                  {interactions.map((item) => (
                    <li key={item.id} className="relative">
                      <span aria-hidden="true" className="bg-detalhe ring-superficie absolute top-1.5 -left-[1.8rem] size-2.5 rounded-full ring-4" />
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <Badge tone={INTERACTION_TONES[item.kind]}>{INTERACTION_KIND_LABELS[item.kind]}</Badge>
                        <span className="text-texto-suave text-[0.8125rem]">
                          <DateText value={item.occurredAt} format="datetime" />
                          {item.authorName ? ` · ${item.authorName}` : ""}
                        </span>
                      </div>
                      <p className="text-texto mt-1.5 text-[0.9375rem] leading-relaxed break-words whitespace-pre-line">{item.content}</p>
                    </li>
                  ))}
                </ol>
              )}
            </Card>
          </div>
        </TabPanel>

        <TabPanel value="orcamentos">
          <ProposalsSection clientId={client.id} rows={related.proposals} />
        </TabPanel>
        <TabPanel value="projetos">
          <ProjectsSection clientId={client.id} rows={related.projects} />
        </TabPanel>
        <TabPanel value="contratos">
          <ContractsSection clientId={client.id} rows={related.contracts} />
        </TabPanel>
        <TabPanel value="financeiro">
          <FinanceSection clientId={client.id} finance={related.finance} />
        </TabPanel>
        <TabPanel value="agenda">
          <AgendaSection clientId={client.id} events={related.events} tasks={related.tasks} today={today} />
        </TabPanel>
      </Tabs>
    </>
  );
}

// ---------------------------------------------------------------- listas relacionadas
function SectionHeader({ title, action }: { title: string; action: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="text-texto text-base font-bold">{title}</h2>
      {action}
    </div>
  );
}

function ProposalsSection({ clientId, rows }: { clientId: number; rows: ClientRelated["proposals"] }) {
  const columns: DataListColumn<ClientRelated["proposals"][number]>[] = [
    {
      key: "titulo",
      header: "Orçamento",
      primary: true,
      cell: (row) => (
        <>
          <span className="block break-words">{row.title}</span>
          <span className="text-texto-suave block text-[0.8125rem] font-normal">
            {row.number}
            {row.version > 1 ? ` · versão ${row.version}` : ""}
          </span>
        </>
      ),
    },
    { key: "status", header: "Status", hideLabelOnMobile: true, cell: (row) => <StatusBadge value={row.status} labels={PROPOSAL_STATUS_LABELS} tones={PROPOSAL_STATUS_TONES} /> },
    { key: "validade", header: "Válido até", hideOnMobile: true, cell: (row) => <DateText value={row.validUntil} /> },
    { key: "total", header: "Total", align: "right", cell: (row) => <Money cents={row.totalCents} className="font-semibold" /> },
  ];
  return (
    <>
      <SectionHeader title="Orçamentos do cliente" action={<ButtonLink href={`/painel/orcamentos/novo?cliente=${clientId}`} size="sm" icon={<FilePlus2 />}>Novo orçamento</ButtonLink>} />
      <DataList
        caption="Orçamentos do cliente"
        columns={columns}
        rows={rows}
        rowKey={(row) => row.id}
        href={(row) => `/painel/orcamentos/${row.id}`}
        empty={<EmptyState variant="plain" icon={<FilePlus2 />} title="Nenhum orçamento ainda" description="Monte uma proposta para este cliente a partir de um modelo ou do zero." action={<ButtonLink href={`/painel/orcamentos/novo?cliente=${clientId}`} icon={<FilePlus2 />}>Novo orçamento</ButtonLink>} />}
      />
    </>
  );
}

function ProjectsSection({ clientId, rows }: { clientId: number; rows: ClientRelated["projects"] }) {
  const columns: DataListColumn<ClientRelated["projects"][number]>[] = [
    { key: "titulo", header: "Projeto", primary: true, cell: (row) => <span className="block break-words">{row.title}</span> },
    { key: "etapa", header: "Etapa", hideLabelOnMobile: true, cell: (row) => <Badge tone={row.stage === "entregue" ? "sucesso" : row.stage === "cancelado" ? "neutral" : "roxo"} dot>{PROJECT_STAGE_LABELS[row.stage]}</Badge> },
    { key: "evento", header: "Data do evento", hideOnMobile: true, cell: (row) => <DateText value={row.eventDate} /> },
    { key: "entrega", header: "Entrega", align: "right", cell: (row) => <DateText value={row.deliveryDeadline} /> },
  ];
  return (
    <>
      <SectionHeader title="Projetos do cliente" action={<ButtonLink href={`/painel/projetos/novo?cliente=${clientId}`} size="sm" icon={<FolderPlus />}>Novo projeto</ButtonLink>} />
      <DataList
        caption="Projetos do cliente"
        columns={columns}
        rows={rows}
        rowKey={(row) => row.id}
        href={(row) => `/painel/projetos/${row.id}`}
        empty={<EmptyState variant="plain" icon={<FolderPlus />} title="Nenhum projeto ainda" description="Quando o orçamento for aceito, crie o projeto para acompanhar prazos e entregas." action={<ButtonLink href={`/painel/projetos/novo?cliente=${clientId}`} icon={<FolderPlus />}>Novo projeto</ButtonLink>} />}
      />
    </>
  );
}

function ContractsSection({ clientId, rows }: { clientId: number; rows: ClientRelated["contracts"] }) {
  const columns: DataListColumn<ClientRelated["contracts"][number]>[] = [
    {
      key: "titulo",
      header: "Contrato",
      primary: true,
      cell: (row) => (
        <>
          <span className="block break-words">{row.title}</span>
          <span className="text-texto-suave block text-[0.8125rem] font-normal">{CONTRACT_KIND_LABELS[row.kind]}</span>
        </>
      ),
    },
    { key: "status", header: "Status", hideLabelOnMobile: true, cell: (row) => <Badge tone={row.status === "assinado" ? "sucesso" : row.status === "cancelado" ? "perigo" : row.status === "enviado" ? "roxo" : "neutral"} dot>{CONTRACT_STATUS_LABELS[row.status]}</Badge> },
    { key: "assinatura", header: "Assinado em", align: "right", hideOnMobile: true, cell: (row) => <DateText value={row.signedAt} /> },
  ];
  return (
    <>
      <SectionHeader title="Contratos do cliente" action={<ButtonLink href={`/painel/contratos/novo?cliente=${clientId}`} size="sm" icon={<FilePlus2 />}>Novo contrato</ButtonLink>} />
      <DataList
        caption="Contratos do cliente"
        columns={columns}
        rows={rows}
        rowKey={(row) => row.id}
        href={(row) => `/painel/contratos/${row.id}`}
        empty={<EmptyState variant="plain" icon={<FilePlus2 />} title="Nenhum contrato ainda" description="Gere o contrato a partir de um modelo, já com os dados deste cliente." action={<ButtonLink href={`/painel/contratos/novo?cliente=${clientId}`} icon={<FilePlus2 />}>Novo contrato</ButtonLink>} />}
      />
    </>
  );
}

function FinanceSection({ clientId, finance }: { clientId: number; finance: ClientRelated["finance"] }) {
  const { summary, entries } = finance;
  const columns: DataListColumn<ClientRelated["finance"]["entries"][number]>[] = [
    {
      key: "descricao",
      header: "Lançamento",
      primary: true,
      cell: (row) => (
        <>
          <span className="block break-words">{row.description}</span>
          <span className="text-texto-suave block text-[0.8125rem] font-normal">
            {row.type === "receita" ? "Receita" : "Despesa"}
            {row.installmentLabel ? ` · ${row.installmentLabel}` : ""}
          </span>
        </>
      ),
    },
    { key: "vence", header: "Vencimento", hideOnMobile: true, cell: (row) => <DateText value={row.dueDate} /> },
    { key: "situacao", header: "Situação", hideLabelOnMobile: true, cell: (row) => (row.paidAt ? <Badge tone="sucesso" dot>{row.type === "receita" ? "Recebido" : "Pago"}</Badge> : <Badge tone={row.dueDate < todayISO() ? "perigo" : "alerta"} dot>{row.dueDate < todayISO() ? "Vencido" : "Previsto"}</Badge>) },
    { key: "valor", header: "Valor", align: "right", cell: (row) => <Money cents={row.type === "despesa" ? -row.amountCents : row.amountCents} colored /> },
  ];
  return (
    <>
      <SectionHeader title="Financeiro do cliente" action={<ButtonLink href={`/painel/financeiro/novo?tipo=receita&cliente=${clientId}`} size="sm" icon={<Wallet />}>Nova receita</ButtonLink>} />
      {finance.total > 0 ? (
        <dl className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            { label: "Receitas previstas", value: summary.incomePlanned },
            { label: "Já recebido", value: summary.incomeReceived },
            { label: "A receber", value: summary.incomeOpen },
            { label: "Despesas (pagas de previstas)", value: summary.expensePaid, extra: summary.expensePlanned },
          ].map((item) => (
            <div key={item.label} className="card card-pad !p-4">
              <dt className="text-texto-suave text-[0.8125rem] font-semibold">{item.label}</dt>
              <dd className="text-texto mt-1 text-lg font-bold">
                <Money cents={item.value} />
                {item.extra !== undefined ? <span className="text-texto-suave block text-[0.8125rem] font-normal">de <Money cents={item.extra} /></span> : null}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
      <DataList
        caption="Lançamentos do cliente"
        columns={columns}
        rows={entries}
        rowKey={(row) => row.id}
        href={(row) => `/painel/financeiro/${row.id}`}
        empty={<EmptyState variant="plain" icon={<Wallet />} title="Nenhum lançamento financeiro" description="Registre a entrada e as parcelas deste cliente para acompanhar previsto × recebido." action={<ButtonLink href={`/painel/financeiro/novo?tipo=receita&cliente=${clientId}`} icon={<Wallet />}>Nova receita</ButtonLink>} />}
      />
      {finance.total > entries.length ? <p className="text-texto-suave mt-2 text-sm">Mostrando {entries.length} de {finance.total} lançamentos. Veja todos em <Link href="/painel/financeiro" className="link">Financeiro</Link>.</p> : null}
    </>
  );
}

function AgendaSection({ clientId, events, tasks, today }: { clientId: number; events: ClientRelated["events"]; tasks: ClientRelated["tasks"]; today: string }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
      <Card as="section" aria-labelledby="agenda-titulo">
        <CardHeader id="agenda-titulo" title="Próximos compromissos" action={<ButtonLink href={`/painel/agenda/novo?cliente=${clientId}`} size="sm" variant="secondary" icon={<CalendarPlus />}>Agendar</ButtonLink>} />
        {events.length === 0 ? (
          <EmptyState variant="plain" icon={<CalendarPlus />} title="Nada agendado" description="Agende uma reunião, gravação ou entrega com este cliente." action={<ButtonLink href={`/painel/agenda/novo?cliente=${clientId}`} icon={<CalendarPlus />}>Agendar</ButtonLink>} />
        ) : (
          <ul className="divide-borda divide-y">
            {events.map((event) => (
              <li key={event.id}>
                <Link href={`/painel/agenda/${event.id}`} className="hover:bg-detalhe-suave -mx-2 flex min-h-11 items-center justify-between gap-3 rounded-md px-2 py-2">
                  <span className="min-w-0">
                    <span className="text-texto block text-[0.9375rem] font-semibold break-words">{event.title}</span>
                    <span className="text-texto-suave block text-[0.8125rem]">{AGENDA_KIND_LABELS[event.kind]}</span>
                  </span>
                  <span className="text-texto-suave shrink-0 text-right text-sm">
                    <DateText value={event.date} format="short" />
                    {event.startTime ? <span className="block">{event.startTime}</span> : null}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card as="section" aria-labelledby="tarefas-titulo">
        <CardHeader id="tarefas-titulo" title="Tarefas em aberto" action={<ButtonLink href={`/painel/tarefas?cliente=${clientId}`} size="sm" variant="secondary" icon={<ListPlus />}>Ver tarefas</ButtonLink>} />
        {tasks.length === 0 ? (
          <EmptyState variant="plain" icon={<ListPlus />} title="Nenhuma tarefa em aberto" description="Crie tarefas ligadas a este cliente para não perder prazos." action={<ButtonLink href={`/painel/tarefas?cliente=${clientId}`} icon={<ListPlus />}>Abrir tarefas</ButtonLink>} />
        ) : (
          <ul className="divide-borda divide-y">
            {tasks.map((task) => (
              <li key={task.id} className="flex min-h-11 items-center justify-between gap-3 py-2">
                <span className="min-w-0">
                  <span className="text-texto block text-[0.9375rem] break-words">{task.title}</span>
                  <span className="text-texto-suave block text-[0.8125rem]">
                    {task.ownerName ?? "Sem responsável"}
                    {task.priority === "alta" ? ` · prioridade ${TASK_PRIORITY_LABELS.alta.toLowerCase()}` : ""}
                  </span>
                </span>
                {task.dueDate ? (
                  <Badge tone={task.dueDate < today ? "perigo" : "neutral"}>
                    <DateText value={task.dueDate} format="relative" />
                  </Badge>
                ) : (
                  <span className="text-texto-suave shrink-0 text-sm">Sem prazo</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
