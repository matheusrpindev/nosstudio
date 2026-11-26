"use server";

/**
 * Server Actions do módulo de Projetos (padrão do módulo de Leads: guarda → zod → mutação → logAudit → refresh/redirect).
 *
 * ACESSO: criar, editar o cadastro completo e excluir exigem o módulo inteiro (`requirePermission`). O que se faz
 * NO ANDAMENTO de um projeto — etapa, checklist, tarefa rápida — também vale para quem só tem a permissão "nos
 * projetos em que está" (funcionário): `requireScopedPermission` devolve o escopo e cada ação confere se o
 * projeto está nele (`scopeAllows`) antes de gravar. Projeto alheio e inexistente respondem igual.
 */
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { flashToast } from "@/components/ui/flash";
import { actionError, actionOk, type ActionState } from "@/lib/action-state";
import { logAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/auth";
import { todayISO } from "@/lib/dates";
import { BACKUP_STATUSES, CLIENT_STATUS_LABELS, PROJECT_STAGE_LABELS, PROJECT_STAGES, SERVICE_INTERESTS } from "@/lib/domain";
import { safeUrl } from "@/lib/format";
import { requireScopedPermission, scopeAllows } from "@/server/access";
import { listProjectMemberCandidates, listProjectMembers, removeProjectMember, setProjectMember } from "@/server/access/members";
import { f, formToObject, jsonField, parseForm, parseInput } from "@/server/action";
import {
  addChecklistItem,
  addProjectTask,
  checkProjectRefs,
  createProject,
  deleteProject,
  getProject,
  removeChecklistItem,
  setProjectStage,
  toggleChecklistItem,
  updateProject,
} from "@/server/projects/admin";
import { funnelAdvanceNotice } from "@/server/proposals/funnel-logic";

const MAX_CHECKLIST_ITEMS = 100;
const DENIED = "Você não tem permissão para alterar este projeto.";

// ------------------------------------------------------------ cadastro/edição
/** Link opcional: vazio vira ""; preenchido precisa ser http(s) (sem protocolo, assume https) e é gravado normalizado. */
const optionalUrl = () =>
  z
    .string()
    .trim()
    .max(500, "Máximo de 500 caracteres.")
    .optional()
    .transform((v) => v ?? "")
    .refine((v) => v === "" || safeUrl(v) !== "", "Informe um link válido, começando com https://.")
    .transform((v) => (v ? safeUrl(v) : ""));

const extraLinksSchema = z
  .array(z.object({ label: z.string().trim().max(60, "O nome do link tem no máximo 60 caracteres."), url: z.string().trim().max(500) }))
  .max(15, "No máximo 15 links extras.")
  .superRefine((items, ctx) => {
    items.forEach((item, index) => {
      if (!item.label) ctx.addIssue({ code: "custom", message: `Link extra ${index + 1}: informe um nome (ex.: "Making of").` });
      else if (!safeUrl(item.url)) ctx.addIssue({ code: "custom", message: `Link extra ${index + 1}: informe um endereço válido, começando com https://.` });
    });
  })
  .transform((items) => items.map((item) => ({ label: item.label, url: safeUrl(item.url) })));

const projectSchema = z.object({
  title: f.text(160, "Informe o nome do projeto."),
  clientId: f.optionalId(),
  proposalId: f.optionalId(),
  serviceType: z.enum(SERVICE_INTERESTS, { error: "Selecione o tipo de serviço." }),
  stage: z.enum(PROJECT_STAGES, { error: "Selecione a etapa." }),
  ownerId: f.optionalId(),
  location: f.optionalText(200),
  eventDate: f.optionalDate(),
  shootDeadline: f.optionalDate(),
  deliveryDeadline: f.optionalDate(),
  deliveredAt: f.optionalDate(),
  driveUrl: optionalUrl(),
  galleryUrl: optionalUrl(),
  referencesUrl: optionalUrl(),
  finalFilesUrl: optionalUrl(),
  links: extraLinksSchema,
  backupStatus: z.enum(BACKUP_STATUSES, { error: "Selecione a situação do backup." }),
  backupNote: f.optionalText(500),
  notes: f.optionalText(5000),
});

function parseProjectForm(formData: FormData) {
  const object: Record<string, unknown> = formToObject(formData);
  // itens totalmente vazios (linha adicionada e não preenchida) são descartados
  const rawLinks = jsonField(formData, "links");
  object.links = Array.isArray(rawLinks)
    ? rawLinks
        .filter((item): item is { label?: string; url?: string } => typeof item === "object" && item !== null)
        .map((item) => ({ label: String(item.label ?? ""), url: String(item.url ?? "") }))
        .filter((item) => item.label.trim() || item.url.trim())
    : [];
  const values: Record<string, string> = {};
  for (const [key, value] of Object.entries(object)) if (typeof value === "string") values[key] = value;
  return { parsed: parseInput(projectSchema, object, values), values };
}

export async function createProjectAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission("projetos", "editar");
  const { parsed, values } = parseProjectForm(formData);
  if (!parsed.ok) return parsed.state;

  const refErrors = await checkProjectRefs(parsed.data);
  if (Object.keys(refErrors).length > 0) {
    return actionError(refErrors._form ?? "Confira os campos destacados.", { fieldErrors: refErrors, values });
  }
  const { project, clientMoved } = await createProject(parsed.data, todayISO(), user.id);
  await logAudit({
    user,
    action: "create",
    entity: "project",
    entityId: project.id,
    summary: project.proposalId ? `Criou um projeto a partir da proposta #${project.proposalId}` : "Criou um projeto",
  });
  if (clientMoved) {
    await logAudit({
      user,
      action: "status",
      entity: "client",
      entityId: clientMoved.clientId,
      summary: `Status do cliente: ${CLIENT_STATUS_LABELS[clientMoved.from]} → ${CLIENT_STATUS_LABELS[clientMoved.to]} (automático, projeto #${project.id})`,
    });
  }
  await flashToast(clientMoved ? `Projeto criado. ${funnelAdvanceNotice(clientMoved.to)}` : "Projeto criado.");
  redirect(`/painel/projetos/${project.id}`);
}

