"use server";

/**
 * Server Actions de Editar site › Banners (carrossel da página inicial): guarda → validação (zod) → banco →
 * logAudit → invalidateSite() (a home é estática) → refresh()/redirect().
 */
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { flashToast } from "@/components/ui/flash";
import { actionError, actionOk, type ActionState } from "@/lib/action-state";
import { logAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/auth";
import { BANNER_LAYOUTS, BANNER_TONES, BRAND_COLORS } from "@/lib/domain";
import { safeHref } from "@/lib/format";
import { BANNER_DURATION, pieceAccessibleName } from "@/lib/site/banners";
import { f, parseForm, parseInput } from "@/server/action";
import { droppedMediaIds, getMediaByIds, releaseMedia } from "@/server/media";
import {
  bannerMediaIds,
  createBanner,
  deleteBanner,
  duplicateBanner,
  getBanner,
  moveBanner,
  reorderBanners,
  setBannerEnabled,
  updateBanner,
  type BannerInput,
} from "@/server/site/admin/banners";
import { invalidateSite } from "@/server/site/cache";

const LIST = "/painel/site/banners";
const GONE = "Este banner não existe mais.";

/** `YYYY-MM-DDTHH:mm` (campo datetime-local) ou vazio → null. */
const localDateTime = (message: string) =>
  z
    .string()
    .trim()
    .optional()
    .transform((v) => v || null)
    .refine((v) => v === null || (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v) && !Number.isNaN(Date.parse(v))), message);

const LINK_ERROR = "Endereço inválido. Use um caminho do site (/contato) ou um link completo (https://…).";

const schema = z
  .object({
    id: f.optionalId(),
    name: f.optionalText(120),
    layout: z.enum(BANNER_LAYOUTS, { error: "Escolha o tipo de banner." }),
    title: f.optionalText(120),
    subtitle: f.optionalText(200),
    buttonLabel: f.optionalText(60),
    buttonUrl: f.optionalText(500),
    secondaryLabel: f.optionalText(60),
    secondaryUrl: f.optionalText(500),
    desktopMediaId: f.optionalId(),
    mobileMediaId: f.optionalId(),
    videoMediaId: f.optionalId(),
    alt: f.optionalText(300),
    bgColor: z.enum(BRAND_COLORS, { error: "Escolha a cor de fundo." }),
    tone: z.enum(BANNER_TONES, { error: "Escolha a cor do texto." }),
    durationSeconds: z.coerce
      .number({ error: "Informe o tempo em segundos." })
      .int("Use um número inteiro de segundos.")
      .min(BANNER_DURATION.min, `O mínimo é ${BANNER_DURATION.min} segundos.`)
      .max(BANNER_DURATION.max, `O máximo é ${BANNER_DURATION.max} segundos.`),
    startsAt: localDateTime("Informe um início válido."),
    endsAt: localDateTime("Informe um fim válido."),
    enabled: f.checkbox(),
  })
  .superRefine((value, ctx) => {
    const issue = (path: string, message: string) => ctx.addIssue({ code: "custom", path: [path], message });
    const peca = value.layout === "peca";
    for (const [label, url] of [
      ["buttonLabel", "buttonUrl"],
      ["secondaryLabel", "secondaryUrl"],
    ] as const) {
      if (value[url] && !safeHref(value[url])) issue(url, LINK_ERROR);
      // em peça pronta o botão principal é o link do banner inteiro: o rótulo é opcional
      if (value[url] && !value[label] && !(peca && url === "buttonUrl")) issue(label, "Dê um nome ao botão ou apague o endereço.");
      if (value[label] && !value[url]) issue(url, "Informe para onde o botão leva ou apague o nome.");
    }
    if (value.startsAt && value.endsAt && value.endsAt <= value.startsAt) issue("endsAt", "O fim precisa ser depois do início.");

    // Rascunho (desligado) pode ficar incompleto; para LIGAR, o banner precisa do mínimo para aparecer no site.
    if (!value.enabled) return;
    const hasImage = Boolean(value.desktopMediaId || value.mobileMediaId);
    if (value.layout === "tipografico" && !value.title) issue("title", "Para ligar um banner só de texto, escreva o título.");
    if (value.layout === "midia" && !hasImage && !value.videoMediaId) issue("desktopMediaId", "Para ligar este banner, envie uma imagem ou um vídeo.");
    if (peca && !hasImage) issue("desktopMediaId", "Para ligar uma peça pronta, envie a arte.");
    if (peca && hasImage && !pieceAccessibleName(value)) {
      issue("alt", "Para ligar uma peça pronta, descreva a arte (o que está escrito nela): é o que leitores de tela e buscadores recebem.");
    }
  });

