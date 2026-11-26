import { Clapperboard, Plus, SearchX } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { StatusBadge } from "@/components/ui/badge";
import { Board } from "@/components/ui/board";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DataList, type DataListColumn } from "@/components/ui/data-list";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterBar, type FilterSelect } from "@/components/ui/filter-bar";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { paramId, paramOneOf, paramText, parsePage, type PageSearchParams } from "@/components/ui/search-params";
import { DateText } from "@/components/ui/text";
import { canEverywhere } from "@/lib/auth";
import { todayISO } from "@/lib/dates";
import {
  BACKUP_STATUS_LABELS,
  BACKUP_STATUSES,
  PROJECT_STAGE_LABELS,
  PROJECT_STAGES,
  SERVICE_INTEREST_LABELS,
  SERVICE_INTERESTS,
} from "@/lib/domain";
import { moduleScope, requireScopedPermission } from "@/server/access";
import { getClientOptions, getUserOptions } from "@/server/options";
import { listProjects, type ProjectFilters, type ProjectListItem } from "@/server/projects/admin";
import { BOARD_STAGES, projectLinkEntries } from "@/server/projects/logic";
import { moveProjectAction } from "./actions";
import { ProjectCard } from "./_components/project-card";
import { BACKUP_TONES, DeadlineBadge, LinkChips, PROJECT_STAGE_TONES, ViewSwitch } from "./ui";

export const metadata: Metadata = { title: "Projetos" };
export const instant = false;

const VIEWS = ["quadro", "lista", "arquivos"] as const;
type View = (typeof VIEWS)[number];
const VIEW_LABELS: Record<View, string> = { quadro: "Quadro", lista: "Lista", arquivos: "Arquivos e entregas" };
/** Filtros que valem em todas as visões e acompanham a troca de visão. */
const SHARED_PARAMS = ["q", "responsavel", "cliente", "servico"] as const;

