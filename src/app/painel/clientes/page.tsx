import { Download, Plus, SearchX, UserRound } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { StatusBadge } from "@/components/ui/badge";
import { Board, type BoardColumn } from "@/components/ui/board";
import { ButtonLink, buttonClasses } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { DataList, type DataListColumn } from "@/components/ui/data-list";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterBar } from "@/components/ui/filter-bar";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { parsePage, type PageSearchParams } from "@/components/ui/search-params";
import { DateText } from "@/components/ui/text";
import { requireUser } from "@/lib/auth";
import { CLIENT_PIPELINE, CLIENT_STATUS_LABELS, CONTACT_SOURCE_LABELS, SERVICE_INTEREST_LABELS } from "@/lib/domain";
import { formatPhone } from "@/lib/format";
import { cn } from "@/lib/cn";
import { FUNNEL_LIMIT, listClients, listClientsForBoard, type ClientListItem } from "@/server/clients/admin";
import { getUserOptions } from "@/server/options";
import { moveClientAction } from "./actions";
import { clientFiltersFromParams, clientFiltersToQuery, isFunnelView } from "./filters";
import { CLIENT_STATUS_TONES } from "./ui";

export const metadata: Metadata = { title: "Clientes" };
export const instant = false;

const columns: DataListColumn<ClientListItem>[] = [
  {
    key: "nome",
    header: "Cliente",
    primary: true,
    cell: (client) => (
      <>
        <span className="block break-words">{client.name}</span>
        <span className="text-texto-suave block text-[0.8125rem] font-normal">
          {[client.contactName, client.whatsapp ? formatPhone(client.whatsapp) : "", client.city].filter(Boolean).join(" · ") || "Sem contato cadastrado"}
        </span>
      </>
    ),
  },
  { key: "status", header: "Status", hideLabelOnMobile: true, cell: (client) => <StatusBadge value={client.status} labels={CLIENT_STATUS_LABELS} tones={CLIENT_STATUS_TONES} /> },
  { key: "servico", header: "Serviço", hideOnMobile: true, cell: (client) => SERVICE_INTEREST_LABELS[client.serviceInterest] },
  { key: "origem", header: "Origem", hideOnMobile: true, cell: (client) => CONTACT_SOURCE_LABELS[client.source] },
  { key: "responsavel", header: "Responsável", hideOnMobile: true, cell: (client) => client.ownerName ?? <span className="text-texto-suave">—</span> },
  {
    key: "proximo",
    header: "Próximo passo",
    cell: (client) =>
      client.nextStep || client.nextStepDate ? (
        <>
          <span className="block break-words">{client.nextStep || "Sem descrição"}</span>
          {client.nextStepDate ? <DateText value={client.nextStepDate} format="relative" className="text-texto-suave text-[0.8125rem]" /> : null}
        </>
      ) : (
        <span className="text-texto-suave">—</span>
      ),
  },
  { key: "atualizado", header: "Atualizado", align: "right", hideOnMobile: true, cell: (client) => <DateText value={client.updatedAt} format="relative" className="text-texto-suave" /> },
];

