import { Inbox, Plus, SearchX } from "lucide-react";
import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/button";
import { DataList, type DataListColumn } from "@/components/ui/data-list";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterBar } from "@/components/ui/filter-bar";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { paramOneOf, paramText, parsePage, type PageSearchParams } from "@/components/ui/search-params";
import { StatusBadge } from "@/components/ui/badge";
import { DateText } from "@/components/ui/text";
import { requireUser } from "@/lib/auth";
import { CONTACT_SOURCE_LABELS, LEAD_STATUS_LABELS, LEAD_STATUSES, SERVICE_INTEREST_LABELS, SERVICE_INTERESTS } from "@/lib/domain";
import { formatPhone } from "@/lib/format";
import { listLeads, type LeadListItem } from "@/server/leads/admin";
import { LEAD_STATUS_TONES } from "./ui";

export const metadata: Metadata = { title: "Leads" };
// Página de painel: lê o banco a cada visita, sem cache — navegar para cá pode esperar o servidor.
export const instant = false;

const columns: DataListColumn<LeadListItem>[] = [
  {
    key: "nome",
    header: "Nome",
    primary: true,
    cell: (lead) => (
      <>
        <span className="block break-words">{lead.name}</span>
        <span className="text-cinza block text-[0.8125rem] font-normal">
          {formatPhone(lead.whatsapp)}
          {lead.city ? ` · ${lead.city}` : ""}
        </span>
      </>
    ),
  },
  { key: "interesse", header: "Interesse", cell: (lead) => SERVICE_INTEREST_LABELS[lead.serviceInterest] },
  { key: "origem", header: "Origem", hideOnMobile: true, cell: (lead) => CONTACT_SOURCE_LABELS[lead.source] },
  { key: "status", header: "Status", cell: (lead) => <StatusBadge value={lead.status} labels={LEAD_STATUS_LABELS} tones={LEAD_STATUS_TONES} /> },
  { key: "recebido", header: "Recebido em", align: "right", cell: (lead) => <DateText value={lead.createdAt} format="datetime" className="text-cinza" /> },
];

export default async function LeadsPage({ searchParams }: { searchParams: PageSearchParams }) {
  await requireUser();
  const params = await searchParams;
  const filters = {
    // a URL é entrada do usuário: só passam valores que existem nos enums
    status: paramOneOf(LEAD_STATUSES, params.status),
    service: paramOneOf(SERVICE_INTERESTS, params.servico),
    q: paramText(params.q),
    page: parsePage(params.pagina),
  };
  const { rows, total, page, pageSize } = await listLeads(filters);
  const filtered = Boolean(filters.status || filters.service || filters.q);

  return (
    <>
      <PageHeader
        title="Leads"
        description="Pedidos que chegaram pelo formulário do site e contatos cadastrados à mão. Os não lidos aparecem em destaque."
        actions={
          <ButtonLink href="/painel/leads/novo" icon={<Plus />}>
            Cadastrar lead
          </ButtonLink>
        }
      />

      <FilterBar
        search={{ placeholder: "Buscar por nome, e-mail ou WhatsApp", label: "Buscar leads" }}
        filters={[
          { name: "status", label: "Status", options: LEAD_STATUS_LABELS, allLabel: "Todos os status" },
          { name: "servico", label: "Serviço de interesse", options: SERVICE_INTEREST_LABELS, allLabel: "Todos os interesses" },
        ]}
      />

      <DataList
        caption="Leads"
        columns={columns}
        rows={rows}
        rowKey={(lead) => lead.id}
        href={(lead) => `/painel/leads/${lead.id}`}
        highlight={(lead) => lead.readAt === null}
        highlightLabel="Não lido"
        empty={
          filtered ? (
            <EmptyState variant="plain" icon={<SearchX />} title="Nenhum lead com esses filtros" description="Tente outro termo ou limpe os filtros." action={<ButtonLink href="/painel/leads" variant="secondary">Limpar filtros</ButtonLink>} />
          ) : (
            <EmptyState
              variant="plain"
              icon={<Inbox />}
              title="Nenhum lead por enquanto"
              description="Quando alguém enviar o formulário do site, o pedido aparece aqui. Contatos que chegam por WhatsApp ou Instagram podem ser cadastrados à mão."
              action={<ButtonLink href="/painel/leads/novo" icon={<Plus />}>Cadastrar lead</ButtonLink>}
            />
          )
        }
      />
      <Pagination page={page} pageSize={pageSize} total={total} noun={total === 1 ? "lead" : "leads"} />
    </>
  );
}
