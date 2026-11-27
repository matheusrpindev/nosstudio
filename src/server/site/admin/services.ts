import "server-only";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { portfolioProjects, services, type Service, type ServiceBenefit, type ServiceFaq } from "@/db/schema";
import type { ServiceInterest } from "@/lib/domain";
import { droppedMediaIds, releaseMedia } from "@/server/media";
import { moveInOrder, nextSortOrder, slugTaken, uniqueSlug, type MoveDirection } from "./order";

export type ServiceInput = {
  title: string;
  /** Vazio = gerar a partir do título. */
  slug: string;
  summary: string;
  description: string;
  items: string[];
  ctaLabel: string;
  interest: ServiceInterest;
  coverMediaId: number | null;
  gallery: number[];
  videoUrl: string | null;
  pagePath: string | null;
  benefits: ServiceBenefit[];
  faq: ServiceFaq[];
  /** Projetos do portfólio relacionados (ids existentes; os inexistentes são descartados ao salvar). */
  relatedProjectIds: number[];
  visible: boolean;
};

export type RelatedProjectOption = { id: number; title: string; published: boolean };

/** Projetos do portfólio que podem ser marcados como "trabalhos relacionados" de um serviço. */
export async function listRelatedProjectOptions(): Promise<RelatedProjectOption[]> {
  return db
    .select({ id: portfolioProjects.id, title: portfolioProjects.title, published: portfolioProjects.published })
    .from(portfolioProjects)
    .orderBy(asc(portfolioProjects.sortOrder), asc(portfolioProjects.id));
}

export type SaveResult<T> = { ok: true; row: T } | { ok: false; error: "slug_taken" | "not_found" };

export async function listServices(): Promise<Service[]> {
  return db.select().from(services).orderBy(asc(services.sortOrder), asc(services.id));
}

export async function getService(id: number): Promise<Service | null> {
  const [row] = await db.select().from(services).where(eq(services.id, id));
  return row ?? null;
}

export async function saveService(id: number | null, input: ServiceInput): Promise<SaveResult<Service>> {
  let slug = input.slug;
  if (slug) {
    if (await slugTaken(services, slug, id ?? undefined)) return { ok: false, error: "slug_taken" };
  } else {
    slug = await uniqueSlug(services, input.title, id ?? undefined);
  }
  // só ids de projetos que existem (o formulário pode ter ficado aberto enquanto um projeto era excluído)
  const known = new Set((await listRelatedProjectOptions()).map((project) => project.id));
  const values = { ...input, slug, relatedProjectIds: [...new Set(input.relatedProjectIds)].filter((projectId) => known.has(projectId)) };
  if (id === null) {
    const [row] = await db.insert(services).values({ ...values, sortOrder: await nextSortOrder(services) }).returning();
    return { ok: true, row };
  }
  const previous = await getService(id);
  const [row] = await db.update(services).set(values).where(eq(services.id, id)).returning();
  if (!row) return { ok: false, error: "not_found" };
  // fotos trocadas ou tiradas da galeria: os arquivos antigos são apagados
  if (previous) await releaseMedia(droppedMediaIds([previous.coverMediaId, ...previous.gallery], [row.coverMediaId, ...row.gallery]));
  return { ok: true, row };
}

export async function setServiceVisible(id: number, visible: boolean): Promise<Service | null> {
  const [row] = await db.update(services).set({ visible }).where(eq(services.id, id)).returning();
  return row ?? null;
}

export const moveService = (id: number, direction: MoveDirection) => moveInOrder(services, id, direction);

/** Exclui o serviço e apaga as fotos dele (as que nenhum outro conteúdo usa). */
export async function deleteService(id: number): Promise<Service | null> {
  const [row] = await db.delete(services).where(eq(services.id, id)).returning();
  if (row) await releaseMedia([row.coverMediaId, ...row.gallery]);
  return row ?? null;
}
