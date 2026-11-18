import { FileSignature, FileText, Plus, SearchX } from "lucide-react";
import type { Metadata } from "next";
import { StatusBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { DataList, type DataListColumn } from "@/components/ui/data-list";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterBar } from "@/components/ui/filter-bar";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { paramId, paramOneOf, paramText, parsePage, type PageSearchParams } from "@/components/ui/search-params";
import { DateText } from "@/components/ui/text";
import { requireUser } from "@/lib/auth";
import { CONTRACT_KIND_LABELS, CONTRACT_KINDS, CONTRACT_STATUS_LABELS, CONTRACT_STATUSES } from "@/lib/domain";
import { listContracts, type ContractListItem } from "@/server/contracts/admin";
import { getClientOptions } from "@/server/options";
import { CONTRACT_STATUS_TONES } from "./ui";

export const metadata: Metadata = { title: "Contratos" };
export const instant = false;

const columns: DataListColumn<ContractListItem>[] = [
  {
    key: "titulo",
    header: "Contrato",
    primary: true,
    cell: (c) => (
      <>
        <span className="block break-words">{c.title}</span>
        <span className="text-cinza block text-[0.8125rem] font-normal">
          {CONTRACT_KIND_LABELS[c.kind]}
          {c.versionLabel ? ` · ${c.versionLabel}` : ""}
        </span>
      </>
    ),
  },
  { key: "cliente", header: "Cliente", cell: (c) => c.clientName ?? <span className="text-cinza">—</span> },
  { key: "status", header: "Status", cell: (c) => <StatusBadge value={c.status} labels={CONTRACT_STATUS_LABELS} tones={CONTRACT_STATUS_TONES} /> },
  { key: "assinatura", header: "Assinado em", hideOnMobile: true, cell: (c) => (c.signedAt ? <DateText value={c.signedAt} /> : <span className="text-cinza">—</span>) },
  { key: "vigencia", header: "Vigência até", hideOnMobile: true, align: "right", cell: (c) => (c.validUntil ? <DateText value={c.validUntil} /> : <span className="text-cinza">—</span>) },
];

export default async function ContractsPage({ searchParams }: { searchParams: PageSearchParams }) {
  await requireUser();
  const params = await searchParams;
  const clientOptions = await getClientOptions();
  const clientId = paramId(params.cliente);
  const filters = {
    kind: paramOneOf(CONTRACT_KINDS, params.tipo),
    status: paramOneOf(CONTRACT_STATUSES, params.status),
    clientId: clientOptions.some((o) => o.value === clientId) ? clientId : undefined,
    q: paramText(params.q),
    page: parsePage(params.pagina),
  };
  const { rows, total, page, pageSize } = await listContracts(filters);
  const filtered = Boolean(filters.kind || filters.status || filters.clientId || filters.q);

  return (
    <>
      <PageHeader
        title="Contratos"
        description="Contratos e acordos com datas, vigência e o arquivo assinado. A assinatura eletrônica não faz parte desta fase: o documento assinado é anexado ou ligado por link."
        actions={
          <>
            <ButtonLink href="/painel/contratos/modelos" variant="secondary" icon={<FileText />}>
              Modelos
            </ButtonLink>
            <ButtonLink href="/painel/contratos/novo" icon={<Plus />}>
              Novo contrato
            </ButtonLink>
          </>
        }
      />

      <FilterBar
        search={{ placeholder: "Buscar por título ou cliente", label: "Buscar contratos" }}
        filters={[
          { name: "tipo", label: "Tipo", options: CONTRACT_KIND_LABELS, allLabel: "Todos os tipos" },
          { name: "status", label: "Status", options: CONTRACT_STATUS_LABELS, allLabel: "Todos os status" },
          { name: "cliente", label: "Cliente", options: clientOptions.map((o) => ({ value: String(o.value), label: o.label })), allLabel: "Todos os clientes" },
        ]}
      />

      <DataList
        caption="Contratos"
        columns={columns}
        rows={rows}
        rowKey={(c) => c.id}
        href={(c) => `/painel/contratos/${c.id}`}
        empty={
          filtered ? (
            <EmptyState variant="plain" icon={<SearchX />} title="Nenhum contrato com esses filtros" description="Tente outro termo ou limpe os filtros." action={<ButtonLink href="/painel/contratos" variant="secondary">Limpar filtros</ButtonLink>} />
          ) : (
            <EmptyState
              variant="plain"
              icon={<FileSignature />}
              title="Nenhum contrato por enquanto"
              description="Comece por um modelo de texto (mensal, evento, casamento, diária…) ou cadastre um contrato já assinado com o arquivo em PDF."
              action={<ButtonLink href="/painel/contratos/novo" icon={<Plus />}>Novo contrato</ButtonLink>}
            />
          )
        }
      />
      <Pagination page={page} pageSize={pageSize} total={total} noun={total === 1 ? "contrato" : "contratos"} />
    </>
  );
}
