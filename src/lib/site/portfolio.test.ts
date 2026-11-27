import { describe, expect, it } from "vitest";
import type { PortfolioProject } from "@/db/schema";
import type { PublicImage } from "@/lib/media";
import {
  filterPortfolio,
  homeFeaturedProjects,
  matchesSearch,
  normalizeSearch,
  parsePortfolioFilter,
  portfolioCategoryOptions,
  portfolioFilterQuery,
  projectMediaIds,
  projectSearchText,
  projectVideos,
  publishBlockers,
  relatedProjects,
  toPublicProject,
} from "./portfolio";

const image = (id: number, alt = `Imagem ${id}`): PublicImage => ({ id, url: `/media/site/${id}.webp`, width: 1600, height: 1000, alt, sources: [], placeholderColor: null });
const images = new Map([1, 2, 3, 4, 5, 6, 7].map((id) => [id, image(id)]));

const row = (over: Partial<PortfolioProject> = {}): PortfolioProject => ({
  id: 10,
  slug: "projeto",
  title: "[Teste] Projeto",
  clientName: "",
  showClient: false,
  category: "fotografia",
  summary: "",
  description: "",
  servicesDone: [],
  coverMediaId: null,
  gallery: [],
  videoUrl: null,
  extraVideoUrls: [],
  objective: "",
  challenge: "",
  solution: "",
  results: "",
  beforeAfter: [],
  backstage: [],
  relatedProjectIds: [],
  origin: "nos",
  originNote: "",
  projectDate: null,
  published: true,
  featured: false,
  sortOrder: 0,
  createdAt: new Date(0),
  updatedAt: new Date(0),
  ...over,
});

