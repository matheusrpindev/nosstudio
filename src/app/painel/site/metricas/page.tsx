import { BarChart3, ChevronLeft, ChevronRight, Download } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { ButtonLink, buttonClasses } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import type { PageSearchParams } from "@/components/ui/search-params";
import { canEverywhere, requirePermission } from "@/lib/auth";
import { addMonths, formatDate, formatMonth, startOfMonth, todayISO } from "@/lib/dates";
import { VISIT_SOURCE_HINTS, type VisitSource } from "@/lib/domain";
import { NOT_FOUND_PAGE_KEY, VISIT_SESSION_RETENTION_DAYS } from "@/lib/metrics/classify";
import { counterMinimum } from "@/lib/metrics/counter";
import { parseMetricsPeriod, PERIOD_DAY_PRESETS, periodLabel, periodLength, periodQuery } from "@/lib/metrics/period";
import { formatCount, formatShare, measuredDays } from "@/lib/metrics/report";
import { getMetricsReport, getVisitGrandTotal } from "@/server/metrics/queries";
import { getSiteContentForEdit } from "@/server/site/content";
import { BarList, EmptyNote, Kpi } from "./blocks";
import { DailyChart } from "./daily-chart";

export const metadata: Metadata = { title: "Métricas do site" };
export const instant = false;

const BASE = "/painel/site/metricas";
const pill = (active: boolean) => buttonClasses({ variant: active ? "accent" : "secondary" });
const navButton = `${buttonClasses({ variant: "secondary" })} !px-0 w-11`;
const plural = (n: number, one: string, many: string) => `${formatCount(n)} ${n === 1 ? one : many}`;
const percent = (value: number | null) => (value === null ? "—" : formatShare(value));

/**
 * Métricas do site: visitas, visitantes estimados, origem, páginas, aparelhos, cliques e formulários, com filtro
 * de período e comparação com o período anterior. Só leitura. A medição é própria (sem cookie e sem IP guardado):
 * o método está em `src/server/metrics/collect.ts` e resumido na própria tela.
 * Junta dois módulos: os blocos de LEADS (leads recebidos, serviços mais procurados) só aparecem — e só são
 * consultados — para quem vê o módulo de leads.
 */
