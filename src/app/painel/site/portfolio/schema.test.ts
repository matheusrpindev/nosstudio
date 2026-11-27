import { describe, expect, it } from "vitest";
import { zodFieldErrors } from "@/server/action";
import { PORTFOLIO_LIMITS } from "./limits";
import { portfolioSchema, toPortfolioInput } from "./schema";

/** O que o formulário envia depois de `parseSiteForm` (textos como string, listas já lidas do JSON). */
const form = (over: Record<string, unknown> = {}) => ({
  id: "",
  title: "[Teste] Projeto",
  slug: "",
  category: "fotografia",
  projectDate: "",
  clientName: "",
  summary: "",
  description: "",
  servicesDone: [],
  objective: "",
  challenge: "",
  solution: "",
  results: "",
  cover: "",
  gallery: [],
  videoUrl: "",
  extraVideoUrls: [],
  beforeAfter: [],
  backstage: [],
  relatedProjectIds: [],
  origin: "nos",
  originNote: "",
  ...over,
});

const parse = (over: Record<string, unknown> = {}) => portfolioSchema.safeParse(form(over));
const errors = (over: Record<string, unknown>) => {
  const result = parse(over);
  return result.success ? {} : zodFieldErrors(result.error);
};
const input = (over: Record<string, unknown> = {}) => {
  const result = parse(over);
  if (!result.success) throw new Error(JSON.stringify(zodFieldErrors(result.error)));
  return toPortfolioInput(result.data);
};

