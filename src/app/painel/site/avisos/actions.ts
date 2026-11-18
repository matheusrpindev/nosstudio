"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { flashToast } from "@/components/ui/flash";
import { actionError, actionOk, type ActionState } from "@/lib/action-state";
import { logAudit } from "@/lib/audit";
import { requireUser } from "@/lib/auth";
import { BRAND_COLORS } from "@/lib/domain";
import { safeHref } from "@/lib/format";
import { f, parseForm, parseInput } from "@/server/action";
import { invalidateSite } from "@/server/site/cache";
import { createAnnouncement, deleteAnnouncement, moveAnnouncement, setAnnouncementEnabled, updateAnnouncement } from "@/server/site/admin/announcements";

const LIST = "/painel/site/avisos";

/** `YYYY-MM-DDTHH:mm` (campo datetime-local) ou vazio → null. */
const localDateTime = (message: string) =>
  z
    .string()
    .trim()
    .optional()
    .transform((v) => v || null)
    .refine((v) => v === null || (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v) && !Number.isNaN(Date.parse(v))), message);

const schema = z
  .object({
    id: f.optionalId(),
    message: f.text(240, "Escreva a mensagem do aviso."),
    linkLabel: f.optionalText(40),
    linkUrl: f.optionalText(500),
    bgColor: z.enum(BRAND_COLORS, { error: "Escolha a cor de fundo." }),
    textColor: z.enum(BRAND_COLORS, { error: "Escolha a cor do texto." }),
    startsAt: localDateTime("Informe um início válido."),
    endsAt: localDateTime("Informe um fim válido."),
    dismissible: f.checkbox(),
    enabled: f.checkbox(),
  })
  .superRefine((value, ctx) => {
    if (value.linkUrl && !safeHref(value.linkUrl)) {
      ctx.addIssue({ code: "custom", path: ["linkUrl"], message: "Endereço inválido. Use um link completo (https://…) ou um caminho do site (/contato)." });
    }
    if (value.linkUrl && !value.linkLabel) ctx.addIssue({ code: "custom", path: ["linkLabel"], message: "Dê um nome ao botão ou apague o endereço." });
    if (value.linkLabel && !value.linkUrl) ctx.addIssue({ code: "custom", path: ["linkUrl"], message: "Informe para onde o botão leva ou apague o nome." });
    if (value.startsAt && value.endsAt && value.endsAt <= value.startsAt) {
      ctx.addIssue({ code: "custom", path: ["endsAt"], message: "O fim precisa ser depois do início." });
    }
  });

export async function saveAnnouncementAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = parseForm(schema, formData);
  if (!parsed.ok) return parsed.state;
  const { id, ...data } = parsed.data;
  const input = { ...data, linkUrl: safeHref(data.linkUrl) };

  if (id === null) {
    const row = await createAnnouncement(input);
    await logAudit({ user, action: "create", entity: "announcement", entityId: row.id, summary: "Criou um aviso da barra do site" });
    invalidateSite();
    await flashToast("Aviso criado.");
    redirect(LIST);
  }
  const row = await updateAnnouncement(id, input);
  if (!row) return actionError("Este aviso não existe mais.");
  await logAudit({ user, action: "update", entity: "announcement", entityId: row.id, summary: "Editou um aviso da barra do site" });
  invalidateSite();
  refresh();
  return actionOk("Aviso salvo.");
}

export async function toggleAnnouncementAction(id: number, enabled: boolean): Promise<ActionState> {
  const user = await requireUser();
  const parsed = parseInput(z.object({ id: f.id(), enabled: z.boolean() }), { id, enabled });
  if (!parsed.ok) return parsed.state;
  const row = await setAnnouncementEnabled(parsed.data.id, parsed.data.enabled);
  if (!row) return actionError("Este aviso não existe mais.");
  await logAudit({ user, action: "update", entity: "announcement", entityId: row.id, summary: row.enabled ? "Ligou um aviso da barra do site" : "Desligou um aviso da barra do site" });
  invalidateSite();
  refresh();
  return actionOk(row.enabled ? "Aviso ligado." : "Aviso desligado.");
}

export async function moveAnnouncementAction(id: number, direction: "up" | "down"): Promise<ActionState> {
  const user = await requireUser();
  const parsed = parseInput(z.object({ id: f.id(), direction: z.enum(["up", "down"]) }), { id, direction });
  if (!parsed.ok) return parsed.state;
  const moved = await moveAnnouncement(parsed.data.id, parsed.data.direction);
  if (moved) {
    await logAudit({ user, action: "update", entity: "announcement", entityId: parsed.data.id, summary: "Mudou a ordem dos avisos" });
    invalidateSite();
  }
  refresh();
  return actionOk();
}

export async function deleteAnnouncementAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = parseForm(z.object({ id: f.id("Aviso inválido.") }), formData);
  if (!parsed.ok) return parsed.state;
  if (await deleteAnnouncement(parsed.data.id)) {
    await logAudit({ user, action: "delete", entity: "announcement", entityId: parsed.data.id, summary: "Excluiu um aviso da barra do site" });
    invalidateSite();
  }
  await flashToast("Aviso excluído.");
  redirect(LIST);
}
