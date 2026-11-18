"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { flashToast } from "@/components/ui/flash";
import { actionError, actionOk, type ActionState } from "@/lib/action-state";
import { logAudit } from "@/lib/audit";
import { requireUser } from "@/lib/auth";
import { CONTRACT_STATUS_LABELS, CONTRACT_STATUSES } from "@/lib/domain";
import { f, parseForm } from "@/server/action";
import {
  createContract,
  createTemplate,
  deleteContract,
  deleteTemplate,
  findMissingLinks,
  isPrivateMedia,
  setContractStatus,
  updateContract,
  updateTemplate,
} from "@/server/contracts/admin";
import { contractSchema, templateSchema } from "./schemas";

const idSchema = z.object({ id: f.id("Registro inválido.") });

/** Valida vínculos e arquivo contra o banco; devolve o estado de erro ou `null` se estiver tudo certo. */
async function checkReferences(data: z.output<typeof contractSchema>, formData: FormData): Promise<ActionState | null> {
  const fieldErrors: Record<string, string> = await findMissingLinks(data);
  if (data.fileMediaId && !(await isPrivateMedia(data.fileMediaId))) fieldErrors.fileMediaId = "Arquivo inválido. Envie o documento de novo.";
  if (Object.keys(fieldErrors).length === 0) return null;
  const values: Record<string, string> = {};
  for (const [key, value] of formData.entries()) if (typeof value === "string") values[key] = value;
  return actionError("Confira os campos destacados.", { fieldErrors, values });
}

// ------------------------------------------------------------------ contratos
export async function createContractAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = parseForm(contractSchema, formData);
  if (!parsed.ok) return parsed.state;
  const invalid = await checkReferences(parsed.data, formData);
  if (invalid) return invalid;

  const contract = await createContract(parsed.data);
  await logAudit({ user, action: "create", entity: "contract", entityId: contract.id, summary: "Cadastrou um contrato" });
  await flashToast("Contrato cadastrado.");
  redirect(`/painel/contratos/${contract.id}`);
}

export async function updateContractAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const id = parseForm(idSchema, formData);
  if (!id.ok) return id.state;
  const parsed = parseForm(contractSchema, formData);
  if (!parsed.ok) return parsed.state;
  const invalid = await checkReferences(parsed.data, formData);
  if (invalid) return invalid;

  const contract = await updateContract(id.data.id, parsed.data);
  if (!contract) return actionError("Este contrato não existe mais.");
  await logAudit({ user, action: "update", entity: "contract", entityId: contract.id, summary: "Editou um contrato" });
  await flashToast("Contrato atualizado.");
  redirect(`/painel/contratos/${contract.id}`);
}

const statusSchema = z.object({ id: f.id("Contrato inválido."), status: z.enum(CONTRACT_STATUSES, { error: "Selecione um status." }) });

export async function updateContractStatusAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = parseForm(statusSchema, formData);
  if (!parsed.ok) return parsed.state;
  const contract = await setContractStatus(parsed.data.id, parsed.data.status);
  if (!contract) return actionError("Este contrato não existe mais.");
  await logAudit({ user, action: "status", entity: "contract", entityId: contract.id, summary: `Status do contrato: ${CONTRACT_STATUS_LABELS[contract.status]}` });
  refresh();
  return actionOk("Status atualizado.");
}

export async function deleteContractAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = parseForm(idSchema, formData);
  if (!parsed.ok) return parsed.state;
  const deleted = await deleteContract(parsed.data.id);
  if (deleted) await logAudit({ user, action: "delete", entity: "contract", entityId: deleted.id, summary: "Excluiu um contrato" });
  await flashToast("Contrato excluído.");
  redirect("/painel/contratos");
}

// --------------------------------------------------------------------- modelos
export async function createTemplateAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = parseForm(templateSchema, formData);
  if (!parsed.ok) return parsed.state;
  const template = await createTemplate(parsed.data);
  await logAudit({ user, action: "create", entity: "contract_template", entityId: template.id, summary: "Criou um modelo de contrato" });
  await flashToast("Modelo criado.");
  redirect("/painel/contratos/modelos");
}

export async function updateTemplateAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const id = parseForm(idSchema, formData);
  if (!id.ok) return id.state;
  const parsed = parseForm(templateSchema, formData);
  if (!parsed.ok) return parsed.state;
  const template = await updateTemplate(id.data.id, parsed.data);
  if (!template) return actionError("Este modelo não existe mais.");
  await logAudit({ user, action: "update", entity: "contract_template", entityId: template.id, summary: "Editou um modelo de contrato" });
  await flashToast("Modelo atualizado.");
  redirect("/painel/contratos/modelos");
}

export async function deleteTemplateAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = parseForm(idSchema, formData);
  if (!parsed.ok) return parsed.state;
  const deleted = await deleteTemplate(parsed.data.id);
  if (deleted) await logAudit({ user, action: "delete", entity: "contract_template", entityId: deleted.id, summary: "Excluiu um modelo de contrato" });
  await flashToast("Modelo excluído.");
  redirect("/painel/contratos/modelos");
}
