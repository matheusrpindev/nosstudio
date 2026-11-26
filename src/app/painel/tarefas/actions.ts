"use server";

/**
 * Server Actions das Tarefas: adicionar rápido, editar, concluir/reabrir e excluir.
 *
 * ACESSO: `requireScopedPermission("tarefas", "editar")` deixa passar quem edita o módulo inteiro (sócios,
 * gestor) e quem edita só "nos projetos em que está" (funcionário), e devolve o ESCOPO. Para o escopo restrito,
 * cada ação confere o projeto da tarefa LIDO DO BANCO (`getTaskRefs`) — e o projeto de destino, quando muda —
 * antes de gravar. Tarefa de projeto alheio, inexistente ou sem projeto: mesma resposta ("sem permissão").
 * Excluir exige o módulo inteiro.
 */
import { refresh } from "next/cache";
import { z } from "zod";
import { actionError, actionOk, type ActionState } from "@/lib/action-state";
import { logAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/auth";
import { TASK_PRIORITIES } from "@/lib/domain";
import { requireScopedPermission, scopeAllows, type IdScope } from "@/server/access";
import { f, formToObject, parseForm, parseInput } from "@/server/action";
import {
  checkTaskRefs,
  createTask,
  deleteTask,
  getProjectInfo,
  getTaskRefs,
  setTaskDone,
  updateTask,
} from "@/server/tasks/admin";

const DENIED = "Você não tem permissão para alterar tarefas deste projeto.";

/**
 * Regras de quem edita só nos próprios projetos (escopo ≠ "todos"), aplicadas ao que veio do formulário:
 * - a tarefa precisa estar num projeto em que a pessoa pode editar;
 * - o cliente não vem do formulário: é o do projeto (ela não escolhe clientes);
 * - o responsável só pode ser ela mesma, ninguém, ou quem já era (`keepOwnerId`).
 * Devolve os vínculos corrigidos ou a mensagem de erro.
 */
async function restrictedRefs(
  scope: IdScope,
  userId: number,
  input: { projectId: number | null; ownerId: number | null },
  keepOwnerId: number | null = null,
): Promise<{ ok: true; projectId: number; clientId: number | null; ownerId: number | null } | { ok: false; message: string }> {
  if (!scopeAllows(scope, input.projectId) || input.projectId === null) return { ok: false, message: DENIED };
  if (input.ownerId !== null && input.ownerId !== userId && input.ownerId !== keepOwnerId) {
    return { ok: false, message: "Você só pode deixar a tarefa com você mesmo(a) ou sem responsável." };
  }
  const project = await getProjectInfo(input.projectId);
  if (!project) return { ok: false, message: DENIED };
  return { ok: true, projectId: input.projectId, clientId: project.clientId, ownerId: input.ownerId };
}

/** O que a pessoa digitou, para repopular o formulário quando o erro não vem da validação do zod. */
function typedValues(formData: FormData): Record<string, string> {
  return Object.fromEntries(
    Object.entries(formToObject(formData)).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  );
}

// ---------------------------------------------------------------- adicionar rápido
const quickSchema = z.object({
  title: f.text(160, "Escreva a tarefa."),
  dueDate: f.optionalDate(),
  ownerId: f.optionalId(),
  clientId: f.optionalId(),
  projectId: f.optionalId(),
});

export async function createTaskAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { user, scope } = await requireScopedPermission("tarefas", "editar");
  const parsed = parseForm(quickSchema, formData);
  if (!parsed.ok) return parsed.state;
  const input = {
    ...parsed.data,
    description: "",
    priority: "normal" as const,
  };
  if (scope !== "todos") {
    const refs = await restrictedRefs(scope, user.id, input);
    if (!refs.ok) return actionError(refs.message, { values: typedValues(formData) });
    Object.assign(input, { projectId: refs.projectId, clientId: refs.clientId, ownerId: refs.ownerId });
  }
  const refsError = await checkTaskRefs(input);
  if (refsError)
    return actionError(refsError, { values: typedValues(formData) });

  const task = await createTask(input);
  await logAudit({
    user,
    action: "create",
    entity: "task",
    entityId: task.id,
    summary: "Criou uma tarefa",
  });
  refresh();
  return actionOk("Tarefa adicionada.");
}

// ------------------------------------------------------------------------- editar
const editSchema = z.object({
  id: f.id("Tarefa inválida."),
  title: f.text(160, "Escreva a tarefa."),
  description: f.optionalText(4000),
  dueDate: f.optionalDate(),
  ownerId: f.optionalId(),
  priority: z.enum(TASK_PRIORITIES, { error: "Selecione a prioridade." }),
  clientId: f.optionalId(),
  projectId: f.optionalId(),
});

export async function updateTaskAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { user, scope } = await requireScopedPermission("tarefas", "editar");
  const parsed = parseForm(editSchema, formData);
  if (!parsed.ok) return parsed.state;
  const { id, ...input } = parsed.data;
  if (scope !== "todos") {
    // a tarefa como está no banco precisa ser de um projeto da pessoa — e o projeto de destino também
    const current = await getTaskRefs(id);
    if (!current || !scopeAllows(scope, current.projectId)) return actionError(DENIED);
    const refs = await restrictedRefs(scope, user.id, input, current.ownerId);
    if (!refs.ok) return actionError(refs.message, { values: typedValues(formData) });
    Object.assign(input, { projectId: refs.projectId, clientId: refs.clientId, ownerId: refs.ownerId });
  }
  const refsError = await checkTaskRefs(input);
  if (refsError)
    return actionError(refsError, { values: typedValues(formData) });

  const task = await updateTask(id, input);
  if (!task) return actionError("Esta tarefa não existe mais.");
  await logAudit({
    user,
    action: "update",
    entity: "task",
    entityId: task.id,
    summary: "Editou uma tarefa",
  });
  refresh();
  return actionOk("Tarefa salva.");
}

// ------------------------------------------------------------- concluir / reabrir
/** Chamada direto pelo cliente (checkbox com atualização otimista): recebe valores simples e valida do mesmo jeito. */
export async function setTaskDoneAction(
  taskId: number,
  done: boolean,
): Promise<ActionState> {
  const { user, scope } = await requireScopedPermission("tarefas", "editar");
  const parsed = parseInput(
    z.object({ id: f.id("Tarefa inválida."), done: z.boolean() }),
    { id: taskId, done },
  );
  if (!parsed.ok) return parsed.state;
  if (scope !== "todos") {
    const current = await getTaskRefs(parsed.data.id);
    if (!current || !scopeAllows(scope, current.projectId)) return actionError(DENIED);
  }
  const task = await setTaskDone(parsed.data.id, parsed.data.done);
  if (!task) return actionError("Esta tarefa não existe mais.");
  await logAudit({
    user,
    action: "status",
    entity: "task",
    entityId: task.id,
    summary: parsed.data.done ? "Concluiu uma tarefa" : "Reabriu uma tarefa",
  });
  refresh();
  return actionOk();
}

// -------------------------------------------------------------------------- excluir
export async function deleteTaskAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requirePermission("tarefas", "excluir");
  const parsed = parseForm(
    z.object({ id: f.id("Tarefa inválida.") }),
    formData,
  );
  if (!parsed.ok) return parsed.state;
  const deleted = await deleteTask(parsed.data.id);
  if (deleted)
    await logAudit({
      user,
      action: "delete",
      entity: "task",
      entityId: deleted.id,
      summary: "Excluiu uma tarefa",
    });
  refresh();
  return actionOk("Tarefa excluída.");
}
