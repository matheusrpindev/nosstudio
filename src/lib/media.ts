/**
 * Mídia (imagens e arquivos enviados pelo painel) — tipos e helpers puros, usáveis no servidor e no cliente.
 * Upload/armazenamento: src/server/media. Entrega: rota /media/[...key].
 */
import type { Media, MediaVariant } from "@/db/schema";

/** URL pública de um arquivo do storage. Arquivos privados exigem sessão (checado na rota). */
export function mediaUrl(storageKey: string): string {
  return `/media/${storageKey}`;
}

/** Forma "achatada" de uma imagem, pronta para renderizar (`<SiteImage>`). */
export type PublicImage = {
  id: number;
  url: string;
  width: number;
  height: number;
  alt: string;
  /** Versões menores para `srcset`, da menor para a maior. */
  sources: { width: number; url: string }[];
  placeholderColor: string | null;
};

export function toPublicImage(row: Media | null | undefined): PublicImage | null {
  if (!row || row.visibility !== "public" || !row.mime.startsWith("image/") || !row.width || !row.height) return null;
  const variants: MediaVariant[] = Array.isArray(row.variants) ? row.variants : [];
  return {
    id: row.id,
    url: mediaUrl(row.storageKey),
    width: row.width,
    height: row.height,
    alt: row.alt,
    sources: variants
      .map((v) => ({ width: v.width, url: mediaUrl(v.key) }))
      .sort((a, b) => a.width - b.width),
    placeholderColor: row.placeholderColor,
  };
}

/** Atributo `srcset` a partir das versões geradas no upload. */
export function imageSrcSet(image: PublicImage): string | undefined {
  if (image.sources.length === 0) return undefined;
  return image.sources.map((s) => `${s.url} ${s.width}w`).join(", ");
}
