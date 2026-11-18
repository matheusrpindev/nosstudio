import { CalendarX2, Lightbulb, Plus, SearchX } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Board } from "@/components/ui/board";
import { ButtonLink } from "@/components/ui/button";
import { DataList, type DataListColumn } from "@/components/ui/data-list";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterBar, type FilterSelect } from "@/components/ui/filter-bar";
import { MonthCalendar, parseMonthParam, type CalendarItem } from "@/components/ui/month-calendar";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import type { PageSearchParams } from "@/components/ui/search-params";
import { DateText } from "@/components/ui/text";
import { requireUser } from "@/lib/auth";
import { formatDate, todayISO } from "@/lib/dates";
import {
  APPROVAL_STATUS_LABELS,
  CONTENT_FORMAT_LABELS,
  CONTENT_NETWORK_LABELS,
  CONTENT_STATUS_LABELS,
  CONTENT_STATUSES,
} from "@/lib/domain";
import { listBoard, listCalendar, listContent, type ContentListItem } from "@/server/content/admin";
import { calendarWindow } from "@/server/content/logic";
import { getClientOptions, getUserOptions } from "@/server/options";
import { moveContentAction } from "./actions";
import {
  accountOptions,
  APPROVAL_TONES,
  CALENDAR_STATUS_TONES,
  CONTENT_STATUS_TONES,
  EDIT_MARK,
  NOS_ACCOUNT_LABEL,
  parseContentQuery,
  RECORD_MARK,
} from "./ui";
import { ViewSwitch } from "./view-switch";

export const metadata: Metadata = { title: "Conteúdo" };
export const instant = false;

function accountLabel(item: Pick<ContentListItem, "clientName">) {
  return item.clientName ?? NOS_ACCOUNT_LABEL;
}

const listColumns: DataListColumn<ContentListItem>[] = [
  {
    key: "tema",
    header: "Tema",
    primary: true,
    cell: (item) => (
      <>
        <span className="block break-words">{item.title}</span>
        <span className="text-cinza block text-[0.8125rem] font-normal">
          {accountLabel(item)} · {CONTENT_NETWORK_LABELS[item.network]} · {CONTENT_FORMAT_LABELS[item.format]}
        </span>
      </>
    ),
  },
  { key: "status", header: "Status", cell: (item) => <StatusBadge value={item.status} labels={CONTENT_STATUS_LABELS} tones={CONTENT_STATUS_TONES} /> },
  {
    key: "aprovacao",
    header: "Aprovação",
    hideOnMobile: true,
    cell: (item) => <StatusBadge value={item.approvalStatus} labels={APPROVAL_STATUS_LABELS} tones={APPROVAL_TONES} />,
  },
  {
    key: "publicacao",
    header: "Publicação",
    cell: (item) => (item.publishDate ? <DateText value={item.publishDate} format="date" /> : <span className="text-cinza">Sem data</span>),
  },
  { key: "responsavel", header: "Responsável", hideOnMobile: true, cell: (item) => item.ownerName ?? <span className="text-cinza">—</span> },
];

function BoardCardBody({ item }: { item: ContentListItem }) {
  return (
    <div className="min-w-0 space-y-1.5">
      <Link href={`/painel/conteudo/${item.id}`} className="text-grafite hover:text-roxo block text-sm leading-snug font-semibold break-words">
        {item.title}
      </Link>
      <p className="text-cinza text-xs">
        {accountLabel(item)} · {CONTENT_NETWORK_LABELS[item.network]} · {CONTENT_FORMAT_LABELS[item.format]}
      </p>
      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        {item.publishDate ? <span className="text-grafite font-medium">Publica {formatDate(item.publishDate)}</span> : <span className="text-cinza">Sem data</span>}
        {item.status === "aprovacao" ? <StatusBadge value={item.approvalStatus} labels={APPROVAL_STATUS_LABELS} tones={APPROVAL_TONES} /> : null}
      </div>
      {item.ownerName ? <p className="text-cinza text-xs">Responsável: {item.ownerName}</p> : null}
    </div>
  );
}

