"use server";

/**
 * Server Actions do editor de textos do site. Uma action serve às 12 seções (a chave vem no campo oculto
 * `_section`): requirePermission → monta o objeto a partir do mapa (`build.ts`) → saveSiteContent (zod) →
 * invalidateSite() → logAudit → refresh().
 */
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { flashToast } from "@/components/ui/flash";
import { actionError, actionOk, type ActionState } from "@/lib/action-state";
import { logAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/auth";
import { SITE_CONTENT_LABELS } from "@/lib/site/content";
import { getMediaByIds } from "@/server/media";
import { saveSiteContent } from "@/server/site/content";
import { invalidateSite } from "@/server/site/cache";
import { parseSectionForm } from "./build";
import { isSiteContentKey } from "./config";
import { resetSiteContent } from "./store";

export async function saveSectionAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission("site", "editar");
  const key = formData.get("_section");
  if (typeof key !== "string" || !isSiteContentKey(key)) return actionError("Seção desconhecida. Recarregue a página.");

  const parsed = parseSectionForm(key, formData);
  if (!parsed.ok) {
    return actionError("Confira os campos destacados.", { fieldErrors: parsed.errors, values: parsed.values });
  }

  // imagens: precisam existir e ser públicas (aparecem no site)
  if (parsed.mediaIds.length > 0) {
    const found = await getMediaByIds(parsed.mediaIds);
    const bad = parsed.mediaIds.find((id) => found.get(id)?.visibility !== "public");
    if (bad !== undefined) return actionError("Uma das imagens não está mais disponível. Envie a imagem de novo e salve.");
  }

  try {
    await saveSiteContent(key, parsed.data, user.id);
  } catch {
    return actionError("Não foi possível salvar. Confira os campos e tente de novo.");
  }
  invalidateSite();
  await logAudit({ user, action: "update", entity: "site_content", entityId: key, summary: `Editou o texto do site: ${SITE_CONTENT_LABELS[key]}` });
  refresh();
  return actionOk("Alterações salvas. O site já mostra a versão nova.");
}

/**
 * Apaga o registro da seção (volta aos textos originais). Termina com `redirect()` para a mesma tela com um
 * parâmetro novo: é ele que faz o formulário ser remontado já com os textos originais.
 */
export async function restoreSectionAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission("site", "editar");
  const key = formData.get("_section");
  if (typeof key !== "string" || !isSiteContentKey(key)) return actionError("Seção desconhecida. Recarregue a página.");

  await resetSiteContent(key);
  invalidateSite();
  await logAudit({ user, action: "restore", entity: "site_content", entityId: key, summary: `Restaurou o texto original do site: ${SITE_CONTENT_LABELS[key]}` });
  await flashToast("Texto original restaurado.");
  redirect(`/painel/site/textos/${key}?restaurado=${Date.now()}`);
}