export default async function ProjectsPage({ searchParams }: { searchParams: PageSearchParams }) {
  // Quem vê o módulo inteiro (sócios, gestor) vê todos; o funcionário, só os projetos em que é membro.
  const { user, scope } = await requireScopedPermission("projetos", "ver");
  const restricted = scope !== "todos";
  const params = await searchParams;
  // "Arquivos e entregas" mostra links de trabalho e backup de todos os projetos: só para quem vê o módulo inteiro.
  const views = restricted ? VIEWS.filter((value) => value !== "arquivos") : VIEWS;
  const view: View = paramOneOf(views, params.vista) ?? "quadro";
  const today = todayISO();
  const canCreate = canEverywhere(user, "projetos", "editar");
  const editScope = await moduleScope(user, "projetos", "editar");

  // Quem só vê os próprios projetos não recebe a lista de clientes nem a da equipe.
  const [clientOptions, userOptions] = restricted ? [[], []] : await Promise.all([canEverywhere(user, "clientes", "ver") ? getClientOptions() : [], getUserOptions()]);
  const filters: ProjectFilters = {
    q: paramText(params.q),
    ownerId: view === "arquivos" || restricted ? undefined : paramId(params.responsavel),
    clientId: clientOptions.length > 0 ? paramId(params.cliente) : undefined,
    service: paramOneOf(SERVICE_INTERESTS, params.servico),
    stage: view === "quadro" ? undefined : paramOneOf(PROJECT_STAGES, params.etapa),
    backup: view === "arquivos" ? paramOneOf(BACKUP_STATUSES, params.backup) : undefined,
    page: view === "quadro" ? undefined : parsePage(params.pagina),
  };
  const listed = await listProjects(filters, scope);
  const { total, page, pageSize } = listed;
  // Para quem só vê os próprios projetos, as linhas saem daqui sem os campos internos (observações, links de
  // trabalho, backup, proposta de origem): a lista não os mostra, e assim eles nem chegam aos componentes.
  const rows = restricted ? listed.rows.map(withoutInternalFields) : listed.rows;
  const filtered = Boolean(filters.q || filters.ownerId || filters.clientId || filters.service || filters.stage || filters.backup);

  // visão = parâmetro `vista`; ao trocar, os filtros comuns acompanham
  const viewHref = (value: View) => {
    const next = new URLSearchParams();
    if (value !== "quadro") next.set("vista", value);
    for (const key of SHARED_PARAMS) {
      const current = params[key];
      const text = Array.isArray(current) ? current[0] : current;
      if (text) next.set(key, text);
    }
    const query = next.toString();
    return query ? `/painel/projetos?${query}` : "/painel/projetos";
  };

  const filterSelects: FilterSelect[] = [
    ...(view === "arquivos" || userOptions.length === 0 ? [] : [{ name: "responsavel", label: "Responsável", options: userOptions, allLabel: "Todos os responsáveis" }]),
    ...(clientOptions.length === 0 ? [] : [{ name: "cliente", label: "Cliente", options: clientOptions, allLabel: "Todos os clientes" }]),
    { name: "servico", label: "Tipo de serviço", options: SERVICE_INTEREST_LABELS, allLabel: "Todos os serviços" },
    ...(view === "quadro" ? [] : [{ name: "etapa", label: "Etapa", options: PROJECT_STAGE_LABELS, allLabel: "Todas as etapas" }]),
    ...(view === "arquivos" ? [{ name: "backup", label: "Situação do backup", options: BACKUP_STATUS_LABELS, allLabel: "Qualquer backup" }] : []),
  ];

  const emptyState = filtered ? (
    <EmptyState
      variant="plain"
      icon={<SearchX />}
      title="Nenhum projeto com esses filtros"
      description="Tente outro termo ou limpe os filtros."
      action={
        <ButtonLink href={view === "quadro" ? "/painel/projetos" : `/painel/projetos?vista=${view}`} variant="secondary">
          Limpar filtros
        </ButtonLink>
      }
    />
  ) : (
    <EmptyState
      variant="plain"
      icon={<Clapperboard />}
      title={restricted ? "Você ainda não está em nenhum projeto" : "Nenhum projeto por enquanto"}
      description={
        restricted
          ? "Quando a NÓS incluir você na equipe de um projeto, ele aparece aqui."
          : "Quando uma proposta for aceita, crie o projeto a partir dela (ou cadastre um à mão) para acompanhar prazos, arquivos e entregas."
      }
      action={
        canCreate ? (
          <ButtonLink href="/painel/projetos/novo" icon={<Plus />}>
            Novo projeto
          </ButtonLink>
        ) : undefined
      }
    />
  );

  return (
    <>
      <PageHeader
        title="Projetos"
        description={restricted ? "Os projetos em que você está: etapas, prazos e tarefas de cada trabalho." : "Do briefing à entrega: etapas, prazos, arquivos e backup de cada trabalho."}
        actions={
          canCreate ? (
            <ButtonLink href="/painel/projetos/novo" icon={<Plus />}>
              Novo projeto
            </ButtonLink>
          ) : undefined
        }
      />

      <ViewSwitch current={view} items={views.map((value) => ({ value, label: VIEW_LABELS[value], href: viewHref(value) }))} />

      <FilterBar
        key={view}
        search={{ placeholder: "Buscar por projeto ou cliente", label: "Buscar projetos" }}
        filters={filterSelects}
        preserve={view === "quadro" ? [] : ["vista"]}
      />

      {view === "quadro" ? <BoardView rows={rows} today={today} empty={emptyState} /> : null}
      {view === "quadro" && editScope !== "todos" && rows.some((project) => !editScope.includes(project.id)) ? (
        <p className="text-texto-suave mt-3 text-sm">Você só consegue mudar a etapa dos projetos em que tem permissão para editar.</p>
      ) : null}
      {view === "lista" ? (
        <>
          <DataList
            caption="Projetos"
            columns={listColumns(today)}
            rows={rows}
            rowKey={(project) => project.id}
            href={(project) => `/painel/projetos/${project.id}`}
            empty={emptyState}
          />
          <Pagination page={page} pageSize={pageSize} total={total} noun={total === 1 ? "projeto" : "projetos"} />
        </>
      ) : null}
      {view === "arquivos" ? (
        <>
          <DataList
            caption="Arquivos e entregas por projeto"
            columns={fileColumns(today)}
            rows={rows}
            rowKey={(project) => project.id}
            href={(project) => `/painel/projetos/${project.id}`}
            empty={emptyState}
          />
          <Pagination page={page} pageSize={pageSize} total={total} noun={total === 1 ? "projeto" : "projetos"} />
        </>
      ) : null}
    </>
  );
}

/** O que a lista de um membro de projeto NÃO carrega (o detalhe decide, campo a campo, o que ele pode ver). */
function withoutInternalFields(project: ProjectListItem): ProjectListItem {
  return { ...project, notes: "", driveUrl: "", galleryUrl: "", referencesUrl: "", finalFilesUrl: "", links: [], backupNote: "", proposalId: null };
}

