import { describe, expect, it } from "vitest";
import { PANEL_HOME, safeNextPath } from "./next-path";

describe("safeNextPath", () => {
  it("aceita caminhos do painel, com busca e âncora", () => {
    expect(safeNextPath("/painel")).toBe("/painel");
    expect(safeNextPath("/painel/clientes/12")).toBe("/painel/clientes/12");
    expect(safeNextPath("/painel/leads?status=novo&q=ana")).toBe("/painel/leads?status=novo&q=ana");
    expect(safeNextPath("/painel?x=1")).toBe("/painel?x=1");
    expect(safeNextPath("/painel/site#avisos")).toBe("/painel/site#avisos");
  });

  it("codifica acentos e espaços (o destino vai num cabeçalho HTTP)", () => {
    expect(safeNextPath("/painel/clientes?q=joão silva")).toBe("/painel/clientes?q=jo%C3%A3o%20silva");
    expect(safeNextPath("/painel/clientes?q=jo%C3%A3o")).toBe("/painel/clientes?q=jo%C3%A3o");
  });

  it("recusa destinos fora do painel (open redirect)", () => {
    for (const value of [
      "",
      "/",
      "/login",
      "//evil.example/painel",
      "/\\evil.example",
      "\\\\evil.example",
      "https://evil.example/painel",
      "/painel/x?u=https://evil.example",
      "/painel\\@evil.example",
      "/painelfalso",
      "/painel/../login",
      "/painel/%2e%2e/login",
      "javascript:alert(1)",
      "painel",
      null,
      undefined,
      42,
      ["/painel"],
    ]) {
      expect(safeNextPath(value)).toBe(PANEL_HOME);
    }
  });

  it("recusa caracteres de controle (CR/LF quebravam o redirecionamento do login) e valores enormes", () => {
    for (const value of ["/painel\r\nx", "/painel\nSet-Cookie: a=b", "/painel/\tx", "/painel\u0000", "/painel/\u007f", "/painel/ ", `/painel/${"a".repeat(600)}`]) {
      expect(safeNextPath(value)).toBe(PANEL_HOME);
    }
  });
});
