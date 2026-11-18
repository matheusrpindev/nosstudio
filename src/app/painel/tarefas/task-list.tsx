"use client";

import { ChevronDown } from "lucide-react";
import { startTransition, useOptimistic } from "react";
import { Card, CardHeader } from "@/components/ui/card";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import type { ISODate } from "@/lib/dates";
import type { TaskGroup, TaskView } from "@/server/tasks/logic";
import { setTaskDoneAction } from "./actions";
import { TaskRow, type TaskOptions } from "./task-row";

type Props = {
  groups: TaskGroup[];
  recentDone: TaskView[];
  today: ISODate;
  options: TaskOptions;
};

/**
 * Grupos de tarefas em aberto + "Concluídas recentemente". Marcar/desmarcar é otimista: a caixa muda na hora e,
 * se o servidor recusar, volta sozinha (o `useOptimistic` descarta o palpite) com um aviso.
 */
export function TaskList({ groups, recentDone, today, options }: Props) {
  const [overrides, setOverride] = useOptimistic<
    Record<number, boolean>,
    { id: number; done: boolean }
  >({}, (current, change) => ({ ...current, [change.id]: change.done }));

  function toggle(task: TaskView, done: boolean) {
    startTransition(async () => {
      setOverride({ id: task.id, done });
      try {
        const result = await setTaskDoneAction(task.id, done);
        if (!result.ok)
          toast.error(result.message ?? "Não foi possível atualizar a tarefa.");
      } catch {
        toast.error(
          "Não foi possível atualizar a tarefa. Confira a conexão e tente de novo.",
        );
      }
    });
  }
  const isDone = (task: TaskView) => overrides[task.id] ?? task.done;

  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <Card
          key={group.key}
          as="section"
          aria-labelledby={`grupo-${group.key}`}
          flush
          className={cn(group.key === "atrasadas" && "border-perigo/40")}
        >
          <CardHeader
            id={`grupo-${group.key}`}
            as="h2"
            title={
              <span className={cn(group.key === "atrasadas" && "text-perigo")}>
                {group.label}{" "}
                <span className="text-cinza font-semibold">
                  ({group.tasks.length})
                </span>
              </span>
            }
          />
          <ul className="divide-areia divide-y px-2 pb-2 sm:px-3">
            {group.tasks.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                today={today}
                done={isDone(task)}
                onToggle={toggle}
                options={options}
              />
            ))}
          </ul>
        </Card>
      ))}

      {recentDone.length > 0 ? (
        <details className="card group/concluidas">
          <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-2 px-4 py-2 text-sm font-bold text-grafite sm:px-5 [&::-webkit-details-marker]:hidden">
            <span>
              Concluídas recentemente{" "}
              <span className="text-cinza font-semibold">
                ({recentDone.length})
              </span>
            </span>
            <ChevronDown
              aria-hidden="true"
              className="text-cinza size-5 transition-transform group-open/concluidas:rotate-180"
            />
          </summary>
          <ul className="divide-areia border-areia divide-y border-t px-2 pb-2 sm:px-3">
            {recentDone.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                today={today}
                done={isDone(task)}
                onToggle={toggle}
                options={options}
                completedList
              />
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}