describe("projeto público do portfólio (toPublicProject)", () => {
  it("nome do cliente só sai com a autorização marcada — e nunca aparece em campo nenhum sem ela", () => {
    const hidden = toPublicProject(row({ clientName: "Cliente Sigiloso Ltda.", showClient: false }), images);
    expect(hidden.clientName).toBe("");
    expect(JSON.stringify(hidden)).not.toContain("Sigiloso");
    expect(projectSearchText(hidden)).not.toContain("sigiloso");

    const shown = toPublicProject(row({ clientName: "  Cliente Autorizado  ", showClient: true }), images);
    expect(shown.clientName).toBe("Cliente Autorizado");
    expect(projectSearchText(shown)).toContain("cliente autorizado");
  });

  it("blocos vazios (ou só com espaços) saem vazios: a página não tem o que renderizar", () => {
    const empty = toPublicProject(row({ objective: "   ", challenge: "\n", solution: "", results: " \t " }), images);
    expect([empty.objective, empty.challenge, empty.solution, empty.results]).toEqual(["", "", "", ""]);
    expect(empty.gallery).toEqual([]);
    expect(empty.backstage).toEqual([]);
    expect(empty.beforeAfter).toEqual([]);
    expect(projectVideos(empty)).toEqual([]);
    expect(empty.cover).toBeNull();
    expect(empty.servicesDone).toEqual([]);

    const filled = toPublicProject(row({ objective: " Vender mais. ", results: "**+30%** de pedidos (relatório do cliente)." }), images);
    expect(filled.objective).toBe("Vender mais.");
    expect(filled.results).toContain("+30%");
    expect(filled.challenge).toBe("");
  });

  it("imagens: só as que existem e são públicas; par de antes/depois só com as DUAS imagens", () => {
    const project = toPublicProject(
      row({
        coverMediaId: 1,
        gallery: [2, 99, 3],
        backstage: [98, 4],
        beforeAfter: [
          { beforeMediaId: 5, afterMediaId: 6, caption: "  Fachada  " },
          { beforeMediaId: 5, afterMediaId: 97, caption: "depois apagado" },
          { beforeMediaId: 96, afterMediaId: 6, caption: "antes apagado" },
        ],
      }),
      images,
    );
    expect(project.cover?.id).toBe(1);
    expect(project.gallery.map((item) => item.id)).toEqual([2, 3]);
    expect(project.backstage.map((item) => item.id)).toEqual([4]);
    expect(project.beforeAfter).toEqual([{ before: image(5), after: image(6), caption: "Fachada" }]);
  });

  it("vídeos: principal + adicionais, só YouTube/Vimeo, sem repetir o mesmo vídeo", () => {
    const project = toPublicProject(
      row({
        videoUrl: "https://youtu.be/abc123",
        extraVideoUrls: ["https://www.youtube.com/watch?v=abc123", "https://vimeo.com/123456", "https://exemplo.com/video.mp4", "javascript:alert(1)", "https://vimeo.com/123456"],
      }),
      images,
    );
    expect(projectVideos(project)).toEqual(["https://youtu.be/abc123", "https://vimeo.com/123456"]);
    // link principal inválido não vira vídeo; os adicionais válidos continuam
    const broken = toPublicProject(row({ videoUrl: "https://exemplo.com/x", extraVideoUrls: ["https://youtu.be/zzz"] }), images);
    expect(broken.videoUrl).toBeNull();
    expect(projectVideos(broken)).toEqual(["https://youtu.be/zzz"]);
  });

  it("origem: a observação só acompanha a experiência anterior", () => {
    expect(toPublicProject(row({ origin: "nos", originNote: "não deve sair" }), images)).toMatchObject({ origin: "nos", originNote: "" });
    expect(toPublicProject(row({ origin: "experiencia_anterior", originNote: " Trabalho de um fundador. " }), images)).toMatchObject({
      origin: "experiencia_anterior",
      originNote: "Trabalho de um fundador.",
    });
  });

  it("não vaza colunas internas (publicação, ordem, autorização, datas de sistema)", () => {
    const project = toPublicProject(row({ clientName: "X", showClient: true }), images);
    expect(Object.keys(project).sort()).toEqual(
      [
        "backstage",
        "beforeAfter",
        "category",
        "challenge",
        "clientName",
        "cover",
        "description",
        "extraVideoUrls",
        "featured",
        "gallery",
        "id",
        "objective",
        "origin",
        "originNote",
        "projectDate",
        "relatedProjectIds",
        "results",
        "servicesDone",
        "slug",
        "solution",
        "summary",
        "title",
        "videoUrl",
      ].sort(),
    );
  });

  it("projectMediaIds junta capa, galeria, bastidores e os dois lados de cada par, sem repetir", () => {
    expect(projectMediaIds(row({ coverMediaId: 1, gallery: [2, 3], backstage: [3, 4], beforeAfter: [{ beforeMediaId: 5, afterMediaId: 1, caption: "" }] }))).toEqual([1, 2, 3, 4, 5]);
    expect(projectMediaIds(row())).toEqual([]);
  });
});