export default async function SiteMetricsPage({ searchParams }: { searchParams: PageSearchParams }) {
  const user = await requirePermission("site", "ver");
  const today = todayISO();
  const period = parseMetricsPeriod(await searchParams, today);
  const seesLeads = canEverywhere(user, "leads", "ver");
  const canExport = canEverywhere(user, "dados", "baixar");
  const canEdit = canEverywhere(user, "site", "editar");

  const [report, counter, grandTotal] = await Promise.all([getMetricsReport(period, { includeLeads: seesLeads }), getSiteContentForEdit("visitCounter"), getVisitGrandTotal()]);
  const { totals, previousTotals } = report;
  const compare = report.previousHasData;
  const prev = <T,>(value: T) => (compare ? value : null);
  const query = periodQuery(period);
  const label = periodLabel(period);
  const covered = measuredDays(period, report.collectingSince);
  const partial = report.collectingSince !== null && covered > 0 && covered < periodLength(period);

  const month = period.kind === "mes" ? period.from : startOfMonth(today);
  const prevMonth = addMonths(month, -1).slice(0, 7);
  const nextMonth = addMonths(month, 1).slice(0, 7);
  const isCurrentMonth = month === startOfMonth(today);
  const monthHref = (value: string) => `${BASE}?periodo=mes&mes=${value}`;

  const minimum = counterMinimum(counter.minimum);
  const counterVisible = counter.enabled && counter.label.trim() !== "" && grandTotal > 0 && grandTotal >= minimum;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Métricas do site"
        description="Quantas visitas o site recebe, de onde elas vêm, o que as pessoas olham e quando viram contato."
        actions={
          canExport && report.collectingSince !== null ? (
            <>
              {/* exportação: só quem pode exportar dados (admin, sócio) — a rota confere de novo */}
              <a href={`${BASE}/exportar?${query}`} className={buttonClasses({ variant: "secondary" })}>
                <span className="btn-icone" aria-hidden="true">
                  <Download />
                </span>
                CSV por dia
              </a>
              <a href={`${BASE}/exportar?${query}&tabela=recortes`} className={buttonClasses({ variant: "secondary" })}>
                <span className="btn-icone" aria-hidden="true">
                  <Download />
                </span>
                CSV por recorte
              </a>
            </>
          ) : null
        }
        // sem margem própria além da do `space-y` do contêiner
        className="!mb-6"
      />

      {/* ---------------------------------------------------------------- período */}
      <section aria-labelledby="periodo-titulo" className="space-y-3">
        <h2 id="periodo-titulo" className="sr-only">
          Período
        </h2>
        <nav aria-label="Período" className="flex flex-wrap gap-2">
          {PERIOD_DAY_PRESETS.map((days) => (
            <Link key={days} href={`${BASE}?periodo=${days}`} aria-current={period.kind === "dias" && period.days === days ? "true" : undefined} className={pill(period.kind === "dias" && period.days === days)}>
              {days} dias
            </Link>
          ))}
          <Link href={monthHref(today.slice(0, 7))} aria-current={period.kind === "mes" ? "true" : undefined} className={pill(period.kind === "mes")}>
            Mês
          </Link>
          <Link href={`${BASE}?periodo=intervalo&de=${period.from}&ate=${period.to}`} aria-current={period.kind === "intervalo" ? "true" : undefined} className={pill(period.kind === "intervalo")}>
            Intervalo
          </Link>
        </nav>

        {period.kind === "mes" ? (
          <nav aria-label="Mês" className="flex flex-wrap items-center gap-2">
            <Link href={monthHref(prevMonth)} className={navButton} aria-label={`Mês anterior: ${formatMonth(`${prevMonth}-01`)}`}>
              <ChevronLeft aria-hidden="true" className="size-5" />
            </Link>
            <p className="text-texto min-w-[9.5rem] px-1 text-center text-base font-bold first-letter:uppercase">{formatMonth(month)}</p>
            {isCurrentMonth ? (
              <span className={`${navButton} pointer-events-none opacity-40`} aria-hidden="true">
                <ChevronRight className="size-5" />
              </span>
            ) : (
              <Link href={monthHref(nextMonth)} className={navButton} aria-label={`Próximo mês: ${formatMonth(`${nextMonth}-01`)}`}>
                <ChevronRight aria-hidden="true" className="size-5" />
              </Link>
            )}
          </nav>
        ) : null}

        {period.kind === "intervalo" ? (
          <form method="get" action={BASE} className="flex flex-wrap items-end gap-3">
            <input type="hidden" name="periodo" value="intervalo" />
            <label className="grid gap-1">
              <span className="label !mb-0">De</span>
              <input type="date" name="de" defaultValue={period.from} max={today} required className="input w-auto" />
            </label>
            <label className="grid gap-1">
              <span className="label !mb-0">Até</span>
              <input type="date" name="ate" defaultValue={period.to} max={today} required className="input w-auto" />
            </label>
            <button type="submit" className={buttonClasses({ variant: "secondary" })}>
              Aplicar
            </button>
          </form>
        ) : null}

        <p className="text-texto-suave text-sm">
          <span className="text-texto font-semibold first-letter:uppercase">{label}</span>
          {period.kind !== "intervalo" ? ` · ${formatDate(period.from)} a ${formatDate(period.to)}` : ""} · comparado com {formatDate(report.previous.from)} a {formatDate(report.previous.to)}
        </p>
      </section>

      {/* --------------------------------------------------- como a contagem é feita */}
      <details className="border-borda bg-superficie rounded-campo group border">
        <summary className="text-texto focus-visible:outline-foco flex min-h-11 cursor-pointer items-center gap-2 px-4 py-2.5 text-sm font-semibold">
          <span aria-hidden="true" className="text-detalhe transition-transform group-open:rotate-90">
            <ChevronRight className="size-4" />
          </span>
          Como a contagem é feita
          <span className="text-texto-suave font-normal max-sm:hidden">— medição própria, sem cookie e sem guardar IP</span>
        </summary>
        <div className="text-texto border-borda space-y-2 border-t px-4 py-3 text-sm leading-relaxed">
          <p>
            A medição é do próprio site: não usa serviço de terceiros, não grava cookie e não guarda o endereço IP de ninguém. Por isso o site não precisa de aviso de cookies.
          </p>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              <strong>Visita</strong>: uma sequência de páginas da mesma pessoa. Depois de 30 minutos sem atividade, a próxima página conta como uma visita nova. Recarregar a página não conta de novo.
            </li>
            <li>
              <strong>Visitantes estimados</strong>: pessoas diferentes em cada dia, reconhecidas por um código anônimo (rede + navegador) que muda todo dia. É uma estimativa: a mesma pessoa no celular e no computador conta duas vezes, e quem volta em
              outro dia conta de novo — em um período, o número é a soma dos dias.
            </li>
            <li>
              <strong>Não contam</strong>: robôs e buscadores, quem está logado no painel (a sua navegação não entra), navegadores sem JavaScript e as páginas do painel.
            </li>
            <li>
              <strong>Origem</strong>: de onde a pessoa chegou na primeira página da visita. Só o domínio é guardado (ex.: instagram.com), nunca o endereço completo.
            </li>
            <li>
              <strong>O que fica guardado</strong>: os totais de cada dia, sem prazo. Os registros de cada visita (sem IP) são apagados depois de {VISIT_SESSION_RETENTION_DAYS} dias.
            </li>
          </ul>
        </div>
      </details>

      {report.collectingSince === null ? (
        <EmptyState
          icon={<BarChart3 />}
          title="Ainda sem dados"
          description="Nenhuma visita foi medida até agora. A contagem começa sozinha quando alguém abre o site (a navegação de quem está logado no painel não conta). Os números aparecem aqui em seguida."
          action={
            <ButtonLink href="/" external variant="secondary">
              Abrir o site
            </ButtonLink>
          }
        />
      ) : (
        <>
          {partial ? (
            <Alert tone="info">
              A medição começou em {formatDate(report.collectingSince)}: este período só tem {plural(covered, "dia medido", "dias medidos")} de {periodLength(period)}.
            </Alert>
          ) : null}
          {covered === 0 ? <Alert tone="info">A medição começou em {formatDate(report.collectingSince)}, depois deste período. Não há números para mostrar aqui.</Alert> : null}

          {/* ------------------------------------------------------------ indicadores */}
          <section aria-labelledby="resumo-titulo">
            <h2 id="resumo-titulo" className="sr-only">
              Resumo do período
            </h2>
            <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
              <Kpi label="Visitas" value={formatCount(totals.visits)} current={totals.visits} previous={prev(previousTotals.visits)} />
              <Kpi label="Visitantes estimados" value={formatCount(totals.visitors)} current={totals.visitors} previous={prev(previousTotals.visitors)} />
              <Kpi
                label="Páginas vistas"
                value={formatCount(totals.pageviews)}
                current={totals.pageviews}
                previous={prev(previousTotals.pageviews)}
                hint={totals.pagesPerVisit === null ? undefined : `${totals.pagesPerVisit.toFixed(1).replace(".", ",")} por visita`}
              />
              <Kpi label="Formulários enviados" value={formatCount(totals.forms)} current={totals.forms} previous={prev(previousTotals.forms)} />
              <Kpi
                label="Conversão visita → formulário"
                value={percent(totals.conversion)}
                current={totals.conversion ?? 0}
                previous={totals.conversion === null ? null : prev(previousTotals.conversion)}
                previousLabel={percent(previousTotals.conversion)}
                hint="Formulários enviados ÷ visitas"
              />
              {seesLeads ? <Kpi label="Leads recebidos" value={formatCount(totals.leads)} current={totals.leads} previous={prev(previousTotals.leads)} hint="Todas as origens, inclusive os cadastrados à mão" /> : null}
              <Kpi label="Cliques em WhatsApp" value={formatCount(totals.whatsappClicks)} current={totals.whatsappClicks} previous={prev(previousTotals.whatsappClicks)} />
              <Kpi label="Cliques em banner" value={formatCount(totals.bannerClicks)} current={totals.bannerClicks} previous={prev(previousTotals.bannerClicks)} />
            </div>
          </section>

          {/* ---------------------------------------------------------------- dia a dia */}
          <Card as="section" aria-labelledby="dias-titulo">
            <CardHeader id="dias-titulo" title="Visitas e visitantes estimados por dia" description={<span className="first-letter:uppercase inline-block">{label}</span>} />
            {report.hasVisits ? <DailyChart days={report.days} todayPartial={period.to === today} /> : <EmptyNote>Nenhuma visita registrada neste período.</EmptyNote>}
          </Card>

          <div className="grid items-start gap-4 lg:grid-cols-2">
            {/* ------------------------------------------------------------------ origem */}
            <Card as="section" aria-labelledby="origem-titulo">
              <CardHeader id="origem-titulo" title="Origem das visitas" description="De onde as pessoas chegaram na primeira página da visita." />
              {report.sources.length > 0 ? (
                <BarList
                  caption="Origem das visitas"
                  unit={["visita", "visitas"]}
                  items={report.sources.map((item) => ({ key: item.key, label: item.label, value: item.value, share: item.share, note: VISIT_SOURCE_HINTS[item.key as VisitSource] }))}
                />
              ) : (
                <EmptyNote>Ainda sem visitas neste período.</EmptyNote>
              )}
              {report.referrers.length > 0 ? (
                <div className="border-borda mt-5 border-t pt-4">
                  <h3 className="text-texto mb-3 text-sm font-bold">Sites e redes de onde vieram</h3>
                  <BarList caption="Sites e redes de origem" unit={["visita", "visitas"]} items={report.referrers.map((item) => ({ key: item.key, label: item.label, value: item.value, share: item.share }))} />
                </div>
              ) : null}
              {report.campaigns.length > 0 ? (
                <div className="border-borda mt-5 border-t pt-4">
                  <h3 className="text-texto mb-3 text-sm font-bold">Campanhas (links com UTM)</h3>
                  <BarList caption="Campanhas" unit={["visita", "visitas"]} items={report.campaigns.map((item) => ({ key: item.key, label: item.label, value: item.value, share: item.share }))} />
                </div>
              ) : null}
            </Card>

            {/* ----------------------------------------------------------------- páginas */}
            <Card as="section" aria-labelledby="paginas-titulo">
              <CardHeader id="paginas-titulo" title="Páginas mais vistas" description="Quantas vezes cada página foi aberta e em quantas visitas ela foi a porta de entrada." />
              {report.pages.length > 0 ? (
                <BarList
                  caption="Páginas mais vistas"
                  unit={["vez", "vezes"]}
                  mono
                  items={report.pages.map((page) => ({
                    key: page.key,
                    label: page.key === "/" ? "/ (página inicial)" : page.key,
                    value: page.views,
                    share: page.share,
                    note:
                      page.key === NOT_FOUND_PAGE_KEY
                        ? "Endereços que não existem no site (link quebrado ou digitado errado)."
                        : page.entries > 0
                          ? `Entrada de ${plural(page.entries, "visita", "visitas")}`
                          : undefined,
                  }))}
                />
              ) : (
                <EmptyNote>Ainda sem páginas vistas neste período.</EmptyNote>
              )}
            </Card>

            {/* --------------------------------------------------------------- aparelhos */}
            <Card as="section" aria-labelledby="aparelhos-titulo">
              <CardHeader id="aparelhos-titulo" title="Aparelhos" description="Em que tipo de aparelho o site foi aberto." />
              {report.devices.length > 0 ? (
                <BarList caption="Aparelhos" unit={["visita", "visitas"]} items={report.devices.map((item) => ({ key: item.key, label: item.label, value: item.value, share: item.share }))} />
              ) : (
                <EmptyNote>Ainda sem visitas neste período.</EmptyNote>
              )}
            </Card>

            {/* ----------------------------------------------------------------- cliques */}
            <Card as="section" aria-labelledby="cliques-titulo">
              <CardHeader id="cliques-titulo" title="Cliques em WhatsApp e em banners" description="Quantas vezes cada botão de WhatsApp e cada banner da página inicial foi clicado." />
              <h3 className="text-texto mb-3 text-sm font-bold">WhatsApp</h3>
              {report.whatsappClicks.length > 0 ? (
                <BarList caption="Cliques em WhatsApp por botão" unit={["clique", "cliques"]} items={report.whatsappClicks.map((item) => ({ key: item.key, label: item.label, value: item.value }))} />
              ) : (
                <EmptyNote>Nenhum clique em WhatsApp neste período.</EmptyNote>
              )}
              <div className="border-borda mt-5 border-t pt-4">
                <h3 className="text-texto mb-3 text-sm font-bold">Banners</h3>
                {report.bannerClicks.length > 0 ? (
                  <BarList caption="Cliques por banner" unit={["clique", "cliques"]} items={report.bannerClicks.map((item) => ({ key: item.key, label: item.label, value: item.value }))} />
                ) : (
                  <EmptyNote>Nenhum clique em banner neste período.</EmptyNote>
                )}
              </div>
            </Card>

            {/* ------------------------------------------------------------- formulários */}
            <Card as="section" aria-labelledby="formularios-titulo">
              <CardHeader
                id="formularios-titulo"
                title="Formulários enviados"
                description={totals.conversion === null ? "Em que página estava o formulário enviado." : `Em que página estava o formulário enviado. Conversão do período: ${formatShare(totals.conversion)} das visitas.`}
              />
              {report.forms.length > 0 ? (
                <BarList caption="Formulários enviados por página" unit={["envio", "envios"]} mono items={report.forms.map((item) => ({ key: item.key, label: item.label, value: item.value, share: item.share }))} />
              ) : (
                <EmptyNote>Nenhum formulário enviado neste período.</EmptyNote>
              )}
            </Card>

            {/* ------------------------------------------------------------------- leads */}
            {seesLeads ? (
              <Card as="section" aria-labelledby="procura-titulo">
                <CardHeader
                  id="procura-titulo"
                  title="Serviços mais procurados"
                  description="O interesse informado nos leads recebidos no período."
                  action={
                    <ButtonLink href="/painel/leads" variant="ghost" size="sm">
                      Ver leads
                    </ButtonLink>
                  }
                />
                {report.demand.length > 0 ? (
                  <BarList caption="Serviços mais procurados" unit={["lead", "leads"]} items={report.demand.map((item) => ({ key: item.key, label: item.label, value: item.value, share: item.share }))} />
                ) : (
                  <EmptyNote>Nenhum lead recebido neste período.</EmptyNote>
                )}
                {report.leadsBySource.length > 0 ? (
                  <div className="border-borda mt-5 border-t pt-4">
                    <h3 className="text-texto mb-3 text-sm font-bold">Leads por origem do contato</h3>
                    <BarList caption="Leads por origem" unit={["lead", "leads"]} items={report.leadsBySource.map((item) => ({ key: item.key, label: item.label, value: item.value, share: item.share }))} />
                  </div>
                ) : null}
              </Card>
            ) : null}
          </div>
        </>
      )}

      {/* ------------------------------------------------------- contador público */}
      <Card as="section" aria-labelledby="contador-titulo">
        <CardHeader
          id="contador-titulo"
          title={
            <span className="flex flex-wrap items-center gap-2">
              Contador público de visitas
              <Badge tone={counterVisible ? "sucesso" : "neutral"} dot>
                {counterVisible ? "Aparecendo no site" : counter.enabled ? "Ligado, ainda oculto" : "Desligado"}
              </Badge>
            </span>
          }
          description="A faixa “Cada visita é o começo de uma nova história.”, no fim das páginas do site."
          action={
            canEdit ? (
              <ButtonLink href="/painel/site/textos/visitCounter" variant="secondary" size="sm">
                Configurar
              </ButtonLink>
            ) : null
          }
        />
        <p className="text-texto text-sm leading-relaxed">
          {report.collectingSince === null ? (
            "Ainda não há visitas medidas: mesmo ligado, o contador só aparece depois da primeira."
          ) : (
            <>
              Total desde o início da medição ({formatDate(report.collectingSince)}): <strong className="tabular-nums">{plural(grandTotal, "visita", "visitas")}</strong>. É este o número que o site mostra — sempre o real, atualizado a cada poucos
              minutos.
            </>
          )}{" "}
          {counter.enabled && !counterVisible && grandTotal > 0 && grandTotal < minimum ? `Ele aparece quando o total chegar a ${formatCount(minimum)} (mínimo escolhido).` : null}
          {counter.enabled && counter.label.trim() === "" ? "Falta a legenda do número: sem ela o contador não aparece." : null}
        </p>
      </Card>
    </div>
  );
}
