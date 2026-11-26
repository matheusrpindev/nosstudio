"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { flashToast } from "@/components/ui/flash";
import { actionError, actionOk, type ActionState } from "@/lib/action-state";
import { logAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/auth";
import { PACKAGE_KINDS, PRICE_MODES } from "@/lib/domain";
import { f, parseForm, parseInput } from "@/server/action";
import { parseSiteForm, textListField } from "@/server/site/admin/form";
import { deletePackage, movePackage, savePackage, setPackageVisible } from "@/server/site/admin/packages";
import { invalidateSite } from "@/server/site/cache";

const LIST = "/painel/site/pacotes";

const schema = z
  .object({
    id: f.optionalId(),
    kind: z.enum(PACKAGE_KINDS, { error: "Selecione o tipo." }),
    name: f.text(120, "Informe o nome do pacote."),
    tagline: f.optionalText(200),
    description: f.optionalText(2000),
    includes: textListField(30, 160),
    deliverables: z
      .array(z.object({ label: z.string().trim().max(120, "Máximo de 120 caracteres."), quantity: z.string().trim().max(60, "Máximo de 60 caracteres.") }))
      .max(30, "No máximo 30 entregas.")
      // linha sem nome é descartada (a quantidade sozinha não diz nada)
      .transform((rows) => rows.filter((row) => row.label)),
    recordingDuration: f.optionalText(120),
    revisionLimit: f.optionalText(120),
    priceMode: z.enum(PRICE_MODES, { error: "Selecione como o preço aparece." }),
    price: f.optionalMoney(),
    priceSuffix: f.optionalText(40),
    recommended: f.checkbox(),
    ctaLabel: f.text(40, "Informe o texto do botão."),
    visible: f.checkbox(),
  })
  .superRefine((value, ctx) => {
    if (value.priceMode !== "sob_consulta" && (value.price === null || value.price <= 0)) {
      ctx.addIssue({ code: "custom", path: ["price"], message: "Informe o valor ou escolha “Sob consulta”." });
    }
  });

export async function savePackageAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission("site", "editar");
  const parsed = parseSiteForm(schema, formData, ["includes", "deliverables"]);
  if (!parsed.ok) return parsed.state;
  const { id, price, ...data } = parsed.data;

  const row = await savePackage(id, { ...data, priceCents: price });
  if (!row) return actionError("Este pacote não existe mais.");
  await logAudit({ user, action: id === null ? "create" : "update", entity: "package", entityId: row.id, summary: id === null ? "Criou um pacote do site" : "Editou um pacote do site" });
  invalidateSite();
  if (id === null) {
    await flashToast("Pacote criado.");
    redirect(LIST);
  }
  refresh();
  return actionOk("Pacote salvo.");
}

export async function togglePackageAction(id: number, visible: boolean): Promise<ActionState> {
  const user = await requirePermission("site", "editar");
  const parsed = parseInput(z.object({ id: f.id(), visible: z.boolean() }), { id, visible });
  if (!parsed.ok) return parsed.state;
  const row = await setPackageVisible(parsed.data.id, parsed.data.visible);
  if (!row) return actionError("Este pacote não existe mais.");
  await logAudit({ user, action: "update", entity: "package", entityId: row.id, summary: row.visible ? "Mostrou um pacote no site" : "Ocultou um pacote do site" });
  invalidateSite();
  refresh();
  return actionOk(row.visible ? "Pacote visível no site." : "Pacote oculto do site.");
}

export async function movePackageAction(id: number, direction: "up" | "down"): Promise<ActionState> {
  const user = await requirePermission("site", "editar");
  const parsed = parseInput(z.object({ id: f.id(), direction: z.enum(["up", "down"]) }), { id, direction });
  if (!parsed.ok) return parsed.state;
  if (await movePackage(parsed.data.id, parsed.data.direction)) {
    await logAudit({ user, action: "update", entity: "package", entityId: parsed.data.id, summary: "Mudou a ordem dos pacotes" });
    invalidateSite();
  }
  refresh();
  return actionOk();
}

export async function deletePackageAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission("site", "excluir");
  const parsed = parseForm(z.object({ id: f.id("Pacote inválido.") }), formData);
  if (!parsed.ok) return parsed.state;
  const row = await deletePackage(parsed.data.id);
  if (row) {
    await logAudit({ user, action: "delete", entity: "package", entityId: row.id, summary: "Excluiu um pacote do site" });
    invalidateSite();
  }
  await flashToast("Pacote excluído.");
  redirect(LIST);
}
