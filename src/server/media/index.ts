/**
 * Serviço de mídia: único caminho de entrada de arquivos no sistema.
 * - Imagens públicas (site): reencodadas em WebP, sem metadados, com versões menores.
 * - Arquivos privados (contratos, comprovantes, materiais): guardados como estão, servidos só com sessão.
 */
import "server-only";
import { eq, inArray } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import { db } from "@/db";
import {
  brandAssets,
  contracts,
  financeEntries,
  media,
  portfolioProjects,
  services,
  siteContent,
  testimonials,
  type Media,
  type MediaVariant,
} from "@/db/schema";
import type { MediaVisibility } from "@/lib/domain";
import { mediaUrl } from "@/lib/media";
import { FILE_MAX_BYTES, MediaError, processImage, sanitizeFileName, sniffFile } from "./process";
import { storage } from "./storage";

export { MediaError } from "./process";

/** Forma devolvida pela API do painel e esperada pelos campos de upload do kit. */
export type MediaValue = {
  id: number;
  url: string;
  mime: string;
  originalName: string;
  size: number;
  width: number | null;
  height: number | null;
  alt: string;
  visibility: MediaVisibility;
};

export function toMediaValue(row: Media): MediaValue {
  return {
    id: row.id,
    url: mediaUrl(row.storageKey),
    mime: row.mime,
    originalName: row.originalName,
    size: row.size,
    width: row.width,
    height: row.height,
    alt: row.alt,
    visibility: row.visibility,
  };
}

