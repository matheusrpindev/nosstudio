"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { flashToast } from "@/components/ui/flash";
import { actionError, actionOk, type ActionState } from "@/lib/action-state";
import { logAudit } from "@/lib/audit";
import { requireUser } from "@/lib/auth";
import { PORTFOLIO_CATEGORIES } from "@/lib/domain";
import { f, parseForm, parseInput } from "@/server/action";
import { fieldError, idListField, parseSiteForm, slugField, textListField, videoField } from "@/server/site/admin/form";
import { deletePortfolioProject, savePortfolioProject, setPortfolioPublished } from "@/server/site/admin/portfolio";
import { invalidateSite } from "@/server/site/cache";

const LIST = "/painel/site/portfolio";

const schema = z.object({
  id: f.optionalId(),
  title: f.text(140, "Informe o título do projeto."),
  slug: slugField(),
  category: z.enum(PORTFOLIO_CATEGORIES, { error: "Selecione a categoria." }),
  clientName: f.optionalText(120),
  showClient: f.checkbox(),
  summary: f.optionalText(300),
  description: f.optionalText(8000),
  servicesDone: textListField(20, 120),
  cover: f.optionalId(),
  gallery: idListField(40),
  videoUrl: videoField(),
  projectDate: f.optionalDate(),
  featured: f.checkbox(),
  published: f.checkbox(),
});

export async function savePortfolioAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = parseSiteForm(schema, formData, ["servicesDone", "gallery"]);
  if (!parsed.ok) return parsed.state;
  const { id, cover, ...data } = parsed.data;

  const result = await savePortfolioProject(id, { ...data, coverMediaId: cover, showClient: data.showClient && Boolean(data.clientName) });
  if (!result.ok) {
    if (result.error === "slug_taken") return fieldError("slug", "Já existe um projeto com este endereço. Escolha outro ou deixe em branco.", parsed.values);
    return actionError("Este projeto não existe mais.");
  }
  await logAudit({ user, action: id === null ? "create" : "update", entity: "portfolio", entityId: result.row.id, summary: id === null ? "Criou um projeto do portfólio" : "Editou um projeto do portfólio" });
  invalidateSite();
  if (id === null) {
    await flashToast("Projeto criado.");
    redirect(LIST);
  }
  refresh();
  return actionOk(result.row.published ? "Projeto salvo e publicado." : "Projeto salvo como rascunho.");
}

export async function togglePortfolioAction(id: number, published: boolean): Promise<ActionState> {
  const user = await requireUser();
  const parsed = parseInput(z.object({ id: f.id(), published: z.boolean() }), { id, published });
  if (!parsed.ok) return parsed.state;
  const row = await setPortfolioPublished(parsed.data.id, parsed.data.published);
  if (!row) return actionError("Este projeto não existe mais.");
  await logAudit({ user, action: "status", entity: "portfolio", entityId: row.id, summary: row.published ? "Publicou um projeto do portfólio" : "Voltou um projeto do portfólio para rascunho" });
  invalidateSite();
  refresh();
  return actionOk(row.published ? "Projeto publicado no site." : "Projeto voltou para rascunho.");
}

export async function deletePortfolioAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
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