/** As mídias informadas existem, são públicas e do tipo certo (imagem nos campos de imagem, vídeo no de vídeo)? */
async function mediaErrors(data: Pick<BannerInput, "desktopMediaId" | "mobileMediaId" | "videoMediaId">): Promise<Record<string, string> | null> {
  const rows = await getMediaByIds([data.desktopMediaId, data.mobileMediaId, data.videoMediaId]);
  const errors: Record<string, string> = {};
  for (const field of ["desktopMediaId", "mobileMediaId"] as const) {
    const row = data[field] ? rows.get(data[field]) : undefined;
    if (data[field] && !(row && row.visibility === "public" && row.mime.startsWith("image/"))) errors[field] = "Envie a imagem de novo (o arquivo não foi encontrado).";
  }
  const video = data.videoMediaId ? rows.get(data.videoMediaId) : undefined;
  if (data.videoMediaId && !(video && video.visibility === "public" && video.mime.startsWith("video/"))) errors.videoMediaId = "Envie o vídeo de novo (o arquivo não foi encontrado).";
  return Object.keys(errors).length > 0 ? errors : null;
}

export async function saveBannerAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission("site", "editar");
  const parsed = parseForm(schema, formData);
  if (!parsed.ok) return parsed.state;
  const { id, ...data } = parsed.data;
  const input: BannerInput = {
    ...data,
    name: data.name || data.title || "Banner sem nome",
    buttonUrl: safeHref(data.buttonUrl),
    secondaryUrl: safeHref(data.secondaryUrl),
  };
  const invalidMedia = await mediaErrors(input);
  if (invalidMedia) return actionError("Confira os arquivos enviados.", { fieldErrors: invalidMedia });

  if (id === null) {
    const row = await createBanner(input);
    await logAudit({ user, action: "create", entity: "banner", entityId: row.id, summary: `Criou o banner “${row.name}”` });
    invalidateSite();
    await flashToast(row.enabled ? "Banner criado e ligado." : "Banner criado (desligado).");
    redirect(`${LIST}/${row.id}`);
  }
  const result = await updateBanner(id, input);
  if (!result) return actionError(GONE);
  // imagem/vídeo trocado ou removido: apaga o arquivo antigo se nenhum outro banner (ou conteúdo) o usa
  await releaseMedia(droppedMediaIds(bannerMediaIds(result.previous), bannerMediaIds(result.row)));
  await logAudit({ user, action: "update", entity: "banner", entityId: id, summary: `Editou o banner “${result.row.name}”` });
  invalidateSite();
  refresh();
  return actionOk("Banner salvo.");
}

