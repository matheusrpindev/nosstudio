/**
 * CSV das métricas do site (abre no Excel/Planilhas em português): separador ";", BOM UTF-8, datas `dd/mm/aaaa`.
 * Duas tabelas: `dias` (uma linha por dia) e `recortes` (totais do período por origem, página, aparelho…).
 * Só números agregados — não há dado pessoal aqui. Arquivo puro, testado em `csv.test.ts`.
 */
import { formatDate } from "@/lib/dates";
import { csvCell } from "@/server/finance/csv";
import { formatShare, type MetricsReport } from "@/lib/metrics/report";

const BOM = "﻿";
const SEPARATOR = ";";
const line = (cells: (string | number)[]) => cells.map((cell) => csvCell(String(cell))).join(SEPARATOR);

export const METRICS_CSV_TABLES = ["dias", "recortes"] as const;
export type MetricsCsvTable = (typeof METRICS_CSV_TABLES)[number];

export const DAILY_CSV_HEADERS = ["Data", "Visitas", "Visitantes estimados", "Páginas vistas", "Formulários enviados", "Cliques em WhatsApp", "Cliques em banner", "Leads recebidos"] as const;

export function buildDailyMetricsCsv(report: MetricsReport): string {
  const rows = report.days.map((day) => line([formatDate(day.day), day.visits, day.visitors, day.pageviews, day.forms, day.whatsappClicks, day.bannerClicks, day.leads]));
  const { totals } = report;
  rows.push(line(["Total", totals.visits, totals.visitors, totals.pageviews, totals.forms, totals.whatsappClicks, totals.bannerClicks, totals.leads]));
  return `${BOM}${[line([...DAILY_CSV_HEADERS]), ...rows].join("\r\n")}\r\n`;
}

export const BREAKDOWN_CSV_HEADERS = ["Recorte", "Item", "Quantidade", "Unidade", "Participação"] as const;

export function buildBreakdownMetricsCsv(report: MetricsReport): string {
  const rows: string[] = [];
  const add = (section: string, unit: string, items: { label: string; value: number; share?: number }[]) => {
    for (const item of items) rows.push(line([section, item.label, item.value, unit, item.share === undefined ? "" : formatShare(item.share)]));
  };
  const { totals } = report;
  add("Resumo", "visitas", [{ label: "Visitas", value: totals.visits }]);
  add("Resumo", "visitantes estimados", [{ label: "Visitantes estimados (soma dos dias)", value: totals.visitors }]);
  add("Resumo", "páginas vistas", [{ label: "Páginas vistas", value: totals.pageviews }]);
  add("Resumo", "envios", [{ label: "Formulários enviados", value: totals.forms }]);
  add("Resumo", "leads", [{ label: "Leads recebidos (todas as origens)", value: totals.leads }]);
  rows.push(line(["Resumo", "Conversão visita → formulário", totals.conversion === null ? "" : formatShare(totals.conversion), "", ""]));
  add("Origem das visitas", "visitas", report.sources);
  add("Sites e redes de origem", "visitas", report.referrers);
  add("Campanhas", "visitas", report.campaigns);
  add("Aparelhos", "visitas", report.devices);
  add("Páginas mais vistas", "páginas vistas", report.pages.map((page) => ({ label: page.key, value: page.views, share: page.share })));
  add("Páginas de entrada", "visitas", report.pages.filter((page) => page.entries > 0).map((page) => ({ label: page.key, value: page.entries })));
  add("Cliques em WhatsApp", "cliques", report.whatsappClicks);
  add("Cliques em banner", "cliques", report.bannerClicks);
  add("Formulários enviados por página", "envios", report.forms);
  add("Serviços mais procurados", "leads", report.demand);
  add("Leads por origem", "leads", report.leadsBySource);
  return `${BOM}${[line([...BREAKDOWN_CSV_HEADERS]), ...rows].join("\r\n")}\r\n`;
}
