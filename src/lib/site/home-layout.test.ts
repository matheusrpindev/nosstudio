import { describe, expect, it } from "vitest";
import {
  defaultHomeLayout,
  HOME_SECTION_IDS,
  HOME_SECTION_INFO,
  isDefaultHomeLayout,
  moveHomeSection,
  reorderHomeSections,
  resolveHomeLayout,
  setHomeSectionVisible,
  visibleHomeSections,
  type HomeLayout,
} from "./home-layout";

const ids = (layout: HomeLayout) => layout.map((item) => item.id);

describe("ordem e visibilidade das seções da página inicial", () => {
  it("o padrão é a ordem do briefing v2, com tudo ligado", () => {
    expect(ids(defaultHomeLayout)).toEqual([
      "servicos",
      "portfolio",
      "diferenciais",
      "fundadores",
      "processo",
      "planos",
      "avulsos",
      "eventos",
      "depoimentos",
      "faq",
      "formulario",
    ]);
    expect(defaultHomeLayout.every((item) => item.visible)).toBe(true);
    expect(isDefaultHomeLayout(defaultHomeLayout)).toBe(true);
    // toda seção tem rótulo e destino de edição no painel
    for (const id of HOME_SECTION_IDS) {
      expect(HOME_SECTION_INFO[id].label).not.toBe("");
      expect(HOME_SECTION_INFO[id].editHref).toMatch(/^\/painel\/site\//);
    }
  });

  it("nada salvo, valor corrompido ou formato errado → padrão (o site nunca quebra)", () => {
    for (const stored of [undefined, null, "x", 42, {}, [{ id: 1 }], [{ id: "servicos" }], [{ id: "servicos", visible: "sim" }]]) {
      expect(resolveHomeLayout(stored)).toEqual(defaultHomeLayout);
    }
    // devolve uma cópia: mexer no resultado não altera o padrão
    resolveHomeLayout(null)[0].visible = false;
    expect(defaultHomeLayout[0].visible).toBe(true);
  });

  it("respeita a ordem e a visibilidade salvas", () => {
    const stored = [...defaultHomeLayout].reverse().map((item) => ({ ...item, visible: item.id !== "faq" }));
    const layout = resolveHomeLayout(stored);
    expect(ids(layout)).toEqual([...HOME_SECTION_IDS].reverse());
    expect(layout.find((item) => item.id === "faq")?.visible).toBe(false);
    expect(isDefaultHomeLayout(layout)).toBe(false);
  });

  it("descarta ids desconhecidos e repetidos", () => {
    const layout = resolveHomeLayout([
      { id: "formulario", visible: true },
      { id: "secao-que-nao-existe", visible: true },
      { id: "formulario", visible: false },
      ...defaultHomeLayout.filter((item) => item.id !== "formulario"),
    ]);
    expect(layout).toHaveLength(HOME_SECTION_IDS.length);
    expect(layout[0]).toEqual({ id: "formulario", visible: true });
    expect(new Set(ids(layout)).size).toBe(layout.length);
  });

  it("seção nova (ausente do que foi salvo) entra visível, logo depois da vizinha anterior da ordem padrão", () => {
    // ordem salva antes de "diferenciais" e "avulsos" existirem, com os planos no topo
    const saved = [
      { id: "planos", visible: true },
      { id: "servicos", visible: false },
      { id: "portfolio", visible: true },
      { id: "fundadores", visible: true },
      { id: "processo", visible: true },
      { id: "eventos", visible: true },
      { id: "depoimentos", visible: true },
      { id: "faq", visible: true },
      { id: "formulario", visible: true },
    ];
    const layout = resolveHomeLayout(saved);
    expect(ids(layout)).toEqual(["planos", "avulsos", "servicos", "portfolio", "diferenciais", "fundadores", "processo", "eventos", "depoimentos", "faq", "formulario"]);
    expect(layout.find((item) => item.id === "diferenciais")?.visible).toBe(true);
    expect(layout.find((item) => item.id === "servicos")?.visible).toBe(false);
    // sem nenhuma vizinha anterior salva, a seção nova vai para o início
    expect(ids(resolveHomeLayout([{ id: "formulario", visible: true }]))[0]).toBe("servicos");
  });

  it("subir e descer trocam com a vizinha; na ponta nada muda", () => {
    const down = moveHomeSection(defaultHomeLayout, "servicos", "down");
    expect(ids(down).slice(0, 3)).toEqual(["portfolio", "servicos", "diferenciais"]);
    expect(ids(moveHomeSection(down, "servicos", "up"))).toEqual(ids(defaultHomeLayout));
    expect(moveHomeSection(defaultHomeLayout, "servicos", "up")).toBe(defaultHomeLayout);
    expect(moveHomeSection(defaultHomeLayout, "formulario", "down")).toBe(defaultHomeLayout);
    // não altera a lista original
    expect(ids(defaultHomeLayout)[0]).toBe("servicos");
  });

  it("ocultar tira a seção das visíveis sem perder a posição; mostrar devolve no mesmo lugar", () => {
    const hidden = setHomeSectionVisible(defaultHomeLayout, "processo", false);
    expect(visibleHomeSections(hidden)).not.toContain("processo");
    expect(ids(hidden)).toEqual(ids(defaultHomeLayout));
    expect(visibleHomeSections(setHomeSectionVisible(hidden, "processo", true))).toEqual([...HOME_SECTION_IDS]);
    expect(defaultHomeLayout.find((item) => item.id === "processo")?.visible).toBe(true);
  });

  it("arrastar: aplica a nova ordem, ignora ids estranhos/repetidos e não perde seção que faltou na lista", () => {
    const layout = setHomeSectionVisible(defaultHomeLayout, "eventos", false);
    const next = reorderHomeSections(layout, ["formulario", "x", "eventos", "formulario", "servicos"]);
    expect(ids(next).slice(0, 3)).toEqual(["formulario", "eventos", "servicos"]);
    expect(next).toHaveLength(HOME_SECTION_IDS.length);
    expect(next.find((item) => item.id === "eventos")?.visible).toBe(false);
    // as que não vieram na lista continuam, na ordem em que estavam
    expect(ids(next).slice(3)).toEqual(["portfolio", "diferenciais", "fundadores", "processo", "planos", "avulsos", "depoimentos", "faq"]);
  });

  it("o que foi salvo passa de novo pelo resolve sem mudar (ida e volta)", () => {
    const layout = setHomeSectionVisible(moveHomeSection(defaultHomeLayout, "eventos", "up"), "avulsos", false);
    expect(resolveHomeLayout(JSON.parse(JSON.stringify(layout)))).toEqual(layout);
  });
});
