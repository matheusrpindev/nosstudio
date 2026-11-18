import { describe, expect, it } from "vitest";
import { centsToCsv, csvCell, dayStartMs, generateTemporaryPassword, nextDayStartMs, stripSecretColumns, toCsv } from "./logic";
import { passwordProblem } from "@/lib/auth/password";

describe("generateTemporaryPassword", () => {
  it("gera 4 blocos de 4 caracteres, sem ambíguos, e passa na validação de senha", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) {
      const password = generateTemporaryPassword();
      expect(password).toMatch(/^[a-hj-km-np-z2-9]{4}(-[a-hj-km-np-z2-9]{4}){3}$/);
      expect(passwordProblem(password)).toBeNull();
      seen.add(password);
    }
    expect(seen.size).toBe(200);
  });
});

describe("CSV", () => {
  it("escapa aspas, separador e quebras de linha", () => {
    expect(csvCell('Ela disse "oi"')).toBe('"Ela disse ""oi"""');
    expect(csvCell("a;b")).toBe('"a;b"');
    expect(csvCell("linha1\nlinha2")).toBe('"linha1\nlinha2"');
    expect(csvCell(null)).toBe("");
    expect(csvCell(12)).toBe("12");
  });
  it("neutraliza fórmulas, mas deixa números negativos", () => {
    expect(csvCell("=HYPERLINK(\"x\")")).toBe(`"'=HYPERLINK(""x"")"`);
    expect(csvCell("+5511999999999")).toBe("'+5511999999999");
    expect(csvCell("@cmd")).toBe("'@cmd");
    expect(csvCell("-1234,56")).toBe("-1234,56");
  });
  it("monta com BOM, ponto e vírgula e CRLF", () => {
    const csv = toCsv(["A", "B"], [[1, "x;y"]]);
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toBe("﻿A;B\r\n1;\"x;y\"\r\n");
  });
  it("formata centavos", () => {
    expect(centsToCsv(123456)).toBe("1234,56");
    expect(centsToCsv(5)).toBe("0,05");
    expect(centsToCsv(-1050)).toBe("-10,50");
    expect(centsToCsv(null)).toBe("");
  });
});

describe("período no fuso do estúdio", () => {
  it("o dia em São Paulo começa às 03:00 UTC", () => {
    expect(new Date(dayStartMs("2026-11-18", "America/Sao_Paulo")).toISOString()).toBe("2026-11-18T03:00:00.000Z");
    expect(new Date(nextDayStartMs("2026-11-30", "America/Sao_Paulo")).toISOString()).toBe("2026-12-01T03:00:00.000Z");
  });
  it("funciona em UTC", () => {
    expect(new Date(dayStartMs("2026-01-01", "UTC")).toISOString()).toBe("2026-01-01T00:00:00.000Z");
  });
});

describe("stripSecretColumns", () => {
  it("remove hash de senha", () => {
    expect(stripSecretColumns({ id: 1, passwordHash: "x", password_hash: "y", name: "A" })).toEqual({ id: 1, name: "A" });
  });
});
