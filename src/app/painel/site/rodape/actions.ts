"use server";

/**
 * Server Action de Editar site › Rodapé (rodapé interativo: câmera e celular simulados): guarda → validação (zod)
 * → confere as mídias → banco → libera os arquivos que saíram → logAudit → invalidateSite() → refresh().
 */
import { refresh } from "next/cache";
import { z } from "zod";
import { actionError, actionOk, type ActionState } from "@/lib/action-state";
import { logAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/auth";
import { FOOTER_CLIP_CAPTION_MAX, FOOTER_CLIPS_MAX, FOOTER_PHOTOS_MAX, footerExperienceMediaIds, type FooterExperienceSettings } from "@/lib/site/footer-experience";
import { f, formToObject, jsonField, parseInput } from "@/server/action";
import { droppedMediaIds, getMediaByIds, releaseMedia } from "@/server/media";
import { invalidateSite } from "@/server/site/cache";
import { saveFooterExperience } from "@/server/site/footer-experience";

/** Índices dos campos de trecho do formulário (`clip0`, `clipCaption0`…). */
const CLIP_SLOTS = Array.from({ length: FOOTER_CLIPS_MAX }, (_, index) => index);

const schema = z.object({
  enabled: f.checkbox(),
  photos: z
    .array(z.number().int().positive(), { error: "Envie as fotos de novo." })
    .max(FOOTER_PHOTOS_MAX, `No máximo ${FOOTER_PHOTOS_MAX} fotos.`),
  ...Object.fromEntries(CLIP_SLOTS.flatMap((index) => [[`clip${index}`, f.optionalId()], [`clipCaption${index}`, f.optionalText(FOOTER_CLIP_CAPTION_MAX)]])),
});

type Parsed = { enabled: boolean; photos: number[] } & Record<string, number | null | string | boolean | number[]>;

export async function saveFooterExperienceAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission("site", "editar");
  const object = formToObject(formData);
  const values: Record<string, string> = {};
  for (const [key, value] of Object.entries(object)) if (typeof value === "string") values[key] = value;
  const parsed = parseInput(schema, { ...object, photos: jsonField(formData, "photos") ?? [] }, values);
  if (!parsed.ok) return parsed.state;
  const data = parsed.data as Parsed;

  const clips = CLIP_SLOTS.flatMap((index) => {
    const mediaId = data[`clip${index}`];
    return typeof mediaId === "number" ? [{ mediaId, caption: String(data[`clipCaption${index}`] ?? "") }] : [];
  });
  const errors: Record<string, string> = {};
  CLIP_SLOTS.forEach((index) => {
    if (data[`clip${index}`] === null && String(data[`clipCaption${index}`] ?? "") !== "") errors[`clip${index}`] = "Envie o vídeo deste trecho ou apague a legenda.";
  });
  const clipIds = clips.map((clip) => clip.mediaId);
  if (new Set(clipIds).size !== clipIds.length) errors.clip0 = "O mesmo vídeo foi escolhido em dois trechos.";

  // As mídias existem, são públicas e do tipo certo? Toda foto precisa de texto alternativo (ela aparece no site).
  const rows = await getMediaByIds([...data.photos, ...clipIds]);
  const photoRows = data.photos.map((id) => rows.get(id));
  if (photoRows.some((row) => !row || row.visibility !== "public" || !row.mime.startsWith("image/"))) {
    errors.photos = "Uma das fotos não está mais disponível. Remova e envie de novo.";
  } else if (photoRows.some((row) => !row?.alt.trim())) {
    errors.photos = "Descreva cada foto no campo de texto alternativo (é o que leitores de tela leem quando a foto é revelada).";
  }
  CLIP_SLOTS.forEach((index) => {
    const id = data[`clip${index}`];
    const row = typeof id === "number" ? rows.get(id) : undefined;
    if (typeof id === "number" && !(row && row.visibility === "public" && row.mime.startsWith("video/"))) errors[`clip${index}`] = "Envie o vídeo de novo (o arquivo não foi encontrado).";
  });
  if (Object.keys(errors).length > 0) return actionError("Confira os campos destacados.", { fieldErrors: errors, values });

  const settings: FooterExperienceSettings = { enabled: data.enabled, photos: data.photos.map((mediaId) => ({ mediaId })), clips };
  const { previous, saved } = await saveFooterExperience(settings, user.id);
  // foto ou trecho removido: o arquivo é apagado se nada mais o usa
  await releaseMedia(droppedMediaIds(footerExperienceMediaIds(previous), footerExperienceMediaIds(saved)));
  invalidateSite();
  const summary =
    previous.enabled !== saved.enabled
      ? `${saved.enabled ? "Ligou" : "Desligou"} o rodapé interativo do site`
      : `Editou o rodapé interativo do site (${saved.photos.length} ${saved.photos.length === 1 ? "foto" : "fotos"}, ${saved.clips.length} ${saved.clips.length === 1 ? "trecho" : "trechos"})`;
  await logAudit({ user, action: "update", entity: "site_content", entityId: "footerExperience", summary });
  refresh();
  return actionOk(saved.enabled ? "Rodapé salvo. O site já mostra a versão nova." : "Rodapé salvo e desligado: o site não mostra mais a câmera e o celular.");
}
