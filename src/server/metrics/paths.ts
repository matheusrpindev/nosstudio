/**
 * Endereços que existem no site (serviços visíveis e projetos publicados), para o relatório de páginas só guardar páginas
 * de verdade. Consulta direta com memória curta no processo (a coleta roda a cada página vista).
 */
import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { portfolioProjects, services } from "@/db/schema";
import { normalizeVisitPath, NOT_FOUND_PAGE_KEY, publicPageKey } from "@/lib/metrics/classify";

type Slugs = { services: string[]; portfolio: string[] };
const TTL_MS = 60_000;
const holder = globalThis as unknown as { __nosVisitSlugs?: { at: number; slugs: Slugs } };

export async function publishedSlugs(now: number = Date.now()): Promise<Slugs> {
  const cached = holder.__nosVisitSlugs;
  if (cached && now - cached.at < TTL_MS && now >= cached.at) return cached.slugs;
  const [serviceRows, projectRows] = await Promise.all([
    db.select({ slug: services.slug }).from(services).where(eq(services.visible, true)),
    db.select({ slug: portfolioProjects.slug }).from(portfolioProjects).where(eq(portfolioProjects.published, true)),
  ]);
  const slugs = { services: serviceRows.map((row) => row.slug), portfolio: projectRows.map((row) => row.slug) };
  holder.__nosVisitSlugs = { at: now, slugs };
  return slugs;
}

/** Esquece a memória (testes; e quando um serviço/projeto acabou de ser publicado). */
export function forgetPublishedSlugs(): void {
  holder.__nosVisitSlugs = undefined;
}

/**
 * Caminho enviado pelo navegador → página do relatório. `null` = não conta (painel, áreas privadas, arquivos…);
 * endereço que não existe no site vira `NOT_FOUND_PAGE_KEY`.
 */
export async function resolvePageKey(rawPath: string | null | undefined): Promise<string | null> {
  const path = normalizeVisitPath(rawPath);
  if (path === null) return null;
  try {
    return publicPageKey(path, await publishedSlugs());
  } catch {
    return publicPageKey(path, { services: [], portfolio: [] }) ?? NOT_FOUND_PAGE_KEY;
  }
}
