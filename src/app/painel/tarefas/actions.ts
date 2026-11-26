"use server";

/** Server Actions das Tarefas: adicionar rápido, editar, concluir/reabrir e excluir. */
import { refresh } from "next/cache";
import { z } from "zod";
import { actionError, actionOk, type ActionState } from "@/lib/action-state";
import { logAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/auth";
import { TASK_PRIORITIES } from "@/lib/domain";
import { f, formToObject, parseForm, parseInput } from "@/server/action";
import {
  checkTaskRefs,
  createTask,
  deleteTask,
  setTaskDone,
  updateTask,
} from "@/server/tasks/admin";

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
  const user = await requirePermission("tarefas", "editar");
  const parsed = parseForm(quickSchema, formData);
  if (!parsed.ok) return parsed.state;
  const input = {
    ...parsed.data,
    description: "",
    priority: "normal" as const,
  };
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
  const user = await requirePermission("tarefas", "editar");
  const parsed = parseForm(editSchema, formData);
  if (!parsed.ok) return parsed.state;
  const { id, ...input } = parsed.data;
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
  const user = await requirePermission("tarefas", "editar");
  const parsed = parseInput(
    z.object({ id: f.id("Tarefa inválida."), done: z.boolean() }),
    { id: taskId, done },
  );
  if (!parsed.ok) return parsed.state;
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
