import { History, SearchX } from "lucide-react";
import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataList, type DataListColumn } from "@/components/ui/data-list";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterBar } from "@/components/ui/filter-bar";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { firstParam, paramId, paramText, parsePage, type PageSearchParams } from "@/components/ui/search-params";
import { DateText } from "@/components/ui/text";
import type { AuditLogEntry } from "@/db/schema";
import { isISODate } from "@/lib/dates";
import { requirePermission } from "@/lib/auth";
import { auditFilterOptions, listAudit } from "@/server/config/audit";
import { actionLabel, ACTION_LABELS, entityLabel, ENTITY_LABELS } from "./labels";
import { PeriodFields } from "./period-fields";

export const metadata: Metadata = { title: "Auditoria" };
export const instant = false;

const columns: DataListColumn<AuditLogEntry>[] = [
  {
    key: "quando",
    header: "Quando",
    primary: true,
    className: "whitespace-nowrap",
    cell: (row) => <DateText value={row.createdAt} format="datetime" />,
  },
  { key: "quem", header: "Quem", cell: (row) => row.userName ?? <span className="text-texto-suave">Sistema ou visitante</span> },
  {
    key: "acao",
    header: "Ação",
    cell: (row) => (
      <span className="flex flex-wrap items-center gap-1.5">
        <Badge tone={row.action === "delete" ? "perigo" : row.action === "export" || row.action === "login_falhou" ? "alerta" : "neutral"}>{actionLabel(row.action)}</Badge>
        {row.entity ? <span className="text-texto-suave text-[0.8125rem]">{entityLabel(row.entity)}{row.entityId ? ` #${row.entityId}` : ""}</span> : null}
      </span>
    ),
  },
  { key: "resumo", header: "O que aconteceu", cell: (row) => <span className="break-words">{row.summary ?? "—"}</span> },
];

export default async function AuditPage({ searchParams }: { searchParams: PageSearchParams }) {
  await requirePermission("auditoria", "ver");
  const params = await searchParams;
  const options = await auditFilterOptions();

  let from = isISODate(firstParam(params.de)) ? firstParam(params.de) : undefined;
  let to = isISODate(firstParam(params.ate)) ? firstParam(params.ate) : undefined;
  if (from && to && from > to) [from, to] = [to, from]; // datas trocadas: corrige em vez de mostrar lista vazia

  const userParam = firstParam(params.usuario);
  const filters = {
    userId: userParam === "0" ? 0 : paramId(params.usuario),
    action: options.actions.find((value) => value === firstParam(params.acao)),
    entity: options.entities.find((value) => value === firstParam(params.entidade)),
    from,
    to,
    q: paramText(params.q),
    page: parsePage(params.pagina),
  };
  const { rows, total, page, pageSize } = await listAudit(filters);
  const filtered = Boolean(filters.userId !== undefined || filters.action || filters.entity || filters.from || filters.to || filters.q);

  return (
    <>
      <PageHeader title="Auditoria" description="O histórico de quem fez o quê no painel. Os registros não podem ser editados nem apagados por aqui." back={{ href: "/painel/config", label: "Configurações" }} />

      <FilterBar
        search={{ placeholder: "Buscar no texto ou no nome", label: "Buscar na auditoria" }}
        filters={[
          { name: "usuario", label: "Usuário", allLabel: "Todas as pessoas", options: [...options.users.map((u) => ({ value: u.id, label: u.name })), { value: 0, label: "Sistema ou visitante" }] },
          { name: "acao", label: "Ação", allLabel: "Todas as ações", options: options.actions.map((value) => ({ value, label: ACTION_LABELS[value] ?? value })) },
          { name: "entidade", label: "Tipo de registro", allLabel: "Todos os tipos", options: options.entities.map((value) => ({ value, label: ENTITY_LABELS[value] ?? value })) },
        ]}
      >
        <PeriodFields />
      </FilterBar>

      <DataList
        caption="Trilha de auditoria"
        columns={columns}
        rows={rows}
        rowKey={(row) => row.id}
        empty={
          filtered ? (
            <EmptyState variant="plain" icon={<SearchX />} title="Nenhum evento com esses filtros" description="Tente outro período ou limpe os filtros." action={<ButtonLink href="/painel/config/auditoria" variant="secondary">Limpar filtros</ButtonLink>} />
          ) : (
            <EmptyState variant="plain" icon={<History />} title="Nada registrado ainda" description="Logins, alterações e exportações aparecem aqui assim que acontecerem." />
          )
        }
      />
      <Pagination page={page} pageSize={pageSize} total={total} noun={total === 1 ? "evento" : "eventos"} />
    </>
  );
}
