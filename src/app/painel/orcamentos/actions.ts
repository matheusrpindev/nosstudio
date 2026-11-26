"use server";

/**
 * Server Actions de Orçamentos e propostas. Padrão do painel: `requirePermission(módulo, ação)` → validar com zod → mutação em
 * `src/server/proposals/admin.ts` → `logAudit()` → `refresh()`/`redirect()`.
 *
 * Nada daqui devolve custos, margens ou notas internas para fora do painel: o PDF sai só pela rota
 * `/painel/orcamentos/[id]/pdf`, a partir de `toPublicProposal()`.
 */
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { flashToast } from "@/components/ui/flash";
import { actionError, actionOk, type ActionState } from "@/lib/action-state";
import { logAudit } from "@/lib/audit";
import { requirePermission, type CurrentUser } from "@/lib/auth";
import { CLIENT_STATUS_LABELS, PROPOSAL_MODALITIES, PROPOSAL_STATUS_LABELS, PROPOSAL_STATUSES } from "@/lib/domain";
import { isValidPhone } from "@/lib/format";
import { f, jsonField, parseForm, zodFieldErrors } from "@/server/action";
import {
  convertProposalToProject,
  createProposal,
  createProposalVersion,
  createTemplate,
  deleteProposal,
  duplicateProposal,
  linkProposalContract,
  saveProposal,
  saveProposalAsTemplate,
  setProposalStatus,
} from "@/server/proposals/admin";
import type { FunnelMove } from "@/server/proposals/funnel";
import { funnelAdvanceNotice } from "@/server/proposals/funnel-logic";
import { DEFAULT_TITLES, dropBlankRows, proposalDraftSchema, type ProposalDraft } from "./draft";

const idSchema = z.object({ id: f.id("Proposta inválida.") });
const editorPath = (id: number) => `/painel/orcamentos/${id}`;
const numberLabel = (number: string, version: number) => `${number}${version > 1 ? ` v${version}` : ""}`;

// ------------------------------------------------------------------- novo
const newProposalSchema = z
  .object({
    modality: z.enum(PROPOSAL_MODALITIES, { error: "Selecione a modalidade." }),
    clientMode: z.enum(["existente", "novo"]).default("existente"),
    clientId: f.optionalId(),
    newClientName: f.optionalText(120),
    newClientWhatsapp: f.optionalText(30),
    templateId: f.optionalId(),
    title: f.optionalText(160),
  })
  .superRefine((data, ctx) => {
    if (data.clientMode === "existente") {
      if (!data.clientId) ctx.addIssue({ code: "custom", path: ["clientId"], message: "Selecione o cliente (ou use o cadastro rápido)." });
      return;
    }
    if (!data.newClientName) ctx.addIssue({ code: "custom", path: ["newClientName"], message: "Informe o nome do cliente." });
    if (!isValidPhone(data.newClientWhatsapp)) ctx.addIssue({ code: "custom", path: ["newClientWhatsapp"], message: "Informe o WhatsApp com DDD." });
  });

export async function createProposalAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission("propostas", "editar");
  const parsed = parseForm(newProposalSchema, formData);
  if (!parsed.ok) return parsed.state;
  const data = parsed.data;

  const result = await createProposal({
    modality: data.modality,
    // com modelo, o título em branco herda o do modelo
    title: data.title || (data.templateId ? "" : DEFAULT_TITLES[data.modality]),
    clientId: data.clientMode === "existente" ? data.clientId : null,
    newClient: data.clientMode === "novo" ? { name: data.newClientName, whatsapp: data.newClientWhatsapp } : null,
    templateId: data.templateId,
    userId: user.id,
  });
  if (!result.ok) {
    return actionError(result.reason === "client_not_found" ? "Este cliente não existe mais. Escolha outro." : "Este modelo não existe mais. Escolha outro.");
  }
  if (result.createdClientId) {
    await logAudit({ user, action: "create", entity: "client", entityId: result.createdClientId, summary: "Cadastro rápido de cliente ao criar um orçamento" });
  }
  await logAudit({ user, action: "create", entity: "proposal", entityId: result.id, summary: `Criou a proposta ${result.number}` });
  await flashToast(`Proposta ${result.number} criada como rascunho.`);
  redirect(editorPath(result.id));
}

