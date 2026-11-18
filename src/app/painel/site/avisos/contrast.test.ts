import { describe, expect, it } from "vitest";
import { BRAND_COLOR_HEX } from "@/lib/domain";
import { contrastRatio, MIN_CONTRAST } from "./contrast";

describe("contrastRatio", () => {
  it("preto sobre branco é 21", () => {
    expect(contrastRatio("#000000", "#FFFFFF")).toBeCloseTo(21, 5);
  });

  it("é simétrico e igual a 1 para cores iguais", () => {
    expect(contrastRatio("#3B1F8E", "#C6F432")).toBeCloseTo(contrastRatio("#C6F432", "#3B1F8E"), 10);
    expect(contrastRatio("#3B1F8E", "#3B1F8E")).toBe(1);
  });

  it("combinações boas da paleta passam do mínimo", () => {
    expect(contrastRatio(BRAND_COLOR_HEX.branco, BRAND_COLOR_HEX.roxo)).toBeGreaterThanOrEqual(MIN_CONTRAST);
    expect(contrastRatio(BRAND_COLOR_HEX.lima, BRAND_COLOR_HEX.grafite)).toBeGreaterThanOrEqual(MIN_CONTRAST);
    expect(contrastRatio(BRAND_COLOR_HEX.grafite, BRAND_COLOR_HEX.offwhite)).toBeGreaterThanOrEqual(MIN_CONTRAST);
  });

  it("combinações ruins da paleta ficam abaixo do mínimo", () => {
    expect(contrastRatio(BRAND_COLOR_HEX.lima, BRAND_COLOR_HEX.branco)).toBeLessThan(MIN_CONTRAST);
    expect(contrastRatio(BRAND_COLOR_HEX.lavanda, BRAND_COLOR_HEX.offwhite)).toBeLessThan(MIN_CONTRAST);
  });

  it("rejeita cor inválida", () => {
    expect(() => contrastRatio("roxo", "#fff")).toThrow();
  });
});
