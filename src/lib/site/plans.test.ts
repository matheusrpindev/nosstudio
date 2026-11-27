import { describe, expect, it } from "vitest";
import { buildPlanComparison, planFeatures, type ComparablePlan } from "./plans";

const essencial: ComparablePlan = { id: 1, name: "Plano Essencial", includes: ["Planejamento mensal", "Calendário", "Design"], base: null };
const integrado: ComparablePlan = { id: 2, name: "Plano Integrado", includes: ["Roteiros", "Captação"], base: { id: 1 } };
const estrategico: ComparablePlan = { id: 3, name: "Plano Estratégico", includes: ["Estratégia integrada", "Campanhas"], base: null };
const plans = [essencial, integrado, estrategico];

describe("tabela comparativa dos planos", () => {
  it("plano com plano-base herda as entregas do base, que vêm primeiro", () => {
    expect(planFeatures(integrado, plans)).toEqual(["Planejamento mensal", "Calendário", "Design", "Roteiros", "Captação"]);
    expect(planFeatures(essencial, plans)).toEqual(["Planejamento mensal", "Calendário", "Design"]);
  });

  it("linhas na ordem em que as entregas aparecem; célula marcada só onde a entrega está listada (própria ou herdada)", () => {
    const table = buildPlanComparison(plans);
    expect(table.columns.map((column) => column.name)).toEqual(["Plano Essencial", "Plano Integrado", "Plano Estratégico"]);
    expect(table.rows.map((row) => row.label)).toEqual(["Planejamento mensal", "Calendário", "Design", "Roteiros", "Captação", "Estratégia integrada", "Campanhas"]);
    const row = (label: string) => table.rows.find((item) => item.label === label)?.cells;
    expect(row("Design")).toEqual([true, true, false]);
    expect(row("Roteiros")).toEqual([false, true, false]);
    // o Estratégico NÃO herda nada sem plano-base: o site não marca o que os sócios não cadastraram
    expect(row("Campanhas")).toEqual([false, false, true]);
  });

  it("herança em cadeia (A ← B ← C)", () => {
    const top = { ...estrategico, base: { id: 2 } };
    const table = buildPlanComparison([essencial, integrado, top]);
    expect(table.rows.find((row) => row.label === "Calendário")?.cells).toEqual([true, true, true]);
    expect(table.rows.find((row) => row.label === "Captação")?.cells).toEqual([false, true, true]);
  });

  it("a mesma entrega escrita com maiúsculas/espaços diferentes é uma linha só; itens vazios são ignorados", () => {
    const a: ComparablePlan = { id: 1, name: "A", includes: ["Relatórios", "  "], base: null };
    const b: ComparablePlan = { id: 2, name: "B", includes: [" relatórios ", "Reels"], base: null };
    const table = buildPlanComparison([a, b]);
    expect(table.rows).toEqual([
      { label: "Relatórios", cells: [true, true] },
      { label: "Reels", cells: [false, true] },
    ]);
  });

  it("não entra em laço com planos-base circulares nem quebra com base inexistente ou oculta", () => {
    const a: ComparablePlan = { id: 1, name: "A", includes: ["x"], base: { id: 2 } };
    const b: ComparablePlan = { id: 2, name: "B", includes: ["y"], base: { id: 1 } };
    expect(planFeatures(a, [a, b]).sort()).toEqual(["x", "y"]);
    expect(planFeatures({ id: 9, name: "C", includes: ["z"], base: { id: 404 } }, [a, b])).toEqual(["z"]);
  });

  it("sem planos ou sem entregas não há linhas (a tabela não aparece)", () => {
    expect(buildPlanComparison([]).rows).toEqual([]);
    expect(buildPlanComparison([{ id: 1, name: "A", includes: [], base: null }]).rows).toEqual([]);
  });
});
