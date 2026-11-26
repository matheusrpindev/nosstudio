"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { flashToast } from "@/components/ui/flash";
import { actionError, actionOk, type ActionState } from "@/lib/action-state";
import { logAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/auth";
import { f, parseForm, parseInput } from "@/server/action";
import { deleteFaq, moveFaq, saveFaq, setFaqPublished } from "@/server/site/admin/faqs";
import { parseSiteForm } from "@/server/site/admin/form";
import { invalidateSite } from "@/server/site/cache";

const LIST = "/painel/site/faq";

const schema = z
  .object({
    id: f.optionalId(),
    question: f.text(240, "Escreva a pergunta."),
    answer: f.optionalText(6000),
    published: f.checkbox(),
    showOnHome: f.checkbox(),
    showOnWeddings: f.checkbox(),
  })
  .superRefine((value, ctx) => {
    if (value.published && !value.answer) ctx.addIssue({ code: "custom", path: ["answer"], message: "Escreva a resposta antes de publicar, ou deixe como rascunho." });
  });

export async function saveFaqAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission("site", "editar");
  const parsed = parseSiteForm(schema, formData);
  if (!parsed.ok) return parsed.state;
  const { id, ...data } = parsed.data;

  const row = await saveFaq(id, data);
  if (!row) return actionError("Esta pergunta não existe mais.");
  await logAudit({ user, action: id === null ? "create" : "update", entity: "faq", entityId: row.id, summary: id === null ? "Criou uma pergunta do FAQ" : "Editou uma pergunta do FAQ" });
  invalidateSite();
  if (id === null) {
    await flashToast("Pergunta criada.");
    redirect(LIST);
  }
  refresh();
  return actionOk(row.published ? "Pergunta salva e publicada." : "Pergunta salva como rascunho.");
}

export async function toggleFaqAction(id: number, published: boolean): Promise<ActionState> {
  const user = await requirePermission("site", "editar");
  const parsed = parseInput(z.object({ id: f.id(), published: z.boolean() }), { id, published });
  if (!parsed.ok) return parsed.state;
  const result = await setFaqPublished(parsed.data.id, parsed.data.published);
  if (!result.ok) return actionError(result.error === "no_answer" ? "Escreva a resposta antes de publicar esta pergunta." : "Esta pergunta não existe mais.");
  await logAudit({ user, action: "status", entity: "faq", entityId: result.row.id, summary: result.row.published ? "Publicou uma pergunta do FAQ" : "Voltou uma pergunta do FAQ para rascunho" });
  invalidateSite();
  refresh();
  return actionOk(result.row.published ? "Pergunta publicada no site." : "Pergunta voltou para rascunho.");
}

export async function moveFaqAction(id: number, direction: "up" | "down"): Promise<ActionState> {
  const user = await requirePermission("site", "editar");
  const parsed = parseInput(z.object({ id: f.id(), direction: z.enum(["up", "down"]) }), { id, direction });
  if (!parsed.ok) return parsed.state;
  if (await moveFaq(parsed.data.id, parsed.data.direction)) {
    await logAudit({ user, action: "update", entity: "faq", entityId: parsed.data.id, summary: "Mudou a ordem do FAQ" });
    invalidateSite();
  }
  refresh();
  return actionOk();
}

export async function deleteFaqAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission("site", "excluir");
  const parsed = parseForm(z.object({ id: f.id("Pergunta inválida.") }), formData);
  if (!parsed.ok) return parsed.state;
  if (await deleteFaq(parsed.data.id)) {
    await logAudit({ user, action: "delete", entity: "faq", entityId: parsed.data.id, summary: "Excluiu uma pergunta do FAQ" });
    invalidateSite();
  }
  await flashToast("Pergunta excluída.");
  redirect(LIST);
}
