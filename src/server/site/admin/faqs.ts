import "server-only";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { faqs, type Faq } from "@/db/schema";
import { moveInOrder, nextSortOrder, type MoveDirection } from "./order";

export type FaqInput = {
  question: string;
  answer: string;
  published: boolean;
  showOnHome: boolean;
  showOnWeddings: boolean;
};

export async function listFaqs(): Promise<Faq[]> {
  return db.select().from(faqs).orderBy(asc(faqs.sortOrder), asc(faqs.id));
}

export async function getFaq(id: number): Promise<Faq | null> {
  const [row] = await db.select().from(faqs).where(eq(faqs.id, id));
  return row ?? null;
}

export async function saveFaq(id: number | null, input: FaqInput): Promise<Faq | null> {
  if (id === null) {
    const [row] = await db.insert(faqs).values({ ...input, sortOrder: await nextSortOrder(faqs) }).returning();
    return row;
  }
  const [row] = await db.update(faqs).set(input).where(eq(faqs.id, id)).returning();
  return row ?? null;
}

/** Publicar exige resposta preenchida — a regra fica aqui também, não só no formulário. */
export async function setFaqPublished(id: number, published: boolean): Promise<{ ok: true; row: Faq } | { ok: false; error: "not_found" | "no_answer" }> {
  const current = await getFaq(id);
  if (!current) return { ok: false, error: "not_found" };
  if (published && !current.answer.trim()) return { ok: false, error: "no_answer" };
  const [row] = await db.update(faqs).set({ published }).where(eq(faqs.id, id)).returning();
  return { ok: true, row };
}

export const moveFaq = (id: number, direction: MoveDirection) => moveInOrder(faqs, id, direction);

export async function deleteFaq(id: number): Promise<boolean> {
  const rows = await db.delete(faqs).where(eq(faqs.id, id)).returning({ id: faqs.id });
  return rows.length > 0;
}
