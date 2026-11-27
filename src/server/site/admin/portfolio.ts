/**
 * Portfólio no painel (Editar site › Portfólio): leitura, gravação, ordem, publicação e destaque.
 * Só fala com o banco; quem autoriza e valida são as Server Actions em `src/app/painel/site/portfolio/actions.ts`.
 * O formato que vai para o site é montado por `toPublicProject` (src/lib/site/portfolio.ts).
 */
import "server-only";
import { and, asc, eq, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { portfolioProjects, type PortfolioBeforeAfter, type PortfolioProject } from "@/db/schema";
import type { PortfolioCategory, PortfolioOrigin } from "@/lib/domain";
import { projectMediaIds, publishBlockers, type PublishBlockers } from "@/lib/site/portfolio";
import { droppedMediaIds, getMediaByIds, releaseMedia } from "@/server/media";
import { moveInOrder, slugTaken, uniqueSlug, type MoveDirection } from "./order";
import type { SaveResult } from "./services";

export type PortfolioInput = {
  title: string;
  /** Vazio = gerar a partir do título. */
  slug: string;
  category: PortfolioCategory;
  clientName: string;
  showClient: boolean;
  summary: string;
  description: string;
  servicesDone: string[];
  coverMediaId: number | null;
  gallery: number[];
  videoUrl: string | null;
  projectDate: string | null;
  featured: boolean;
  published: boolean;
  // ---- briefing v2 (opcionais aqui: quem não informa mantém o que está gravado; projeto novo usa o padrão)
  extraVideoUrls?: string[];
  objective?: string;
  challenge?: string;
  solution?: string;
  results?: string;
  beforeAfter?: PortfolioBeforeAfter[];
  backstage?: number[];
  /** Ids de outros projetos (os inexistentes e o próprio são descartados ao salvar). */
  relatedProjectIds?: number[];
  origin?: PortfolioOrigin;
  originNote?: string;
};

export type PortfolioFilters = {
  category?: PortfolioCategory;
  /** "publicado" | "rascunho" */
  status?: "publicado" | "rascunho";
  q?: string;
};

export type RelatedOption = { id: number; title: string; published: boolean };

const likePattern = (term: string) => `%${term.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
/** A ordem do painel É a ordem do site. */
const panelOrder = [asc(portfolioProjects.sortOrder), asc(portfolioProjects.id)] as const;

export async function listPortfolio(filters: PortfolioFilters = {}): Promise<PortfolioProject[]> {
  const conditions: (SQL | undefined)[] = [];
  if (filters.category) conditions.push(eq(portfolioProjects.category, filters.category));
  if (filters.status) conditions.push(eq(portfolioProjects.published, filters.status === "publicado"));
  const q = filters.q?.trim().slice(0, 80);
  if (q) {
    const text = likePattern(q.toLowerCase());
    conditions.push(or(sql`lower(${portfolioProjects.title}) like ${text} escape '\\'`, sql`lower(${portfolioProjects.clientName}) like ${text} escape '\\'`));
  }
  return db
    .select()
    .from(portfolioProjects)
    .where(and(...conditions))
    .orderBy(...panelOrder);
}

export async function countPortfolio(): Promise<{ total: number; published: number }> {
  const rows = await db.select({ published: portfolioProjects.published }).from(portfolioProjects);
  return { total: rows.length, published: rows.filter((row) => row.published).length };
}

export async function getPortfolioProject(id: number): Promise<PortfolioProject | null> {
  const [row] = await db.select().from(portfolioProjects).where(eq(portfolioProjects.id, id));
  return row ?? null;
}

/** Projetos que podem ser marcados como "relacionados" de um projeto (todos menos ele mesmo), na ordem do painel. */
export async function listRelatedOptions(exceptId: number | null): Promise<RelatedOption[]> {
  const rows = await db
    .select({ id: portfolioProjects.id, title: portfolioProjects.title, published: portfolioProjects.published })
    .from(portfolioProjects)
    .orderBy(...panelOrder);
  return rows.filter((row) => row.id !== exceptId);
}

/**
 * O que impede a publicação (capa e texto alternativo das imagens), lendo o texto alternativo ATUAL de cada
 * imagem — ele é salvo direto na mídia, ao sair do campo, antes de o formulário ser enviado.
 */
export async function findPublishBlockers(row: Parameters<typeof projectMediaIds>[0]): Promise<PublishBlockers> {
  const rows = await getMediaByIds(projectMediaIds(row));
  return publishBlockers(row, new Map([...rows].map(([id, item]) => [id, item.alt])));
}

/** Projeto novo entra no TOPO da lista (o trabalho mais recente primeiro); os sócios reordenam quando quiserem. */
async function topSortOrder(): Promise<number> {
  const [row] = await db.select({ min: sql<number | null>`min(${portfolioProjects.sortOrder})` }).from(portfolioProjects);
  return (row?.min ?? 1) - 1;
}

export async function savePortfolioProject(id: number | null, input: PortfolioInput): Promise<SaveResult<PortfolioProject>> {
  let slug = input.slug;
  if (slug) {
    if (await slugTaken(portfolioProjects, slug, id ?? undefined)) return { ok: false, error: "slug_taken" };
  } else {
    slug = await uniqueSlug(portfolioProjects, input.title, id ?? undefined);
  }
  const values: PortfolioInput & { slug: string } = { ...input, slug };
  if (input.relatedProjectIds) {
    // só ids de projetos que existem (o formulário pode ter ficado aberto enquanto um projeto era excluído)
    const known = new Set((await listRelatedOptions(id)).map((project) => project.id));
    values.relatedProjectIds = [...new Set(input.relatedProjectIds)].filter((projectId) => known.has(projectId));
  }
  // a observação da origem só existe para experiência anterior
  if (input.origin === "nos") values.originNote = "";

  if (id === null) {
    const [row] = await db.insert(portfolioProjects).values({ ...values, sortOrder: await topSortOrder() }).returning();
    return { ok: true, row };
  }
  const previous = await getPortfolioProject(id);
  const [row] = await db.update(portfolioProjects).set(values).where(eq(portfolioProjects.id, id)).returning();
  if (!row) return { ok: false, error: "not_found" };
  // imagens trocadas ou tiradas (capa, galeria, bastidores, antes/depois): os arquivos antigos são apagados
  if (previous) await releaseMedia(droppedMediaIds(projectMediaIds(previous), projectMediaIds(row)));
  return { ok: true, row };
}

export type PublishResult = { ok: true; row: PortfolioProject } | { ok: false; error: "not_found" } | { ok: false; error: "blocked"; blockers: PublishBlockers };

/** Publica ou volta para rascunho. Publicar exige capa e texto alternativo em todas as imagens. */
export async function setPortfolioPublished(id: number, published: boolean): Promise<PublishResult> {
  if (published) {
    const current = await getPortfolioProject(id);
    if (!current) return { ok: false, error: "not_found" };
    const blockers = await findPublishBlockers(current);
    if (Object.keys(blockers).length > 0) return { ok: false, error: "blocked", blockers };
  }
  const [row] = await db.update(portfolioProjects).set({ published }).where(eq(portfolioProjects.id, id)).returning();
  return row ? { ok: true, row } : { ok: false, error: "not_found" };
}

export async function setPortfolioFeatured(id: number, featured: boolean): Promise<PortfolioProject | null> {
  const [row] = await db.update(portfolioProjects).set({ featured }).where(eq(portfolioProjects.id, id)).returning();
  return row ?? null;
}

export const movePortfolio = (id: number, direction: MoveDirection) => moveInOrder(portfolioProjects, id, direction);

/**
 * Aplica a ordem arrastada na lista: `ids` na ordem nova. Ids desconhecidos ou repetidos são ignorados e projeto
 * que faltou na lista (criado em outra aba, por exemplo) fica no fim, na ordem em que estava — nada se perde.
 * Devolve `false` se nada mudou.
 */
export async function reorderPortfolio(ids: readonly number[]): Promise<boolean> {
  return db.transaction(async (tx) => {
    const rows = await tx
      .select({ id: portfolioProjects.id, sortOrder: portfolioProjects.sortOrder })
      .from(portfolioProjects)
      .orderBy(...panelOrder);
    const current = rows.map((row) => row.id);
    const known = new Set(current);
    const wanted = [...new Set(ids)].filter((projectId) => known.has(projectId));
    const next = [...wanted, ...current.filter((projectId) => !wanted.includes(projectId))];
    const changed = next.some((projectId, position) => projectId !== current[position] || rows[position].sortOrder !== position);
    if (!changed) return false;
    for (const [position, projectId] of next.entries()) {
      await tx.update(portfolioProjects).set({ sortOrder: position }).where(eq(portfolioProjects.id, projectId));
    }
    return next.some((projectId, position) => projectId !== current[position]);
  });
}

/** Exclui o projeto e apaga as imagens dele (as que nenhum outro conteúdo usa). */
export async function deletePortfolioProject(id: number): Promise<PortfolioProject | null> {
  const [row] = await db.delete(portfolioProjects).where(eq(portfolioProjects.id, id)).returning();
  if (row) await releaseMedia(projectMediaIds(row));
  return row ?? null;
}