export default async function ContentPage({ searchParams }: { searchParams: PageSearchParams }) {
  await requireUser();
  const params = await searchParams;
  const today = todayISO();
  const [clients, users] = await Promise.all([getClientOptions(), getUserOptions()]);
  const { view, filters, page, query } = parseContentQuery(params, clients, users);

  const filterSelects: FilterSelect[] = [
    { name: "conta", label: "Conta", options: accountOptions(clients), allLabel: "Todas as contas" },
    { name: "rede", label: "Rede", options: CONTENT_NETWORK_LABELS, allLabel: "Todas as redes" },
    { name: "formato", label: "Formato", options: CONTENT_FORMAT_LABELS, allLabel: "Formatos" },
    { name: "responsavel", label: "Responsável", options: users, allLabel: "Toda a equipe" },
  ];
  if (view !== "quadro") filterSelects.push({ name: "status", label: "Status", options: CONTENT_STATUS_LABELS, allLabel: "Todos os status" });
  if (view === "lista") filterSelects.push({ name: "data", label: "Data de publicação", options: [{ value: "sem", label: "Só sem data (ideias)" }], allLabel: "Qualquer data" });
  const filtered = query.size > 0;

  // "Novo" já com a conta filtrada (quando é um cliente)
  const newParams = new URLSearchParams();
  if (typeof filters.account === "number") newParams.set("cliente", String(filters.account));
  const newHref = (extra?: Record<string, string>) => {
    const p = new URLSearchParams(newParams);
    for (const [k, v] of Object.entries(extra ?? {})) p.set(k, v);
    return `/painel/conteudo/novo${p.size > 0 ? `?${p}` : ""}`;
  };

  let body: React.ReactNode;

  if (view === "calendario") {
    const month = parseMonthParam(params.mes, today);
    const { from, to } = calendarWindow(month);
    const { entries, undatedCount } = await listCalendar(filters, from, to);
    const items: CalendarItem[] = entries.map((entry) => ({
      id: entry.key,
      date: entry.date,
      href: `/painel/conteudo/${entry.id}`,
      ...(entry.kind === "publicacao"
        ? { title: entry.title, tone: CALENDAR_STATUS_TONES[entry.status] }
        : entry.kind === "gravacao"
          ? { title: `${RECORD_MARK} Gravar: ${entry.title}`, tone: "neutral" as const }
          : { title: `${EDIT_MARK} Editar até: ${entry.title}`, tone: "neutral" as const }),
    }));
    const baseQuery = new URLSearchParams(query);
    baseQuery.set("vista", "calendario");
    body = (
      <>
        <MonthCalendar
          month={month}
          today={today}
          items={items}
          baseHref={`/painel/conteudo?${baseQuery}`}
          label="Calendário editorial"
          daySlot={(date) => (
            <Link
              href={newHref({ data: date })}
              aria-label={`Novo conteúdo em ${formatDate(date)}`}
              title="Novo conteúdo neste dia"
              className="text-roxo hover:bg-lavanda-claro pointer-coarse:opacity-100 inline-flex size-11 items-center justify-center rounded-full sm:size-7 sm:opacity-0 sm:group-hover/dia:opacity-100 sm:focus-visible:opacity-100"
            >
              <Plus aria-hidden="true" className="size-5 sm:size-4" />
            </Link>
          )}
        />
        <ul aria-label="Legenda" className="mt-3 flex flex-wrap gap-2">
          {CONTENT_STATUSES.map((status) => (
            <li key={status}>
              <Badge tone={CONTENT_STATUS_TONES[status]} dot>
                {CONTENT_STATUS_LABELS[status]}
              </Badge>
            </li>
          ))}
          <li>
            <Badge tone="neutral">
              <span aria-hidden="true">{RECORD_MARK}</span> Data de gravação
            </Badge>
          </li>
          <li>
            <Badge tone="neutral">
              <span aria-hidden="true">{EDIT_MARK}</span> Prazo de edição
            </Badge>
          </li>
        </ul>
        <p className="text-cinza mt-2 text-[0.8125rem]">
          As cores mostram o status de cada publicação.{" "}
          {undatedCount > 0 ? (
            <>
              <Link href={`/painel/conteudo?${new URLSearchParams({ ...Object.fromEntries(query), vista: "lista", data: "sem" })}`} className="link">
                {undatedCount} {undatedCount === 1 ? "item ainda sem" : "itens ainda sem"} data de publicação
              </Link>{" "}
              (veja na lista de ideias).
            </>
          ) : null}
        </p>
        {entries.length === 0 && !filtered ? (
          <p className="text-cinza mt-2 text-[0.8125rem]">Nada marcado neste mês. Use o + de um dia para planejar uma publicação.</p>
        ) : null}
      </>
    );
  } else if (view === "quadro") {
    const { rows, hiddenPublished } = await listBoard(filters);
    body =
      rows.length === 0 ? (
        <EmptyState
          icon={filtered ? <SearchX /> : <Lightbulb />}
          title={filtered ? "Nenhum conteúdo com esses filtros" : "Nenhum conteúdo ainda"}
          description={filtered ? "Tente outros filtros ou limpe a busca." : "Comece registrando uma ideia. Depois é só arrastar o cartão a cada etapa: roteiro, gravação, edição, aprovação e publicação."}
          action={<ButtonLink href={newHref()} icon={<Plus />}>Nova ideia</ButtonLink>}
        />
      ) : (
        <>
          <Board
            label="Quadro de conteúdo por etapa"
            columns={CONTENT_STATUSES.map((status) => ({ id: status, title: CONTENT_STATUS_LABELS[status], tone: CONTENT_STATUS_TONES[status] }))}
            cards={rows.map((item) => ({ id: item.id, columnId: item.status, label: item.title, content: <BoardCardBody item={item} /> }))}
            onMove={moveContentAction}
            emptyLabel="Nada nesta etapa"
          />
          <p className="text-cinza mt-3 text-[0.8125rem]">
            Mover um cartão muda a etapa; ao chegar em Publicado sem data, usamos a de hoje.
            {hiddenPublished > 0 ? ` Em Publicado aparecem só os ${rows.filter((r) => r.status === "publicado").length} mais recentes — o resto está na lista.` : ""}
          </p>
        </>
      );
  } else {
    const { rows, total, page: currentPage, pageSize } = await listContent({ ...filters, page });
    body = (
      <>
        <DataList
          caption="Conteúdos e ideias"
          columns={listColumns}
          rows={rows}
          rowKey={(item) => item.id}
          href={(item) => `/painel/conteudo/${item.id}`}
          empty={
            filtered ? (
              <EmptyState variant="plain" icon={<SearchX />} title="Nenhum conteúdo com esses filtros" description="Tente outro termo ou limpe os filtros." action={<ButtonLink href="/painel/conteudo?vista=lista" variant="secondary">Limpar filtros</ButtonLink>} />
            ) : (
              <EmptyState
                variant="plain"
                icon={<CalendarX2 />}
                title="Nenhum conteúdo ainda"
                description="Anote ideias de posts e vídeos da NÓS e dos clientes. Quando tiver data, elas aparecem no calendário."
                action={<ButtonLink href={newHref()} icon={<Plus />}>Nova ideia</ButtonLink>}
              />
            )
          }
        />
        <Pagination page={currentPage} pageSize={pageSize} total={total} noun={total === 1 ? "conteúdo" : "conteúdos"} />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Conteúdo"
        description="Calendário editorial da NÓS e dos clientes. É organização interna: nada é publicado automaticamente nas redes."
        actions={
          <ButtonLink href={newHref()} icon={<Plus />}>
            Novo conteúdo
          </ButtonLink>
        }
      />
      <ViewSwitch current={view} query={query} />
      <FilterBar
        search={{ placeholder: "Buscar por tema, roteiro ou legenda", label: "Buscar conteúdo" }}
        preserve={["vista", "mes"]}
        filters={filterSelects}
      />
      {body}
    </>
  );
}
