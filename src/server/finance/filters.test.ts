import { describe, expect, it } from "vitest";
import { filtersToQuery, parseFinanceFilters, resolveScope } from "./filters";

const today = "2026-11-18";

describe("filtros do financeiro", () => {
  it("sem filtros: o mês de hoje", () => {
    const filters = parseFinanceFilters({}, today);
    expect(filters.month).toBe("2026-11-01");
    expect(resolveScope(filters)).toEqual({ kind: "month", from: "2026-11-01", to: "2026-11-30" });
  });

  it("`?proposta=` filtra pela proposta e atravessa os meses (como cliente e projeto)", () => {
    const filters = parseFinanceFilters({ proposta: "12", mes: "2026-03" }, today);
    expect(filters.proposalId).toBe(12);
    expect(resolveScope(filters)).toEqual({ kind: "all" });
    expect(filtersToQuery(filters)).toBe("mes=2026-03&proposta=12");
    expect(filtersToQuery(filters, { pagina: "2" })).toBe("mes=2026-03&proposta=12&pagina=2");
  });

  it("ignora ids inválidos vindos da URL", () => {
    for (const value of ["0", "-3", "abc", "1.5", "12; drop table", "99999999999"]) {
      const filters = parseFinanceFilters({ proposta: value, cliente: value, projeto: value }, today);
      expect([filters.proposalId, filters.clientId, filters.projectId]).toEqual([undefined, undefined, undefined]);
    }
  });

  it("datas informadas valem mais que o recorte por proposta", () => {
    const filters = parseFinanceFilters({ proposta: "3", de: "2026-01-01", ate: "2026-06-30" }, today);
    expect(resolveScope(filters)).toEqual({ kind: "range", from: "2026-01-01", to: "2026-06-30" });
  });
});
