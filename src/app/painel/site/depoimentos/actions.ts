"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { flashToast } from "@/components/ui/flash";
import { actionError, actionOk, type ActionState } from "@/lib/action-state";
import { logAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/auth";
import { TESTIMONIAL_KINDS } from "@/lib/domain";
import { f, parseForm, parseInput } from "@/server/action";
import { parseSiteForm, videoField } from "@/server/site/admin/form";
import { deleteTestimonial, moveTestimonial, saveTestimonial, setTestimonialPublished } from "@/server/site/admin/testimonials";
import { invalidateSite } from "@/server/site/cache";

const LIST = "/painel/site/depoimentos";

const schema = z
  .object({
    id: f.optionalId(),
    kind: z.enum(TESTIMONIAL_KINDS, { error: "Selecione o tipo." }),
    authorName: f.text(120, "Informe quem deu o depoimento."),
    authorRole: f.optionalText(160),
    content: f.optionalText(2000),
    media: f.optionalId(),
    mediaAlt: f.optionalText(300),
    videoUrl: videoField(),
    authorized: f.checkbox(),
    published: f.checkbox(),
  })
  .superRefine((value, ctx) => {
    // path vazio = erro geral do formulário (mostrado no alerta do topo): usado onde não há campo de texto para marcar
    const need = (path: string, message: string) => ctx.addIssue({ code: "custom", path: path ? [path] : [], message });
    if (value.kind === "texto" && !value.content) need("content", "Escreva o depoimento.");
    if (value.kind === "print") {
      if (value.media === null) need("media", "Envie a imagem do print.");
      if (!value.mediaAlt) need("mediaAlt", "Descreva o que o print mostra (para quem não enxerga a imagem).");
    }
    if (value.kind === "video" && !value.videoUrl) need("videoUrl", "Informe o link do vídeo (YouTube ou Vimeo).");
    if (value.published && !value.authorized) need("", "Para publicar, registre a autorização do cliente (liga “Autorização do cliente registrada”) ou deixe como rascunho.");
  });

export async function saveTestimonialAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission("site", "editar");
  const parsed = parseSiteForm(schema, formData);
  if (!parsed.ok) return parsed.state;
  const { id, media, ...data } = parsed.data;

  // só guarda o que o tipo escolhido usa
  const row = await saveTestimonial(id, {
    ...data,
    mediaId: data.kind === "video" ? null : media,
    mediaAlt: data.kind === "video" ? "" : data.mediaAlt,
    videoUrl: data.kind === "video" ? data.videoUrl : null,
  });
  if (!row) return actionError("Este depoimento não existe mais.");
  await logAudit({ user, action: id === null ? "create" : "update", entity: "testimonial", entityId: row.id, summary: id === null ? "Criou um depoimento" : "Editou um depoimento" });
  invalidateSite();
  if (id === null) {
    await flashToast("Depoimento criado.");
    redirect(LIST);
  }
  refresh();
  return actionOk(row.published ? "Depoimento salvo e publicado." : "Depoimento salvo como rascunho.");
}

export async function toggleTestimonialAction(id: number, published: boolean): Promise<ActionState> {
  const user = await requirePermission("site", "editar");
  const parsed = parseInput(z.object({ id: f.id(), published: z.boolean() }), { id, published });
  if (!parsed.ok) return parsed.state;
  const result = await setTestimonialPublished(parsed.data.id, parsed.data.published);
  if (!result.ok) return actionError(result.error === "not_authorized" ? "Registre a autorização do cliente (na edição do depoimento) antes de publicar." : "Este depoimento não existe mais.");
  await logAudit({ user, action: "status", entity: "testimonial", entityId: result.row.id, summary: result.row.published ? "Publicou um depoimento" : "Voltou um depoimento para rascunho" });
  invalidateSite();
  refresh();
  return actionOk(result.row.published ? "Depoimento publicado no site." : "Depoimento voltou para rascunho.");
}

export async function moveTestimonialAction(id: number, direction: "up" | "down"): Promise<ActionState> {
  const user = await requirePermission("site", "editar");
  const parsed = parseInput(z.object({ id: f.id(), direction: z.enum(["up", "down"]) }), { id, direction });
  if (!parsed.ok) return parsed.state;
  if (await moveTestimonial(parsed.data.id, parsed.data.direction)) {
    await logAudit({ user, action: "update", entity: "testimonial", entityId: parsed.data.id, summary: "Mudou a ordem dos depoimentos" });
    invalidateSite();
  }
  refresh();
  return actionOk();
}

export async function deleteTestimonialAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission("site", "excluir");
  const parsed = parseForm(z.object({ id: f.id("Depoimento inválido.") }), formData);
  if (!parsed.ok) return parsed.state;
  if (await deleteTestimonial(parsed.data.id)) {
    await logAudit({ user, action: "delete", entity: "testimonial", entityId: parsed.data.id, summary: "Excluiu um depoimento" });
    invalidateSite();
  }
  await flashToast("Depoimento excluído.");
  redirect(LIST);
}
