import { FileText, LayoutTemplate, Plus, SearchX } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { DataList, type DataListColumn } from "@/components/ui/data-list";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterBar } from "@/components/ui/filter-bar";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { paramOneOf, paramText, parsePage, type PageSearchParams } from "@/components/ui/search-params";
import { DateText, Money } from "@/components/ui/text";
import { requireUser } from "@/lib/auth";
import { cn } from "@/lib/cn";
import { PROPOSAL_MODALITY_LABELS, PROPOSAL_STATUS_LABELS, PROPOSAL_STATUSES, type ProposalStatus } from "@/lib/domain";
import { countProposalsByStatus, listProposals, type ProposalListItem } from "@/server/proposals/admin";
import { PROPOSAL_STATUS_TONES } from "./ui";

export const metadata: Metadata = { title: "Orçamentos" };
export const instant = false;

const columns: DataListColumn<ProposalListItem>[] = [
  {
    key: "numero",
    header: "Proposta",
    primary: true,
    cell: (row) => (
      <>
        <span className="block tabular-nums">
          {row.number}
          {row.version > 1 ? <span className="bg-lavanda-claro text-roxo ml-2 rounded-full px-2 py-0.5 text-xs font-bold">v{row.version}</span> : null}
        </span>
        <span className="text-cinza block text-[0.8125rem] font-normal break-words">{row.title}</span>
      </>
    ),
  },
  {
    key: "cliente",
    header: "Cliente",
    cell: (row) => (row.clientLabel ? <span className="break-words">{row.clientLabel}</span> : <span className="text-cinza">Sem cliente</span>),
  },
  { key: "modalidade", header: "Modalidade", hideOnMobile: true, cell: (row) => PROPOSAL_MODALITY_LABELS[row.modality] },
  { key: "total", header: "Total", align: "right", className: "whitespace-nowrap", cell: (row) => <Money cents={row.totalCents} /> },
  {
    key: "validade",
    header: "Validade",
    className: "whitespace-nowrap",
    cell: (row) =>
      row.overdue ? (
        <span className="text-perigo font-semibold">
          <DateText value={row.validUntil} /> <Badge tone="perigo">Vencida</Badge>
        </span>
      ) : (
        <DateText value={row.validUntil} className="text-cinza" />
      ),
  },
  { key: "status", header: "Status", cell: (row) => <StatusBadge value={row.status} labels={PROPOSAL_STATUS_LABELS} tones={PROPOSAL_STATUS_TONES} /> },
  { key: "responsavel", header: "Responsável", hideOnMobile: true, cell: (row) => row.ownerName?.split(" ")[0] ?? <span className="text-cinza">—</span> },
];

export default async function ProposalsPage({ searchParams }: { searchParams: PageSearchParams }) {
  await requireUser();
  const params = await searchParams;
  const filters = {
    status: paramOneOf(PROPOSAL_STATUSES, params.status),
    q: paramText(params.q),
    page: parsePage(params.pagina),
  };
  const [{ rows, total, page, pageSize }, counts] = await Promise.all([listProposals(filters), countProposalsByStatus()]);
  const filtered = Boolean(filters.status || filters.q);

  const tabHref = (status?: ProposalStatus) => {
    const query = new URLSearchParams();
    if (status) query.set("status", status);
    if (filters.q) query.set("q", filters.q);
    const text = query.toString();
    return `/painel/orcamentos${text ? `?${text}` : ""}`;
  };
  const tabs: { key: string; label: string; count: number; href: string; active: boolean }[] = [
    { key: "todas", label: "Todas", count: counts.all, href: tabHref(), active: !filters.status },
    ...PROPOSAL_STATUSES.map((status) => ({
      key: status,
      label: PROPOSAL_STATUS_LABELS[status],
      count: counts[status],
      href: tabHref(status),
      active: filters.status === status,
    })),
  ];

  return (
    <>
      <PageHeader
        title="Orçamentos"
        description="Propostas comerciais: monte o escopo, confira a conta interna e gere o PDF para o cliente."
        actions={
          <>
            <ButtonLink href="/painel/orcamentos/modelos" variant="secondary" icon={<LayoutTemplate />}>
              Modelos
            </ButtonLink>
            <ButtonLink href="/painel/orcamentos/novo" icon={<Plus />}>
              Novo orçamento
            </ButtonLink>
          </>
        }
      />

      <nav aria-label="Filtrar por status" className="border-areia -mx-4 mb-4 flex gap-1 overflow-x-auto border-b px-4 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden">
        {tabs.map((tab) => (
          <Link
            key={tab.key}
            href={tab.href}
            aria-current={tab.active ? "page" : undefined}
            className={cn(
              "hover:text-roxo relative inline-flex min-h-11 shrink-0 items-center gap-2 px-3 text-sm font-semibold whitespace-nowrap transition-colors after:absolute after:inset-x-3 after:bottom-0 after:h-[3px] after:rounded-t-full",
              tab.active ? "text-roxo after:bg-roxo" : "text-cinza after:bg-transparent",
            )}
          >
            {tab.label}
            <span className={cn("rounded-full px-1.5 text-xs leading-5 font-bold tabular-nums", tab.active ? "bg-roxo text-white" : "bg-lavanda-claro text-roxo")}>{tab.count}</span>
          </Link>
        ))}
      </nav>

      <FilterBar search={{ placeholder: "Buscar por número, cliente ou título", label: "Buscar propostas" }} preserve={["status"]} />

      <DataList
        caption="Propostas"
        columns={columns}
        rows={rows}
        rowKey={(row) => row.id}
        href={(row) => `/painel/orcamentos/${row.id}`}
        highlight={(row) => row.overdue}
        highlightLabel="Validade vencida"
        empty={
          filtered ? (
            <EmptyState
              variant="plain"
              icon={<SearchX />}
              title="Nenhuma proposta com esses filtros"
              description="Tente outro termo ou veja todas as propostas."
              action={
                <ButtonLink href="/painel/orcamentos" variant="secondary">
                  Limpar filtros
                </ButtonLink>
              }
            />
          ) : (
            <EmptyState
              variant="plain"
              icon={<FileText />}
              title="Nenhum orçamento ainda"
              description="Crie o primeiro a partir de um modelo (casamento ou plano mensal) ou comece em branco. Ele nasce como rascunho e só vira PDF quando você quiser."
              action={
                <ButtonLink href="/painel/orcamentos/novo" icon={<Plus />}>
                  Novo orçamento
                </ButtonLink>
              }
            />
          )
        }
      />
      <Pagination page={page} pageSize={pageSize} total={total} noun={total === 1 ? "proposta" : "propostas"} />
    </>
  );
}
