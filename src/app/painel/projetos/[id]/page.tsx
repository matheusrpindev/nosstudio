import { CalendarPlus, ExternalLink, FilePlus2, Pencil, Trash2, Wallet } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Markdown } from "@/components/markdown";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { DescriptionList } from "@/components/ui/description-list";
import { ConfirmDialog } from "@/components/ui/dialog";
import { ActionForm, Field, FieldRow, SubmitButton } from "@/components/ui/form";
import { DateInput, Input, Select } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { DateText, Money } from "@/components/ui/text";
import { canEverywhere, canUsePanelModule } from "@/lib/auth";
import { todayISO } from "@/lib/dates";
import {
  AGENDA_KIND_LABELS,
  BACKUP_STATUS_LABELS,
  CONTRACT_STATUS_LABELS,
  PROJECT_STAGE_LABELS,
  PROJECT_STAGES,
  SERVICE_INTEREST_LABELS,
  TASK_PRIORITY_LABELS,
} from "@/lib/domain";
import {
  countProjectTasks,
  getProject,
  listProjectContracts,
  listProjectEvents,
  listProjectFinance,
  listProjectTasks,
} from "@/server/projects/admin";
import { canInProject, requireProjectPermission } from "@/server/access";
import { linkHost, projectLinkEntries } from "@/server/projects/logic";
import { addProjectTaskAction, deleteProjectAction, updateProjectStageAction } from "../actions";
import { Checklist } from "../_components/checklist";
import { ProjectTeam } from "../_components/project-team";
import { BACKUP_TONES, DeadlineBadge, PROJECT_STAGE_TONES } from "../ui";

