import { CheckCheck, ListChecks, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Alert } from "@/components/ui/alert";
import { buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterBar } from "@/components/ui/filter-bar";
import { ActionForm, Field, SubmitButton } from "@/components/ui/form";
import { DateInput, Input, Select } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { paramId, type PageSearchParams } from "@/components/ui/search-params";
import { requireUser } from "@/lib/auth";
import { todayISO } from "@/lib/dates";
import {
  getClientOptions,
  getProjectOptions,
  getUserOptions,
} from "@/server/options";
import { getClientName, getProjectInfo, listTasks } from "@/server/tasks/admin";
import { groupTasks } from "@/server/tasks/logic";
import { createTaskAction } from "./actions";
import { TaskList } from "./task-list";

export const metadata: Metadata = { title: "Tarefas" };
export const instant = false;

export default async function TasksPage({
  searchParams,
}: {
  searchParams: PageSearchParams;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const today = todayISO();
  const [users, clients, projects] = await Promise.all([
    getUserOptions(),
    getClientOptions(),
    getProjectOptions(),
  ]);

  // a URL é entrada do usuário: só valem ids que existem
  const ownerParam = paramId(params.responsavel);
  const ownerId = users.some((option) => option.value === ownerParam)
    ? ownerParam
    : undefined;
  const clientParam = paramId(params.cliente);
  const projectParam = paramId(params.projeto);
  const clientId = clients.some((option) => option.value === clientParam)
    ? clientParam
    : undefined;
  const projectId = projects.some((option) => option.value === projectParam)
    ? projectParam
    : undefined;

  const [{ open, recentDone }, clientName, projectInfo] = await Promise.all([
    listTasks({ ownerId, clientId, projectId }),
    clientId ? getClientName(clientId) : null,
    projectId ? getProjectInfo(projectId) : null,
  ]);
  const groups = groupTasks(open, today);

  // Filtros de contexto (?cliente=, ?projeto=) seguem nos links e no formulário de filtro.
  const context = new URLSearchParams();
  if (clientId) context.set("cliente", String(clientId));
  if (projectId) context.set("projeto", String(projectId));
  const withOwner = (id?: number) => {
    const query = new URLSearchParams(context);
    if (id) query.set("responsavel", String(id));
    return `/painel/tarefas${query.size > 0 ? `?${query}` : ""}`;
  };
  const mine = ownerId === user.id;
  const everyone = ownerId === undefined;
  const filtered = Boolean(ownerId || clientId || projectId);
  const quickOwner = ownerId ?? user.id;

  return (
    <>
      <PageHeader
        title="Tarefas"
        description="O que precisa ser feito, por prazo. Marque a caixa para concluir; a tarefa fica em “Concluídas recentemente” por 14 dias, caso precise desfazer."
      />

      {clientId || projectId ? (
        <Alert
          tone="info"
          className="mb-4"
          action={
            <Link href="/painel/tarefas" className="link">
              Ver todas as tarefas
            </Link>
          }
        >
          Mostrando só as tarefas{" "}
          {projectInfo ? (
            <>
              do projeto <strong>{projectInfo.title}</strong>
            </>
          ) : (
            <>
              do cliente <strong>{clientName ?? "selecionado"}</strong>
            </>
          )}
          .
        </Alert>
      ) : null}

      <Card as="section" aria-labelledby="nova-tarefa-titulo" className="mb-4">
        <h2 id="nova-tarefa-titulo" className="sr-only">
          Adicionar tarefa
        </h2>
        <ActionForm
          action={createTaskAction}
          hidden={{ clientId, projectId }}
          resetOnSuccess
          className="grid grid-cols-2 gap-3 space-y-0 sm:grid-cols-[minmax(0,1fr)_10.5rem_11rem_auto] sm:items-end"
        >
          <Field
            name="title"
            label="Nova tarefa"
            required
            className="col-span-2 sm:col-span-1"
          >
            <Input
              autoComplete="off"
              maxLength={160}
              placeholder="Ex.: Enviar o roteiro para a Ana"
            />
          </Field>
          <Field name="dueDate" label="Prazo">
            <DateInput />
          </Field>
          <Field name="ownerId" label="Responsável">
            <Select
              options={users}
              placeholder="Ninguém"
              defaultValue={quickOwner}
            />
          </Field>
          <SubmitButton
            className="col-span-2 sm:col-span-1"
            icon={<Plus />}
            pendingLabel="Adicionando…"
          >
            Adicionar
          </SubmitButton>
        </ActionForm>
      </Card>

      <FilterBar
        search={false}
        preserve={["cliente", "projeto"]}
        filters={[
          {
            name: "responsavel",
            label: "Responsável",
            options: users,
            allLabel: "Toda a equipe",
          },
        ]}
      >
        <nav aria-label="Quais tarefas mostrar" className="flex gap-2">
          <Link
            href={withOwner()}
            aria-current={everyone ? "true" : undefined}
            className={buttonClasses({
              variant: everyone ? "primary" : "secondary",
            })}
          >
            Todas
          </Link>
          <Link
            href={withOwner(user.id)}
            aria-current={mine ? "true" : undefined}
            className={buttonClasses({
              variant: mine ? "primary" : "secondary",
            })}
          >
            Minhas
          </Link>
        </nav>
      </FilterBar>

      {groups.length === 0 && recentDone.length === 0 ? (
        <EmptyState
          icon={filtered ? <ListChecks /> : <CheckCheck />}
          title={
            filtered
              ? "Nenhuma tarefa com esses filtros"
              : "Nenhuma tarefa por enquanto"
          }
          description={
            filtered
              ? "Experimente ver todas as tarefas ou escolher outro responsável."
              : "Anote acima o que precisa ser feito, com prazo e responsável. As tarefas aparecem aqui, por prazo."
          }
          action={
            filtered ? (
              <Link
                href="/painel/tarefas"
                className={buttonClasses({ variant: "secondary" })}
              >
                Ver todas as tarefas
              </Link>
            ) : undefined
          }
        />
      ) : (
        <>
          {groups.length === 0 ? (
            <EmptyState
              variant="card"
              icon={<CheckCheck />}
              title="Tudo em dia"
              description="Não há tarefas em aberto. Adicione uma nova acima quando surgir algo."
              className="mb-4"
            />
          ) : null}
          <TaskList
            groups={groups}
            recentDone={recentDone}
            today={today}
            options={{ clients, projects, users }}
          />
        </>
      )}
    </>
  );
}
