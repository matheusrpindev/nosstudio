/**
 * Relatório de métricas do site: junta os totais diários (`visit_stats`) e os leads do período num objeto pronto
 * para a tela e para o CSV. PURO (sem banco) — testado em `report.test.ts`. As consultas ficam em
 * `src/server/metrics/queries.ts`.
 *
 * Como ler os números:
 * - visitas = sessões (o mesmo visitante volta a contar depois de 30 min parado);
 * - visitantes estimados = soma dos visitantes de CADA DIA (quem volta em outro dia conta de novo);
 * - conversão = formulários enviados ÷ visitas.
 */
import { diffDays, type ISODate } from "@/lib/dates";
import {
  CONTACT_SOURCE_LABELS,
  SERVICE_INTEREST_LABELS,
  TRACK_EVENT_TYPE_LABELS,
  VISIT_DEVICE_LABELS,
  VISIT_DEVICES,
  VISIT_SOURCE_LABELS,
  VISIT_SOURCES,
  type ContactSource,
  type ServiceInterest,
  type TrackEventType,
  type VisitDevice,
  type VisitDimension,
  type VisitSource,
} from "@/lib/domain";
import { parseTrackEvent } from "./classify";
import { periodDays, type MetricsPeriod } from "./period";

/** Uma linha de `visit_stats` (ou a soma de várias, por recorte × chave). */
export type StatRow = { dimension: VisitDimension; key: string; visits: number; visitors: number; hits: number };
export type DailyStatRow = StatRow & { day: ISODate };
export type LeadRow = { day: ISODate; serviceInterest: ServiceInterest; source: ContactSource };

export type DayPoint = {
  day: ISODate;
  visits: number;
  visitors: number;
  pageviews: number;
  forms: number;
  whatsappClicks: number;
  bannerClicks: number;
  leads: number;
};

export type Totals = {
  visits: number;
  visitors: number;
  pageviews: number;
  forms: number;
  whatsappClicks: number;
  bannerClicks: number;
  /** Leads cadastrados no período, de qualquer origem (site, WhatsApp, indicação…). */
  leads: number;
  /** Formulários enviados ÷ visitas (0–1). `null` sem visitas. */
  conversion: number | null;
  /** Páginas vistas por visita. `null` sem visitas. */
  pagesPerVisit: number | null;
};

/** Item de um recorte (origem, aparelho, página…): quanto vale e que fatia do total representa (0–1). */
export type BreakdownItem = { key: string; label: string; value: number; share: number; hint?: string };
export type PageItem = { key: string; views: number; entries: number; share: number };
export type ClickItem = { key: string; type: TrackEventType; label: string; value: number };

export type MetricsReport = {
  period: MetricsPeriod;
  previous: { from: ISODate; to: ISODate };
  /** O período de comparação tem algum dado? (sem isso as variações não aparecem) */
  previousHasData: boolean;
  /** Primeiro dia com medição (`null` = a coleta ainda não registrou nada). */
  collectingSince: ISODate | null;
  hasVisits: boolean;
  days: DayPoint[];
  totals: Totals;
  previousTotals: Totals;
  sources: BreakdownItem[];
  referrers: BreakdownItem[];
  campaigns: BreakdownItem[];
  devices: BreakdownItem[];
  pages: PageItem[];
  whatsappClicks: ClickItem[];
  bannerClicks: ClickItem[];
  /** Formulários enviados, pela página em que estavam. */
  forms: BreakdownItem[];
  /** Serviços mais procurados (interesse informado nos leads do período). */
  demand: BreakdownItem[];
  leadsBySource: BreakdownItem[];
};

const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);
const share = (value: number, total: number) => (total > 0 ? value / total : 0);

function totalsFrom(stats: StatRow[], leads: LeadRow[]): Totals {
  const of = (dimension: VisitDimension) => stats.filter((row) => row.dimension === dimension);
  const total = of("total");
  const visits = sum(total.map((row) => row.visits));
  const pageviews = sum(total.map((row) => row.hits));
  const forms = sum(of("formulario").map((row) => row.hits));
  const clicks = of("clique");
  const clicksOf = (type: TrackEventType) => sum(clicks.filter((row) => row.key.startsWith(`${type}:`)).map((row) => row.hits));
  return {
    visits,
    visitors: sum(total.map((row) => row.visitors)),
    pageviews,
    forms,
    whatsappClicks: clicksOf("whatsapp"),
    bannerClicks: clicksOf("banner"),
    leads: leads.length,
    conversion: visits > 0 ? forms / visits : null,
    pagesPerVisit: visits > 0 ? pageviews / visits : null,
  };
}