export const metadata: Metadata = { title: "Projeto" };
export const instant = false;

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  // O id da URL é entrada do usuário. Quem vê o módulo inteiro passa; o funcionário, só se for membro DESTE
  // projeto — projeto alheio e projeto que não existe dão a mesma resposta (não revelam nem a existência).
  const id = Number((await params).id);
  const user = await requireProjectPermission("projetos", "ver", Number.isInteger(id) && id > 0 ? id : null);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const project = await getProject(id);
  if (!project) notFound();

  // O que esta pessoa pode NESTE projeto e quais blocos de outros módulos ela enxerga.
  const full = canEverywhere(user, "projetos", "ver"); // vê o módulo inteiro (sócios, gestor): cadastro completo
  const [canEdit, canDownload, canSeeTasks, canAddTasks] = await Promise.all([
    canInProject(user, "projetos", "editar", id),
    canInProject(user, "projetos", "baixar", id),
    canInProject(user, "tarefas", "ver", id),
    canInProject(user, "tarefas", "editar", id),
  ]);
  const canEditAll = canEverywhere(user, "projetos", "editar");
  const canDelete = canEverywhere(user, "projetos", "excluir");
  const sees = {
    client: canEverywhere(user, "clientes", "ver"),
    proposal: canEverywhere(user, "propostas", "ver"),
    agenda: canUsePanelModule(user, "agenda", "ver"),
    agendaEdit: canUsePanelModule(user, "agenda", "editar"),
    contracts: canEverywhere(user, "contratos", "ver"),
    contractsEdit: canEverywhere(user, "contratos", "editar"),
    finance: canEverywhere(user, "financeiro", "ver"),
    financeEdit: canEverywhere(user, "financeiro", "editar"),
    team: canEverywhere(user, "equipe", "ver"),
    teamEdit: canEverywhere(user, "equipe", "editar"),
  };

  const [tasks, events, contracts, finance] = await Promise.all([
    canSeeTasks ? listProjectTasks(id) : [],
    sees.agenda ? listProjectEvents(id) : [],
    sees.contracts ? listProjectContracts(id) : [],
    sees.finance ? listProjectFinance(id) : [],
  ]);
  const today = todayISO();
  const links = projectLinkEntries(project);
  const openTasks = tasks.filter((task) => !task.done).length;
  const clientQuery = project.clientId ? `&cliente=${project.clientId}` : "";
  const proposalLabel = project.proposal ? `${project.proposal.number}${project.proposal.version > 1 ? ` v${project.proposal.version}` : ""} — ${project.proposal.title}` : null;

  return (
    <>
      <PageHeader
        title={project.title}
        badge={<StatusBadge value={project.stage} labels={PROJECT_STAGE_LABELS} tones={PROJECT_STAGE_TONES} />}
        description={
          <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
            {SERVICE_INTEREST_LABELS[project.serviceType]}
            <DeadlineBadge deadline={project.deliveryDeadline} stage={project.stage} today={today} />
          </span>
        }
        back={{ href: "/painel/projetos", label: "Projetos" }}
        actions={
          canEditAll ? (
            <ButtonLink href={`/painel/projetos/${project.id}/editar`} variant="secondary" icon={<Pencil />}>
              Editar
            </ButtonLink>
          ) : undefined
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr] lg:items-start">
        <div className="flex flex-col gap-4">
          <Card as="section" aria-labelledby="checklist-titulo">
            <CardHeader id="checklist-titulo" title="Checklist" description={canEdit ? "Marque conforme avança; cada clique já fica salvo." : "O que precisa ser feito neste projeto."} />
            <Checklist projectId={project.id} items={project.checklist} readOnly={!canEdit} />
          </Card>

          <Card as="section" aria-labelledby="arquivos-titulo">
            <CardHeader
              id="arquivos-titulo"
              title="Arquivos e entregas"
              description="Links para onde os arquivos estão guardados — não hospedamos vídeo aqui."
              action={
                canEditAll ? (
                  <ButtonLink href={`/painel/projetos/${project.id}/editar`} variant="ghost" size="sm" icon={<Pencil />}>
                    Editar links
                  </ButtonLink>
                ) : undefined
              }
            />
            {!canDownload ? (
              <p className="text-texto-suave text-sm">Os links dos arquivos deste projeto não estão liberados para a sua conta. Se precisar deles, fale com a NÓS.</p>
            ) : links.length > 0 ? (
              <ul className="divide-borda divide-y">
                {links.map((link) => (
                  <li key={link.key} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2.5">
                    <div className="min-w-0">
                      <p className="text-texto text-sm font-semibold">{link.label}</p>
                      <p className="text-texto-suave text-[0.8125rem] break-all">{linkHost(link.url)}</p>
                    </div>
                    <ButtonLink href={link.url} external variant="secondary" size="sm" iconRight={<ExternalLink />} className="max-sm:min-h-11">
                      Abrir<span className="sr-only"> {link.label}</span>
                    </ButtonLink>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-texto-suave mb-2 text-sm">
                {canEditAll ? "Nenhum link cadastrado. Use “Editar links” para colocar a pasta do Drive, a galeria, as referências e os arquivos finais." : "Nenhum link cadastrado ainda."}
              </p>
            )}
            <DescriptionList
              className="mt-3"
              items={[
                { label: "Data da entrega", value: project.deliveredAt ? <DateText value={project.deliveredAt} format="long" /> : "Ainda não entregue" },
                // situação e nota do backup são controle interno: só para quem vê o módulo inteiro
                ...(full
                  ? [
                      { label: "Backup", value: <StatusBadge value={project.backupStatus} labels={BACKUP_STATUS_LABELS} tones={BACKUP_TONES} /> },
                      { label: "Nota do backup", value: project.backupNote },
                    ]
                  : []),
              ]}
            />
          </Card>

          {canSeeTasks ? (
            <Card as="section" aria-labelledby="tarefas-titulo">
              <CardHeader
                id="tarefas-titulo"
                title="Tarefas do projeto"
                description={tasks.length > 0 ? `${openTasks} em aberto` : undefined}
                action={
                  <ButtonLink href={`/painel/tarefas?projeto=${project.id}`} variant="ghost" size="sm">
                    Ver todas
                  </ButtonLink>
                }
              />
              {tasks.length > 0 ? (
                <ul className="divide-borda mb-4 divide-y">
                  {tasks.map((task) => (
                    <li key={task.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2.5">
                      <span className={task.done ? "text-texto-suave line-through" : "text-texto font-medium"}>{task.title}</span>
                      <span className="text-texto-suave flex items-center gap-2 text-[0.8125rem]">
                        {task.done ? <Badge tone="sucesso">Concluída</Badge> : task.priority === "alta" ? <Badge tone="alerta">{TASK_PRIORITY_LABELS[task.priority]}</Badge> : null}
                        {task.dueDate ? (
                          <span>
                            <span className="sr-only">Prazo: </span>
                            <DateText value={task.dueDate} format="relative" />
                          </span>
                        ) : null}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-texto-suave mb-4 text-sm">{canAddTasks ? "Nenhuma tarefa ainda. Anote abaixo o que precisa ser feito neste projeto." : "Nenhuma tarefa ainda."}</p>
              )}
              {canAddTasks ? (
              <ActionForm action={addProjectTaskAction} hidden={{ id: project.id }} resetOnSuccess className="space-y-3">
                <FieldRow>
                  <Field name="title" label="Nova tarefa" required>
                    <Input maxLength={160} placeholder="Ex.: Enviar o primeiro corte" />
                  </Field>
                  <Field name="dueDate" label="Prazo" optional>
                    <DateInput />
                  </Field>
                </FieldRow>
                <SubmitButton variant="secondary" pendingLabel="Adicionando…">
                  Adicionar tarefa
                </SubmitButton>
              </ActionForm>
              ) : null}
            </Card>
          ) : null}

          {/* observações são anotações internas da administração: só para quem vê o módulo inteiro */}
          {full ? (
            <Card as="section" aria-labelledby="notas-titulo">
              <CardHeader id="notas-titulo" title="Observações" />
              {project.notes.trim() ? <Markdown className="prosa">{project.notes}</Markdown> : <p className="text-texto-suave text-sm">Sem observações. Use “Editar” para registrar combinados e detalhes de produção.</p>}
            </Card>
          ) : null}
        </div>

        <div className="flex flex-col gap-4">
          <Card as="section" aria-labelledby="dados-titulo">
            <CardHeader id="dados-titulo" title="Dados do projeto" />
            <DescriptionList
              items={[
                {
                  label: "Cliente",
                  value: project.client ? (
                    sees.client ? (
                      <Link href={`/painel/clientes/${project.client.id}`} className="link">
                        {project.client.name}
                      </Link>
                    ) : (
                      project.client.name
                    )
                  ) : null,
                },
                { label: "Tipo de serviço", value: SERVICE_INTEREST_LABELS[project.serviceType] },
                { label: "Etapa", value: <StatusBadge value={project.stage} labels={PROJECT_STAGE_LABELS} tones={PROJECT_STAGE_TONES} /> },
                { label: "Responsável", value: project.ownerName },
                { label: "Local", value: project.location },
                { label: "Data do evento", value: project.eventDate ? <DateText value={project.eventDate} format="long" /> : null },
                { label: "Prazo de gravação", value: project.shootDeadline ? <DateText value={project.shootDeadline} format="long" /> : null },
                {
                  label: "Prazo de entrega",
                  value: project.deliveryDeadline ? (
                    <span className="inline-flex flex-wrap items-center justify-end gap-2">
                      <DeadlineBadge deadline={project.deliveryDeadline} stage={project.stage} today={today} />
                      <DateText value={project.deliveryDeadline} format="long" />
                    </span>
                  ) : null,
                },
                { label: "Entregue em", value: project.deliveredAt ? <DateText value={project.deliveredAt} format="long" /> : null },
                {
                  label: "Proposta de origem",
                  value: project.proposal && sees.proposal ? (
                    <Link href={`/painel/orcamentos/${project.proposal.id}`} className="link">
                      {proposalLabel}
                    </Link>
                  ) : null,
                },
              ]}
            />
          </Card>

          {canEdit ? (
            <Card as="section" aria-labelledby="andamento-titulo">
              <CardHeader id="andamento-titulo" title="Andamento" />
              <ActionForm action={updateProjectStageAction} hidden={{ id: project.id }} className="space-y-4">
                <Field name="stage" label="Etapa do projeto" hint="Ao marcar como Entregue, a data de entrega vira hoje (se ainda estiver vazia).">
                  <Select options={PROJECT_STAGES.map((stage) => ({ value: stage, label: PROJECT_STAGE_LABELS[stage] }))} defaultValue={project.stage} />
                </Field>
                <SubmitButton variant="secondary" pendingLabel="Salvando…">
                  Salvar etapa
                </SubmitButton>
              </ActionForm>
            </Card>
          ) : null}

          {sees.team ? <ProjectTeam projectId={project.id} canManage={sees.teamEdit} /> : null}

          {sees.agenda ? (
            <Card as="section" aria-labelledby="agenda-titulo">
              <CardHeader
                id="agenda-titulo"
                title="Agenda do projeto"
                action={
                  sees.agendaEdit ? (
                    <ButtonLink href={`/painel/agenda/novo?projeto=${project.id}${clientQuery}`} variant="ghost" size="sm" icon={<CalendarPlus />}>
                      Novo
                    </ButtonLink>
                  ) : undefined
                }
              />
              {events.length > 0 ? (
                <ul className="divide-borda divide-y">
                  {events.map((event) => (
                    <li key={event.id}>
                      <Link href={`/painel/agenda/${event.id}`} className="hover:text-detalhe flex min-h-11 flex-col justify-center py-2">
                        <span className="text-texto text-sm font-semibold break-words">{event.title}</span>
                        <span className="text-texto-suave text-[0.8125rem]">
                          {AGENDA_KIND_LABELS[event.kind]} · <DateText value={event.date} />
                          {event.startTime ? ` às ${event.startTime}` : ""}
                          {event.location ? ` · ${event.location}` : ""}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-texto-suave text-sm">Nenhum compromisso. Marque a gravação, reuniões e a entrega na agenda.</p>
              )}
            </Card>
          ) : null}

          {sees.contracts ? (
            <Card as="section" aria-labelledby="contratos-titulo">
              <CardHeader
                id="contratos-titulo"
                title="Contratos"
                action={
                  sees.contractsEdit ? (
                    <ButtonLink
                      href={`/painel/contratos/novo?projeto=${project.id}${clientQuery}${project.proposalId ? `&proposta=${project.proposalId}` : ""}`}
                      variant="ghost"
                      size="sm"
                      icon={<FilePlus2 />}
                    >
                      Novo
                    </ButtonLink>
                  ) : undefined
                }
              />
              {contracts.length > 0 ? (
                <ul className="divide-borda divide-y">
                  {contracts.map((contract) => (
                    <li key={contract.id}>
                      <Link href={`/painel/contratos/${contract.id}`} className="hover:text-detalhe flex min-h-11 flex-wrap items-center justify-between gap-2 py-2">
                        <span className="text-texto text-sm font-semibold break-words">{contract.title}</span>
                        <Badge tone={contract.status === "assinado" ? "sucesso" : contract.status === "cancelado" ? "neutral" : "roxo"}>{CONTRACT_STATUS_LABELS[contract.status]}</Badge>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-texto-suave text-sm">Nenhum contrato vinculado a este projeto.</p>
              )}
            </Card>
          ) : null}

          {sees.finance ? (
            <Card as="section" aria-labelledby="financeiro-titulo">
              <CardHeader
                id="financeiro-titulo"
                title="Financeiro"
                action={
                  sees.financeEdit ? (
                    <ButtonLink
                      href={`/painel/financeiro/novo?tipo=receita&projeto=${project.id}${clientQuery}${project.proposalId ? `&proposta=${project.proposalId}` : ""}`}
                      variant="ghost"
                      size="sm"
                      icon={<Wallet />}
                    >
                      Novo
                    </ButtonLink>
                  ) : undefined
                }
              />
              {finance.length > 0 ? (
                <ul className="divide-borda divide-y">
                  {finance.map((entry) => (
                    <li key={entry.id}>
                      <Link href={`/painel/financeiro/${entry.id}`} className="hover:text-detalhe flex min-h-11 items-center justify-between gap-3 py-2">
                        <span className="min-w-0">
                          <span className="text-texto block text-sm font-semibold break-words">
                            {entry.description}
                            {entry.installmentLabel ? ` · ${entry.installmentLabel}` : ""}
                          </span>
                          <span className="text-texto-suave block text-[0.8125rem]">
                            {entry.type === "receita" ? "Receita" : "Despesa"} ·{" "}
                            {entry.paidAt ? (
                              <>
                                {entry.type === "receita" ? "recebida" : "paga"} em <DateText value={entry.paidAt} />
                              </>
                            ) : (
                              <>
                                vence em <DateText value={entry.dueDate} />
                              </>
                            )}
                          </span>
                        </span>
                        <Money cents={entry.type === "despesa" ? -entry.amountCents : entry.amountCents} colored className="text-sm font-semibold" />
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-texto-suave text-sm">Nenhum lançamento vinculado a este projeto.</p>
              )}
            </Card>
          ) : null}

          {canDelete ? (
            <Card as="section" aria-labelledby="excluir-titulo">
              <CardHeader id="excluir-titulo" title="Excluir projeto" description="As tarefas deste projeto são apagadas junto. Compromissos, contratos e lançamentos continuam existindo, só perdem o vínculo." />
              <DeleteProject projectId={project.id} title={project.title} taskCount={await countProjectTasks(project.id)} />
            </Card>
          ) : null}
        </div>
      </div>
    </>
  );
}

function DeleteProject({ projectId, title, taskCount }: { projectId: number; title: string; taskCount: number }) {
  return (
    <ConfirmDialog
      trigger={
        <Button variant="danger-ghost" icon={<Trash2 />} className="-ml-2">
          Excluir projeto
        </Button>
      }
      title="Excluir este projeto?"
      description={
        <>
          <strong className="text-texto">{title}</strong> será apagado e não dá para desfazer.{" "}
          {taskCount > 0 ? `As ${taskCount} tarefa${taskCount === 1 ? "" : "s"} do projeto também serão apagadas.` : "Ele não tem tarefas."}
        </>
      }
      confirmLabel="Excluir projeto"
      action={deleteProjectAction}
      hidden={{ id: projectId }}
    />
  );
}
