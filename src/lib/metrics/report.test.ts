import { describe, expect, it } from "vitest";
import { defaultSiteContent } from "@/lib/site/content";
import { VISIT_SESSION_RETENTION_DAYS } from "./classify";
import { counterMinimum, visitCounterView } from "./counter";
import { parseMetricsPeriod, periodDays, periodLabel, periodLength, periodQuery, previousPeriod } from "./period";
import { buildMetricsReport, clickLabel, formatChange, formatShare, measuredDays, relativeChange, type DailyStatRow, type LeadRow, type StatRow } from "./report";

const TODAY = "2026-11-27";

describe("período da tela de métricas", () => {
  it("padrão: últimos 30 dias terminando hoje", () => {
    expect(parseMetricsPeriod({}, TODAY)).toEqual({ kind: "dias", days: 30, from: "2026-10-29", to: TODAY });
    expect(parseMetricsPeriod({ periodo: "qualquer" }, TODAY).days).toBe(30);
  });

  it("7 e 90 dias", () => {
    expect(parseMetricsPeriod({ periodo: "7" }, TODAY)).toEqual({ kind: "dias", days: 7, from: "2026-11-21", to: TODAY });
    expect(periodLength(parseMetricsPeriod({ periodo: "90" }, TODAY))).toBe(90);
  });

  it("mês do calendário: o corrente vai até hoje; mês futuro cai no corrente", () => {
    expect(parseMetricsPeriod({ periodo: "mes", mes: "2026-10" }, TODAY)).toEqual({ kind: "mes", from: "2026-10-01", to: "2026-10-31" });
    expect(parseMetricsPeriod({ periodo: "mes", mes: "2026-11" }, TODAY)).toEqual({ kind: "mes", from: "2026-11-01", to: TODAY });
    expect(parseMetricsPeriod({ periodo: "mes", mes: "2027-03" }, TODAY).from).toBe("2026-11-01");
    expect(parseMetricsPeriod({ periodo: "mes", mes: "abc" }, TODAY).from).toBe("2026-11-01");
  });

  it("intervalo livre: valida, inverte datas trocadas, não passa de hoje nem de 366 dias", () => {
    expect(parseMetricsPeriod({ periodo: "intervalo", de: "2026-11-01", ate: "2026-11-15" }, TODAY)).toEqual({ kind: "intervalo", from: "2026-11-01", to: "2026-11-15" });
    expect(parseMetricsPeriod({ periodo: "intervalo", de: "2026-11-15", ate: "2026-11-01" }, TODAY)).toMatchObject({ from: "2026-11-01", to: "2026-11-15" });
    expect(parseMetricsPeriod({ periodo: "intervalo", de: "2026-11-20", ate: "2027-01-01" }, TODAY)).toMatchObject({ from: "2026-11-20", to: TODAY });
    expect(periodLength(parseMetricsPeriod({ periodo: "intervalo", de: "2020-01-01", ate: "2026-11-01" }, TODAY))).toBe(366);
    expect(parseMetricsPeriod({ periodo: "intervalo", de: "2026-13-45" }, TODAY)).toMatchObject({ kind: "dias", days: 30 });
    expect(parseMetricsPeriod({ periodo: "intervalo", de: "2026-11-10" }, TODAY)).toMatchObject({ kind: "intervalo", from: "2026-11-10", to: TODAY });
  });

  it("período anterior: o mesmo número de dias, logo antes", () => {
    expect(previousPeriod(parseMetricsPeriod({ periodo: "7" }, TODAY))).toEqual({ from: "2026-11-14", to: "2026-11-20" });
    expect(previousPeriod({ kind: "intervalo", from: "2026-11-01", to: "2026-11-10" })).toEqual({ from: "2026-10-22", to: "2026-10-31" });
  });

  it("período anterior de um mês: mês anterior inteiro se o mês fechou; os mesmos primeiros dias se está em curso", () => {
    expect(previousPeriod({ kind: "mes", from: "2026-10-01", to: "2026-10-31" })).toEqual({ from: "2026-09-01", to: "2026-09-30" });
    expect(previousPeriod({ kind: "mes", from: "2026-11-01", to: "2026-11-27" })).toEqual({ from: "2026-10-01", to: "2026-10-27" });
    // março em curso até o dia 30: fevereiro só tem 28
    expect(previousPeriod({ kind: "mes", from: "2026-03-01", to: "2026-03-30" })).toEqual({ from: "2026-02-01", to: "2026-02-28" });
  });

  it("rótulo e querystring", () => {
    expect(periodLabel(parseMetricsPeriod({ periodo: "7" }, TODAY))).toBe("Últimos 7 dias");
    expect(periodLabel({ kind: "mes", from: "2026-10-01", to: "2026-10-31" })).toBe("outubro de 2026");
    expect(periodLabel({ kind: "intervalo", from: "2026-11-01", to: "2026-11-15" })).toBe("01/11/2026 a 15/11/2026");
    expect(periodQuery({ kind: "mes", from: "2026-10-01", to: "2026-10-31" })).toBe("periodo=mes&mes=2026-10");
    expect(periodQuery({ kind: "intervalo", from: "2026-11-01", to: "2026-11-15" })).toBe("periodo=intervalo&de=2026-11-01&ate=2026-11-15");
    expect(periodDays({ from: "2026-11-25", to: "2026-11-27" })).toEqual(["2026-11-25", "2026-11-26", "2026-11-27"]);
  });
});

