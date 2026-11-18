import { describe, expect, it } from "vitest";
import { buildFinanceCsv, csvCell, type CsvEntry } from "./csv";
import { filtersToQuery, parseFinanceFilters, resolveScope } from "./filters";
import { entryStatus, lastMonths, monthlySeries, nextMonthDueDate, overdueTotals, referenceDate, reserveProgress, summarizeMonth, totalize, type EntryLike } from "./summary";

const TODAY = "2026-11-18";
const e = (type: "receita" | "despesa", amountCents: number, dueDate: string, paidAt: string | null = null): EntryLike => ({ type, amountCents, dueDate, paidAt });

describe("status e data de referência", () => {
  it("pago é realizado; em aberto vence depois do dia do vencimento", () => {
    expect(entryStatus(e("receita", 100, "2026-11-01", "2026-11-02"), TODAY)).toBe("realizado");
    expect(entryStatus(e("receita", 100, "2026-11-17"), TODAY)).toBe("vencido");
    expect(entryStatus(e("receita", 100, TODAY), TODAY)).toBe("previsto"); // vence hoje: ainda no prazo
    expect(entryStatus(e("despesa", 100, "2026-12-01"), TODAY)).toBe("previsto");
  });
  it("referência = pagamento quando existe, senão vencimento", () => {
    expect(referenceDate(e("receita", 1, "2026-10-30", "2026-11-03"))).toBe("2026-11-03");
    expect(referenceDate(e("receita", 1, "2026-10-30"))).toBe("2026-10-30");
  });
});

describe("resumo do mês (previsto × realizado)", () => {
  const entries: EntryLike[] = [
    e("receita", 500000, "2026-11-05", "2026-11-06"), // recebida em novembro
    e("receita", 300000, "2026-11-25"), // a receber em novembro
    e("receita", 200000, "2026-11-10"), // vencida (a receber)
    e("despesa", 120000, "2026-11-08", "2026-11-08"), // paga
    e("despesa", 80000, "2026-11-28"), // a pagar
    e("receita", 999999, "2026-10-20", "2026-10-21"), // outro mês
    e("receita", 777777, "2026-10-28", "2026-11-02"), // venceu em outubro, recebida em novembro: conta em novembro
    e("despesa", 55555, "2026-12-05"), // dezembro
  ];
  const month = summarizeMonth(entries, "2026-11-01");

  it("receitas: previsto = recebido + a receber", () => {
    expect(month.receitas.realizadoCents).toBe(500000 + 777777);
    expect(month.receitas.abertoCents).toBe(300000 + 200000);
    expect(month.receitas.previstoCents).toBe(month.receitas.realizadoCents + month.receitas.abertoCents);
  });
  it("despesas: previsto = pago + a pagar", () => {
    expect(month.despesas).toMatchObject({ previstoCents: 200000, realizadoCents: 120000, abertoCents: 80000, count: 2 });
  });
  it("resultado realizado e previsto", () => {
    expect(month.resultadoRealizadoCents).toBe(500000 + 777777 - 120000);
    expect(month.resultadoPrevistoCents).toBe(month.receitas.previstoCents - month.despesas.previstoCents);
  });
  it("aceita o mês como YYYY-MM ou YYYY-MM-01", () => {
    expect(summarizeMonth(entries, "2026-11").receitas.previstoCents).toBe(month.receitas.previstoCents);
  });
  it("lista vazia dá zeros", () => {
    expect(totalize([])).toMatchObject({ resultadoRealizadoCents: 0, resultadoPrevistoCents: 0 });
  });
});

describe("vencidos", () => {
  it("soma só o que está em aberto e passou do vencimento, de qualquer mês", () => {
    const result = overdueTotals(
      [
        e("receita", 1000, "2026-09-01"),
        e("receita", 2000, "2026-11-17"),
        e("receita", 4000, TODAY), // vence hoje: não vencido
        e("receita", 8000, "2026-08-01", "2026-08-02"), // pago
        e("despesa", 500, "2026-10-01"),
      ],
      TODAY,
    );
    expect(result.receber).toEqual({ cents: 3000, count: 2 });
    expect(result.pagar).toEqual({ cents: 500, count: 1 });
  });
});

describe("série dos últimos meses", () => {
  it("lista seis meses terminando no escolhido, atravessando o ano", () => {
    expect(lastMonths("2026-02-01", 6)).toEqual(["2025-09", "2025-10", "2025-11", "2025-12", "2026-01", "2026-02"]);
  });
  it("usa só o realizado, pela data do pagamento", () => {
    const series = monthlySeries(
      [e("receita", 1000, "2026-10-01", "2026-10-15"), e("despesa", 400, "2026-10-01", "2026-10-20"), e("receita", 9999, "2026-10-01"), e("receita", 50, "2026-01-01", "2026-01-02"), e("receita", 700, "2026-11-30", "2026-11-30")],
      "2026-11",
      6,
    );
    expect(series).toHaveLength(6);
    expect(series.find((p) => p.month === "2026-10")).toEqual({ month: "2026-10", receitasCents: 1000, despesasCents: 400, resultadoCents: 600 });
    expect(series.find((p) => p.month === "2026-11")?.receitasCents).toBe(700);
    expect(series.some((p) => p.month === "2026-01")).toBe(false); // fora da janela
  });
});

