import "server-only";
import { and, desc, eq, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { portfolioProjects, type PortfolioProject } from "@/db/schema";
import type { PortfolioCategory } from "@/lib/domain";
import { slugTaken, uniqueSlug, nextSortOrder } from "./order";
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
};

export type PortfolioFilters = {
  category?: PortfolioCategory;
  /** "publicado" | "rascunho" */
  status?: "publicado" | "rascunho";
  q?: string;
};

const likePattern = (term: string) => `%${term.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;

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
    .orderBy(desc(portfolioProjects.featured), desc(portfolioProjects.projectDate), desc(portfolioProjects.id));
}

export async function countPortfolio(): Promise<{ total: number; published: number }> {
  const rows = await db.select({ published: portfolioProjects.published }).from(portfolioProjects);
  return { total: rows.length, published: rows.filter((row) => row.published).length };
}

export async function getPortfolioProject(id: number): Promise<PortfolioProject | null> {
  const [row] = await db.select().from(portfolioProjects).where(eq(portfolioProjects.id, id));
  return row ?? null;
}

export async function savePortfolioProject(id: number | null, input: PortfolioInput): Promise<SaveResult<PortfolioProject>> {
  let slug = input.slug;
  if (slug) {
    if (await slugTaken(portfolioProjects, slug, id ?? undefined)) return { ok: false, error: "slug_taken" };
  } else {
    slug = await uniqueSlug(portfolioProjects, input.title, id ?? undefined);
  }
  const values = { ...input, slug };
  if (id === null) {
    const [row] = await db.insert(portfolioProjects).values({ ...values, sortOrder: await nextSortOrder(portfolioProjects) }).returning();
    return { ok: true, row };
  }
  const [row] = await db.update(portfolioProjects).set(values).where(eq(portfolioProjects.id, id)).returning();
  return row ? { ok: true, row } : { ok: false, error: "not_found" };
}

export async function setPortfolioPublished(id: number, published: boolean): Promise<PortfolioProject | null> {
  const [row] = await db.update(portfolioProjects).set({ published }).where(eq(portfolioProjects.id, id)).returning();
  return row ?? null;
}

export async function deletePortfolioProject(id: number): Promise<PortfolioProject | null> {
  const [row] = await db.delete(portfolioProjects).where(eq(portfolioProjects.id, id)).returning();
  return row ?? null;
}
