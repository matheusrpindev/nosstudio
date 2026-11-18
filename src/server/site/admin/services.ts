import "server-only";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { services, type Service } from "@/db/schema";
import type { ServiceInterest } from "@/lib/domain";
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
  visible: boolean;
};

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
  const values = { ...input, slug };
  if (id === null) {
    const [row] = await db.insert(services).values({ ...values, sortOrder: await nextSortOrder(services) }).returning();
    return { ok: true, row };
  }
  const [row] = await db.update(services).set(values).where(eq(services.id, id)).returning();
  return row ? { ok: true, row } : { ok: false, error: "not_found" };
}

export async function setServiceVisible(id: number, visible: boolean): Promise<Service | null> {
  const [row] = await db.update(services).set({ visible }).where(eq(services.id, id)).returning();
  return row ?? null;
}

export const moveService = (id: number, direction: MoveDirection) => moveInOrder(services, id, direction);

export async function deleteService(id: number): Promise<Service | null> {
  const [row] = await db.delete(services).where(eq(services.id, id)).returning();
  return row ?? null;
}