const idField = z.object({ id: f.id("Projeto inválido.") });

export async function updateProjectAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission("projetos", "editar");
  const idParsed = parseForm(idField, formData);
  if (!idParsed.ok) return idParsed.state;
  const { parsed, values } = parseProjectForm(formData);
  if (!parsed.ok) return parsed.state;

  const { proposalId: _ignored, ...data } = parsed.data;
  void _ignored; // a proposta de origem não muda na edição
  const refErrors = await checkProjectRefs({ ...data, proposalId: null });
  if (Object.keys(refErrors).length > 0) {
    return actionError("Confira os campos destacados.", { fieldErrors: refErrors, values });
  }
  const project = await updateProject(idParsed.data.id, data, todayISO());
  if (!project) return actionError("Este projeto não existe mais.");
  await logAudit({ user, action: "update", entity: "project", entityId: project.id, summary: "Editou os dados do projeto" });
  await flashToast("Projeto salvo.");
  redirect(`/painel/projetos/${project.id}`);
}

// ---------------------------------------------------------------------- etapa
const stageSchema = z.object({ id: f.id("Projeto inválido."), stage: z.enum(PROJECT_STAGES, { error: "Selecione a etapa." }) });

/** Mudança de etapa pelo formulário do detalhe. */
export async function updateProjectStageAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { user, scope } = await requireScopedPermission("projetos", "editar");
  const parsed = parseForm(stageSchema, formData);
  if (!parsed.ok) return parsed.state;
  if (!scopeAllows(scope, parsed.data.id)) return actionError(DENIED);
  const project = await setProjectStage(parsed.data.id, parsed.data.stage, todayISO());
  if (!project) return actionError("Este projeto não existe mais.");
  await logAudit({ user, action: "status", entity: "project", entityId: project.id, summary: `Etapa do projeto: ${PROJECT_STAGE_LABELS[project.stage]}` });
  refresh();
  return actionOk("Etapa atualizada.");
}