/** Lista ordenada (maior primeiro; empate pela ordem alfabética) com a fatia de cada item. */
function ranked(items: { key: string; label: string; value: number; hint?: string }[], limit?: number): BreakdownItem[] {
  const total = sum(items.map((item) => item.value));
  const sorted = items
    .filter((item) => item.value > 0)
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label, "pt-BR"))
    .map((item) => ({ ...item, share: share(item.value, total) }));
  return limit ? sorted.slice(0, limit) : sorted;
}

/** Soma linhas com a mesma chave (o banco já agrupa; isto protege contra chave repetida vinda de dias diferentes). */
function byKey(rows: StatRow[], field: "visits" | "hits"): Map<string, number> {
  const map = new Map<string, number>();
  for (const row of rows) map.set(row.key, (map.get(row.key) ?? 0) + row[field]);
  return map;
}

/** Nome legível de um clique medido. `bannerNames`: id → nome do banner no painel. */
export function clickLabel(key: string, bannerNames: ReadonlyMap<number, string>): { type: TrackEventType; label: string } | null {
  const event = parseTrackEvent(key);
  if (!event) return null;
  if (event.type === "banner") {
    const id = Number(event.target);
    const name = bannerNames.get(id)?.trim();
    return { type: "banner", label: name ? name : bannerNames.has(id) ? `Banner nº ${id} (sem nome)` : `Banner removido (nº ${id})` };
  }
  return { type: event.type, label: WHATSAPP_PLACE_LABELS[event.target] ?? `${TRACK_EVENT_TYPE_LABELS[event.type]}: ${event.target}` };
}

/** Onde fica cada botão de WhatsApp medido (`data-track="whatsapp:<onde>"`). */
export const WHATSAPP_PLACE_LABELS: Record<string, string> = {
  flutuante: "Botão flutuante (celular)",
  rodape: "Rodapé",
  contato: "Página de contato",
  canais: "Lista de canais (fim das páginas)",
  formulario: "Depois de enviar o formulário",
  link: "Outros links de WhatsApp",
};

export type ReportInput = {
  period: MetricsPeriod;
  previous: { from: ISODate; to: ISODate };
  collectingSince: ISODate | null;
  /** Linhas por dia dos recortes `total`, `formulario` e `clique` (período atual). */
  daily: DailyStatRow[];
  /** Somas por recorte × chave, período atual e anterior. */
  stats: StatRow[];
  previousStats: StatRow[];
  leads: LeadRow[];
  previousLeads: LeadRow[];
  bannerNames: ReadonlyMap<number, string>;
  /** Quantas páginas listar. */
  pageLimit?: number;
};