function newKeyBase(visibility: MediaVisibility, now = new Date()): string {
  const prefix = visibility === "public" ? "pub" : "priv";
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${prefix}/${year}/${month}/${randomBytes(12).toString("hex")}`;
}

type CreateMediaInput = {
  buffer: Buffer;
  originalName: string;
  visibility: MediaVisibility;
  alt?: string;
  userId?: number | null;
};

/** Valida, processa, grava no storage e registra na tabela `media`. Lança MediaError com mensagem para o usuário. */
export async function createMedia(input: CreateMediaInput): Promise<Media> {
  const originalName = sanitizeFileName(input.originalName);
  const alt = (input.alt ?? "").trim().slice(0, 300);
  const base = newKeyBase(input.visibility);
  const written: string[] = [];
  const put = async (key: string, data: Buffer) => {
    await storage.put(key, data);
    written.push(key);
  };

  try {
    if (input.visibility === "public") {
      const image = await processImage(input.buffer);
      const storageKey = `${base}.webp`;
      await put(storageKey, image.main.buffer);
      const variants: MediaVariant[] = [];
      for (const variant of image.variants) {
        const key = `${base}-${variant.width}.webp`;
        await put(key, variant.buffer);
        variants.push({ width: variant.width, height: variant.height, key });
      }
      const [row] = await db
        .insert(media)
        .values({
          storageKey,
          visibility: "public",
          mime: "image/webp",
          originalName,
          size: image.main.buffer.length,
          width: image.main.width,
          height: image.main.height,
          alt,
          variants,
          placeholderColor: image.placeholderColor,
          uploadedBy: input.userId ?? null,
        })
        .returning();
      return row;
    }

    if (input.buffer.length > FILE_MAX_BYTES) throw new MediaError("Arquivo grande demais (máximo de 25 MB).", 413);
    if (input.buffer.length === 0) throw new MediaError("O arquivo está vazio.", 400);
    const { ext, mime } = sniffFile(input.buffer, originalName);
    const storageKey = `${base}.${ext}`;
    await put(storageKey, input.buffer);
    const [row] = await db
      .insert(media)
      .values({
        storageKey,
        visibility: "private",
        mime,
        originalName,
        size: input.buffer.length,
        alt,
        uploadedBy: input.userId ?? null,
      })
      .returning();
    return row;
  } catch (error) {
    // nada de arquivo órfão se algo falhar no meio
    await Promise.allSettled(written.map((key) => storage.delete(key)));
    throw error;
  }
}

export async function getMediaById(id: number): Promise<Media | null> {
  const [row] = await db.select().from(media).where(eq(media.id, id));
  return row ?? null;
}

export async function getMediaByIds(ids: (number | null | undefined)[]): Promise<Map<number, Media>> {
  const unique = [...new Set(ids.filter((id): id is number => typeof id === "number" && id > 0))];
  const map = new Map<number, Media>();
  if (unique.length === 0) return map;
  for (const row of await db.select().from(media).where(inArray(media.id, unique))) map.set(row.id, row);
  return map;
}

/** Valores prontos para os campos de upload (ImageField/GalleryField/FileField), na ordem pedida. */
export async function getMediaValues(ids: (number | null | undefined)[]): Promise<MediaValue[]> {
  const rows = await getMediaByIds(ids);
  return ids.flatMap((id) => {
    const row = typeof id === "number" ? rows.get(id) : undefined;
    return row ? [toMediaValue(row)] : [];
  });
}

export async function getMediaValue(id: number | null | undefined): Promise<MediaValue | null> {
  return (await getMediaValues([id]))[0] ?? null;
}

export async function updateMediaAlt(id: number, alt: string): Promise<Media | null> {
  const [row] = await db.update(media).set({ alt: alt.trim().slice(0, 300) }).where(eq(media.id, id)).returning();
  return row ?? null;
}

/** Procura referências a `id` em propriedades terminadas em "mediaId" (qualquer profundidade). */
function jsonReferencesMedia(value: unknown, id: number): boolean {
  if (Array.isArray(value)) return value.some((item) => jsonReferencesMedia(item, id));
  if (value && typeof value === "object") {
    return Object.entries(value).some(([key, inner]) =>
      /mediaid$/i.test(key) && inner === id ? true : jsonReferencesMedia(inner, id),
    );
  }
  return false;
}

/** Onde a mídia está em uso (lista de descrições em pt-BR). Vazio = pode ser apagada. */
export async function findMediaUsage(id: number): Promise<string[]> {
  const usage: string[] = [];
  const [serviceRows, portfolioRows, testimonialRows, contractRows, financeRows, brandRows, contentRows] = await Promise.all([
    db.select({ title: services.title, cover: services.coverMediaId, gallery: services.gallery }).from(services),
    db
      .select({ title: portfolioProjects.title, cover: portfolioProjects.coverMediaId, gallery: portfolioProjects.gallery })
      .from(portfolioProjects),
    db.select({ author: testimonials.authorName }).from(testimonials).where(eq(testimonials.mediaId, id)),
    db.select({ title: contracts.title }).from(contracts).where(eq(contracts.fileMediaId, id)),
    db.select({ description: financeEntries.description }).from(financeEntries).where(eq(financeEntries.receiptMediaId, id)),
    db.select({ title: brandAssets.title }).from(brandAssets).where(eq(brandAssets.mediaId, id)),
    db.select().from(siteContent),
  ]);
  for (const row of serviceRows) if (row.cover === id || row.gallery.includes(id)) usage.push(`serviço "${row.title}"`);
  for (const row of portfolioRows) if (row.cover === id || row.gallery.includes(id)) usage.push(`projeto "${row.title}"`);
  for (const row of testimonialRows) usage.push(`depoimento de ${row.author || "cliente"}`);
  for (const row of contractRows) usage.push(`contrato "${row.title}"`);
  for (const row of financeRows) usage.push(`lançamento "${row.description}"`);
  for (const row of brandRows) usage.push(`material da marca "${row.title}"`);
  for (const row of contentRows) if (jsonReferencesMedia(row.value, id)) usage.push(`conteúdo do site (${row.key})`);
  return usage;
}

/** Apaga a linha e os arquivos (principal + versões). Quem chama decide se confere `findMediaUsage` antes. */
export async function deleteMedia(id: number): Promise<boolean> {
  const row = await getMediaById(id);
  if (!row) return false;
  await db.delete(media).where(eq(media.id, id));
  const keys = [row.storageKey, ...(Array.isArray(row.variants) ? row.variants.map((variant) => variant.key) : [])];
  await Promise.allSettled(keys.map((key) => storage.delete(key)));
  return true;
}
