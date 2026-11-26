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
import { canEverywhere } from "@/lib/auth";
import { todayISO } from "@/lib/dates";
import {
  getClientOptions,
  getProjectOptions,
  getUserOptions,
} from "@/server/options";
import { moduleScope, requireScopedPermission } from "@/server/access";
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
  // Quem vê o módulo inteiro (sócios, gestor) vê tudo; o funcionário, só as tarefas dos projetos em que está.
  const { user, scope } = await requireScopedPermission("tarefas", "ver");
  const restricted = scope !== "todos";
  const params = await searchParams;
  const today = todayISO();
  const [editScope, userOptions, clientOptions, projects] = await Promise.all([
    moduleScope(user, "tarefas", "editar"),
    getUserOptions(),
    getClientOptions(),
    getProjectOptions(null, scope),
  ]);
  // Quem só vê os próprios projetos não recebe a lista de clientes nem a da equipe inteira.
  const users = restricted ? [{ value: user.id, label: user.name }] : userOptions;
  const clients = restricted || !canEverywhere(user, "clientes", "ver") ? [] : clientOptions;
  const editableProjects = editScope === "todos" ? projects : projects.filter((option) => editScope.includes(option.value));
  const canCreate = editScope === "todos" || editableProjects.length > 0;

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
    listTasks({ ownerId, clientId, projectId }, scope),
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
        description={
          restricted
            ? "As tarefas dos projetos em que você está, por prazo. Marque a caixa para concluir; a tarefa fica em “Concluídas recentemente” por 14 dias, caso precise desfazer."
            : "O que precisa ser feito, por prazo. Marque a caixa para concluir; a tarefa fica em “Concluídas recentemente” por 14 dias, caso precise desfazer."
        }
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

      {canCreate ? (
        <Card as="section" aria-labelledby="nova-tarefa-titulo" className="mb-4">
          <h2 id="nova-tarefa-titulo" className="sr-only">
            Adicionar tarefa
          </h2>
          <ActionForm
            action={createTaskAction}
            hidden={restricted ? undefined : { clientId, projectId }}
            resetOnSuccess
            className={
              restricted
                ? "grid grid-cols-2 gap-3 space-y-0 lg:grid-cols-[minmax(0,1fr)_13rem_10.5rem_11rem_auto] lg:items-end"
                : "grid grid-cols-2 gap-3 space-y-0 sm:grid-cols-[minmax(0,1fr)_10.5rem_11rem_auto] sm:items-end"
            }
          >
            <Field
              name="title"
              label="Nova tarefa"
              required
              className={restricted ? "col-span-2 lg:col-span-1" : "col-span-2 sm:col-span-1"}
            >
              <Input
                autoComplete="off"
                maxLength={160}
                placeholder="Ex.: Enviar o roteiro para a Ana"
              />
            </Field>
            {restricted ? (
              <Field name="projectId" label="Projeto" required className="col-span-2 lg:col-span-1">
                <Select
                  options={editableProjects}
                  defaultValue={editableProjects.some((option) => option.value === projectId) ? projectId : editableProjects[0]?.value}
                />
              </Field>
            ) : null}
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
              className={restricted ? "col-span-2 lg:col-span-1" : "col-span-2 sm:col-span-1"}
              icon={<Plus />}
              pendingLabel="Adicionando…"
            >
              Adicionar
            </SubmitButton>
          </ActionForm>
        </Card>
      ) : null}

      <FilterBar
        search={false}
        preserve={["cliente", "projeto"]}
        filters={
          restricted
            ? []
            : [
                {
                  name: "responsavel",
                  label: "Responsável",
                  options: users,
                  allLabel: "Toda a equipe",
                },
              ]
        }
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
              : restricted
                ? "Quando houver tarefas nos projetos em que você está, elas aparecem aqui, por prazo."
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
              description={canCreate ? "Não há tarefas em aberto. Adicione uma nova acima quando surgir algo." : "Não há tarefas em aberto."}
              className="mb-4"
            />
          ) : null}
          <TaskList
            groups={groups}
            recentDone={recentDone}
            today={today}
            options={{
              clients,
              projects: restricted ? editableProjects : projects,
              users,
              restricted,
              editableProjects: editScope === "todos" ? "todos" : editScope,
              canDelete: canEverywhere(user, "tarefas", "excluir"),
              linkClients: canEverywhere(user, "clientes", "ver"),
            }}
          />
        </>
      )}
    </>
  );
}
