import { describe, expect, it } from "vitest";
import { parseManual, slugify } from "./manual";

describe("slugify", () => {
  it("tira acentos e troca símbolos por hífen", () => {
    expect(slugify("Do contato ao contrato")).toBe("do-contato-ao-contrato");
    expect(slugify("Produção e gestão")).toBe("producao-e-gestao");
    expect(slugify("  Perguntas rápidas?! ")).toBe("perguntas-rapidas");
  });
});

describe("parseManual", () => {
  const source = ["# Manual", "", "Introdução.", "", "## Primeiro acesso", "", "Texto A.", "", "### Entrar", "", "- passo", "", "## Primeiro acesso", "", "Texto B."].join("\n");

  it("separa título, introdução e seções", () => {
    const manual = parseManual(source);
    expect(manual.title).toBe("Manual");
    expect(manual.intro).toBe("Introdução.");
    expect(manual.sections).toHaveLength(2);
    expect(manual.sections[0].markdown).toContain("### Entrar");
    expect(manual.sections[0].markdown).toContain("- passo");
  });

  it("gera âncoras únicas para títulos repetidos", () => {
    expect(parseManual(source).sections.map((section) => section.id)).toEqual(["primeiro-acesso", "primeiro-acesso-2"]);
  });

  it("aceita um texto sem títulos", () => {
    expect(parseManual("só texto")).toEqual({ title: "Manual do painel", intro: "só texto", sections: [] });
  });
});