/** Mudança de etapa pelo quadro (arrastar / "Mover para…"). Recebe os valores direto, não um formulário. */
export async function moveProjectAction(cardId: number, toColumnId: string): Promise<ActionState> {
  const { user, scope } = await requireScopedPermission("projetos", "editar");
  const parsed = parseInput(stageSchema, { id: cardId, stage: toColumnId });
  if (!parsed.ok) return parsed.state;
  if (!scopeAllows(scope, parsed.data.id)) return actionError(DENIED);
  const project = await setProjectStage(parsed.data.id, parsed.data.stage, todayISO());
  if (!project) return actionError("Este projeto não existe mais.");
  await logAudit({ user, action: "status", entity: "project", entityId: project.id, summary: `Moveu o projeto para ${PROJECT_STAGE_LABELS[project.stage]}` });
  refresh();
  return actionOk();
}

// ------------------------------------------------------------------ checklist
const checklistAddSchema = z.object({ id: f.id("Projeto inválido."), text: f.text(200, "Escreva o item do checklist.") });

export async function addChecklistItemAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { user, scope } = await requireScopedPermission("projetos", "editar");
  const parsed = parseForm(checklistAddSchema, formData);
  if (!parsed.ok) return parsed.state;
  if (!scopeAllows(scope, parsed.data.id)) return actionError(DENIED);
  const project = await getProject(parsed.data.id);
  if (!project) return actionError("Este projeto não existe mais.");
  if (project.checklist.length >= MAX_CHECKLIST_ITEMS) return actionError(`O checklist chegou ao limite de ${MAX_CHECKLIST_ITEMS} itens.`);
  await addChecklistItem(project.id, { id: crypto.randomUUID(), text: parsed.data.text, done: false });
  await logAudit({ user, action: "update", entity: "project", entityId: project.id, summary: "Adicionou item ao checklist" });
  refresh();
  return actionOk();
}

const checklistItemSchema = z.object({ projectId: f.id("Projeto inválido."), itemId: z.string().min(1).max(64), done: z.boolean() });

/** Marcar/desmarcar um item: grava na hora (chamada direta do cliente, com atualização otimista). */
export async function toggleChecklistItemAction(projectId: number, itemId: string, done: boolean): Promise<ActionState> {
  const { scope } = await requireScopedPermission("projetos", "editar");
  const parsed = parseInput(checklistItemSchema, { projectId, itemId, done });
  if (!parsed.ok) return actionError("Não foi possível atualizar o item.");
  if (!scopeAllows(scope, parsed.data.projectId)) return actionError(DENIED);
  if (!(await toggleChecklistItem(parsed.data.projectId, parsed.data.itemId, parsed.data.done))) return actionError("Este projeto não existe mais.");
  refresh();
  return actionOk();
}

export async function removeChecklistItemAction(projectId: number, itemId: string): Promise<ActionState> {
  const { user, scope } = await requireScopedPermission("projetos", "editar");
  const parsed = parseInput(checklistItemSchema.omit({ done: true }), { projectId, itemId });
  if (!parsed.ok) return actionError("Não foi possível remover o item.");
  if (!scopeAllows(scope, parsed.data.projectId)) return actionError(DENIED);
  if (!(await removeChecklistItem(parsed.data.projectId, parsed.data.itemId))) return actionError("Este projeto não existe mais.");
  await logAudit({ user, action: "update", entity: "project", entityId: parsed.data.projectId, summary: "Removeu item do checklist" });
  refresh();
  return actionOk();
}

// -------------------------------------------------------------- tarefa rápida
const quickTaskSchema = z.object({ id: f.id("Projeto inválido."), title: f.text(160, "Escreva a tarefa."), dueDate: f.optionalDate() });

export async function addProjectTaskAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { user, scope: projectScope } = await requireScopedPermission("projetos", "ver");
  const { scope: taskScope } = await requireScopedPermission("tarefas", "editar");
  const parsed = parseForm(quickTaskSchema, formData);
  if (!parsed.ok) return parsed.state;
  if (!scopeAllows(projectScope, parsed.data.id) || !scopeAllows(taskScope, parsed.data.id)) return actionError(DENIED);
  const project = await getProject(parsed.data.id);
  if (!project) return actionError("Este projeto não existe mais.");
  const task = await addProjectTask(project, { title: parsed.data.title, dueDate: parsed.data.dueDate, priority: "normal" }, user.id);
  await logAudit({ user, action: "create", entity: "task", entityId: task.id, summary: "Criou uma tarefa a partir do projeto" });
  refresh();
  return actionOk("Tarefa adicionada.");
}