describe("agregação por período", () => {
  const period = { kind: "intervalo" as const, from: "2026-11-24", to: "2026-11-27" };
  const previous = previousPeriod(period);
  const daily: DailyStatRow[] = [
    { day: "2026-11-24", dimension: "total", key: "", visits: 10, visitors: 8, hits: 25 },
    { day: "2026-11-26", dimension: "total", key: "", visits: 20, visitors: 15, hits: 55 },
    { day: "2026-11-26", dimension: "formulario", key: "/contato", visits: 0, visitors: 0, hits: 2 },
    { day: "2026-11-26", dimension: "clique", key: "whatsapp:flutuante", visits: 0, visitors: 0, hits: 4 },
    { day: "2026-11-27", dimension: "clique", key: "banner:3", visits: 0, visitors: 0, hits: 1 },
    // fora do período: ignorada
    { day: "2026-11-20", dimension: "total", key: "", visits: 99, visitors: 99, hits: 99 },
  ];
  const stats: StatRow[] = [
    { dimension: "total", key: "", visits: 30, visitors: 23, hits: 80 },
    { dimension: "origem", key: "direto", visits: 12, visitors: 0, hits: 0 },
    { dimension: "origem", key: "social", visits: 15, visitors: 0, hits: 0 },
    { dimension: "origem", key: "busca", visits: 3, visitors: 0, hits: 0 },
    { dimension: "referencia", key: "instagram.com", visits: 14, visitors: 0, hits: 0 },
    { dimension: "referencia", key: "google.com", visits: 3, visitors: 0, hits: 0 },
    { dimension: "dispositivo", key: "celular", visits: 24, visitors: 0, hits: 0 },
    { dimension: "dispositivo", key: "computador", visits: 6, visitors: 0, hits: 0 },
    { dimension: "pagina", key: "/", visits: 22, visitors: 0, hits: 40 },
    { dimension: "pagina", key: "/servicos", visits: 5, visitors: 0, hits: 30 },
    { dimension: "pagina", key: "/contato", visits: 3, visitors: 0, hits: 10 },
    { dimension: "clique", key: "whatsapp:flutuante", visits: 0, visitors: 0, hits: 4 },
    { dimension: "clique", key: "banner:3", visits: 0, visitors: 0, hits: 1 },
    { dimension: "clique", key: "banner:9", visits: 0, visitors: 0, hits: 2 },
    { dimension: "clique", key: "lixo sem formato", visits: 0, visitors: 0, hits: 50 },
    { dimension: "formulario", key: "/contato", visits: 0, visitors: 0, hits: 2 },
    { dimension: "formulario", key: "/eventos-e-casamentos", visits: 0, visitors: 0, hits: 1 },
  ];
  const previousStats: StatRow[] = [
    { dimension: "total", key: "", visits: 20, visitors: 18, hits: 40 },
    { dimension: "formulario", key: "/contato", visits: 0, visitors: 0, hits: 1 },
  ];
  const leads: LeadRow[] = [
    { day: "2026-11-26", serviceInterest: "fotografia", source: "site" },
    { day: "2026-11-26", serviceInterest: "fotografia", source: "site" },
    { day: "2026-11-27", serviceInterest: "casamentos", source: "whatsapp" },
  ];
  const report = buildMetricsReport({
    period,
    previous,
    collectingSince: "2026-11-01",
    daily,
    stats,
    previousStats,
    leads,
    previousLeads: [{ day: "2026-11-21", serviceInterest: "outro", source: "site" }],
    bannerNames: new Map([[3, "Lançamento de verão"]]),
  });

  it("dia a dia: todo dia do período aparece (zerado quando não houve visita)", () => {
    expect(report.days.map((point) => [point.day, point.visits, point.visitors, point.pageviews])).toEqual([
      ["2026-11-24", 10, 8, 25],
      ["2026-11-25", 0, 0, 0],
      ["2026-11-26", 20, 15, 55],
      ["2026-11-27", 0, 0, 0],
    ]);
    expect(report.days[2]).toMatchObject({ forms: 2, whatsappClicks: 4, bannerClicks: 0, leads: 2 });
    expect(report.days[3]).toMatchObject({ bannerClicks: 1, leads: 1 });
  });

  it("totais, conversão visita → formulário e páginas por visita", () => {
    expect(report.totals).toMatchObject({ visits: 30, visitors: 23, pageviews: 80, forms: 3, whatsappClicks: 4, bannerClicks: 3, leads: 3 });
    expect(report.totals.conversion).toBeCloseTo(0.1);
    expect(report.totals.pagesPerVisit).toBeCloseTo(80 / 30);
    expect(report.hasVisits).toBe(true);
  });

  it("comparação com o período anterior", () => {
    expect(report.previous).toEqual({ from: "2026-11-20", to: "2026-11-23" });
    expect(report.previousHasData).toBe(true);
    expect(report.previousTotals).toMatchObject({ visits: 20, visitors: 18, forms: 1, leads: 1 });
    expect(relativeChange(report.totals.visits, report.previousTotals.visits)).toBeCloseTo(0.5);
    expect(formatChange(0.5)).toBe("+50%");
    expect(formatChange(-0.084)).toBe("−8%");
    expect(formatChange(0.001)).toBe("0%");
    expect(formatChange(42)).toBe("+999%+");
    // sem base, não inventa porcentagem
    expect(relativeChange(10, 0)).toBeNull();
  });

  it("origem, aparelhos e referências: ordenados, com a fatia de cada um", () => {
    expect(report.sources.map((item) => [item.key, item.value])).toEqual([
      ["social", 15],
      ["direto", 12],
      ["busca", 3],
    ]);
    expect(report.sources[0].share).toBeCloseTo(0.5);
    expect(report.sources[0].label).toBe("Redes sociais");
    expect(report.devices.map((item) => item.label)).toEqual(["Celular", "Computador"]);
    expect(report.referrers[0]).toMatchObject({ key: "instagram.com", value: 14 });
    expect(formatShare(0.5)).toBe("50%");
    expect(formatShare(0.0256)).toBe("2,6%");
    expect(formatShare(0.03)).toBe("3%");
    expect(formatShare(0.0004)).toBe("<0,1%");
  });

  it("páginas mais vistas (com as visitas que começaram em cada uma)", () => {
    expect(report.pages.map((page) => [page.key, page.views, page.entries])).toEqual([
      ["/", 40, 22],
      ["/servicos", 30, 5],
      ["/contato", 10, 3],
    ]);
    expect(report.pages[0].share).toBeCloseTo(0.5);
  });

  it("cliques: WhatsApp por lugar e banner pelo NOME (banner apagado continua contando)", () => {
    expect(report.whatsappClicks).toEqual([{ key: "whatsapp:flutuante", type: "whatsapp", label: "Botão flutuante (celular)", value: 4 }]);
    expect(report.bannerClicks.map((click) => [click.label, click.value])).toEqual([
      ["Banner removido (nº 9)", 2],
      ["Lançamento de verão", 1],
    ]);
    expect(clickLabel("banner:5", new Map([[5, ""]]))?.label).toBe("Banner nº 5 (sem nome)");
    expect(clickLabel("lixo", new Map())).toBeNull();
  });

  it("formulários por página, serviços mais procurados e leads por origem", () => {
    expect(report.forms.map((item) => [item.key, item.value])).toEqual([
      ["/contato", 2],
      ["/eventos-e-casamentos", 1],
    ]);
    expect(report.demand.map((item) => [item.label, item.value])).toEqual([
      ["Fotografia", 2],
      ["Casamentos", 1],
    ]);
    expect(report.leadsBySource.map((item) => [item.label, item.value])).toEqual([
      ["Site", 2],
      ["WhatsApp", 1],
    ]);
  });

  it("sem dados: tudo zerado, sem divisão por zero e sem comparação inventada", () => {
    const empty = buildMetricsReport({ period, previous, collectingSince: null, daily: [], stats: [], previousStats: [], leads: [], previousLeads: [], bannerNames: new Map() });
    expect(empty.hasVisits).toBe(false);
    expect(empty.previousHasData).toBe(false);
    expect(empty.totals).toMatchObject({ visits: 0, visitors: 0, conversion: null, pagesPerVisit: null });
    expect(empty.days).toHaveLength(4);
    expect(empty.sources).toEqual([]);
    expect(empty.pages).toEqual([]);
  });

  it("período anterior de antes de a coleta começar não serve de comparação", () => {
    const fresh = buildMetricsReport({ period, previous, collectingSince: "2026-11-24", daily, stats, previousStats, leads: [], previousLeads: [], bannerNames: new Map() });
    expect(fresh.previousHasData).toBe(false);
    expect(measuredDays(period, "2026-11-26")).toBe(2);
    expect(measuredDays(period, "2026-10-01")).toBe(4);
    expect(measuredDays(period, null)).toBe(0);
    expect(measuredDays(period, "2026-12-01")).toBe(0);
  });
});

