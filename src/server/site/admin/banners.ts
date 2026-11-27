/**
 * Banners do carrossel da página inicial — leitura e gravação para o painel (Editar site › Banners).
 * Só fala com o banco; quem autoriza e valida são as Server Actions em src/app/painel/site/banners/actions.ts.
 * Leitura pública (com cache e janela de exibição): `getBanners()` em src/server/site/queries.ts.
 */
import "server-only";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { banners, type Banner } from "@/db/schema";
import type { BannerLayout, BannerTone, BrandColor } from "@/lib/domain";
import { moveInOrder, nextSortOrder, type MoveDirection } from "./order";

export type { Banner };

export type BannerInput = {
  name: string;
  layout: BannerLayout;
  title: string;
  subtitle: string;
  buttonLabel: string;
  buttonUrl: string;
  secondaryLabel: string;
  secondaryUrl: string;
  desktopMediaId: number | null;
  mobileMediaId: number | null;
  videoMediaId: number | null;
  alt: string;
  bgColor: BrandColor;
  tone: BannerTone;
  durationSeconds: number;
  startsAt: string | null;
  endsAt: string | null;
  enabled: boolean;
};

/** Ids de mídia de um banner (para liberar arquivos que deixaram de ser usados). */
export const bannerMediaIds = (row: Pick<Banner, "desktopMediaId" | "mobileMediaId" | "videoMediaId">) => [row.desktopMediaId, row.mobileMediaId, row.videoMediaId];

/** Na ordem do site: `sortOrder`, depois o mais antigo primeiro. */
export async function listBanners(): Promise<Banner[]> {
  return db.select().from(banners).orderBy(asc(banners.sortOrder), asc(banners.id));
}

export async function getBanner(id: number): Promise<Banner | null> {
  const [row] = await db.select().from(banners).where(eq(banners.id, id));
  return row ?? null;
}

/** Banner novo entra no FIM do carrossel. */
export async function createBanner(input: BannerInput): Promise<Banner> {
  const [row] = await db
    .insert(banners)
    .values({ ...input, sortOrder: await nextSortOrder(banners) })
    .returning();
  return row;
}

/** Devolve o registro novo e o anterior (para comparar as mídias). `null` se o banner não existe mais. */
export async function updateBanner(id: number, input: BannerInput): Promise<{ row: Banner; previous: Banner } | null> {
  const previous = await getBanner(id);
  if (!previous) return null;
  const [row] = await db.update(banners).set(input).where(eq(banners.id, id)).returning();
  return row ? { row, previous } : null;
}

export async function setBannerEnabled(id: number, enabled: boolean): Promise<Banner | null> {
  const [row] = await db.update(banners).set({ enabled }).where(eq(banners.id, id)).returning();
  return row ?? null;
}

/** Nome da cópia: "Nome (cópia)", "Nome (cópia 2)"… sem repetir um nome que já existe. */
export function copyName(name: string, taken: readonly string[]): string {
  const base = (name.trim() || "Banner").replace(/\s*\(cópia(?: \d+)?\)$/u, "");
  for (let n = 1; n < 200; n++) {
    const candidate = `${base} (cópia${n === 1 ? "" : ` ${n}`})`.slice(0, 120);
    if (!taken.includes(candidate)) return candidate;
  }
  return `${base} (cópia)`.slice(0, 120);
}

/**
 * Duplica um banner: a cópia nasce DESLIGADA, logo abaixo do original, com os mesmos textos, datas e mídias
 * (os arquivos são compartilhados — apagar um dos dois não tira a imagem do outro; ver `findMediaUsage`).
 */
export async function duplicateBanner(id: number): Promise<Banner | null> {
  return db.transaction(async (tx) => {
    const rows = await tx.select().from(banners).orderBy(asc(banners.sortOrder), asc(banners.id));
    const index = rows.findIndex((row) => row.id === id);
    if (index === -1) return null;
    const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...source } = rows[index];
    const [copy] = await tx
      .insert(banners)
      .values({ ...source, name: copyName(source.name || source.title, rows.map((row) => row.name)), enabled: false })
      .returning();
    // renumera 0…N com a cópia logo depois do original
    const order = [...rows.slice(0, index + 1).map((row) => row.id), copy.id, ...rows.slice(index + 1).map((row) => row.id)];
    for (const [position, rowId] of order.entries()) await tx.update(banners).set({ sortOrder: position }).where(eq(banners.id, rowId));
    return { ...copy, sortOrder: index + 1 };
  });
}

export const moveBanner = (id: number, direction: MoveDirection) => moveInOrder(banners, id, direction);

/**
 * Arrastar e soltar: grava a ordem recebida. Ids desconhecidos são ignorados e banners que não vieram na lista
 * (criados em outra aba enquanto isso) continuam depois, na ordem em que estavam. Devolve `false` se nada mudou.
 */
export async function reorderBanners(orderedIds: readonly number[]): Promise<boolean> {
  return db.transaction(async (tx) => {
    const rows = await tx.select({ id: banners.id }).from(banners).orderBy(asc(banners.sortOrder), asc(banners.id));
    const current = rows.map((row) => row.id);
    const known = new Set(current);
    const wanted = [...new Set(orderedIds)].filter((id) => known.has(id));
    const next = [...wanted, ...current.filter((id) => !wanted.includes(id))];
    if (next.every((id, index) => id === current[index])) return false;
    for (const [position, id] of next.entries()) await tx.update(banners).set({ sortOrder: position }).where(eq(banners.id, id));
    return true;
  });
}

/** Apaga e devolve o registro apagado (para liberar as mídias), ou `null` se já não existia. */
export async function deleteBanner(id: number): Promise<Banner | null> {
  const [row] = await db.delete(banners).where(eq(banners.id, id)).returning();
  return row ?? null;
}
