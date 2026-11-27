/**
 * Rodapé interativo (briefing v2, seção 11) — o que fica fora dos textos: se a experiência está no ar e quais
 * fotos (câmera) e trechos de vídeo (celular) os sócios cadastraram. Os textos ficam em `content.footerExperience`
 * (Editar site › Textos); isto aqui é editado em Editar site › Rodapé.
 *
 * Guardado como JSON na tabela `site_content`, na chave `FOOTER_EXPERIENCE_KEY` (fora de `SITE_CONTENT_KEYS`, como a
 * ordem da página inicial). As propriedades se chamam `mediaId` de propósito: `findMediaUsage` (src/server/media)
 * enxerga os arquivos e nunca os trata como "sem uso".
 *
 * Arquivo PURO (sem banco): usado pelo painel (cliente e servidor), pelas consultas do site e pelos testes.
 */
import "@/lib/zod-setup";
import { z } from "zod";

export const FOOTER_EXPERIENCE_KEY = "footerExperienceSettings";

/** Máximos: o suficiente para variar a foto a cada clique sem pesar a página (as fotos só carregam no clique). */
export const FOOTER_PHOTOS_MAX = 12;
export const FOOTER_CLIPS_MAX = 4;
export const FOOTER_CLIP_CAPTION_MAX = 80;

const mediaRef = z.object({ mediaId: z.number().int().positive() });

export const footerExperienceSettingsSchema = z.object({
  /** Liga a experiência no site. Desligada, o espaço volta a ser só o contador de visitas (se ele estiver ligado). */
  enabled: z.boolean(),
  /** Fotos reveladas pela câmera, na ordem (uma por clique, em rodízio). O texto alternativo fica no arquivo. */
  photos: z.array(mediaRef).max(FOOTER_PHOTOS_MAX),
  /** Trechos curtos (MP4/WebM, sem som) que passam na tela do celular durante o REC, na ordem. */
  clips: z.array(mediaRef.extend({ caption: z.string().trim().max(FOOTER_CLIP_CAPTION_MAX) })).max(FOOTER_CLIPS_MAX),
});

export type FooterExperienceSettings = z.infer<typeof footerExperienceSettingsSchema>;

/**
 * Padrão: LIGADA e sem mídia. É conteúdo do briefing e não inventa nada — sem fotos/trechos, a câmera e o celular
 * mostram a composição gráfica da marca.
 */
export const defaultFooterExperienceSettings: FooterExperienceSettings = { enabled: true, photos: [], clips: [] };

/** Valor salvo (talvez antigo ou corrompido) → configurações válidas. Ids repetidos saem; o que sobra do limite, também. */
export function resolveFooterExperienceSettings(stored: unknown): FooterExperienceSettings {
  if (stored === undefined || stored === null) return defaultFooterExperienceSettings;
  const parsed = footerExperienceSettingsSchema.safeParse(stored);
  if (!parsed.success) return defaultFooterExperienceSettings;
  const unique = <T extends { mediaId: number }>(items: T[]) => items.filter((item, index) => items.findIndex((other) => other.mediaId === item.mediaId) === index);
  return { enabled: parsed.data.enabled, photos: unique(parsed.data.photos), clips: unique(parsed.data.clips) };
}

/** Todos os ids de mídia citados (fotos e trechos). */
export function footerExperienceMediaIds(settings: FooterExperienceSettings): number[] {
  return [...new Set([...settings.photos.map((photo) => photo.mediaId), ...settings.clips.map((clip) => clip.mediaId)])];
}

/** O que o site recebe: só o que pode aparecer para qualquer visitante. */
export type PublicFooterPhoto = { id: number; url: string; srcSet: string | undefined; width: number; height: number; alt: string };
export type PublicFooterClip = { id: number; url: string; mime: string; caption: string };
export type PublicFooterExperience = { photos: PublicFooterPhoto[]; clips: PublicFooterClip[] };
