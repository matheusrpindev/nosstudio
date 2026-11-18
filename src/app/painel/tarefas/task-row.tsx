"use client";

import { AlertTriangle, Flag, Pencil, Trash2, Undo2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { IconButton } from "@/components/ui/button";
import { ConfirmDialog, Dialog } from "@/components/ui/dialog";
import {
  ActionForm,
  Field,
  FieldRow,
  FormActions,
  SubmitButton,
} from "@/components/ui/form";
import { DateInput, Input, Select, Textarea } from "@/components/ui/input";
import { cn } from "@/lib/cn";
import { formatDate, formatRelativeDay, type ISODate } from "@/lib/dates";
import { TASK_PRIORITY_LABELS } from "@/lib/domain";
import type { Option } from "@/server/options";
import { overdueDays, overdueLabel, type TaskView } from "@/server/tasks/logic";
import { deleteTaskAction, updateTaskAction } from "./actions";

export type TaskOptions = {
  clients: Option[];
  projects: Option[];
  users: Option[];
};

type Props = {
  task: TaskView;
  today: ISODate;
  /** Estado de "concluída" a exibir (pode estar à frente do servidor: atualização otimista). */
  done: boolean;
  onToggle: (task: TaskView, done: boolean) => void;
  options: TaskOptions;
  /** Na lista de concluídas o botão de editar some e aparece "Desfazer". */
  completedList?: boolean;
};

/** Uma tarefa: caixa de concluir (alvo de 44px), título, selos de prazo/prioridade, ligações e ações. */
export function TaskRow({
  task,
  today,
  done,
  onToggle,
  options,
  completedList,
}: Props) {
  const [editing, setEditing] = useState(false);
  const late = overdueDays({ dueDate: task.dueDate, done }, today);
  const high = task.priority === "alta" && !done;

  return (
    <li
      className={cn(
        "flex items-start gap-1 border-l-4 border-transparent py-1.5 pr-1",
        late > 0 && "border-perigo",
        high && late === 0 && "border-alerta",
      )}
    >
      <label className="flex size-11 shrink-0 cursor-pointer items-center justify-center">
        <input
          type="checkbox"
          checked={done}
          onChange={(event) => onToggle(task, event.currentTarget.checked)}
          aria-label={
            done
              ? `Reabrir a tarefa: ${task.title}`
              : `Concluir a tarefa: ${task.title}`
          }
          className="checkbox size-6 rounded-md"
        />
      </label>
      <div className="min-w-0 flex-1 py-2">
        <p
          className={cn(
            "text-[0.9375rem] leading-snug font-semibold break-words",
            done ? "text-cinza line-through" : "text-grafite",
          )}
        >
          {task.title}
        </p>
        <div className="text-cinza mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-[0.8125rem]">
          {late > 0 ? (
            <Badge tone="perigo">
              <AlertTriangle aria-hidden="true" className="size-3.5" />
              {overdueLabel(late)}
            </Badge>
          ) : null}
          {high ? (
            <Badge tone="alerta">
              <Flag aria-hidden="true" className="size-3.5" />
              Prioridade alta
            </Badge>
          ) : null}
          {task.dueDate && late === 0 ? (
            <span>
              <span className="sr-only">Prazo: </span>
              {formatRelativeDay(task.dueDate, today)}
            </span>
          ) : null}
          {task.dueDate && late > 0 ? (
            <span>
              <span className="sr-only">Prazo: </span>
              {formatDate(task.dueDate)}
            </span>
          ) : null}
          {task.ownerName ? <span>{task.ownerName}</span> : null}
          {task.clientId && task.clientName ? (
            <Link
              href={`/painel/clientes/${task.clientId}`}
              className="link text-[0.8125rem]"
            >
              {task.clientName}
            </Link>
          ) : null}
          {task.projectId && task.projectTitle ? (
            <Link
              href={`/painel/projetos/${task.projectId}`}
              className="link text-[0.8125rem]"
            >
              {task.projectTitle}
            </Link>
          ) : null}
        </div>
        {task.description.trim() ? (
          <p className="text-cinza mt-1.5 text-[0.8125rem] leading-snug break-words whitespace-pre-line">
            {task.description}
          </p>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center">
        {completedList ? (
          <IconButton
            aria-label={`Desfazer: reabrir a tarefa ${task.title}`}
            onClick={() => onToggle(task, false)}
          >
            <Undo2 />
          </IconButton>
        ) : (
          <Dialog
            open={editing}
            onOpenChange={setEditing}
            title="Editar tarefa"
            trigger={
              <IconButton aria-label={`Editar a tarefa: ${task.title}`}>
                <Pencil />
              </IconButton>
            }
          >
            <ActionForm
              action={updateTaskAction}
              hidden={{ id: task.id }}
              onSuccess={() => setEditing(false)}
            >
              <Field name="title" label="Tarefa" required>
                <Input
                  autoComplete="off"
                  maxLength={160}
                  defaultValue={task.title}
                />
              </Field>
              <Field name="description" label="Detalhes" optional>
                <Textarea
                  rows={3}
                  maxLength={4000}
                  defaultValue={task.description}
                />
              </Field>
              <FieldRow>
                <Field name="dueDate" label="Prazo" optional>
                  <DateInput defaultValue={task.dueDate ?? ""} />
                </Field>
                <Field name="priority" label="Prioridade" required>
                  <Select
                    options={TASK_PRIORITY_LABELS}
                    defaultValue={task.priority}
                  />
                </Field>
              </FieldRow>
              <Field name="ownerId" label="Responsável" optional>
                <Select
                  options={options.users}
                  placeholder="Ninguém"
                  defaultValue={task.ownerId ?? ""}
                />
              </Field>
              <FieldRow>
                <Field name="clientId" label="Cliente" optional>
                  <Select
                    options={options.clients}
                    placeholder="Nenhum"
                    defaultValue={task.clientId ?? ""}
                  />
                </Field>
                <Field name="projectId" label="Projeto" optional>
                  <Select
                    options={options.projects}
                    placeholder="Nenhum"
                    defaultValue={task.projectId ?? ""}
                  />
                </Field>
              </FieldRow>
              <FormActions>
                <SubmitButton pendingLabel="Salvando…">
                  Salvar tarefa
                </SubmitButton>
              </FormActions>
            </ActionForm>
          </Dialog>
        )}
        <ConfirmDialog
          trigger={
            <IconButton
              aria-label={`Excluir a tarefa: ${task.title}`}
              className="text-perigo hover:bg-perigo-claro"
            >
              <Trash2 />
            </IconButton>
          }
          title="Excluir esta tarefa?"
          description={
            <>
              <strong className="text-grafite">{task.title}</strong> será
              apagada e não dá para desfazer.
            </>
          }
          confirmLabel="Excluir tarefa"
          action={deleteTaskAction}
          hidden={{ id: task.id }}
        />
      </div>
    </li>
  );
}
