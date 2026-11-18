import "server-only";
import { asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { testimonials, type Testimonial } from "@/db/schema";
import type { TestimonialKind } from "@/lib/domain";
import { droppedMediaIds, releaseMedia } from "@/server/media";
import { moveInOrder, nextSortOrder, type MoveDirection } from "./order";

export type TestimonialInput = {
  kind: TestimonialKind;
  authorName: string;
  authorRole: string;
  content: string;
  mediaId: number | null;
  mediaAlt: string;
  videoUrl: string | null;
  authorized: boolean;
  published: boolean;
};

/** Mesma ordem do site: `sortOrder`, depois o mais novo primeiro. */
export async function listTestimonials(): Promise<Testimonial[]> {
  return db.select().from(testimonials).orderBy(asc(testimonials.sortOrder), desc(testimonials.id));
}

export async function getTestimonial(id: number): Promise<Testimonial | null> {
  const [row] = await db.select().from(testimonials).where(eq(testimonials.id, id));
  return row ?? null;
}

export async function saveTestimonial(id: number | null, input: TestimonialInput): Promise<Testimonial | null> {
  // Sem autorização registrada não existe depoimento publicado, nem por engano.
  const values = { ...input, published: input.published && input.authorized };
  if (id === null) {
    const [row] = await db.insert(testimonials).values({ ...values, sortOrder: await nextSortOrder(testimonials) }).returning();
    return row;
  }
  const previous = await getTestimonial(id);
  const [row] = await db.update(testimonials).set(values).where(eq(testimonials.id, id)).returning();
  // foto/print trocado ou removido: o arquivo antigo é apagado (não fica acessível pelo link)
  if (row && previous) await releaseMedia(droppedMediaIds([previous.mediaId], [row.mediaId]));
  return row ?? null;
}

export async function setTestimonialPublished(id: number, published: boolean): Promise<{ ok: true; row: Testimonial } | { ok: false; error: "not_found" | "not_authorized" }> {
  const current = await getTestimonial(id);
  if (!current) return { ok: false, error: "not_found" };
  if (published && !current.authorized) return { ok: false, error: "not_authorized" };
  const [row] = await db.update(testimonials).set({ published }).where(eq(testimonials.id, id)).returning();
  return { ok: true, row };
}

export const moveTestimonial = (id: number, direction: MoveDirection) => moveInOrder(testimonials, id, direction, "desc");

/** Exclui o depoimento e apaga a foto/print dele (se nenhum outro conteúdo usar o mesmo arquivo). */
export async function deleteTestimonial(id: number): Promise<boolean> {
  const rows = await db.delete(testimonials).where(eq(testimonials.id, id)).returning({ id: testimonials.id, mediaId: testimonials.mediaId });
  await releaseMedia(rows.map((row) => row.mediaId));
  return rows.length > 0;
}
