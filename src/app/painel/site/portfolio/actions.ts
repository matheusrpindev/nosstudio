"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { flashToast } from "@/components/ui/flash";
import { actionError, actionOk, type ActionState } from "@/lib/action-state";
import { logAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/auth";
import { f, parseForm, parseInput } from "@/server/action";
import { fieldError, parseSiteForm } from "@/server/site/admin/form";
import {
  deletePortfolioProject,
  findPublishBlockers,
  movePortfolio,
  reorderPortfolio,
  savePortfolioProject,
  setPortfolioFeatured,
  setPortfolioPublished,
} from "@/server/site/admin/portfolio";
import { invalidateSite } from "@/server/site/cache";
import { PORTFOLIO_JSON_FIELDS, portfolioSchema, toPortfolioInput } from "./schema";

const LIST = "/painel/site/portfolio";

export async function savePortfolioAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission("site", "editar");
  const parsed = parseSiteForm(portfolioSchema, formData, PORTFOLIO_JSON_FIELDS);
  if (!parsed.ok) return parsed.state;
  const id = parsed.data.id;
  const input = toPortfolioInput(parsed.data);

  // Publicar exige capa e texto alternativo em todas as imagens: sem isso nada é gravado (nem como rascunho),
  // para a pessoa não achar que publicou.
  if (input.published) {
    const blockers = await findPublishBlockers({ coverMediaId: input.coverMediaId, gallery: input.gallery, backstage: input.backstage ?? [], beforeAfter: input.beforeAfter ?? [] });
    if (Object.keys(blockers).length > 0) {
      return actionError("Ainda não dá para publicar: confira os campos destacados. Para guardar o que já fez, desligue “Publicado no site” e salve como rascunho.", {
        fieldErrors: blockers,
        values: parsed.values,
      });
    }
  }

  const result = await savePortfolioProject(id, input);
  if (!result.ok) {
    if (result.error === "slug_taken") return fieldError("slug", "Já existe um projeto com este endereço. Escolha outro ou deixe em branco.", parsed.values);
    return actionError("Este projeto não existe mais.");
  }
  await logAudit({ user, action: id === null ? "create" : "update", entity: "portfolio", entityId: result.row.id, summary: id === null ? "Criou um projeto do portfólio" : "Editou um projeto do portfólio" });
  invalidateSite();
  if (id === null) {
    await flashToast(result.row.published ? "Projeto criado e publicado." : "Projeto criado como rascunho.");
    redirect(LIST);
  }
  refresh();
  return actionOk(result.row.published ? "Projeto salvo e publicado." : "Projeto salvo como rascunho.");
}

export async function togglePortfolioAction(id: number, published: boolean): Promise<ActionState> {
  const user = await requirePermission("site", "editar");
  const parsed = parseInput(z.object({ id: f.id(), published: z.boolean() }), { id, published });
  if (!parsed.ok) return parsed.state;
  const result = await setPortfolioPublished(parsed.data.id, parsed.data.published);
  if (!result.ok) {
    if (result.error === "blocked") return actionError(`${Object.values(result.blockers)[0]} Abra o projeto para completar.`);
    return actionError("Este projeto não existe mais.");
  }
  const { row } = result;
  await logAudit({ user, action: "status", entity: "portfolio", entityId: row.id, summary: row.published ? "Publicou um projeto do portfólio" : "Voltou um projeto do portfólio para rascunho" });
  invalidateSite();
  refresh();
  return actionOk(row.published ? "Projeto publicado no site." : "Projeto voltou para rascunho.");
}

export async function featurePortfolioAction(id: number, featured: boolean): Promise<ActionState> {
  const user = await requirePermission("site", "editar");
  const parsed = parseInput(z.object({ id: f.id(), featured: z.boolean() }), { id, featured });
  if (!parsed.ok) return parsed.state;
  const row = await setPortfolioFeatured(parsed.data.id, parsed.data.featured);
  if (!row) return actionError("Este projeto não existe mais.");
  await logAudit({ user, action: "update", entity: "portfolio", entityId: row.id, summary: row.featured ? "Marcou um projeto do portfólio como destaque" : "Tirou o destaque de um projeto do portfólio" });
  invalidateSite();
  refresh();
  return actionOk(row.featured ? "Projeto em destaque: aparece maior no portfólio e entra na página inicial." : "Destaque removido.");
}

export async function movePortfolioAction(id: number, direction: "up" | "down"): Promise<ActionState> {
  const user = await requirePermission("site", "editar");
  const parsed = parseInput(z.object({ id: f.id(), direction: z.enum(["up", "down"]) }), { id, direction });
  if (!parsed.ok) return parsed.state;
  if (await movePortfolio(parsed.data.id, parsed.data.direction)) {
    await logAudit({ user, action: "update", entity: "portfolio", entityId: parsed.data.id, summary: "Mudou a ordem do portfólio" });
    invalidateSite();
  }
  refresh();
  return actionOk();
}

/** Ordem arrastada na lista: os ids dos projetos, na ordem nova. */
export async function reorderPortfolioAction(order: number[]): Promise<ActionState> {
  const user = await requirePermission("site", "editar");
  const parsed = parseInput(z.object({ order: z.array(z.number().int().positive()).max(2000) }), { order });
  if (!parsed.ok) return parsed.state;
  if (await reorderPortfolio(parsed.data.order)) {
    await logAudit({ user, action: "update", entity: "portfolio", summary: "Mudou a ordem do portfólio" });
    invalidateSite();
  }
  refresh();
  return actionOk();
}

export async function deletePortfolioAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission("site", "excluir");
  const parsed = parseForm(z.object({ id: f.id("Projeto inválido.") }), formData);
  if (!parsed.ok) return parsed.state;
  const row = await deletePortfolioProject(parsed.data.id);
  if (row) {
    await logAudit({ user, action: "delete", entity: "portfolio", entityId: row.id, summary: "Excluiu um projeto do portfólio" });
    invalidateSite();
  }
  await flashToast("Projeto excluído.");
  redirect(LIST);
}
