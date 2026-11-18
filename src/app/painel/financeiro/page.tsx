import { ChevronLeft, ChevronRight, Download, Plus, Receipt, SearchX } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { ButtonLink, buttonClasses } from "@/components/ui/button";
import { Card, CardHeader, StatCard } from "@/components/ui/card";
import { DataList, type DataListColumn } from "@/components/ui/data-list";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterBar } from "@/components/ui/filter-bar";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import type { PageSearchParams } from "@/components/ui/search-params";
import { DateText, Money } from "@/components/ui/text";
import { requireUser } from "@/lib/auth";
import { addMonths, formatDate, formatMonth, formatRelativeDay, startOfMonth, todayISO } from "@/lib/dates";
import { FINANCE_CATEGORIES_BY_TYPE, FINANCE_CATEGORY_LABELS, FINANCE_TYPE_LABELS, type FinanceCategory } from "@/lib/domain";
import { formatBRL } from "@/lib/format";
import { getClientOptions, getProjectOptions } from "@/server/options";
import { FINANCE_PAGE_SIZE, getMonthEntries, getOverdueEntries, getProposalLabel, getRealizedEntries, listFinanceEntries, type FinanceListItem } from "@/server/finance/admin";
import { filtersToQuery, parseFinanceFilters, resolveScope } from "@/server/finance/filters";
import { entryStatus, monthlySeries, overdueTotals, reserveProgress, summarizeMonth, totalize } from "@/server/finance/summary";
import { getSetting } from "@/server/settings";
import { BalanceChart } from "./balance-chart";
import { DateFilter } from "./date-filter";
import { EntryActions } from "./entry-actions";
import { ReserveDialog } from "./reserve-dialog";
import { ENTRY_STATUS_LABELS, ENTRY_STATUS_TONES, SITUATION_FILTER_LABELS } from "./ui";

export const metadata: Metadata = { title: "Financeiro" };
export const instant = false;

const navButton = `${buttonClasses({ variant: "secondary" })} !px-0 w-11`;

