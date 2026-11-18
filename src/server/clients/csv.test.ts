import { describe, expect, it } from "vitest";
import { buildCsv, csvCell } from "./csv";

describe("csv", () => {
  it("coloca aspas quando há separador, aspas ou quebra de linha", () => {
    expect(csvCell("Ana")).toBe("Ana");
    expect(csvCell("Silva; Souza")).toBe('"Silva; Souza"');
    expect(csvCell('Disse "oi"')).toBe('"Disse ""oi"""');
    expect(csvCell("linha 1\nlinha 2")).toBe('"linha 1\nlinha 2"');
    expect(csvCell(null)).toBe("");
    expect(csvCell(12)).toBe("12");
  });
  it("neutraliza fórmulas de planilha", () => {
    expect(csvCell("=SOMA(A1:A2)")).toBe("'=SOMA(A1:A2)");
    expect(csvCell("@usuario")).toBe("'@usuario");
    expect(csvCell("-1+1")).toBe("'-1+1");
  });
  it("gera BOM, separador ; e CRLF", () => {
    const csv = buildCsv(["Nome", "Cidade"], [["Ana", "São Paulo"], ["Bia", ""]]);
    expect(csv.startsWith("﻿Nome;Cidade\r\n")).toBe(true);
    expect(csv).toBe("﻿Nome;Cidade\r\nAna;São Paulo\r\nBia;\r\n");
  });
});