describe("projetos relacionados e destaque da home", () => {
  const published = [
    toPublicProject(row({ id: 1, slug: "a", category: "fotografia" }), images),
    toPublicProject(row({ id: 2, slug: "b", category: "fotografia", featured: true }), images),
    toPublicProject(row({ id: 3, slug: "c", category: "casamentos" }), images),
    toPublicProject(row({ id: 4, slug: "d", category: "fotografia", featured: true }), images),
    toPublicProject(row({ id: 5, slug: "e", category: "fotografia" }), images),
  ];

  it("usa os escolhidos à mão, na ordem escolhida — e só os que estão publicados", () => {
    // 77 é um rascunho (não está na lista de publicados); 3 e 1 estão
    const project = toPublicProject(row({ id: 2, category: "fotografia", relatedProjectIds: [3, 77, 1] }), images);
    expect(relatedProjects(project, published).map((item) => item.id)).toEqual([3, 1]);
  });

  it("sem escolhidos publicados: outros publicados da mesma categoria, sem o próprio projeto", () => {
    const none = toPublicProject(row({ id: 2, category: "fotografia", relatedProjectIds: [] }), images);
    expect(relatedProjects(none, published).map((item) => item.id)).toEqual([1, 4, 5]);
    const onlyDrafts = toPublicProject(row({ id: 2, category: "fotografia", relatedProjectIds: [77, 78] }), images);
    expect(relatedProjects(onlyDrafts, published).map((item) => item.id)).toEqual([1, 4, 5]);
    // categoria sem outros projetos: o bloco não aparece
    const alone = toPublicProject(row({ id: 3, category: "casamentos" }), images);
    expect(relatedProjects(alone, published)).toEqual([]);
  });

  it("um projeto nunca é relacionado dele mesmo", () => {
    const self = toPublicProject(row({ id: 2, relatedProjectIds: [2, 1] }), images);
    expect(self.relatedProjectIds).toEqual([1]);
    expect(relatedProjects({ id: 2, category: "fotografia", relatedProjectIds: [2] }, published).map((item) => item.id)).toEqual([1, 4, 5]);
  });

  it("home: os destaques na ordem do painel; sem destaque, os primeiros; sem publicados, nada", () => {
    expect(homeFeaturedProjects(published).map((item) => item.id)).toEqual([2, 4]);
    expect(homeFeaturedProjects(published.filter((item) => !item.featured)).map((item) => item.id)).toEqual([1, 3, 5]);
    expect(homeFeaturedProjects([])).toEqual([]);
    expect(homeFeaturedProjects(Array.from({ length: 9 }, (_, id) => ({ id, featured: true })))).toHaveLength(6);
  });
});

describe("pesquisa e filtros do portfólio", () => {
  const projects = [
    toPublicProject(row({ id: 1, title: "Café da Praça", category: "fotografia", clientName: "Padaria São João", showClient: true, servicesDone: ["Fotografia de produto"] }), images),
    toPublicProject(row({ id: 2, title: "Filme institucional", category: "audiovisual", clientName: "Cliente Oculto", showClient: false, servicesDone: ["Roteiro", "Edição"] }), images),
    toPublicProject(row({ id: 3, title: "Nova marca", category: "identidade_visual", servicesDone: ["Logotipo"] }), images),
    toPublicProject(row({ id: 4, title: "Ensaio de família", category: "fotografia" }), images),
  ];
  const items = projects.map((project) => ({ id: project.id, category: project.category, search: projectSearchText(project) }));
  const ids = (category: Parameters<typeof filterPortfolio>[1]["category"], q: string) => filterPortfolio(items, { category, q }).map((item) => item.id);

  it("ignora acento, caixa e espaços sobrando", () => {
    expect(normalizeSearch("  Fotografia   de FAMÍLIA ")).toBe("fotografia de familia");
    expect(ids(null, "cafe")).toEqual([1]);
    expect(ids(null, "CAFÉ DA PRAÇA")).toEqual([1]);
    expect(ids(null, "familia")).toEqual([4]);
    expect(ids(null, "   ")).toEqual([1, 2, 3, 4]);
  });

  it("procura no título, no cliente autorizado, nos serviços e na categoria", () => {
    expect(ids(null, "sao joao")).toEqual([1]); // cliente autorizado
    expect(ids(null, "oculto")).toEqual([]); // cliente NÃO autorizado: não é pesquisável
    expect(ids(null, "roteiro")).toEqual([2]); // serviço
    expect(ids(null, "identidade")).toEqual([3]); // rótulo da categoria
    expect(ids(null, "fotografia")).toEqual([1, 4]); // categoria (e serviço do 1)
    expect(ids(null, "produto praca")).toEqual([1]); // todas as palavras, em qualquer ordem
    expect(ids(null, "produto casamento")).toEqual([]);
  });

  it("combina categoria e busca", () => {
    expect(ids("fotografia", "")).toEqual([1, 4]);
    expect(ids("fotografia", "ensaio")).toEqual([4]);
    expect(ids("audiovisual", "ensaio")).toEqual([]);
    expect(matchesSearch("qualquer coisa", "")).toBe(true);
  });

  it("filtros: só categorias com projeto, na ordem do briefing, com contagem", () => {
    expect(portfolioCategoryOptions(projects)).toEqual([
      { value: "audiovisual", label: "Audiovisual", count: 1 },
      { value: "fotografia", label: "Fotografia", count: 2 },
      { value: "identidade_visual", label: "Identidade visual", count: 1 },
    ]);
    expect(portfolioCategoryOptions([])).toEqual([]);
  });

  it("estado na URL: lê, ignora categoria desconhecida ou sem projeto, e escreve de volta", () => {
    expect(parsePortfolioFilter("?categoria=fotografia&q=caf%C3%A9")).toEqual({ category: "fotografia", q: "café" });
    expect(parsePortfolioFilter("")).toEqual({ category: null, q: "" });
    expect(parsePortfolioFilter("?categoria=videos")).toEqual({ category: null, q: "" }); // nome antigo
    expect(parsePortfolioFilter("?categoria=%3Cscript%3E&q=x")).toEqual({ category: null, q: "x" });
    expect(parsePortfolioFilter("?categoria=casamentos", ["fotografia", "audiovisual"])).toEqual({ category: null, q: "" });
    expect(parsePortfolioFilter(`?q=${"a".repeat(500)}`).q).toHaveLength(80);

    expect(portfolioFilterQuery({ category: null, q: "" })).toBe("");
    expect(portfolioFilterQuery({ category: null, q: "   " })).toBe("");
    expect(portfolioFilterQuery({ category: "identidade_visual", q: "" })).toBe("?categoria=identidade_visual");
    const query = portfolioFilterQuery({ category: "fotografia", q: "café & pão" });
    expect(parsePortfolioFilter(query)).toEqual({ category: "fotografia", q: "café & pão" });
  });
});

