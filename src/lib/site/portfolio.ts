/**
 * Portfólio do site (briefing v2, seção 08) — regras PURAS, sem banco e sem React: servem no servidor
 * (src/server/site/queries.ts, actions do painel) e no navegador (pesquisa e filtros de /portfolio).
 *
 * - `toPublicProject`: a ÚNICA função que transforma uma linha de `portfolio_projects` no que pode ir para o
 *   site. Nome de cliente sem autorização nunca sai; bloco vazio sai vazio (a página não o renderiza).
 * - pesquisa e filtros (`normalizeSearch`, `filterPortfolio`, `parsePortfolioFilter`…): rodam no navegador sobre
 *   a lista estática; o estado vai na URL (`?categoria=&q=`).
 * - `relatedProjects`, `homeFeaturedProjects`: seleção de projetos — sempre a partir da lista de PUBLICADOS.
 * - `publishBlockers`: o que impede publicar (capa e texto alternativo das imagens).
 */
import type { PortfolioBeforeAfter, PortfolioProject } from "@/db/schema";
import { PORTFOLIO_CATEGORIES, PORTFOLIO_CATEGORY_LABELS, type PortfolioCategory, type PortfolioOrigin } from "@/lib/domain";
import { videoEmbedUrl } from "@/lib/format";
import type { PublicImage } from "@/lib/media";

// ------------------------------------------------------------ projeto público
export type PublicBeforeAfter = { before: PublicImage; after: PublicImage; caption: string };

export type PublicPortfolioProject = {
  id: number;
  slug: string;
  title: string;
  category: PortfolioCategory;
  summary: string;
  description: string;
  servicesDone: string[];
  /** Vídeo principal (YouTube/Vimeo) — `null` se não houver ou se o link não for aceito. */
  videoUrl: string | null;
  /** Vídeos adicionais válidos, sem repetir o principal. */
  extraVideoUrls: string[];
  projectDate: string | null;
  featured: boolean;
  /** Nome do cliente — só vem preenchido quando a exibição foi autorizada. */
  clientName: string;
  cover: PublicImage | null;
  gallery: PublicImage[];
  /** Estudo de caso: cada bloco vem "" quando não foi preenchido (e então não aparece). */
  objective: string;
  challenge: string;
  solution: string;
  results: string;
  /** Só pares com as DUAS imagens. */
  beforeAfter: PublicBeforeAfter[];
  backstage: PublicImage[];
  /** Relacionados escolhidos à mão (ids, sem o próprio projeto). Quem resolve é `relatedProjects`. */
  relatedProjectIds: number[];
  origin: PortfolioOrigin;
  /** Complemento da origem — só quando `origin` é "experiencia_anterior". */
  originNote: string;
};

type ProjectMediaRefs = Pick<PortfolioProject, "coverMediaId" | "gallery" | "backstage" | "beforeAfter">;

const list = <T>(value: T[] | null | undefined): T[] => (Array.isArray(value) ? value : []);
const text = (value: string | null | undefined): string => (value ?? "").trim();

/** Todos os ids de mídia que um projeto usa (capa, galeria, bastidores, antes/depois), sem repetição. */
export function projectMediaIds(row: ProjectMediaRefs): number[] {
  const ids = [
    row.coverMediaId,
    ...list(row.gallery),
    ...list(row.backstage),
    ...list<PortfolioBeforeAfter>(row.beforeAfter).flatMap((pair) => [pair.beforeMediaId, pair.afterMediaId]),
  ];
  return [...new Set(ids.filter((id): id is number => typeof id === "number" && id > 0))];
}