// ---------------------------------------------------------------------- quadro
function BoardView({ rows, today, empty }: { rows: ProjectListItem[]; today: string; empty: React.ReactNode }) {
  const boardRows = rows.filter((project) => project.stage !== "cancelado");
  const cancelled = rows.filter((project) => project.stage === "cancelado");
  if (rows.length === 0) return <div className="card">{empty}</div>;
  return (
    <>
      <Board
        label="Quadro de projetos por etapa"
        columns={BOARD_STAGES.map((stage) => ({
          id: stage,
          title: PROJECT_STAGE_LABELS[stage],
          tone: stage === "entregue" ? ("sucesso" as const) : undefined,
        }))}
        cards={boardRows.map((project) => ({
          id: project.id,
          columnId: project.stage,
          label: project.title,
          content: <ProjectCard project={project} today={today} />,
        }))}
        onMove={moveProjectAction}
        emptyLabel="Nenhum projeto aqui"
      />
      {cancelled.length > 0 ? (
        <Card as="section" aria-labelledby="cancelados-titulo" className="mt-6">
          <details>
            <summary id="cancelados-titulo" className="text-texto flex min-h-11 cursor-pointer items-center text-sm font-semibold">
              Cancelados ({cancelled.length})
            </summary>
            <ul className="divide-borda mt-2 divide-y">
              {cancelled.map((project) => (
                <li key={project.id}>
                  <Link href={`/painel/projetos/${project.id}`} className="hover:text-detalhe flex min-h-11 flex-wrap items-center justify-between gap-x-4 py-2 text-sm">
                    <span className="font-semibold">{project.title}</span>
                    <span className="text-texto-suave">{project.clientName ?? "Sem cliente"}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </details>
        </Card>
      ) : null}
    </>
  );
}

// ----------------------------------------------------------------------- lista
const listColumns = (today: string): DataListColumn<ProjectListItem>[] => [
  {
    key: "projeto",
    header: "Projeto",
    primary: true,
    cell: (project) => (
      <>
        <span className="block break-words">{project.title}</span>
        <span className="text-texto-suave block text-[0.8125rem] font-normal">{project.clientName ?? "Sem cliente"}</span>
      </>
    ),
  },
  { key: "servico", header: "Serviço", hideOnMobile: true, cell: (project) => SERVICE_INTEREST_LABELS[project.serviceType] },
  { key: "etapa", header: "Etapa", cell: (project) => <StatusBadge value={project.stage} labels={PROJECT_STAGE_LABELS} tones={PROJECT_STAGE_TONES} /> },
  { key: "responsavel", header: "Responsável", hideOnMobile: true, cell: (project) => project.ownerName ?? <span className="text-texto-suave">—</span> },
  {
    key: "prazo",
    header: "Entrega",
    align: "right",
    cell: (project) => (
      <span className="inline-flex flex-wrap items-center justify-end gap-2">
        <DeadlineBadge deadline={project.deliveryDeadline} stage={project.stage} today={today} />
        <DateText value={project.deliveryDeadline} className="text-texto" />
      </span>
    ),
  },
];

// ------------------------------------------------------------ arquivos e entregas
const fileColumns = (today: string): DataListColumn<ProjectListItem>[] => [
  {
    key: "projeto",
    header: "Projeto",
    primary: true,
    cell: (project) => (
      <>
        <span className="block break-words">{project.title}</span>
        <span className="text-texto-suave block text-[0.8125rem] font-normal">{project.clientName ?? "Sem cliente"}</span>
      </>
    ),
  },
  { key: "etapa", header: "Etapa", cell: (project) => <StatusBadge value={project.stage} labels={PROJECT_STAGE_LABELS} tones={PROJECT_STAGE_TONES} /> },
  { key: "links", header: "Links", interactive: true, cell: (project) => <LinkChips links={projectLinkEntries(project)} /> },
  {
    key: "entrega",
    header: "Entrega",
    cell: (project) =>
      project.deliveredAt ? (
        <span>
          Entregue em <DateText value={project.deliveredAt} />
        </span>
      ) : (
        <span className="inline-flex flex-wrap items-center gap-2">
          <DeadlineBadge deadline={project.deliveryDeadline} stage={project.stage} today={today} />
          {project.deliveryDeadline ? <span>Prazo <DateText value={project.deliveryDeadline} /></span> : <span className="text-texto-suave">Sem prazo</span>}
        </span>
      ),
  },
  {
    key: "backup",
    header: "Backup",
    cell: (project) => (
      <span className="block">
        <StatusBadge value={project.backupStatus} labels={BACKUP_STATUS_LABELS} tones={BACKUP_TONES} />
        {project.backupNote ? <span className="text-texto-suave mt-1 block max-w-56 text-xs break-words md:text-left">{project.backupNote}</span> : null}
      </span>
    ),
  },
];
