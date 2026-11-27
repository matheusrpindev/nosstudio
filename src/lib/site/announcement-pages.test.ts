import { describe, expect, it } from "vitest";
import { ANNOUNCEMENT_PAGE_KEYS, announcementMatchesPath, announcementPaths, normalizeAnnouncementPages } from "./announcement-pages";

describe("páginas da barra de avisos", () => {
  it("normaliza: só chaves conhecidas, sem repetição, na ordem do menu", () => {
    expect(normalizeAnnouncementPages(["contact", "home", "contact", "nao-existe", 3, "clientArea"])).toEqual(["home", "contact"]);
    expect(normalizeAnnouncementPages(null)).toEqual([]);
    expect(normalizeAnnouncementPages("home")).toEqual([]);
  });
  it("todas as páginas marcadas = lista vazia (todas)", () => {
    expect(normalizeAnnouncementPages([...ANNOUNCEMENT_PAGE_KEYS])).toEqual([]);
  });
  it("converte chaves em caminhos", () => {
    expect(announcementPaths(["events", "home"])).toEqual(["/", "/eventos-e-casamentos"]);
    expect(announcementPaths([])).toEqual([]);
  });
  it("lista vazia aparece em qualquer página, inclusive nas que não estão na lista", () => {
    expect(announcementMatchesPath([], "/")).toBe(true);
    expect(announcementMatchesPath([], "/qualquer-coisa")).toBe(true);
  });
  it("a página inicial só casa com a raiz", () => {
    expect(announcementMatchesPath(["/"], "/")).toBe(true);
    expect(announcementMatchesPath(["/"], "/sobre")).toBe(false);
  });
  it("uma página vale para as que ficam abaixo dela, mas não para vizinhas de nome parecido", () => {
    expect(announcementMatchesPath(["/servicos"], "/servicos")).toBe(true);
    expect(announcementMatchesPath(["/servicos"], "/servicos/")).toBe(true);
    expect(announcementMatchesPath(["/servicos"], "/servicos/fotografia")).toBe(true);
    expect(announcementMatchesPath(["/servicos"], "/servicos-extra")).toBe(false);
    expect(announcementMatchesPath(["/contato", "/planos"], "/planos")).toBe(true);
    expect(announcementMatchesPath(["/contato", "/planos"], "/sobre")).toBe(false);
  });
});
