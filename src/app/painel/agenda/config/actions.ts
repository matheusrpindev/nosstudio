"use server";

/** Server Actions das configurações da agenda: categorias, agendas (calendários) e modelos de checklist. */
import { refresh } from "next/cache";
import { z } from "zod";
import { actionError, actionOk, type ActionState } from "@/lib/action-state";
import { logAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/auth";
import { AGENDA_CALENDAR_KINDS, AGENDA_COLORS, AGENDA_ICONS } from "@/lib/domain";
import { f, jsonField, parseForm, parseInput } from "@/server/action";
import {
  deleteChecklistTemplate,
  moveCalendar,
  moveCategory,
  moveChecklistTemplate,
  saveCalendar,
  saveCategory,
  saveChecklistTemplate,
  setCalendarActive,
  setCategoryActive,
} from "@/server/agenda/settings";

const idSchema = z.object({ id: f.id("Registro inválido.") });
const moveSchema = idSchema.extend({ direction: z.enum(["up", "down"]) });
const activeSchema = idSchema.extend({ active: f.checkbox() });
const color = z.enum(AGENDA_COLORS, { error: "Escolha uma cor." });

// ---------------------------------------------------------------- categorias
const categorySchema = z.object({
  id: f.optionalId(),
  name: f.text(60, "Dê um nome à categoria."),
  color,
  icon: z.enum(AGENDA_ICONS, { error: "Escolha um ícone." }),
  blocksDay: f.checkbox(),
  isProduction: f.checkbox(),
});

export async function saveCategoryAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission("agenda", "editar");
  const parsed = parseForm(categorySchema, formData);
  if (!parsed.ok) return parsed.state;
  const { id, ...input } = parsed.data;
  const saved = await saveCategory(id, input);
  if (!saved) return actionError("Esta categoria não existe mais.");
  await logAudit({ user, action: id ? "update" : "create", entity: "agenda", entityId: saved, summary: `${id ? "Editou" : "Criou"} a categoria de agenda “${input.name}”` });
  refresh();
  return actionOk(id ? "Categoria salva." : "Categoria criada.");
}

export async function setCategoryActiveAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission("agenda", "editar");
  const parsed = parseForm(activeSchema, formData);
  if (!parsed.ok) return parsed.state;
  const result = await setCategoryActive(parsed.data.id, parsed.data.active);
  if (result === "inexistente") return actionError("Esta categoria não existe mais.");
  if (result === "protegida") return actionError("“Outros” não pode ser desativada: é para ela que vai o que fica sem categoria.");
  await logAudit({ user, action: "status", entity: "agenda", entityId: parsed.data.id, summary: `${parsed.data.active ? "Reativou" : "Desativou"} uma categoria de agenda` });
  refresh();
  return actionOk(parsed.data.active ? "Categoria reativada." : "Categoria desativada.");
}

export async function moveCategoryAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requirePermission("agenda", "editar");
  const parsed = parseForm(moveSchema, formData);
  if (!parsed.ok) return parsed.state;
  await moveCategory(parsed.data.id, parsed.data.direction);
  refresh();
  return actionOk();
}

// -------------------------------------------------------------------- agendas
const calendarSchema = z.object({
  id: f.optionalId(),
  name: f.text(60, "Dê um nome à agenda."),
  color,
  kind: z.enum(AGENDA_CALENDAR_KINDS).optional(),
});

export async function saveCalendarAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission("agenda", "editar");
  const parsed = parseForm(calendarSchema, formData);
  if (!parsed.ok) return parsed.state;
  const { id, ...input } = parsed.data;
  const saved = await saveCalendar(id, input);
  if (!saved) return actionError("Esta agenda não existe mais.");
  await logAudit({ user, action: id ? "update" : "create", entity: "agenda", entityId: saved, summary: `${id ? "Editou" : "Criou"} a agenda “${input.name}”` });
  refresh();
  return actionOk(id ? "Agenda salva." : "Agenda criada.");
}

export async function setCalendarActiveAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission("agenda", "editar");
  const parsed = parseForm(activeSchema, formData);
  if (!parsed.ok) return parsed.state;
  const result = await setCalendarActive(parsed.data.id, parsed.data.active);
  if (result === "inexistente") return actionError("Esta agenda não existe mais.");
  if (result === "protegida") return actionError("A agenda geral não pode ser desativada.");
  await logAudit({ user, action: "status", entity: "agenda", entityId: parsed.data.id, summary: `${parsed.data.active ? "Reativou" : "Desativou"} uma agenda` });
  refresh();
  return actionOk(parsed.data.active ? "Agenda reativada." : "Agenda desativada.");
}

export async function moveCalendarAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requirePermission("agenda", "editar");
  const parsed = parseForm(moveSchema, formData);
  if (!parsed.ok) return parsed.state;
  await moveCalendar(parsed.data.id, parsed.data.direction);
  refresh();
  return actionOk();
}

// --------------------------------------------------------- modelos de checklist
const templateSchema = z.object({
  id: f.optionalId(),
  name: f.text(80, "Dê um nome ao modelo."),
  categoryId: f.optionalId(),
  items: z
    .array(z.string().trim().max(200))
    .max(60, "Máximo de 60 itens.")
    .transform((items) => items.filter((item) => item !== ""))
    .refine((items) => items.length > 0, "Adicione ao menos um item."),
});

export async function saveChecklistTemplateAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission("agenda", "editar");
  const parsed = parseInput(templateSchema, {
    id: formData.get("id") ?? undefined,
    name: formData.get("name") ?? undefined,
    categoryId: formData.get("categoryId") ?? undefined,
    items: jsonField(formData, "items") ?? [],
  });
  if (!parsed.ok) return parsed.state;
  const { id, ...input } = parsed.data;
  const saved = await saveChecklistTemplate(id, input);
  if (!saved) return actionError("Não foi possível salvar: o modelo ou a categoria não existe mais.");
  await logAudit({ user, action: id ? "update" : "create", entity: "agenda", entityId: saved, summary: `${id ? "Editou" : "Criou"} o modelo de checklist “${input.name}”` });
  refresh();
  return actionOk(id ? "Modelo salvo." : "Modelo criado.");
}

export async function moveChecklistTemplateAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requirePermission("agenda", "editar");
  const parsed = parseForm(moveSchema, formData);
  if (!parsed.ok) return parsed.state;
  await moveChecklistTemplate(parsed.data.id, parsed.data.direction);
  refresh();
  return actionOk();
}

export async function deleteChecklistTemplateAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission("agenda", "excluir");
  const parsed = parseForm(idSchema, formData);
  if (!parsed.ok) return parsed.state;
  if (await deleteChecklistTemplate(parsed.data.id)) {
    await logAudit({ user, action: "delete", entity: "agenda", entityId: parsed.data.id, summary: "Excluiu um modelo de checklist da agenda" });
  }
  refresh();
  return actionOk("Modelo excluído.");
}
