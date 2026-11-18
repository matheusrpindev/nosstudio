/**
 * Biblioteca da marca no PAINEL. Nada daqui é público (os SVGs do logo em /brand/* são arquivos estáticos do site).
 * Só fala com o banco; autorização, zod e auditoria ficam nas Server Actions.
 */
import "server-only";
import { and, asc, eq, max } from "drizzle-orm";
import { db } from "@/db";
import { brandAssets, type BrandAsset } from "@/db/schema";
import { BRAND_ASSET_CATEGORIES, type BrandAssetCategory } from "@/lib/domain";
import { deleteMedia, findMediaUsage, getMediaById, getMediaByIds, toMediaValue, type MediaValue } from "@/server/media";

export type BrandAssetItem = BrandAsset & { file: MediaValue | null };

/** Todos os itens com o arquivo (se houver), na ordem de exibição de cada categoria. */
export async function listBrandAssets(): Promise<Record<BrandAssetCategory, BrandAssetItem[]>> {
  const rows = await db.select().from(brandAssets).orderBy(asc(brandAssets.sortOrder), asc(brandAssets.id));
  const files = await getMediaByIds(rows.map((row) => row.mediaId));
  const grouped = Object.fromEntries(BRAND_ASSET_CATEGORIES.map((category) => [category, [] as BrandAssetItem[]])) as Record<BrandAssetCategory, BrandAssetItem[]>;
  for (const row of rows) {
    const media = row.mediaId ? files.get(row.mediaId) : undefined;
    grouped[row.category].push({ ...row, file: media ? toMediaValue(media) : null });
  }
  return grouped;
}

export async function getBrandAsset(id: number): Promise<BrandAsset | null> {
  const [row] = await db.select().from(brandAssets).where(eq(brandAssets.id, id));
  return row ?? null;
}

export type BrandAssetInput = {
  category: BrandAssetCategory;
  title: string;
  description: string;
  url: string;
  mediaId: number | null;
};

/** O arquivo da biblioteca tem de ser um upload PRIVADO existente. */
export async function isPrivateMedia(mediaId: number): Promise<boolean> {
  return (await getMediaById(mediaId))?.visibility === "private";
}

async function releaseMedia(mediaId: number | null | undefined): Promise<void> {
  if (!mediaId) return;
  if ((await findMediaUsage(mediaId)).length === 0) await deleteMedia(mediaId);
}

export async function createBrandAsset(input: BrandAssetInput): Promise<BrandAsset> {
  const [{ top }] = await db.select({ top: max(brandAssets.sortOrder) }).from(brandAssets).where(eq(brandAssets.category, input.category));
  const [row] = await db
    .insert(brandAssets)
    .values({ ...input, sortOrder: (top ?? 0) + 1 })
    .returning();
  return row;
}

export async function updateBrandAsset(id: number, input: BrandAssetInput): Promise<BrandAsset | null> {
  const existing = await getBrandAsset(id);
  if (!existing) return null;
  // mudar de categoria manda o item para o fim da nova categoria
  let sortOrder = existing.sortOrder;
  if (existing.category !== input.category) {
    const [{ top }] = await db.select({ top: max(brandAssets.sortOrder) }).from(brandAssets).where(eq(brandAssets.category, input.category));
    sortOrder = (top ?? 0) + 1;
  }
  const [row] = await db.update(brandAssets).set({ ...input, sortOrder }).where(eq(brandAssets.id, id)).returning();
  if (existing.mediaId && existing.mediaId !== input.mediaId) await releaseMedia(existing.mediaId);
  return row ?? null;
}

export async function deleteBrandAsset(id: number): Promise<BrandAsset | null> {
  const existing = await getBrandAsset(id);
  if (!existing) return null;
  await db.delete(brandAssets).where(eq(brandAssets.id, id));
  await releaseMedia(existing.mediaId);
  return existing;
}

/** Sobe ou desce um item dentro da própria categoria (renumera a categoria inteira, então não há empates). */
export async function moveBrandAsset(id: number, direction: "up" | "down"): Promise<boolean> {
  const asset = await getBrandAsset(id);
  if (!asset) return false;
  const siblings = await db
    .select({ id: brandAssets.id })
    .from(brandAssets)
    .where(eq(brandAssets.category, asset.category))
    .orderBy(asc(brandAssets.sortOrder), asc(brandAssets.id));
  const index = siblings.findIndex((row) => row.id === id);
  const target = direction === "up" ? index - 1 : index + 1;
  if (index < 0 || target < 0 || target >= siblings.length) return false;
  const order = siblings.map((row) => row.id);
  [order[index], order[target]] = [order[target], order[index]];
  await db.transaction(async (tx) => {
    for (const [position, rowId] of order.entries()) {
      await tx
        .update(brandAssets)
        .set({ sortOrder: position + 1 })
        .where(and(eq(brandAssets.id, rowId), eq(brandAssets.category, asset.category)));
    }
  });
  return true;
}