export default async function FinancePage({ searchParams }: { searchParams: PageSearchParams }) {
  const user = await requireUser();
  const today = todayISO();
  const filters = parseFinanceFilters(await searchParams, today);
  const month = filters.month;
  const scope = resolveScope(filters);

  const [monthEntries, overdueEntries, realizedEntries, reserve, listed, clientOptions, projectOptions, proposalLabel] = await Promise.all([
    getMonthEntries(month),
    getOverdueEntries(today),
    getRealizedEntries(month, 6),
    getSetting("finance"),
    listFinanceEntries(filters, today),
    getClientOptions(),
    getProjectOptions(),
    filters.proposalId ? getProposalLabel(filters.proposalId) : null,
  ]);

  const summary = summarizeMonth(monthEntries, month);
  const overdue = overdueTotals(overdueEntries, today);
  const series = monthlySeries(realizedEntries, month, 6);
  const progress = reserveProgress(reserve.cashReserveCents, reserve.cashReserveGoalCents);
  const listTotals = totalize(listed);

  const pageCount = Math.max(1, Math.ceil(listed.length / FINANCE_PAGE_SIZE));
  const page = Math.min(filters.page, pageCount);
  const rows = listed.slice((page - 1) * FINANCE_PAGE_SIZE, page * FINANCE_PAGE_SIZE);

  const prevMonth = addMonths(month, -1).slice(0, 7);
  const nextMonth = addMonths(month, 1).slice(0, 7);
  const isCurrentMonth = month === startOfMonth(today);
  const monthHref = (value: string) => `/painel/financeiro?${filtersToQuery(filters, { mes: value, pagina: null })}`;
  const exportHref = `/painel/financeiro/exportar?${filtersToQuery(filters, { pagina: null })}`;
  const overdueHref = (type: "receita" | "despesa") => `/painel/financeiro?${new URLSearchParams({ mes: month.slice(0, 7), tipo: type, situacao: "vencido" }).toString()}#lancamentos`;
  const newHref = (type?: "receita" | "despesa") => `/painel/financeiro/novo${type ? `?tipo=${type}` : ""}`;

  const filtered = Boolean(filters.type || filters.category || filters.situation || filters.clientId || filters.projectId || filters.proposalId || filters.q || filters.from || filters.to);
  const scopeLabel =
    scope.kind === "month"
      ? `Lançamentos de ${formatMonth(month)}`
      : scope.kind === "range"
        ? `Lançamentos ${scope.from ? `de ${formatDate(scope.from)} ` : ""}${scope.to ? `até ${formatDate(scope.to)}` : ""}`.trim()
        : "Lançamentos de todo o período";

  const categoryOptions = (filters.type ? FINANCE_CATEGORIES_BY_TYPE[filters.type] : (Object.keys(FINANCE_CATEGORY_LABELS) as FinanceCategory[])).map((value) => ({ value, label: FINANCE_CATEGORY_LABELS[value] }));

  const columns: DataListColumn<FinanceListItem>[] = [
    {
      key: "descricao",
      header: "Descrição",
      primary: true,
      cell: (entry) => {
        const meta = [FINANCE_CATEGORY_LABELS[entry.category], entry.installmentLabel, entry.clientName, entry.projectTitle].filter(Boolean).join(" · ");
        return (
          <>
            <span className="block break-words">{entry.description}</span>
            <span className="text-cinza block text-[0.8125rem] font-normal break-words">
              <span className="sr-only">{FINANCE_TYPE_LABELS[entry.type]}: </span>
              {meta}
            </span>
          </>
        );
      },
    },
    {
      key: "vencimento",
      header: "Vencimento",
      cell: (entry) => {
        const status = entryStatus(entry, today);
        return (
          <>
            <DateText value={entry.dueDate} />
            {status === "realizado" ? (
              <span className="text-cinza block text-[0.8125rem]">
                {entry.type === "receita" ? "Recebido" : "Pago"} em <DateText value={entry.paidAt} />
              </span>
            ) : status === "vencido" ? (
              <span className="text-perigo block text-[0.8125rem] font-semibold">Venceu {formatRelativeDay(entry.dueDate, today)}</span>
            ) : null}
          </>
        );
      },
    },
    {
      key: "valor",
      header: "Valor",
      align: "right",
      cell: (entry) => <Money cents={entry.type === "receita" ? entry.amountCents : -entry.amountCents} colored className="font-semibold" />,
    },
    {
      key: "situacao",
      header: "Situação",
      hideLabelOnMobile: true,
      cell: (entry) => {
        const status = entryStatus(entry, today);
        return (
          <Badge tone={ENTRY_STATUS_TONES[status]} dot>
            {ENTRY_STATUS_LABELS[entry.type][status]}
          </Badge>
        );
      },
    },
    {
      key: "acoes",
      header: "Ações",
      interactive: true,
      hideLabelOnMobile: true,
      align: "right",
      cell: (entry) => (
        <EntryActions
          today={today}
          entry={{
            id: entry.id,
            type: entry.type,
            description: entry.description,
            amountLabel: formatBRL(entry.amountCents),
            dueDate: entry.dueDate,
            paid: entry.paidAt !== null,
            method: entry.method,
          }}
        />
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Financeiro"
        description="Receitas, despesas e a reserva de caixa: o que está previsto e o que já aconteceu."
        actions={
          <>
            {/* exportação é só de administradores (a rota confere de novo) */}
            {user.role === "admin" ? (
              <a href={exportHref} className={buttonClasses({ variant: "secondary" })}>
                <span className="btn-icone" aria-hidden="true">
                  <Download />
                </span>
                Exportar CSV
              </a>
            ) : null}
            <ButtonLink href={newHref()} icon={<Plus />}>
              Novo lançamento
            </ButtonLink>
          </>
        }
        className="!mb-0"
      />

      <Alert tone="info">Visão gerencial para acompanhar o caixa. Não substitui a contabilidade.</Alert>

      {/* ------------------------------------------------------------ vencidos */}
      {overdue.receber.count + overdue.pagar.count > 0 ? (
        <section aria-labelledby="vencidos-titulo" className="space-y-3">
          <h2 id="vencidos-titulo" className="text-perigo text-base font-bold">
            Atenção: vencidos
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {overdue.receber.count > 0 ? (
              <Link href={overdueHref("receita")} className="border-perigo/30 bg-perigo-claro hover:border-perigo block rounded-cartao border p-4 transition-colors sm:p-5">
                <p className="text-perigo text-sm font-semibold">A receber vencido</p>
                <p className="text-perigo mt-1.5 text-2xl font-extrabold tabular-nums">{formatBRL(overdue.receber.cents)}</p>
                <p className="text-grafite mt-1 text-[0.8125rem]">
                  {overdue.receber.count} {overdue.receber.count === 1 ? "lançamento atrasado" : "lançamentos atrasados"} · ver lista
                </p>
              </Link>
            ) : null}
            {overdue.pagar.count > 0 ? (
              <Link href={overdueHref("despesa")} className="border-perigo/30 bg-perigo-claro hover:border-perigo block rounded-cartao border p-4 transition-colors sm:p-5">
                <p className="text-perigo text-sm font-semibold">A pagar vencido</p>
                <p className="text-perigo mt-1.5 text-2xl font-extrabold tabular-nums">{formatBRL(overdue.pagar.cents)}</p>
                <p className="text-grafite mt-1 text-[0.8125rem]">
                  {overdue.pagar.count} {overdue.pagar.count === 1 ? "lançamento atrasado" : "lançamentos atrasados"} · ver lista
                </p>
              </Link>
            ) : null}
          </div>
        </section>
      ) : (
        <Alert tone="sucesso">Nada vencido: nenhuma conta a receber ou a pagar está atrasada.</Alert>
      )}

      {/* --------------------------------------------------------- resumo do mês */}
      <section aria-labelledby="resumo-titulo" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="resumo-titulo" className="text-grafite text-xl font-extrabold first-letter:uppercase">
            {formatMonth(month)}
          </h2>
          <nav aria-label="Mês" className="flex items-center gap-2">
            <Link href={monthHref(prevMonth)} className={navButton} aria-label={`Mês anterior: ${formatMonth(`${prevMonth}-01`)}`}>
              <ChevronLeft aria-hidden="true" className="size-5" />
            </Link>
            {!isCurrentMonth ? (
              <Link href={monthHref(today.slice(0, 7))} className={buttonClasses({ variant: "ghost" })}>
                Mês atual
              </Link>
            ) : null}
            <Link href={monthHref(nextMonth)} className={navButton} aria-label={`Próximo mês: ${formatMonth(`${nextMonth}-01`)}`}>
              <ChevronRight aria-hidden="true" className="size-5" />
            </Link>
          </nav>
        </div>
        <p className="text-cinza -mt-2 text-[0.8125rem]">O que foi pago conta no mês do pagamento; o que está em aberto conta no mês do vencimento.</p>

        <div>
          <h3 className="text-cinza mb-2 text-xs font-bold tracking-wide uppercase">Receitas</h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <StatCard className="max-sm:col-span-2" size="md" label="Receitas previstas" value={formatBRL(summary.receitas.previstoCents)} caption="Tudo que era para entrar no mês" />
            <StatCard size="md" label="Recebidas" value={formatBRL(summary.receitas.realizadoCents)} caption="Já entrou" />
            <StatCard size="md" label="A receber" value={formatBRL(summary.receitas.abertoCents)} caption="Ainda em aberto" />
          </div>
        </div>
        <div>
          <h3 className="text-cinza mb-2 text-xs font-bold tracking-wide uppercase">Despesas</h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <StatCard className="max-sm:col-span-2" size="md" label="Despesas previstas" value={formatBRL(summary.despesas.previstoCents)} caption="Tudo que era para sair no mês" />
            <StatCard size="md" label="Pagas" value={formatBRL(summary.despesas.realizadoCents)} caption="Já saiu" />
            <StatCard size="md" label="A pagar" value={formatBRL(summary.despesas.abertoCents)} caption="Ainda em aberto" />
          </div>
        </div>
        <div>
          <h3 className="text-cinza mb-2 text-xs font-bold tracking-wide uppercase">Resultado</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <StatCard tone="destaque" size="md" label="Resultado do mês (realizado)" value={formatBRL(summary.resultadoRealizadoCents)} caption="Recebido menos pago" />
            <StatCard size="md" label="Resultado previsto" value={formatBRL(summary.resultadoPrevistoCents)} caption="Receitas previstas menos despesas previstas" />
          </div>
        </div>
      </section>

      {/* ------------------------------------------------- reserva + gráfico */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)] lg:items-start">
        <Card as="section" aria-labelledby="reserva-titulo">
          <CardHeader
            id="reserva-titulo"
            title="Reserva de caixa"
            description="Valor definido por vocês, não vem do banco."
            action={<ReserveDialog valueCents={reserve.cashReserveCents} goalCents={reserve.cashReserveGoalCents} note={reserve.note} />}
          />
          <p className="text-roxo text-3xl font-extrabold tabular-nums">{formatBRL(reserve.cashReserveCents)}</p>
          {progress !== null ? (
            <div className="mt-4">
              <div role="progressbar" aria-label="Progresso da reserva de caixa" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress} className="bg-lavanda-claro h-3 overflow-hidden rounded-full">
                <div className="bg-roxo h-full rounded-full" style={{ width: `${progress}%` }} />
              </div>
              <p className="text-grafite mt-2 text-sm">
                <strong>{progress}%</strong> da meta de {formatBRL(reserve.cashReserveGoalCents)}
                {reserve.cashReserveCents < reserve.cashReserveGoalCents ? <span className="text-cinza"> · faltam {formatBRL(reserve.cashReserveGoalCents - reserve.cashReserveCents)}</span> : <span className="text-sucesso font-semibold"> · meta atingida</span>}
              </p>
            </div>
          ) : (
            <p className="text-cinza mt-3 text-sm">Sem meta definida. Use &quot;Editar reserva&quot; para informar uma meta.</p>
          )}
          {reserve.note ? <p className="text-cinza border-areia mt-4 border-t pt-3 text-sm break-words whitespace-pre-line">{reserve.note}</p> : null}
        </Card>

        <Card as="section" aria-labelledby="grafico-titulo">
          <CardHeader id="grafico-titulo" title="Últimos 6 meses" description="Receitas recebidas × despesas pagas (só o que já aconteceu)." />
          <BalanceChart points={series} selectedMonth={month} />
        </Card>
      </div>

      {/* ------------------------------------------------------- lançamentos */}
      <section id="lancamentos" aria-labelledby="lancamentos-titulo" className="scroll-mt-20 space-y-4">
        <div>
          <h2 id="lancamentos-titulo" className="text-grafite text-xl font-extrabold">
            {scopeLabel}
          </h2>
          <p className="text-cinza mt-1 text-sm">
            {listed.length} {listed.length === 1 ? "lançamento" : "lançamentos"}
            {filtered ? " com os filtros escolhidos" : ""}.
          </p>
        </div>

        {filters.proposalId ? (
          <Alert tone="info" role="status">
            Mostrando só os lançamentos {proposalLabel ? <>da proposta <strong>{proposalLabel}</strong></> : "de uma proposta que não existe mais"}.{" "}
            <Link className="link" href={`/painel/financeiro?mes=${month.slice(0, 7)}#lancamentos`}>
              Ver todos os lançamentos
            </Link>
          </Alert>
        ) : null}

        <FilterBar
          preserve={["mes", "proposta"]}
          search={{ placeholder: "Buscar por descrição ou fornecedor", label: "Buscar lançamentos" }}
          filters={[
            { name: "tipo", label: "Tipo", options: FINANCE_TYPE_LABELS, allLabel: "Receitas e despesas" },
            { name: "categoria", label: "Categoria", options: categoryOptions, allLabel: "Todas as categorias" },
            { name: "situacao", label: "Situação", options: SITUATION_FILTER_LABELS, allLabel: "Todas as situações" },
            { name: "cliente", label: "Cliente", options: clientOptions, allLabel: "Todos os clientes" },
            { name: "projeto", label: "Projeto", options: projectOptions, allLabel: "Todos os projetos" },
          ]}
        >
          <DateFilter name="de" label="De" />
          <DateFilter name="ate" label="Até" />
        </FilterBar>

        {listed.length > 0 ? (
          <Card className="grid gap-4 sm:grid-cols-3" aria-label="Totais do filtro">
            <div>
              <p className="text-cinza text-sm font-semibold">Receitas</p>
              <p className="text-grafite mt-1 text-lg font-extrabold tabular-nums">{formatBRL(listTotals.receitas.previstoCents)}</p>
              <p className="text-cinza text-[0.8125rem]">
                {formatBRL(listTotals.receitas.realizadoCents)} recebidas · {formatBRL(listTotals.receitas.abertoCents)} a receber
              </p>
            </div>
            <div>
              <p className="text-cinza text-sm font-semibold">Despesas</p>
              <p className="text-grafite mt-1 text-lg font-extrabold tabular-nums">{formatBRL(listTotals.despesas.previstoCents)}</p>
              <p className="text-cinza text-[0.8125rem]">
                {formatBRL(listTotals.despesas.realizadoCents)} pagas · {formatBRL(listTotals.despesas.abertoCents)} a pagar
              </p>
            </div>
            <div>
              <p className="text-cinza text-sm font-semibold">Resultado realizado</p>
              <p className="mt-1 text-lg font-extrabold tabular-nums">
                <Money cents={listTotals.resultadoRealizadoCents} colored />
              </p>
              <p className="text-cinza text-[0.8125rem]">Previsto: {formatBRL(listTotals.resultadoPrevistoCents)}</p>
            </div>
          </Card>
        ) : null}

        <DataList
          caption={scopeLabel}
          columns={columns}
          rows={rows}
          rowKey={(entry) => entry.id}
          href={(entry) => `/painel/financeiro/${entry.id}`}
          highlight={(entry) => entryStatus(entry, today) === "vencido"}
          highlightLabel="Vencido"
          empty={
            filtered ? (
              <EmptyState variant="plain" icon={<SearchX />} title="Nenhum lançamento com esses filtros" description="Tente outros filtros ou outro período." action={<ButtonLink href={`/painel/financeiro?mes=${month.slice(0, 7)}`} variant="secondary">Limpar filtros</ButtonLink>} />
            ) : (
              <EmptyState
                variant="plain"
                icon={<Receipt />}
                title={`Nenhum lançamento em ${formatMonth(month)}`}
                description="Cadastre o que vai entrar e sair para acompanhar o previsto e o realizado. Se já tem uma proposta aprovada, as parcelas podem virar contas a receber de uma vez."
                action={
                  <>
                    <ButtonLink href={newHref("receita")} icon={<Plus />}>Nova receita</ButtonLink>
                    <ButtonLink href={newHref("despesa")} variant="secondary" icon={<Plus />}>Nova despesa</ButtonLink>
                  </>
                }
              />
            )
          }
        />
        <Pagination page={page} pageSize={FINANCE_PAGE_SIZE} total={listed.length} noun={listed.length === 1 ? "lançamento" : "lançamentos"} />
      </section>
    </div>
  );
}