// ------------------------------------------------------------------ modelos
const newTemplateSchema = z.object({
  templateName: f.text(120, "Dê um nome ao modelo."),
  modality: z.enum(PROPOSAL_MODALITIES, { error: "Selecione a modalidade." }),
});

export async function createTemplateAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission("propostas", "editar");
  const parsed = parseForm(newTemplateSchema, formData);
  if (!parsed.ok) return parsed.state;
  const id = await createTemplate({ ...parsed.data, title: DEFAULT_TITLES[parsed.data.modality], userId: user.id });
  await logAudit({ user, action: "create", entity: "proposal_template", entityId: id, summary: `Criou o modelo de proposta “${parsed.data.templateName}”` });
  await flashToast("Modelo criado. Monte os itens e salve.");
  redirect(editorPath(id));
}

const saveAsTemplateSchema = z.object({ id: f.id("Proposta inválida."), templateName: f.text(120, "Dê um nome ao modelo.") });

export async function saveAsTemplateAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission("propostas", "editar");
  const parsed = parseForm(saveAsTemplateSchema, formData);
  if (!parsed.ok) return parsed.state;
  const result = await saveProposalAsTemplate(parsed.data.id, parsed.data.templateName, user.id);
  if (!result.ok) return actionError("Esta proposta não existe mais.");
  await logAudit({ user, action: "create", entity: "proposal_template", entityId: result.id, summary: `Salvou a proposta #${parsed.data.id} como modelo “${parsed.data.templateName}”` });
  refresh();
  return actionOk(`Modelo “${parsed.data.templateName}” salvo. Ele aparece em Orçamentos › Modelos.`);
}

// ------------------------------------------------------------------- salvar
const FIELD_NAMES: Record<string, string> = {
  title: "título",
  templateName: "nome do modelo",
  items: "itens do escopo",
  costs: "custos internos",
  payments: "parcelas",
  entryPercent: "sinal (%)",
  entryCents: "sinal (valor)",
  taxPercent: "tributos",
  targetMarginPercent: "margem-alvo",
  discountCents: "desconto",
  eventDate: "data",
  validUntil: "validade",
};

/**
 * Salva o editor inteiro. O rascunho chega em JSON (campo `payload`), é validado com zod e o servidor refaz as
 * contas antes de gravar. Em caso de erro, `fieldErrors` usa o caminho do campo (`items.2.title`).
 */
export async function saveProposalAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission("propostas", "editar");
  const idParsed = idSchema.safeParse({ id: formData.get("id") });
  if (!idParsed.success) return actionError("Proposta inválida.");
  const id = idParsed.data.id;

  const raw = jsonField(formData, "payload");
  if (!raw || typeof raw !== "object") return actionError("Não foi possível ler os dados do formulário. Recarregue a página e tente de novo.");
  const shape = z.object({ items: z.array(z.unknown()), costs: z.array(z.unknown()), payments: z.array(z.unknown()) }).safeParse(raw);
  if (!shape.success) return actionError("Não foi possível ler os dados do formulário. Recarregue a página e tente de novo.");

  let cleaned: unknown = raw;
  try {
    cleaned = dropBlankRows(raw as ProposalDraft);
  } catch {
    // formato inesperado: o schema abaixo acusa o erro
  }
  const parsed = proposalDraftSchema.safeParse(cleaned);
  if (!parsed.success) {
    const fieldErrors = zodFieldErrors(parsed.error);
    const [firstPath, firstMessage] = Object.entries(fieldErrors)[0] ?? ["", "Confira os campos."];
    const [field, index] = firstPath.split(".");
    const where = FIELD_NAMES[field] ? `${FIELD_NAMES[field]}${index !== undefined && /^\d+$/.test(index) ? ` (linha ${Number(index) + 1})` : ""}` : "";
    return actionError(where ? `Confira ${where}: ${firstMessage}` : firstMessage, { fieldErrors });
  }

  const result = await saveProposal(id, parsed.data);
  if (!result.ok) {
    if (result.reason === "client_not_found") return actionError("Este cliente não existe mais. Escolha outro.", { fieldErrors: { clientId: "Cliente não encontrado." } });
    if (result.reason === "owner_not_found") return actionError("Este responsável não existe mais. Escolha outro.", { fieldErrors: { ownerId: "Responsável não encontrado." } });
    return actionError("Esta proposta não existe mais.");
  }
  const { proposal } = result;
  await logAudit({
    user,
    action: "update",
    entity: proposal.isTemplate ? "proposal_template" : "proposal",
    entityId: proposal.id,
    summary: proposal.isTemplate ? `Salvou o modelo “${proposal.templateName}”` : `Salvou a proposta ${numberLabel(proposal.number, proposal.version)}`,
  });
  refresh();
  return actionOk(proposal.isTemplate ? "Modelo salvo." : "Proposta salva.");
}