describe("reserva e recorrência", () => {
  it("progresso da reserva", () => {
    expect(reserveProgress(5000, 20000)).toBe(25);
    expect(reserveProgress(30000, 20000)).toBe(100);
    expect(reserveProgress(100, 0)).toBeNull();
  });
  it("duplicar para o mês seguinte ajusta fim de mês", () => {
    expect(nextMonthDueDate("2026-11-10")).toBe("2026-12-10");
    expect(nextMonthDueDate("2026-01-31")).toBe("2026-02-28");
    expect(nextMonthDueDate("2026-12-15")).toBe("2027-01-15");
  });
});

describe("filtros da URL", () => {
  it("ignora valores inválidos", () => {
    const f = parseFinanceFilters({ mes: "lixo", tipo: "x", categoria: "y", situacao: "z", cliente: "abc", projeto: "-3", de: "2026-13-40", pagina: "0" }, TODAY);
    expect(f).toMatchObject({ month: "2026-11-01", type: undefined, category: undefined, situation: undefined, clientId: undefined, projectId: undefined, from: undefined, page: 1 });
  });
  it("aceita valores válidos", () => {
    const f = parseFinanceFilters({ mes: "2026-03", tipo: "despesa", categoria: "freelancer", situacao: "vencido", cliente: "12", de: "2026-01-01", q: " luz " }, TODAY);
    expect(f).toMatchObject({ month: "2026-03-01", type: "despesa", category: "freelancer", situation: "vencido", clientId: 12, from: "2026-01-01", q: "luz" });
  });
  it("o período da lista: mês, intervalo ou tudo", () => {
    expect(resolveScope(parseFinanceFilters({ mes: "2026-02" }, TODAY))).toEqual({ kind: "month", from: "2026-02-01", to: "2026-02-28" });
    expect(resolveScope(parseFinanceFilters({ de: "2026-01-01" }, TODAY))).toMatchObject({ kind: "range", from: "2026-01-01" });
    expect(resolveScope(parseFinanceFilters({ situacao: "vencido" }, TODAY)).kind).toBe("all");
    expect(resolveScope(parseFinanceFilters({ cliente: "3" }, TODAY)).kind).toBe("all");
  });
  it("monta a querystring e troca o mês", () => {
    const f = parseFinanceFilters({ mes: "2026-03", tipo: "receita" }, TODAY);
    expect(filtersToQuery(f)).toBe("mes=2026-03&tipo=receita");
    expect(filtersToQuery(f, { mes: "2026-04" })).toBe("mes=2026-04&tipo=receita");
  });
});

describe("CSV", () => {
  const base: CsvEntry = {
    type: "receita",
    category: "servico",
    description: "Entrada; cobertura \"Ana & Bruno\"",
    amountCents: 123456,
    dueDate: "2026-11-05",
    paidAt: "2026-11-06",
    installmentLabel: "Entrada",
    method: "pix",
    supplier: "",
    clientName: "Ana",
    projectTitle: null,
    notes: "linha 1\nlinha 2",
  };
  it("escapa aspas, ponto e vírgula e quebras; neutraliza fórmulas", () => {
    expect(csvCell('a;b')).toBe('"a;b"');
    expect(csvCell('diz "oi"')).toBe('"diz ""oi"""');
    expect(csvCell("=SOMA(A1)")).toBe("'=SOMA(A1)");
    expect(csvCell("-1+1")).toBe("'-1+1");
    expect(csvCell("normal")).toBe("normal");
  });
  it("tem BOM, separador ';', formato brasileiro e colunas de previsto/realizado", () => {
    const csv = buildFinanceCsv([base, { ...base, type: "despesa", category: "freelancer", paidAt: null, dueDate: "2026-11-01", amountCents: 50000, method: null }], TODAY);
    expect(csv.startsWith("﻿Tipo;Categoria;")).toBe(true);
    const [header, paid, open] = csv.trim().split("\r\n");
    expect(header).toContain("Previsto (R$);Realizado (R$)");
    expect(paid).toContain("1.234,56;1.234,56;06/11/2026;Pix");
    expect(paid).toContain("Recebido");
    expect(paid).toContain("linha 1 linha 2");
    expect(open).toContain("Vencido (a pagar);500,00;0,00");
  });
});