describe("regras de publicação (publishBlockers)", () => {
  const alts = new Map<number, string>([
    [1, "Capa descrita"],
    [2, "Foto 2"],
    [3, ""],
    [4, "   "],
    [5, "Antes"],
    [6, "Depois"],
  ]);

  it("sem capa não publica", () => {
    expect(publishBlockers(row({ coverMediaId: null }), alts)).toEqual({ cover: "Para publicar, envie a capa do projeto." });
  });

  it("toda imagem precisa de texto alternativo: capa, galeria, bastidores e antes/depois", () => {
    expect(publishBlockers(row({ coverMediaId: 3 }), alts).cover).toMatch(/texto alternativo da capa/);
    const blockers = publishBlockers(row({ coverMediaId: 1, gallery: [2, 3, 4], backstage: [4], beforeAfter: [{ beforeMediaId: 5, afterMediaId: 3, caption: "" }] }), alts);
    expect(Object.keys(blockers).sort()).toEqual(["backstage", "beforeAfter", "gallery"]);
    expect(blockers.gallery).toMatch(/2 imagens da galeria/);
    expect(blockers.backstage).toMatch(/imagem de bastidores/);
    expect(blockers.beforeAfter).toMatch(/imagem de antes e depois/);
    // imagem que não existe mais conta como "sem texto"
    expect(publishBlockers(row({ coverMediaId: 1, gallery: [999] }), alts).gallery).toBeDefined();
  });

  it("com capa e tudo descrito, nada impede", () => {
    expect(publishBlockers(row({ coverMediaId: 1, gallery: [2], backstage: [2], beforeAfter: [{ beforeMediaId: 5, afterMediaId: 6, caption: "" }] }), alts)).toEqual({});
    expect(publishBlockers(row({ coverMediaId: 1 }), alts)).toEqual({});
  });
});