export function buildMetricsReport(input: ReportInput): MetricsReport {
  const { period, previous, stats, previousStats, leads, previousLeads, bannerNames } = input;
  const of = (dimension: VisitDimension) => stats.filter((row) => row.dimension === dimension);

  // ---- dia a dia (dias sem registro entram zerados: o gráfico não "pula" datas)
  const points = new Map<ISODate, DayPoint>(
    periodDays(period).map((day) => [day, { day, visits: 0, visitors: 0, pageviews: 0, forms: 0, whatsappClicks: 0, bannerClicks: 0, leads: 0 }]),
  );
  for (const row of input.daily) {
    const point = points.get(row.day);
    if (!point) continue;
    if (row.dimension === "total") {
      point.visits += row.visits;
      point.visitors += row.visitors;
      point.pageviews += row.hits;
    } else if (row.dimension === "formulario") point.forms += row.hits;
    else if (row.dimension === "clique") {
      if (row.key.startsWith("whatsapp:")) point.whatsappClicks += row.hits;
      else if (row.key.startsWith("banner:")) point.bannerClicks += row.hits;
    }
  }
  for (const lead of leads) {
    const point = points.get(lead.day);
    if (point) point.leads += 1;
  }

  const totals = totalsFrom(stats, leads);
  const previousTotals = totalsFrom(previousStats, previousLeads);
  // sem medição no período anterior (ele é de antes de a coleta começar) não há com o que comparar
  const previousHasData = previousStats.some((row) => row.dimension === "total" && row.visits > 0) && (input.collectingSince === null || input.collectingSince <= previous.to);

  // ---- recortes
  const sourceVisits = byKey(of("origem"), "visits");
  const sources = ranked(VISIT_SOURCES.map((key: VisitSource) => ({ key, label: VISIT_SOURCE_LABELS[key], value: sourceVisits.get(key) ?? 0 })));
  const deviceVisits = byKey(of("dispositivo"), "visits");
  const devices = ranked(VISIT_DEVICES.map((key: VisitDevice) => ({ key, label: VISIT_DEVICE_LABELS[key], value: deviceVisits.get(key) ?? 0 })));
  const referrers = ranked([...byKey(of("referencia"), "visits")].map(([key, value]) => ({ key, label: key, value })), 10);
  const campaigns = ranked([...byKey(of("campanha"), "visits")].map(([key, value]) => ({ key, label: key, value })), 10);

  const pageRows = of("pagina");
  const views = byKey(pageRows, "hits");
  const entries = byKey(pageRows, "visits");
  const totalViews = sum([...views.values()]);
  const pages: PageItem[] = [...views]
    .map(([key, value]) => ({ key, views: value, entries: entries.get(key) ?? 0, share: share(value, totalViews) }))
    .filter((page) => page.views > 0)
    .sort((a, b) => b.views - a.views || a.key.localeCompare(b.key))
    .slice(0, input.pageLimit ?? 15);

  const clicks: ClickItem[] = [...byKey(of("clique"), "hits")]
    .flatMap(([key, value]) => {
      const info = clickLabel(key, bannerNames);
      return info && value > 0 ? [{ key, type: info.type, label: info.label, value }] : [];
    })
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label, "pt-BR"));

  const forms = ranked([...byKey(of("formulario"), "hits")].map(([key, value]) => ({ key, label: key, value })));

  const count = <K extends string>(keys: K[]) => {
    const map = new Map<K, number>();
    for (const key of keys) map.set(key, (map.get(key) ?? 0) + 1);
    return map;
  };
  const demand = ranked([...count(leads.map((lead) => lead.serviceInterest))].map(([key, value]) => ({ key, label: SERVICE_INTEREST_LABELS[key], value })));
  const leadsBySource = ranked([...count(leads.map((lead) => lead.source))].map(([key, value]) => ({ key, label: CONTACT_SOURCE_LABELS[key], value })));

  return {
    period,
    previous,
    previousHasData,
    collectingSince: input.collectingSince,
    hasVisits: totals.visits > 0,
    days: [...points.values()],
    totals,
    previousTotals,
    sources,
    referrers,
    campaigns,
    devices,
    pages,
    whatsappClicks: clicks.filter((click) => click.type === "whatsapp"),
    bannerClicks: clicks.filter((click) => click.type === "banner"),
    forms,
    demand,
    leadsBySource,
  };
}

/** Variação relativa (0,25 = +25%). `null` quando não há base (anterior zerado). */
export function relativeChange(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return (current - previous) / previous;
}

/** `+25%`, `−8%`, `0%`. Acima de 999% vira `+999%+`. */
export function formatChange(change: number): string {
  const percent = Math.round(change * 100);
  if (percent === 0) return "0%";
  if (percent > 999) return "+999%+";
  return `${percent > 0 ? "+" : "−"}${Math.abs(percent)}%`;
}

/** `12,5%` (uma casa abaixo de 10%; inteiro acima). */
export function formatShare(value: number): string {
  const percent = value * 100;
  if (percent === 0) return "0%";
  if (percent < 0.1) return "<0,1%";
  return `${percent < 10 ? percent.toFixed(1).replace(".", ",").replace(/,0$/, "") : Math.round(percent)}%`;
}

const integer = new Intl.NumberFormat("pt-BR");
/** `1.284` */
export const formatCount = (value: number) => integer.format(value);

/** Quantos dias de medição existem dentro do período (para avisar quando o período começa antes da coleta). */
export function measuredDays(period: Pick<MetricsPeriod, "from" | "to">, collectingSince: ISODate | null): number {
  if (!collectingSince || collectingSince > period.to) return 0;
  const start = collectingSince > period.from ? collectingSince : period.from;
  return diffDays(start, period.to) + 1;
}
