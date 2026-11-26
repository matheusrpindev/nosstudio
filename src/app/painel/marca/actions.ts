"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { flashToast } from "@/components/ui/flash";
import { actionError, actionOk, type ActionState } from "@/lib/action-state";
import { logAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/auth";
import { BRAND_ASSET_CATEGORIES } from "@/lib/domain";
import { safeUrl } from "@/lib/format";
import { f, parseForm } from "@/server/action";
import { createBrandAsset, deleteBrandAsset, isPrivateMedia, moveBrandAsset, updateBrandAsset } from "@/server/brand/admin";

const idSchema = z.object({ id: f.id("Item inválido.") });

/** Link externo (https) ou um dos SVGs públicos do logo que já vêm com o site (`/brand/nome.svg`). */
const STATIC_BRAND_PATH = /^\/brand\/[a-z0-9-]+\.svg$/;

const assetSchema = z
  .object({
    category: z.enum(BRAND_ASSET_CATEGORIES, { error: "Selecione a categoria." }),
    title: f.text(120, "Informe o título."),
    description: f.optionalText(500),
    url: f.optionalText(500),
    mediaId: f.optionalId(),
  })
  .superRefine((data, ctx) => {
    if (data.url && !STATIC_BRAND_PATH.test(data.url) && !safeUrl(data.url)) {
      ctx.addIssue({ code: "custom", path: ["url"], message: "Informe um link válido (começando com https://)." });
    }
  })
  .transform((data) => ({ ...data, url: STATIC_BRAND_PATH.test(data.url) ? data.url : safeUrl(data.url) }));

async function checkMedia(mediaId: number | null, formData: FormData): Promise<ActionState | null> {
  if (!mediaId || (await isPrivateMedia(mediaId))) return null;
  const values: Record<string, string> = {};
  for (const [key, value] of formData.entries()) if (typeof value === "string") values[key] = value;
  return actionError("Confira os campos destacados.", { fieldErrors: { mediaId: "Arquivo inválido. Envie de novo." }, values });
}

export async function createBrandAssetAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission("marca", "editar");
  const parsed = parseForm(assetSchema, formData);
  if (!parsed.ok) return parsed.state;
  const invalid = await checkMedia(parsed.data.mediaId, formData);
  if (invalid) return invalid;
  const asset = await createBrandAsset(parsed.data);
  await logAudit({ user, action: "create", entity: "brand_asset", entityId: asset.id, summary: "Adicionou um item à biblioteca da marca" });
  await flashToast("Item adicionado.");
  redirect("/painel/marca");
}

export async function updateBrandAssetAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission("marca", "editar");
  const id = parseForm(idSchema, formData);
  if (!id.ok) return id.state;
  const parsed = parseForm(assetSchema, formData);
  if (!parsed.ok) return parsed.state;
  const invalid = await checkMedia(parsed.data.mediaId, formData);
  if (invalid) return invalid;
  const asset = await updateBrandAsset(id.data.id, parsed.data);
  if (!asset) return actionError("Este item não existe mais.");
  await logAudit({ user, action: "update", entity: "brand_asset", entityId: asset.id, summary: "Editou um item da biblioteca da marca" });
  await flashToast("Item atualizado.");
  redirect("/painel/marca");
}

export async function deleteBrandAssetAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission("marca", "excluir");
  const parsed = parseForm(idSchema, formData);
  if (!parsed.ok) return parsed.state;
  const deleted = await deleteBrandAsset(parsed.data.id);
  if (deleted) await logAudit({ user, action: "delete", entity: "brand_asset", entityId: deleted.id, summary: "Excluiu um item da biblioteca da marca" });
  await flashToast("Item excluído.");
  redirect("/painel/marca");
}

const moveSchema = z.object({ id: f.id("Item inválido."), direction: z.enum(["up", "down"]) });

export async function moveBrandAssetAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission("marca", "editar");
  const parsed = parseForm(moveSchema, formData);
  if (!parsed.ok) return parsed.state;
  if (await moveBrandAsset(parsed.data.id, parsed.data.direction)) {
    await logAudit({ user, action: "update", entity: "brand_asset", entityId: parsed.data.id, summary: "Reordenou a biblioteca da marca" });
  }
  refresh();
  return actionOk();
}