describe("formulário de projeto do portfólio", () => {
  it("o mínimo (título + categoria + origem) vira um rascunho sem nada inventado", () => {
    expect(input()).toEqual({
      title: "[Teste] Projeto",
      slug: "",
      category: "fotografia",
      projectDate: null,
      clientName: "",
      showClient: false,
      summary: "",
      description: "",
      servicesDone: [],
      objective: "",
      challenge: "",
      solution: "",
      results: "",
      coverMediaId: null,
      gallery: [],
      videoUrl: null,
      extraVideoUrls: [],
      beforeAfter: [],
      backstage: [],
      relatedProjectIds: [],
      origin: "nos",
      originNote: "",
      featured: false,
      published: false,
    });
  });

  it("exige título, categoria válida e origem válida", () => {
    expect(errors({ title: "   " }).title).toBe("Informe o título do projeto.");
    expect(errors({ category: "videos" }).category).toBe("Selecione a categoria."); // nome antigo não vale mais
    expect(errors({ category: "" }).category).toBe("Selecione a categoria.");
    expect(errors({ origin: "terceiros" }).origin).toBe("Selecione a origem do trabalho.");
    for (const category of ["audiovisual", "fotografia", "design", "marketing", "identidade_visual", "eventos", "casamentos"]) expect(parse({ category }).success, category).toBe(true);
  });

  it("vídeo principal e adicionais: só YouTube ou Vimeo, com mensagem que aponta o link errado", () => {
    expect(errors({ videoUrl: "https://exemplo.com/video.mp4" }).videoUrl).toMatch(/YouTube ou do Vimeo/);
    expect(errors({ extraVideoUrls: ["https://youtu.be/abc", "https://exemplo.com/x"] }).extraVideoUrls).toMatch(/vídeo adicional 2 /);
    expect(errors({ extraVideoUrls: ["javascript:alert(1)"] }).extraVideoUrls).toMatch(/vídeo adicional 1 /);
    expect(errors({ extraVideoUrls: Array.from({ length: PORTFOLIO_LIMITS.extraVideos + 1 }, (_, i) => `https://youtu.be/v${i}`) }).extraVideoUrls).toMatch(/No máximo 6/);

    const ok = input({ videoUrl: " https://youtu.be/principal ", extraVideoUrls: ["https://vimeo.com/123", "", "  ", "https://vimeo.com/123", "https://www.youtube.com/watch?v=principal", "https://youtu.be/outro"] });
    expect(ok.videoUrl).toBe("https://youtu.be/principal");
    // linhas vazias saem, repetidos saem, e o principal não se repete nos adicionais
    expect(ok.extraVideoUrls).toEqual(["https://vimeo.com/123", "https://youtu.be/outro"]);
  });

  it("antes e depois: par vazio é descartado; par incompleto é erro; legenda tem limite", () => {
    expect(input({ beforeAfter: [{ beforeMediaId: null, afterMediaId: null, caption: "  " }] }).beforeAfter).toEqual([]);
    expect(input({ beforeAfter: [{ beforeMediaId: 4, afterMediaId: 5, caption: " Fachada " }] }).beforeAfter).toEqual([{ beforeMediaId: 4, afterMediaId: 5, caption: "Fachada" }]);
    expect(errors({ beforeAfter: [{ beforeMediaId: 4, afterMediaId: 5, caption: "" }, { beforeMediaId: 6, afterMediaId: null, caption: "" }] }).beforeAfter).toBe("O par 2 precisa das duas imagens: a de antes e a de depois.");
    expect(errors({ beforeAfter: [{ beforeMediaId: null, afterMediaId: null, caption: "só legenda" }] }).beforeAfter).toMatch(/O par 1 precisa/);
    expect(Object.values(errors({ beforeAfter: [{ beforeMediaId: 1, afterMediaId: 2, caption: "x".repeat(201) }] })).join(" ")).toMatch(/200 caracteres/);
    expect(errors({ beforeAfter: Array.from({ length: 9 }, () => ({ beforeMediaId: 1, afterMediaId: 2, caption: "" })) }).beforeAfter).toMatch(/No máximo 8/);
    expect(parse({ beforeAfter: [{ beforeMediaId: "4", afterMediaId: 5, caption: "" }] }).success).toBe(false);
  });

  it("imagens: ids inteiros positivos, dentro dos limites", () => {
    expect(input({ cover: "12", gallery: [3, 4], backstage: [5] })).toMatchObject({ coverMediaId: 12, gallery: [3, 4], backstage: [5] });
    expect(parse({ gallery: [0] }).success).toBe(false);
    expect(parse({ gallery: ["3"] }).success).toBe(false);
    expect(parse({ backstage: [1.5] }).success).toBe(false);
    expect(errors({ gallery: Array.from({ length: 41 }, (_, i) => i + 1) }).gallery).toMatch(/No máximo 40/);
    expect(errors({ backstage: Array.from({ length: 25 }, (_, i) => i + 1) }).backstage).toMatch(/No máximo 24/);
  });

  it("cliente: o nome só é marcado para aparecer se houver um nome", () => {
    expect(input({ clientName: "", showClient: "on" }).showClient).toBe(false);
    expect(input({ clientName: "Cliente", showClient: "on" })).toMatchObject({ clientName: "Cliente", showClient: true });
    expect(input({ clientName: "Cliente" }).showClient).toBe(false);
  });

  it("origem: a observação só é guardada para experiência anterior", () => {
    expect(input({ origin: "nos", originNote: "Trabalho de um fundador." }).originNote).toBe("");
    expect(input({ origin: "experiencia_anterior", originNote: " Trabalho de um fundador. " })).toMatchObject({ origin: "experiencia_anterior", originNote: "Trabalho de um fundador." });
    expect(errors({ origin: "experiencia_anterior", originNote: "x".repeat(201) }).originNote).toMatch(/200/);
  });

  it("relacionados: sem repetição, sem o próprio projeto, no máximo 6", () => {
    expect(input({ id: "7", relatedProjectIds: [3, 7, 3, 9] }).relatedProjectIds).toEqual([3, 9]);
    expect(errors({ relatedProjectIds: [1, 2, 3, 4, 5, 6, 7] }).relatedProjectIds).toMatch(/No máximo 6/);
    expect(parse({ relatedProjectIds: ["1"] }).success).toBe(false);
  });

  it("textos do estudo de caso são opcionais e têm limite", () => {
    expect(input({ objective: "  Vender mais.  ", results: "" })).toMatchObject({ objective: "Vender mais.", results: "" });
    expect(errors({ results: "x".repeat(PORTFOLIO_LIMITS.caseText + 1) }).results).toMatch(/3000/);
  });

  it("switches, data e endereço", () => {
    expect(input({ featured: "on", published: "on" })).toMatchObject({ featured: true, published: true });
    expect(input({ projectDate: "2026-03-15" }).projectDate).toBe("2026-03-15");
    expect(errors({ projectDate: "15/03/2026" }).projectDate).toBe("Data inválida.");
    expect(input({ slug: " Meu-Projeto " }).slug).toBe("meu-projeto");
    expect(errors({ slug: "meu projeto!" }).slug).toMatch(/letras minúsculas/);
  });
});
