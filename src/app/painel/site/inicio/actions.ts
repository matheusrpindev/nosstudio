"use server";

/**
 * Server Actions da tela "Página inicial" (ordem e visibilidade das seções da home): requirePermission → lê a
 * ordem atual do banco → aplica a mudança (funções puras de src/lib/site/home-layout.ts) → grava → invalidateSite()
 * → logAudit → refresh().
 */
import { refresh } from "next/cache";
import { z } from "zod";
import { actionError, actionOk, type ActionState } from "@/lib/action-state";
import { logAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/auth";
import {
  HOME_SECTION_IDS,
  HOME_SECTION_INFO,
  moveHomeSection,
  reorderHomeSections,
  setHomeSectionVisible,
  type HomeSectionId,
} from "@/lib/site/home-layout";
import { parseInput } from "@/server/action";
import { invalidateSite } from "@/server/site/cache";
import { getHomeLayoutForEdit, resetHomeLayout, saveHomeLayout } from "@/server/site/home-layout";

const sectionId = z.enum(HOME_SECTION_IDS, { error: "Seção desconhecida. Recarregue a página." });

export async function moveHomeSectionAction(id: HomeSectionId, direction: "up" | "down"): Promise<ActionState> {
  const user = await requirePermission("site", "editar");
  const parsed = parseInput(z.object({ id: sectionId, direction: z.enum(["up", "down"]) }), { id, direction });
  if (!parsed.ok) return parsed.state;
  const { layout } = await getHomeLayoutForEdit();
  const next = moveHomeSection(layout, parsed.data.id, parsed.data.direction);
  if (next !== layout) {
    await saveHomeLayout(next, user.id);
    invalidateSite();
    await logAudit({ user, action: "update", entity: "site_content", entityId: "homeLayout", summary: `Mudou a ordem da página inicial: ${HOME_SECTION_INFO[parsed.data.id].label}` });
  }
  refresh();
  return actionOk();
}

/** Arrastar e soltar: recebe a lista de ids na nova ordem. */
export async function reorderHomeSectionsAction(order: string[]): Promise<ActionState> {
  const user = await requirePermission("site", "editar");
  const parsed = parseInput(z.object({ order: z.array(sectionId).max(HOME_SECTION_IDS.length) }), { order });
  if (!parsed.ok) return actionError("Não foi possível salvar a nova ordem. Recarregue a página e tente de novo.");
  const { layout } = await getHomeLayoutForEdit();
  await saveHomeLayout(reorderHomeSections(layout, parsed.data.order), user.id);
  invalidateSite();
  await logAudit({ user, action: "update", entity: "site_content", entityId: "homeLayout", summary: "Reorganizou as seções da página inicial" });
  refresh();
  return actionOk("Ordem salva. A página inicial já está assim.");
}

export async function toggleHomeSectionAction(id: HomeSectionId, visible: boolean): Promise<ActionState> {
  const user = await requirePermission("site", "editar");
  const parsed = parseInput(z.object({ id: sectionId, visible: z.boolean() }), { id, visible });
  if (!parsed.ok) return parsed.state;
  const { layout } = await getHomeLayoutForEdit();
  await saveHomeLayout(setHomeSectionVisible(layout, parsed.data.id, parsed.data.visible), user.id);
  invalidateSite();
  const label = HOME_SECTION_INFO[parsed.data.id].label;
  await logAudit({
    user,
    action: "update",
    entity: "site_content",
    entityId: "homeLayout",
    summary: parsed.data.visible ? `Mostrou a seção “${label}” na página inicial` : `Ocultou a seção “${label}” da página inicial`,
  });
  refresh();
  return actionOk(parsed.data.visible ? `“${label}” voltou para a página inicial.` : `“${label}” saiu da página inicial.`);
}

/** Volta à ordem do briefing, com todas as seções ligadas. */
export async function resetHomeLayoutAction(_prev: ActionState, _formData: FormData): Promise<ActionState> {
  const user = await requirePermission("site", "editar");
  await resetHomeLayout();
  invalidateSite();
  await logAudit({ user, action: "restore", entity: "site_content", entityId: "homeLayout", summary: "Restaurou a ordem original da página inicial" });
  refresh();
  return actionOk("Ordem original restaurada.");
}