/** Linha do banco → projeto público. `images`: as imagens públicas já carregadas, por id. */
export function toPublicProject(row: PortfolioProject, images: ReadonlyMap<number, PublicImage>): PublicPortfolioProject {
  const pick = (ids: number[] | null | undefined) => list(ids).flatMap((id) => images.get(id) ?? []);
  const mainVideo = videoEmbedUrl(row.videoUrl) ? row.videoUrl : null;
  const seenVideos = new Set(mainVideo ? [videoEmbedUrl(mainVideo)] : []);
  const extraVideoUrls = list(row.extraVideoUrls).filter((url) => {
    const embed = videoEmbedUrl(url);
    if (!embed || seenVideos.has(embed)) return false;
    seenVideos.add(embed);
    return true;
  });
  const previous = row.origin === "experiencia_anterior";
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    category: row.category,
    summary: text(row.summary),
    description: text(row.description),
    servicesDone: list(row.servicesDone).map(text).filter(Boolean),
    videoUrl: mainVideo,
    extraVideoUrls,
    projectDate: row.projectDate,
    featured: row.featured,
    // o nome guardado no painel só sai com a autorização marcada
    clientName: row.showClient ? text(row.clientName) : "",
    cover: row.coverMediaId ? (images.get(row.coverMediaId) ?? null) : null,
    gallery: pick(row.gallery),
    objective: text(row.objective),
    challenge: text(row.challenge),
    solution: text(row.solution),
    results: text(row.results),
    beforeAfter: list<PortfolioBeforeAfter>(row.beforeAfter).flatMap((pair) => {
      const before = images.get(pair.beforeMediaId);
      const after = images.get(pair.afterMediaId);
      return before && after ? [{ before, after, caption: text(pair.caption) }] : [];
    }),
    backstage: pick(row.backstage),
    relatedProjectIds: [...new Set(list(row.relatedProjectIds))].filter((id) => id !== row.id),
    origin: previous ? "experiencia_anterior" : "nos",
    originNote: previous ? text(row.originNote) : "",
  };
}

/** Vídeos do projeto na ordem de exibição: o principal e depois os adicionais. */
export function projectVideos(project: Pick<PublicPortfolioProject, "videoUrl" | "extraVideoUrls">): string[] {
  return [...(project.videoUrl ? [project.videoUrl] : []), ...project.extraVideoUrls];
}

// ------------------------------------------------------------------ seleções
/**
 * Projetos relacionados de um projeto: os escolhidos à mão (na ordem escolhida); se nenhum deles estiver
 * publicado, outros publicados da mesma categoria. `published` é a lista de `getPortfolio()` — por isso rascunho
 * e projeto excluído nunca aparecem.
 */
export function relatedProjects<T extends Pick<PublicPortfolioProject, "id" | "category">>(
  project: Pick<PublicPortfolioProject, "id" | "category" | "relatedProjectIds">,
  published: readonly T[],
  max = 3,
): T[] {
  const chosen = project.relatedProjectIds.flatMap((id) => (id === project.id ? [] : (published.find((other) => other.id === id) ?? [])));
  if (chosen.length > 0) return chosen.slice(0, max);
  return published.filter((other) => other.id !== project.id && other.category === project.category).slice(0, max);
}

/**
 * Bloco "portfólio em destaque" da página inicial: os projetos marcados como destaque, na ordem do painel.
 * Sem nenhum destaque marcado, os primeiros da lista — o bloco só some quando não há projeto publicado.
 */
export function homeFeaturedProjects<T extends Pick<PublicPortfolioProject, "featured">>(published: readonly T[], max = 6, fallback = 3): T[] {
  const featured = published.filter((project) => project.featured);
  return featured.length > 0 ? featured.slice(0, max) : published.slice(0, fallback);
}

// --------------------------------------------------------- pesquisa e filtros
/** Minúsculas, sem acento e com espaços simples: "Fotografia  de Família" → "fotografia de familia". */
export function normalizeSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Texto pesquisável de um projeto: título, cliente (só o autorizado — `clientName` já vem vazio sem autorização),
 * serviços realizados e categoria. Já normalizado.
 */
export function projectSearchText(project: Pick<PublicPortfolioProject, "title" | "clientName" | "servicesDone" | "category">): string {
  return normalizeSearch([project.title, project.clientName, ...project.servicesDone, PORTFOLIO_CATEGORY_LABELS[project.category]].join(" · "));
}

/** Todas as palavras da busca precisam aparecer no texto (em qualquer ordem). Busca vazia casa com tudo. */
export function matchesSearch(haystack: string, query: string): boolean {
  const terms = normalizeSearch(query).split(" ").filter(Boolean);
  return terms.every((term) => haystack.includes(term));
}

