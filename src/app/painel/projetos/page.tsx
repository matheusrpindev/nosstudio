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
import { requireUser } from "@/lib/auth";
import { todayISO } from "@/lib/dates";
import {
  BACKUP_STATUS_LABELS,
  BACKUP_STATUSES,
  PROJECT_STAGE_LABELS,
  PROJECT_STAGES,
  SERVICE_INTEREST_LABELS,
  SERVICE_INTERESTS,
} from "@/lib/domain";
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
  await requireUser();
  const params = await searchParams;
  const view: View = paramOneOf(VIEWS, params.vista) ?? "quadro";
  const today = todayISO();

  const [clientOptions, userOptions] = await Promise.all([getClientOptions(), getUserOptions()]);
  const filters: ProjectFilters = {
    q: paramText(params.q),
    ownerId: view === "arquivos" ? undefined : paramId(params.responsavel),
    clientId: paramId(params.cliente),
    service: paramOneOf(SERVICE_INTERESTS, params.servico),
    stage: view === "quadro" ? undefined : paramOneOf(PROJECT_STAGES, params.etapa),
    backup: view === "arquivos" ? paramOneOf(BACKUP_STATUSES, params.backup) : undefined,
    page: view === "quadro" ? undefined : parsePage(params.pagina),
  };
  const { rows, total, page, pageSize } = await listProjects(filters);
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
    ...(view === "arquivos" ? [] : [{ name: "responsavel", label: "Responsável", options: userOptions, allLabel: "Todos os responsáveis" }]),
    { name: "cliente", label: "Cliente", options: clientOptions, allLabel: "Todos os clientes" },
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
      title="Nenhum projeto por enquanto"
      description="Quando uma proposta for aceita, crie o projeto a partir dela (ou cadastre um à mão) para acompanhar prazos, arquivos e entregas."
      action={
        <ButtonLink href="/painel/projetos/novo" icon={<Plus />}>
          Novo projeto
        </ButtonLink>
      }
    />
  );

  return (
    <>
      <PageHeader
        title="Projetos"
        description="Do briefing à entrega: etapas, prazos, arquivos e backup de cada trabalho."
        actions={
          <ButtonLink href="/painel/projetos/novo" icon={<Plus />}>
            Novo projeto
          </ButtonLink>
        }
      />

      <ViewSwitch current={view} items={VIEWS.map((value) => ({ value, label: VIEW_LABELS[value], href: viewHref(value) }))} />

      <FilterBar
        key={view}
        search={{ placeholder: "Buscar por projeto ou cliente", label: "Buscar projetos" }}
        filters={filterSelects}
        preserve={view === "quadro" ? [] : ["vista"]}
      />

      {view === "quadro" ? <BoardView rows={rows} today={today} empty={emptyState} /> : null}
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
            <summary id="cancelados-titulo" className="text-grafite flex min-h-11 cursor-pointer items-center text-sm font-semibold">
              Cancelados ({cancelled.length})
            </summary>
            <ul className="divide-areia mt-2 divide-y">
              {cancelled.map((project) => (
                <li key={project.id}>
                  <Link href={`/painel/projetos/${project.id}`} className="hover:text-roxo flex min-h-11 flex-wrap items-center justify-between gap-x-4 py-2 text-sm">
                    <span className="font-semibold">{project.title}</span>
                    <span className="text-cinza">{project.clientName ?? "Sem cliente"}</span>
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
        <span className="text-cinza block text-[0.8125rem] font-normal">{project.clientName ?? "Sem cliente"}</span>
      </>
    ),
  },
  { key: "servico", header: "Serviço", hideOnMobile: true, cell: (project) => SERVICE_INTEREST_LABELS[project.serviceType] },
  { key: "etapa", header: "Etapa", cell: (project) => <StatusBadge value={project.stage} labels={PROJECT_STAGE_LABELS} tones={PROJECT_STAGE_TONES} /> },
  { key: "responsavel", header: "Responsável", hideOnMobile: true, cell: (project) => project.ownerName ?? <span className="text-cinza">—</span> },
  {
    key: "prazo",
    header: "Entrega",
    align: "right",
    cell: (project) => (
      <span className="inline-flex flex-wrap items-center justify-end gap-2">
        <DeadlineBadge deadline={project.deliveryDeadline} stage={project.stage} today={today} />
        <DateText value={project.deliveryDeadline} className="text-grafite" />
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
        <span className="text-cinza block text-[0.8125rem] font-normal">{project.clientName ?? "Sem cliente"}</span>
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
          {project.deliveryDeadline ? <span>Prazo <DateText value={project.deliveryDeadline} /></span> : <span className="text-cinza">Sem prazo</span>}
        </span>
      ),
  },
  {
    key: "backup",
    header: "Backup",
    cell: (project) => (
      <span className="block">
        <StatusBadge value={project.backupStatus} labels={BACKUP_STATUS_LABELS} tones={BACKUP_TONES} />
        {project.backupNote ? <span className="text-cinza mt-1 block max-w-56 text-xs break-words md:text-left">{project.backupNote}</span> : null}
      </span>
    ),
  },
];