export async function toggleBannerAction(id: number, enabled: boolean): Promise<ActionState> {
  const user = await requirePermission("site", "editar");
  const parsed = parseInput(z.object({ id: f.id(), enabled: z.boolean() }), { id, enabled });
  if (!parsed.ok) return parsed.state;
  const current = await getBanner(parsed.data.id);
  if (!current) return actionError(GONE);
  if (parsed.data.enabled) {
    // as mesmas condições do formulário: nada de banner vazio (ou peça sem descrição) no ar
    const hasImage = Boolean(current.desktopMediaId || current.mobileMediaId);
    const missing =
      current.layout === "tipografico" && !current.title.trim()
        ? "escreva o título"
        : current.layout === "midia" && !hasImage && !current.videoMediaId
          ? "envie uma imagem ou um vídeo"
          : current.layout === "peca" && !hasImage
            ? "envie a arte"
            : current.layout === "peca" && !pieceAccessibleName(current)
              ? "descreva a arte no texto alternativo"
              : null;
    if (missing) {
      refresh();
      return actionError(`Para ligar este banner, ${missing}. Abra “Editar” para completar.`);
    }
  }
  const row = await setBannerEnabled(parsed.data.id, parsed.data.enabled);
  if (!row) return actionError(GONE);
  await logAudit({ user, action: "update", entity: "banner", entityId: row.id, summary: `${row.enabled ? "Ligou" : "Desligou"} o banner “${row.name}”` });
  invalidateSite();
  refresh();
  return actionOk(row.enabled ? "Banner ligado." : "Banner desligado.");
}

export async function moveBannerAction(id: number, direction: "up" | "down"): Promise<ActionState> {
  const user = await requirePermission("site", "editar");
  const parsed = parseInput(z.object({ id: f.id(), direction: z.enum(["up", "down"]) }), { id, direction });
  if (!parsed.ok) return parsed.state;
  if (await moveBanner(parsed.data.id, parsed.data.direction)) {
    await logAudit({ user, action: "update", entity: "banner", entityId: parsed.data.id, summary: "Mudou a ordem dos banners" });
    invalidateSite();
  }
  refresh();
  return actionOk();
}

/** Arrastar e soltar: recebe os ids na nova ordem. */
export async function reorderBannersAction(order: number[]): Promise<ActionState> {
  const user = await requirePermission("site", "editar");
  const parsed = parseInput(z.object({ order: z.array(f.id()).min(1).max(500) }), { order });
  if (!parsed.ok) return actionError("Não foi possível salvar a nova ordem. Recarregue a página e tente de novo.");
  if (await reorderBanners(parsed.data.order)) {
    await logAudit({ user, action: "update", entity: "banner", summary: "Reorganizou os banners da página inicial" });
    invalidateSite();
  }
  refresh();
  return actionOk("Ordem salva. O carrossel já está assim.");
}

export async function duplicateBannerAction(id: number): Promise<ActionState> {
  const user = await requirePermission("site", "editar");
  const parsed = parseInput(z.object({ id: f.id() }), { id });
  if (!parsed.ok) return parsed.state;
  const copy = await duplicateBanner(parsed.data.id);
  if (!copy) return actionError(GONE);
  await logAudit({ user, action: "create", entity: "banner", entityId: copy.id, summary: `Duplicou um banner: “${copy.name}”` });
  // a cópia nasce desligada: o site não muda
  await flashToast("Banner duplicado. A cópia está desligada: ajuste e ligue quando quiser.");
  redirect(`${LIST}/${copy.id}`);
}

/** Apaga o banner e libera as mídias que só ele usava. */
async function removeBanner(user: Awaited<ReturnType<typeof requirePermission>>, id: number): Promise<void> {
  const row = await deleteBanner(id);
  if (!row) return;
  await releaseMedia(bannerMediaIds(row));
  await logAudit({ user, action: "delete", entity: "banner", entityId: row.id, summary: `Excluiu o banner “${row.name}”` });
  invalidateSite();
}

/** Excluir pela tela de edição: volta para a lista. */
export async function deleteBannerAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission("site", "excluir");
  const parsed = parseForm(z.object({ id: f.id("Banner inválido.") }), formData);
  if (!parsed.ok) return parsed.state;
  await removeBanner(user, parsed.data.id);
  await flashToast("Banner excluído.");
  redirect(LIST);
}

/** Excluir pela lista: fica na lista (o diálogo fecha e a lista se atualiza). */
export async function deleteBannerFromListAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission("site", "excluir");
  const parsed = parseForm(z.object({ id: f.id("Banner inválido.") }), formData);
  if (!parsed.ok) return parsed.state;
  await removeBanner(user, parsed.data.id);
  refresh();
  return actionOk("Banner excluído.");
}
