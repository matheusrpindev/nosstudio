import { describe, expect, it } from "vitest";
import { buildMetricsReport } from "@/lib/metrics/report";
import { BREAKDOWN_CSV_HEADERS, buildBreakdownMetricsCsv, buildDailyMetricsCsv, DAILY_CSV_HEADERS } from "./csv";

const period = { kind: "intervalo" as const, from: "2026-11-26", to: "2026-11-27" };
const report = buildMetricsReport({
  period,
  previous: { from: "2026-11-24", to: "2026-11-25" },
  collectingSince: "2026-11-20",
  daily: [
    { day: "2026-11-26", dimension: "total", key: "", visits: 1200, visitors: 900, hits: 3000 },
    { day: "2026-11-27", dimension: "formulario", key: "/contato", visits: 0, visitors: 0, hits: 3 },
    { day: "2026-11-27", dimension: "clique", key: "whatsapp:rodape", visits: 0, visitors: 0, hits: 5 },
  ],
  stats: [
    { dimension: "total", key: "", visits: 1200, visitors: 900, hits: 3000 },
    { dimension: "origem", key: "campanha", visits: 1200, visitors: 0, hits: 0 },
    { dimension: "campanha", key: "=soma(a1) ; verão", visits: 1200, visitors: 0, hits: 0 },
    { dimension: "pagina", key: "/", visits: 1200, visitors: 0, hits: 3000 },
    { dimension: "formulario", key: "/contato", visits: 0, visitors: 0, hits: 3 },
    { dimension: "clique", key: "whatsapp:rodape", visits: 0, visitors: 0, hits: 5 },
    { dimension: "clique", key: "banner:2", visits: 0, visitors: 0, hits: 4 },
  ],
  previousStats: [],
  leads: [{ day: "2026-11-27", serviceInterest: "video", source: "site" }],
  previousLeads: [],
  bannerNames: new Map([[2, 'Banner "de verão"; 2026']]),
});

describe("CSV das métricas", () => {
  it("por dia: BOM, separador ; , datas brasileiras, uma linha por dia e o total", () => {
    const csv = buildDailyMetricsCsv(report);
    expect(csv.startsWith("﻿")).toBe(true);
    const lines = csv.slice(1).trimEnd().split("\r\n");
    expect(lines[0]).toBe(DAILY_CSV_HEADERS.join(";"));
    expect(lines[1]).toBe("26/11/2026;1200;900;3000;0;0;0;0");
    expect(lines[2]).toBe("27/11/2026;0;0;0;3;5;0;1");
    expect(lines[3]).toBe("Total;1200;900;3000;3;5;4;1");
    expect(lines).toHaveLength(4);
  });

  it("por recorte: resumo, origem, páginas, cliques (banner pelo nome) e procura", () => {
    const csv = buildBreakdownMetricsCsv(report);
    const lines = csv.slice(1).trimEnd().split("\r\n");
    expect(lines[0]).toBe(BREAKDOWN_CSV_HEADERS.join(";"));
    expect(lines).toContain("Resumo;Visitas;1200;visitas;");
    expect(lines).toContain("Resumo;Conversão visita → formulário;0,3%;;");
    expect(lines).toContain("Origem das visitas;Campanha;1200;visitas;100%");
    expect(lines).toContain("Páginas mais vistas;/;3000;páginas vistas;100%");
    expect(lines).toContain("Cliques em WhatsApp;Rodapé;5;cliques;");
    expect(lines).toContain('Cliques em banner;"Banner ""de verão""; 2026";4;cliques;');
    expect(lines).toContain("Serviços mais procurados;Audiovisual;1;leads;100%");
  });

  it("texto vindo de fora (campanha) não vira fórmula na planilha", () => {
    const csv = buildBreakdownMetricsCsv(report);
    expect(csv).toContain(`Campanhas;"'=soma(a1) ; verão";1200;visitas;100%`);
  });
});
