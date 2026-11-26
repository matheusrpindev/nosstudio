"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { flashToast } from "@/components/ui/flash";
import { actionError, actionOk, type ActionState } from "@/lib/action-state";
import { logAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/auth";
import { SERVICE_INTERESTS } from "@/lib/domain";
import { f, parseForm, parseInput } from "@/server/action";
import { fieldError, idListField, parseSiteForm, slugField, textListField, videoField } from "@/server/site/admin/form";
import { deleteService, moveService, saveService, setServiceVisible } from "@/server/site/admin/services";
import { invalidateSite } from "@/server/site/cache";

const LIST = "/painel/site/servicos";

const schema = z.object({
  id: f.optionalId(),
  title: f.text(120, "Informe o nome do serviço."),
  slug: slugField(),
  summary: f.optionalText(240),
  description: f.optionalText(8000),
  items: textListField(30, 160),
  ctaLabel: f.text(40, "Informe o texto do botão."),
  interest: z.enum(SERVICE_INTERESTS, { error: "Selecione o interesse." }),
  cover: f.optionalId(),
  gallery: idListField(24),
  videoUrl: videoField(),
  pagePath: z
    .string()
    .trim()
    .max(80)
    .optional()
    .transform((v) => v || null)
    .refine((v) => v === null || /^\/[a-z0-9]+(-[a-z0-9]+)*(\/[a-z0-9]+(-[a-z0-9]+)*)*$/.test(v), "Use um caminho do site, como /casamentos."),
  visible: f.checkbox(),
});

export async function saveServiceAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission("site", "editar");
  const parsed = parseSiteForm(schema, formData, ["items", "gallery"]);
  if (!parsed.ok) return parsed.state;
  const { id, cover, ...data } = parsed.data;

  const result = await saveService(id, { ...data, coverMediaId: cover });
  if (!result.ok) {
    if (result.error === "slug_taken") return fieldError("slug", "Já existe um serviço com este endereço. Escolha outro ou deixe em branco.", parsed.values);
    return actionError("Este serviço não existe mais.");
  }
  await logAudit({ user, action: id === null ? "create" : "update", entity: "service", entityId: result.row.id, summary: id === null ? "Criou um serviço do site" : "Editou um serviço do site" });
  invalidateSite();
  if (id === null) {
    await flashToast("Serviço criado.");
    redirect(LIST);
  }
  refresh();
  return actionOk("Serviço salvo.");
}

export async function toggleServiceAction(id: number, visible: boolean): Promise<ActionState> {
  const user = await requirePermission("site", "editar");
  const parsed = parseInput(z.object({ id: f.id(), visible: z.boolean() }), { id, visible });
  if (!parsed.ok) return parsed.state;
  const row = await setServiceVisible(parsed.data.id, parsed.data.visible);
  if (!row) return actionError("Este serviço não existe mais.");
  await logAudit({ user, action: "update", entity: "service", entityId: row.id, summary: row.visible ? "Mostrou um serviço no site" : "Ocultou um serviço do site" });
  invalidateSite();
  refresh();
  return actionOk(row.visible ? "Serviço visível no site." : "Serviço oculto do site.");
}

export async function moveServiceAction(id: number, direction: "up" | "down"): Promise<ActionState> {
  const user = await requirePermission("site", "editar");
  const parsed = parseInput(z.object({ id: f.id(), direction: z.enum(["up", "down"]) }), { id, direction });
  if (!parsed.ok) return parsed.state;
  if (await moveService(parsed.data.id, parsed.data.direction)) {
    await logAudit({ user, action: "update", entity: "service", entityId: parsed.data.id, summary: "Mudou a ordem dos serviços" });
    invalidateSite();
  }
  refresh();
  return actionOk();
}

export async function deleteServiceAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission("site", "excluir");
  const parsed = parseForm(z.object({ id: f.id("Serviço inválido.") }), formData);
  if (!parsed.ok) return parsed.state;
  const row = await deleteService(parsed.data.id);
  if (row) {
    await logAudit({ user, action: "delete", entity: "service", entityId: row.id, summary: "Excluiu um serviço do site" });
    invalidateSite();
  }
  await flashToast("Serviço excluído.");
  redirect(LIST);
}