export type PortfolioFilter = { category: PortfolioCategory | null; q: string };
export const EMPTY_PORTFOLIO_FILTER: PortfolioFilter = { category: null, q: "" };
/** Tamanho máximo do termo de busca lido da URL. */
export const PORTFOLIO_SEARCH_MAX = 80;

type Searchable = { category: PortfolioCategory; search: string };

export function filterPortfolio<T extends Searchable>(items: readonly T[], filter: PortfolioFilter): T[] {
  return items.filter((item) => (!filter.category || item.category === filter.category) && matchesSearch(item.search, filter.q));
}

export type PortfolioCategoryOption = { value: PortfolioCategory; label: string; count: number };

/** Filtros disponíveis: só categorias com projeto na lista, na ordem do briefing, com a contagem de cada uma. */
export function portfolioCategoryOptions(items: readonly { category: PortfolioCategory }[]): PortfolioCategoryOption[] {
  return PORTFOLIO_CATEGORIES.map((value) => ({
    value,
    label: PORTFOLIO_CATEGORY_LABELS[value],
    count: items.filter((item) => item.category === value).length,
  })).filter((option) => option.count > 0);
}

/**
 * Estado dos filtros a partir da query string (`?categoria=fotografia&q=marca`). Categoria desconhecida — ou sem
 * projeto publicado, quando `available` é informado — é ignorada.
 */
export function parsePortfolioFilter(search: string, available: readonly PortfolioCategory[] = PORTFOLIO_CATEGORIES): PortfolioFilter {
  const params = new URLSearchParams(search);
  const category = params.get("categoria");
  return {
    category: available.find((value) => value === category) ?? null,
    q: (params.get("q") ?? "").slice(0, PORTFOLIO_SEARCH_MAX),
  };
}

/** Query string do estado dos filtros ("" quando não há filtro): `?categoria=…&q=…`. */
export function portfolioFilterQuery(filter: PortfolioFilter): string {
  const params = new URLSearchParams();
  if (filter.category) params.set("categoria", filter.category);
  if (filter.q.trim()) params.set("q", filter.q.slice(0, PORTFOLIO_SEARCH_MAX));
  const query = params.toString();
  return query ? `?${query}` : "";
}

// ------------------------------------------------------------- publicação
export type PublishBlockers = Partial<Record<"cover" | "gallery" | "backstage" | "beforeAfter", string>>;

const missingAltMessage = (count: number, where: string) =>
  count === 1
    ? `Para publicar, descreva a imagem ${where} que está sem texto alternativo.`
    : `Para publicar, descreva as ${count} imagens ${where} que estão sem texto alternativo.`;

/**
 * O que impede um projeto de ser publicado: falta de capa e imagens sem texto alternativo. Devolve a mensagem
 * por campo do formulário (vazio = pode publicar). `alts`: texto alternativo de cada mídia, por id — uma mídia
 * que não está no mapa conta como "sem texto".
 */
export function publishBlockers(row: ProjectMediaRefs, alts: ReadonlyMap<number, string>): PublishBlockers {
  const missing = (ids: (number | null | undefined)[]) => ids.filter((id) => typeof id === "number" && !(alts.get(id) ?? "").trim()).length;
  const blockers: PublishBlockers = {};
  if (!row.coverMediaId) blockers.cover = "Para publicar, envie a capa do projeto.";
  else if (missing([row.coverMediaId]) > 0) blockers.cover = "Para publicar, preencha o texto alternativo da capa.";
  const gallery = missing(list(row.gallery));
  if (gallery > 0) blockers.gallery = missingAltMessage(gallery, "da galeria");
  const backstage = missing(list(row.backstage));
  if (backstage > 0) blockers.backstage = missingAltMessage(backstage, "de bastidores");
  const pairs = missing(list<PortfolioBeforeAfter>(row.beforeAfter).flatMap((pair) => [pair.beforeMediaId, pair.afterMediaId]));
  if (pairs > 0) blockers.beforeAfter = missingAltMessage(pairs, "de antes e depois");
  return blockers;
}