describe("contador público", () => {
  const settings = { enabled: true, minimum: "", phrase: "Cada visita é o começo de uma nova história.", label: "visitas ao site desde {{inicio}}" };
  const data = { total: 1248, since: "2026-11-27" };

  it("ligado: número real formatado e legenda com o mês em que a contagem começou", () => {
    expect(visitCounterView(settings, data)).toEqual({ phrase: settings.phrase, value: "1.248", label: "visitas ao site desde novembro de 2026" });
  });

  it("desligado por padrão, sem visitas, sem legenda ou abaixo do mínimo: não aparece", () => {
    expect(visitCounterView({ ...settings, enabled: false }, data)).toBeNull();
    expect(visitCounterView(settings, { total: 0, since: null })).toBeNull();
    expect(visitCounterView({ ...settings, label: "  " }, data)).toBeNull();
    expect(visitCounterView({ ...settings, minimum: "2000" }, data)).toBeNull();
    expect(visitCounterView({ ...settings, minimum: "1248" }, data)?.value).toBe("1.248");
  });

  it("nasce desligado, com a frase do briefing e a legenda que identifica a métrica", () => {
    expect(defaultSiteContent.visitCounter).toMatchObject({ enabled: false, minimum: "", phrase: "Cada visita é o começo de uma nova história." });
    expect(defaultSiteContent.visitCounter.label).toContain("visitas");
    expect(defaultSiteContent.visitCounter.label).toContain("{{inicio}}");
  });

  it("a política de privacidade descreve a medição com o prazo de retenção que o código aplica", () => {
    const privacy = defaultSiteContent.privacyPage.body;
    expect(privacy).toContain("## Medição de visitas");
    expect(privacy).toContain(`apagados depois de ${VISIT_SESSION_RETENTION_DAYS} dias`);
    expect(privacy).toContain("sem cookies");
    expect(defaultSiteContent.cookiesPage.body).toContain("## Contagem de visitas (sem cookies)");
  });

  it("mínimo: só dígitos valem", () => {
    expect(counterMinimum("")).toBe(0);
    expect(counterMinimum("500")).toBe(500);
    expect(counterMinimum("abc")).toBe(0);
    expect(counterMinimum("-3")).toBe(0);
  });
});