// ----------------------------------------------------------- duplicar / versão
export async function duplicateProposalAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission("propostas", "editar");
  const parsed = parseForm(idSchema, formData);
  if (!parsed.ok) return parsed.state;
  const result = await duplicateProposal(parsed.data.id, user.id);
  if (!result.ok) return actionError("Esta proposta não existe mais.");
  await logAudit({
    user,
    action: "create",
    entity: result.number ? "proposal" : "proposal_template",
    entityId: result.id,
    summary: result.number ? `Duplicou a proposta #${parsed.data.id} como ${result.number}` : `Duplicou o modelo #${parsed.data.id}`,
  });
  await flashToast(result.number ? `Cópia criada: proposta ${result.number} (rascunho).` : "Cópia do modelo criada.");
  redirect(editorPath(result.id));
}

export async function createVersionAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission("propostas", "editar");
  const parsed = parseForm(idSchema, formData);
  if (!parsed.ok) return parsed.state;
  const result = await createProposalVersion(parsed.data.id, user.id);
  if (!result.ok) return actionError(result.reason === "is_template" ? "Modelos não têm versões." : "Esta proposta não existe mais.");
  await logAudit({ user, action: "create", entity: "proposal", entityId: result.id, summary: `Criou a versão ${result.version} da proposta ${result.number}` });
  await flashToast(`Versão ${result.version} criada como rascunho.`);
  redirect(editorPath(result.id));
}

// ------------------------------------------------------------------- status
/** O avanço automático do cliente no funil também fica na auditoria (sem nome do cliente: só o id). */
async function auditClientMove(user: CurrentUser, move: FunnelMove, cause: string) {
  await logAudit({
    user,
    action: "status",
    entity: "client",
    entityId: move.clientId,
    summary: `Status do cliente: ${CLIENT_STATUS_LABELS[move.from]} → ${CLIENT_STATUS_LABELS[move.to]} (automático, ${cause})`,
  });
}

const statusSchema = z.object({ id: f.id("Proposta inválida."), status: z.enum(PROPOSAL_STATUSES, { error: "Status inválido." }) });

