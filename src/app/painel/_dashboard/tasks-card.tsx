import { ListChecks } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import type { ISODate } from "@/lib/dates";
import { TASK_PRIORITY_LABELS } from "@/lib/domain";
import { describeDeadline, taskState } from "@/server/dashboard/logic";
import type { DashboardTask } from "@/server/dashboard/queries";

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

export function TasksCard({ tasks, total, today }: { tasks: DashboardTask[]; total: number; today: ISODate }) {
  return (
    <Card flush as="section" aria-labelledby="tarefas-titulo">
      <CardHeader
        id="tarefas-titulo"
        title="Tarefas importantes"
        description="Atrasadas, de hoje e de prioridade alta."
        action={
          <ButtonLink href="/painel/tarefas" variant="ghost" size="sm">
            Ver tarefas
          </ButtonLink>
        }
      />
      <div className="card-secao">
        {tasks.length === 0 ? (
          <EmptyState
            variant="plain"
            icon={<ListChecks />}
            title="Nada urgente nas tarefas"
            description="Nenhuma tarefa atrasada, para hoje ou de prioridade alta."
          />
        ) : (
          <>
            <ul className="divide-areia divide-y">
              {tasks.map((task) => {
                const state = taskState(task.dueDate, today);
                const context = task.projectTitle ?? task.clientName;
                return (
                  <li key={task.id}>
                    <Link
                      href={task.projectId ? `/painel/tarefas?projeto=${task.projectId}` : "/painel/tarefas"}
                      className="hover:bg-lavanda-claro/60 focus-visible:bg-lavanda-claro/60 -mx-2 flex min-h-11 items-start gap-3 rounded-campo px-2 py-2 transition-colors"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="text-grafite block text-[0.9375rem] leading-snug font-semibold break-words">{task.title}</span>
                        <span className="text-cinza mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.8125rem]">
                          {task.dueDate ? (
                            <span className={state === "atrasada" ? "text-perigo font-bold" : state === "hoje" ? "text-grafite font-bold" : undefined}>
                              {state === "hoje" ? "Para hoje" : capitalize(describeDeadline(task.dueDate, today, "prazo"))}
                            </span>
                          ) : (
                            <span>Sem prazo</span>
                          )}
                          {context ? <span className="break-words">· {context}</span> : null}
                        </span>
                      </span>
                      {task.priority === "alta" ? <Badge tone="alerta">{TASK_PRIORITY_LABELS.alta}</Badge> : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
            {total > tasks.length ? (
              <p className="text-cinza mt-3 text-sm">
                E mais {total - tasks.length} {total - tasks.length === 1 ? "tarefa" : "tarefas"} em{" "}
                <Link href="/painel/tarefas" className="link">
                  Tarefas
                </Link>
                .
              </p>
            ) : null}
          </>
        )}
      </div>
    </Card>
  );
}