export default async function ClientsPage({ searchParams }: { searchParams: PageSearchParams }) {
  const user = await requireUser();
  const params = await searchParams;
  const funnel = isFunnelView(params.vista);
  const filters = clientFiltersFromParams(params);
  const owners = await getUserOptions();
  const filtered = Boolean(filters.status || filters.owner || filters.service || filters.source || filters.q);
  const query = clientFiltersToQuery(filters);

  const toggle = (
    <div role="group" aria-label="Modo de visualização" className="mb-4 inline-flex gap-1 rounded-campo bg-superficie p-1 shadow-sm ring-1 ring-borda">
      {[
        { label: "Lista", href: `/painel/clientes${query}`, active: !funnel },
        { label: "Funil", href: `/painel/clientes${clientFiltersToQuery({ ...filters, status: undefined }, { vista: "funil" })}`, active: funnel },
      ].map((item) => (
        <Link key={item.label} href={item.href} aria-current={item.active ? "page" : undefined} className={cn(buttonClasses({ variant: item.active ? "primary" : "ghost" }), "min-w-24")}>
          {item.label}
        </Link>
      ))}
    </div>
  );

  const header = (
    <PageHeader
      title="Clientes"
      description="Quem já falou com a gente: histórico de atendimento, orçamentos, projetos e financeiro de cada cliente num lugar só."
      actions={
        <>
          {/* exportação é só de administradores (a rota confere de novo) */}
          {user.role === "admin" ? (
            <ButtonLink href={`/painel/clientes/exportar${query}`} download prefetch={false} variant="secondary" icon={<Download />}>
              Exportar CSV
            </ButtonLink>
          ) : null}
          <ButtonLink href="/painel/clientes/novo" icon={<Plus />}>
            Novo cliente
          </ButtonLink>
        </>
      }
    />
  );

  const filterBar = (
    <FilterBar
      preserve={["vista"]}
      search={{ placeholder: "Nome, contato, e-mail ou WhatsApp", label: "Buscar clientes" }}
      filters={[
        // no funil as colunas já são os status
        ...(funnel ? [] : [{ name: "status", label: "Status", options: CLIENT_STATUS_LABELS, allLabel: "Todos os status" }]),
        { name: "responsavel", label: "Responsável", options: owners, allLabel: "Todos os responsáveis" },
        { name: "servico", label: "Serviço de interesse", options: SERVICE_INTEREST_LABELS, allLabel: "Todos os serviços" },
        { name: "origem", label: "Origem", options: CONTACT_SOURCE_LABELS, allLabel: "Todas as origens" },
      ]}
    />
  );

  if (funnel) {
    const { rows, truncated } = await listClientsForBoard(filters);
    const boardColumns: BoardColumn[] = [
      ...CLIENT_PIPELINE.map((status) => ({ id: status, title: CLIENT_STATUS_LABELS[status], tone: CLIENT_STATUS_TONES[status] })),
      { id: "perdido", title: CLIENT_STATUS_LABELS.perdido, tone: "perigo" },
      { id: "cancelado", title: CLIENT_STATUS_LABELS.cancelado, tone: "neutral" },
    ];
    return (
      <>
        {header}
        {toggle}
        {filterBar}
        {truncated ? <Alert tone="alerta" className="mb-4">Mostrando os {FUNNEL_LIMIT} clientes mais recentes. Use a busca ou os filtros para ver os demais.</Alert> : null}
        {rows.length === 0 && !filtered ? (
          <EmptyState icon={<UserRound />} title="Nenhum cliente no funil" description="Cadastre o primeiro cliente ou converta um lead em cliente." action={<ButtonLink href="/painel/clientes/novo" icon={<Plus />}>Novo cliente</ButtonLink>} />
        ) : (
          <>
            <p className="text-texto-suave mb-3 text-sm">Arraste o cartão para outra etapa — ou use &ldquo;Mover para…&rdquo; no celular. Cada mudança fica registrada no histórico do cliente.</p>
            <Board
              label="Funil de clientes"
              columns={boardColumns}
              emptyLabel="Nenhum cliente nesta etapa."
              onMove={moveClientAction}
              cards={rows.map((client) => ({
                id: client.id,
                columnId: client.status,
                label: client.name,
                content: <FunnelCard client={client} />,
              }))}
            />
          </>
        )}
      </>
    );
  }

  const { rows, total, page, pageSize } = await listClients({ ...filters, page: parsePage(params.pagina) });
  return (
    <>
      {header}
      {toggle}
      {filterBar}
      <DataList
        caption="Clientes"
        columns={columns}
        rows={rows}
        rowKey={(client) => client.id}
        href={(client) => `/painel/clientes/${client.id}`}
        empty={
          filtered ? (
            <EmptyState variant="plain" icon={<SearchX />} title="Nenhum cliente com esses filtros" description="Tente outro termo ou limpe os filtros." action={<ButtonLink href="/painel/clientes" variant="secondary">Limpar filtros</ButtonLink>} />
          ) : (
            <EmptyState
              variant="plain"
              icon={<UserRound />}
              title="Nenhum cliente cadastrado"
              description="Cadastre quem já entrou em contato — ou abra um lead e use “Converter em cliente”."
              action={<ButtonLink href="/painel/clientes/novo" icon={<Plus />}>Novo cliente</ButtonLink>}
            />
          )
        }
      />
      <Pagination page={page} pageSize={pageSize} total={total} noun={total === 1 ? "cliente" : "clientes"} />
    </>
  );
}

function FunnelCard({ client }: { client: ClientListItem }) {
  return (
    <div className="min-w-0 space-y-1">
      <Link href={`/painel/clientes/${client.id}`} className="text-texto hover:text-detalhe block text-[0.9375rem] leading-snug font-bold break-words">
        {client.name}
      </Link>
      <p className="text-texto-suave text-[0.8125rem]">{SERVICE_INTEREST_LABELS[client.serviceInterest]}</p>
      {client.nextStep || client.nextStepDate ? (
        <p className="text-texto text-[0.8125rem] break-words">
          {client.nextStep}
          {client.nextStepDate ? (
            <>
              {client.nextStep ? " · " : ""}
              <DateText value={client.nextStepDate} format="relative" className="font-semibold" />
            </>
          ) : null}
        </p>
      ) : null}
      {client.ownerName ? <p className="text-texto-suave text-xs">{client.ownerName}</p> : null}
    </div>
  );
}