export async function setProposalStatusAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission("propostas", "editar");
  const parsed = parseForm(statusSchema, formData);
  if (!parsed.ok) return parsed.state;
  const result = await setProposalStatus(parsed.data.id, parsed.data.status, user.id);
  if (!result.ok) {
    if (result.reason === "needs_client") return actionError("Selecione o cliente (na etapa Dados) e salve antes de marcar como enviada.");
    if (result.reason === "is_template") return actionError("Modelos não têm status.");
    return actionError("Esta proposta não existe mais.");
  }
  const { proposal, clientMoved } = result;
  await logAudit({
    user,
    action: "status",
    entity: "proposal",
    entityId: proposal.id,
    summary: `Proposta ${numberLabel(proposal.number, proposal.version)}: ${PROPOSAL_STATUS_LABELS[proposal.status]}`,
  });
  if (clientMoved) await auditClientMove(user, clientMoved, `proposta ${numberLabel(proposal.number, proposal.version)}`);
  refresh();
  // com avanço no funil o aviso fica curto (o toast some em poucos segundos): o que importa é o cliente ter andado
  if (clientMoved) return actionOk(`${proposal.status === "enviada" ? "Marcada como enviada." : `Status: ${PROPOSAL_STATUS_LABELS[proposal.status]}.`} ${funnelAdvanceNotice(clientMoved.to)}`);
  return actionOk(proposal.status === "enviada" ? "Marcada como enviada. O envio ficou registrado no histórico do cliente." : `Status: ${PROPOSAL_STATUS_LABELS[proposal.status]}.`);
}

// ------------------------------------------------------- projeto e contrato
export async function convertToProjectAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission("propostas", "editar");
  await requirePermission("projetos", "editar");
  const parsed = parseForm(idSchema, formData);
  if (!parsed.ok) return parsed.state;
  const result = await convertProposalToProject(parsed.data.id, user.id);
  if (!result.ok) {
    return actionError(result.reason === "not_accepted" ? "Só propostas aceitas viram projeto. Marque como aceita primeiro." : "Esta proposta não existe mais.");
  }
  if (result.created) {
    await logAudit({ user, action: "create", entity: "project", entityId: result.projectId, summary: `Criou o projeto a partir da proposta #${parsed.data.id}` });
    if (result.clientMoved) await auditClientMove(user, result.clientMoved, `projeto #${result.projectId}`);
    await flashToast(result.clientMoved ? `Projeto criado a partir da proposta. ${funnelAdvanceNotice(result.clientMoved.to)}` : "Projeto criado a partir da proposta.");
  }
  redirect(`/painel/projetos/${result.projectId}`);
}

const contractSchema = z.object({ id: f.id("Proposta inválida."), contractId: f.optionalId() });

export async function linkContractAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission("propostas", "editar");
  await requirePermission("contratos", "editar");
  const parsed = parseForm(contractSchema, formData);
  if (!parsed.ok) return parsed.state;
  const result = await linkProposalContract(parsed.data.id, parsed.data.contractId);
  if (!result.ok) {
    return actionError(result.reason === "contract_not_found" ? "Este contrato não pertence ao cliente da proposta (ou não existe mais)." : "Esta proposta não existe mais.");
  }
  await logAudit({
    user,
    action: "update",
    entity: "proposal",
    entityId: result.proposal.id,
    summary: parsed.data.contractId ? `Vinculou o contrato #${parsed.data.contractId} à proposta ${result.proposal.number}` : `Desvinculou o contrato da proposta ${result.proposal.number}`,
  });
  refresh();
  return actionOk(parsed.data.contractId ? "Contrato vinculado." : "Contrato desvinculado.");
}

// ------------------------------------------------------------------- excluir
export async function deleteProposalAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission("propostas", "excluir");
  const parsed = parseForm(idSchema, formData);
  if (!parsed.ok) return parsed.state;
  const result = await deleteProposal(parsed.data.id);
  if (!result.ok) {
    if (result.reason === "not_draft") return actionError("Só rascunhos e modelos podem ser excluídos. Propostas enviadas ficam como histórico.");
    await flashToast("Esta proposta já tinha sido excluída.", "info");
    redirect("/painel/orcamentos");
  }
  const { deleted } = result;
  await logAudit({
    user,
    action: "delete",
    entity: deleted.isTemplate ? "proposal_template" : "proposal",
    entityId: deleted.id,
    summary: deleted.isTemplate ? "Excluiu um modelo de proposta" : `Excluiu o rascunho ${numberLabel(deleted.number, deleted.version)}`,
  });
  await flashToast(deleted.isTemplate ? "Modelo excluído." : "Rascunho excluído.");
  redirect(deleted.isTemplate ? "/painel/orcamentos/modelos" : "/painel/orcamentos");
}
