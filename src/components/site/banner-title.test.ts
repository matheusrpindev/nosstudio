import { describe, expect, it } from "vitest";
import { bannerTitleLines } from "./banner-title";

describe("quebra do título do banner", () => {
  it("quebra na pontuação quando há duas frases", () => {
    expect(bannerTitleLines("Sua história, nosso olhar.")).toEqual(["Sua história,", "nosso olhar."]);
    expect(bannerTitleLines("Não apenas vídeos. Histórias.")).toEqual(["Não apenas vídeos.", "Histórias."]);
    expect(bannerTitleLines("Momentos passam. Histórias ficam.")).toEqual(["Momentos passam.", "Histórias ficam."]);
  });
  it("frase única e longa: quebra entre palavras, equilibrando as linhas", () => {
    expect(bannerTitleLines("O comum não é nosso estilo.")).toEqual(["O comum não é", "nosso estilo."]);
  });
  it("título curto fica numa linha só", () => {
    expect(bannerTitleLines("Olá, NÓS")).toEqual(["Olá,", "NÓS"]);
    expect(bannerTitleLines("Histórias")).toEqual(["Histórias", null]);
    expect(bannerTitleLines("Novo site")).toEqual(["Novo site", null]);
  });
  it("nunca perde texto", () => {
    for (const title of ["Uma frase bem comprida sem nenhuma pontuação no meio dela", "  espaços   demais  aqui dentro ", ""]) {
      const lines = bannerTitleLines(title).filter(Boolean).join(" ").split(/\s+/).filter(Boolean).join(" ");
      expect(lines).toBe(title.trim().split(/\s+/).filter(Boolean).join(" "));
    }
  });
});