// ---------------------------------------------------------- equipe do projeto
/*
 * Quem está na equipe de um projeto e o que cada pessoa pode nele (`project_members`). É gestão de EQUIPE:
 * exige "editar" em Equipe no módulo inteiro (sócios e gestor) — nunca vale por ser membro do projeto.
 * Só entram contas ativas de funcionário, freelancer ou gestor (`listProjectMemberCandidates`).
 */
const memberSchema = z.object({
  projectId: f.id("Projeto inválido."),
  userId: f.id("Escolha a pessoa."),
  role: f.optionalText(60),
  canView: f.checkbox(),
  canEdit: f.checkbox(),
  canDownload: f.checkbox(),
  canUpload: f.checkbox(),
});

const memberError = (error: "invalid" | "project_not_found" | "user_not_found" | "role_not_allowed") =>
  error === "project_not_found"
    ? "Este projeto não existe mais."
    : error === "user_not_found"
      ? "Esta conta não existe mais ou está desativada."
      : error === "role_not_allowed"
        ? "Só contas de funcionário, freelancer ou gestor entram na equipe de um projeto."
        : "Confira os campos destacados.";

/** Inclui alguém na equipe do projeto. */
export async function addProjectMemberAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission("equipe", "editar");
  const parsed = parseForm(memberSchema, formData);
  if (!parsed.ok) return parsed.state;
  const { projectId, userId, ...input } = parsed.data;
  // só perfis que trabalham por projeto, e só quem ainda não está na equipe (mudar o que alguém pode é outra ação)
  const candidates = await listProjectMemberCandidates(projectId);
  if (!candidates.some((candidate) => candidate.id === userId)) return actionError(memberError("role_not_allowed"), { fieldErrors: { userId: "Escolha uma pessoa da lista." } });
  const result = await setProjectMember(projectId, userId, input, user);
  if (!result.ok) return actionError(memberError(result.error));
  refresh();
  return actionOk("Pessoa incluída na equipe do projeto.");
}

/** Muda o papel e o que a pessoa pode neste projeto. */
export async function updateProjectMemberAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission("equipe", "editar");
  const parsed = parseForm(memberSchema, formData);
  if (!parsed.ok) return parsed.state;
  const { projectId, userId, ...input } = parsed.data;
  const members = await listProjectMembers(projectId);
  if (!members.some((member) => member.userId === userId)) return actionError("Esta pessoa não está mais na equipe deste projeto.");
  const result = await setProjectMember(projectId, userId, input, user);
  if (!result.ok) return actionError(memberError(result.error));
  refresh();
  return actionOk("Permissões da pessoa neste projeto atualizadas.");
}

/** Tira a pessoa do projeto: o acesso dela a ele acaba na hora. */
export async function removeProjectMemberAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission("equipe", "editar");
  const parsed = parseForm(memberSchema.pick({ projectId: true, userId: true }), formData);
  if (!parsed.ok) return parsed.state;
  await removeProjectMember(parsed.data.projectId, parsed.data.userId, user);
  refresh();
  return actionOk("Pessoa retirada do projeto. O acesso dela a este projeto acabou.");
}

// --------------------------------------------------------------------- excluir
export async function deleteProjectAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission("projetos", "excluir");
  const parsed = parseForm(idField, formData);
  if (!parsed.ok) return parsed.state;
  const deleted = await deleteProject(parsed.data.id);
  if (deleted) {
    await logAudit({
      user,
      action: "delete",
      entity: "project",
      entityId: deleted.id,
      summary: `Excluiu um projeto e ${deleted.deletedTasks} tarefa(s) dele`,
    });
  }
  await flashToast("Projeto excluído.");
  redirect("/painel/projetos");
}
