"use server";

/** Server Actions de Conteúdo: criar, editar, mover no quadro, duplicar e excluir. Nada é publicado nas redes — é organização interna. */
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { flashToast } from "@/components/ui/flash";
import { actionError, actionOk, type ActionState } from "@/lib/action-state";
import { logAudit } from "@/lib/audit";
import { requireUser } from "@/lib/auth";
import { todayISO } from "@/lib/dates";
import { APPROVAL_STATUSES, CONTENT_FORMATS, CONTENT_NETWORKS, CONTENT_STATUS_LABELS, CONTENT_STATUSES } from "@/lib/domain";
import { safeUrl } from "@/lib/format";
import { f, formToObject, parseForm, parseInput } from "@/server/action";
import {
  checkContentRefs,
  createContentItem,
  deleteContentItem,
  duplicateContentItem,
  setContentStatus,
  updateContentItem,
  type ContentInput,
} from "@/server/content/admin";
import { publishDateForStatus, validateContentDates } from "@/server/content/logic";

const contentSchema = z
  .object({
    title: f.text(160, "Dê um tema ao conteúdo."),
    clientId: f.optionalId(),
    network: z.enum(CONTENT_NETWORKS, { error: "Selecione a rede." }),
    format: z.enum(CONTENT_FORMATS, { error: "Selecione o formato." }),
    status: z.enum(CONTENT_STATUSES, { error: "Selecione o status." }),
    ideaNotes: f.optionalText(4000),
    script: f.optionalText(10000),
    caption: f.optionalText(5000),
    cta: f.optionalText(300),
    recordDate: f.optionalDate(),
    editDeadline: f.optionalDate(),
    publishDate: f.optionalDate(),
    approvalStatus: z.enum(APPROVAL_STATUSES, { error: "Selecione a situação da aprovação." }),
    ownerId: f.optionalId(),
    assetUrl: f
      .optionalText(500)
      .refine((v) => v === "" || safeUrl(v) !== "", "Informe um link válido (começa com http:// ou https://)."),
    notes: f.optionalText(4000),
  })
  .superRefine((data, ctx) => {
    for (const [path, message] of Object.entries(validateContentDates(data))) ctx.addIssue({ code: "custom", path: [path], message });
  });

function toInput(data: z.infer<typeof contentSchema>): ContentInput {
  return {
    ...data,
    assetUrl: safeUrl(data.assetUrl),
    // "Publicado" sem data de publicação: usa hoje
    publishDate: publishDateForStatus(data.status, data.publishDate, todayISO()),
  };
}

/** O que a pessoa digitou, para repopular o formulário quando o erro não vem do zod. */
function typedValues(formData: FormData): Record<string, string> {
  return Object.fromEntries(Object.entries(formToObject(formData)).filter((entry): entry is [string, string] => typeof entry[1] === "string"));
}

const idSchema = z.object({ id: f.id("Conteúdo inválido.") });

// ---------------------------------------------------------------------- criar
export async function createContentAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = parseForm(contentSchema, formData);
  if (!parsed.ok) return parsed.state;
  const refsErrors = await checkContentRefs(parsed.data);
  if (Object.keys(refsErrors).length > 0) return actionError("Confira os campos destacados.", { fieldErrors: refsErrors, values: typedValues(formData) });

  const item = await createContentItem(toInput(parsed.data));
  await logAudit({ user, action: "create", entity: "content", entityId: item.id, summary: "Criou um item de conteúdo" });
  await flashToast("Conteúdo criado.");
  redirect(`/painel/conteudo/${item.id}`);
}

// --------------------------------------------------------------------- editar
export async function updateContentAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const idParsed = parseForm(idSchema, formData);
  if (!idParsed.ok) return idParsed.state;
  const parsed = parseForm(contentSchema, formData);
  if (!parsed.ok) return parsed.state;
  const refsErrors = await checkContentRefs(parsed.data);
  if (Object.keys(refsErrors).length > 0) return actionError("Confira os campos destacados.", { fieldErrors: refsErrors, values: typedValues(formData) });

  const item = await updateContentItem(idParsed.data.id, toInput(parsed.data));
  if (!item) return actionError("Este conteúdo não existe mais.");
  await logAudit({ user, action: "update", entity: "content", entityId: item.id, summary: "Editou um item de conteúdo" });
  refresh();
  return actionOk("Conteúdo salvo.");
}

// ------------------------------------------------------------- mover (quadro)
/** Chamada pelo `<Board>`: recebe o id do cartão e a coluna de destino (= status). */
export async function moveContentAction(cardId: number, toColumnId: string): Promise<ActionState> {
  const user = await requireUser();
  const parsed = parseInput(z.object({ id: f.id("Conteúdo inválido."), status: z.enum(CONTENT_STATUSES, { error: "Etapa inválida." }) }), { id: cardId, status: toColumnId });
  if (!parsed.ok) return parsed.state;

  const item = await setContentStatus(parsed.data.id, parsed.data.status, todayISO());
  if (!item) return actionError("Este conteúdo não existe mais.");
  await logAudit({ user, action: "status", entity: "content", entityId: item.id, summary: `Etapa do conteúdo: ${CONTENT_STATUS_LABELS[item.status]}` });
  refresh();
  return actionOk();
}

// ------------------------------------------------------------------- duplicar
export async function duplicateContentAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = parseForm(idSchema, formData);
  if (!parsed.ok) return parsed.state;
  const copy = await duplicateContentItem(parsed.data.id);
  if (!copy) return actionError("Este conteúdo não existe mais.");
  await logAudit({ user, action: "create", entity: "content", entityId: copy.id, summary: `Duplicou o conteúdo #${parsed.data.id}` });
  await flashToast("Cópia criada como nova ideia. Ajuste o tema e as datas.");
  redirect(`/painel/conteudo/${copy.id}`);
}

// -------------------------------------------------------------------- excluir
export async function deleteContentAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = parseForm(idSchema, formData);
  if (!parsed.ok) return parsed.state;
  const deleted = await deleteContentItem(parsed.data.id);
  if (deleted) await logAudit({ user, action: "delete", entity: "content", entityId: deleted.id, summary: "Excluiu um item de conteúdo" });
  await flashToast("Conteúdo excluído.");
  redirect("/painel/conteudo");
}
