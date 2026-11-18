import { ExternalLink, FolderOpen, Plus, SearchX, Star } from "lucide-react";
import type { Metadata } from "next";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { DataList, type DataListColumn } from "@/components/ui/data-list";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterBar } from "@/components/ui/filter-bar";
import { PageHeader } from "@/components/ui/page-header";
import { paramOneOf, paramText, type PageSearchParams } from "@/components/ui/search-params";
import { DateText } from "@/components/ui/text";
import { requireUser } from "@/lib/auth";
import { PORTFOLIO_CATEGORIES, PORTFOLIO_CATEGORY_LABELS } from "@/lib/domain";
import type { PortfolioProject } from "@/db/schema";
import { listPortfolio } from "@/server/site/admin/portfolio";
import { getSiteContentForEdit } from "@/server/site/content";
import { SectionHiddenNotice } from "../_colecoes/hidden-notice";
import { PUBLISHED_TONES } from "../_colecoes/messages";
import { RowSwitch } from "../_colecoes/row-controls";
import { RealWorkNotice } from "./notice";
import { togglePortfolioAction } from "./actions";

export const metadata: Metadata = { title: "Portfólio do site" };
export const instant = false;

const STATUS_OPTIONS = { publicado: "Publicados", rascunho: "Rascunhos" } as const;

export default async function PortfolioAdminPage({ searchParams }: { searchParams: PageSearchParams }) {
  await requireUser();
  const params = await searchParams;
  const filters = {
    category: paramOneOf(PORTFOLIO_CATEGORIES, params.categoria),
    status: paramOneOf(["publicado", "rascunho"] as const, params.situacao),
    q: paramText(params.q),
  };
  const [rows, visibility] = await Promise.all([listPortfolio(filters), getSiteContentForEdit("visibility")]);
  const filtered = Boolean(filters.category || filters.status || filters.q);

  const columns: DataListColumn<PortfolioProject>[] = [
    {
      key: "projeto",
      header: "Projeto",
      primary: true,
      cell: (project) => (
        <>
          <span className="flex flex-wrap items-center gap-2 break-words">
            {project.title}
            {project.featured ? (
              <Badge tone="lima">
                <Star aria-hidden="true" className="size-3" /> Destaque
              </Badge>
            ) : null}
          </span>
          {project.clientName ? (
            <span className="text-cinza block text-[0.8125rem] font-normal">
              {project.clientName}
              {project.showClient ? "" : " · nome não aparece no site"}
            </span>
          ) : null}
        </>
      ),
    },
    { key: "categoria", header: "Categoria", cell: (project) => PORTFOLIO_CATEGORY_LABELS[project.category] },
    { key: "data", header: "Data", hideOnMobile: true, cell: (project) => <DateText value={project.projectDate} className="text-cinza" /> },
    {
      key: "situacao",
      header: "Situação",
      hideLabelOnMobile: true,
      cell: (project) => (
        <Badge tone={PUBLISHED_TONES[project.published ? "publicado" : "rascunho"]} dot>
          {project.published ? "Publicado" : "Rascunho"}
        </Badge>
      ),
    },
    { key: "publicar", header: "No site", interactive: true, cell: (project) => <RowSwitch id={project.id} checked={project.published} label={`Publicar “${project.title}” no site`} action={togglePortfolioAction} /> },
  ];

  return (
    <>
      <PageHeader
        title="Portfólio do site"
        description="Trabalhos reais da NÓS Studio. Rascunhos ficam só aqui no painel."
        actions={
          <>
            <ButtonLink href="/portfolio" external variant="secondary" icon={<ExternalLink />}>
              Ver no site
            </ButtonLink>
            <ButtonLink href="/painel/site/portfolio/novo" icon={<Plus />}>
              Novo projeto
            </ButtonLink>
          </>
        }
      />
      <SectionHiddenNotice hidden={!visibility.portfolio} title="O portfólio está oculto no site" />
      <RealWorkNotice />
      <FilterBar
        search={{ placeholder: "Buscar por título ou cliente", label: "Buscar projetos" }}
        filters={[
          { name: "categoria", label: "Categoria", options: PORTFOLIO_CATEGORY_LABELS, allLabel: "Todas as categorias" },
          { name: "situacao", label: "Situação", options: STATUS_OPTIONS, allLabel: "Todas as situações" },
        ]}
      />
      <DataList
        caption="Projetos do portfólio"
        columns={columns}
        rows={rows}
        rowKey={(project) => project.id}
        href={(project) => `/painel/site/portfolio/${project.id}`}
        empty={
          filtered ? (
            <EmptyState variant="plain" icon={<SearchX />} title="Nenhum projeto com esses filtros" description="Tente outro termo ou limpe os filtros." action={<ButtonLink href="/painel/site/portfolio" variant="secondary">Limpar filtros</ButtonLink>} />
          ) : (
            <EmptyState
              variant="plain"
              icon={<FolderOpen />}
              title="Nenhum projeto cadastrado"
              description="O portfólio começa vazio de propósito: cadastre só trabalhos reais, com autorização do cliente. Enquanto nada estiver publicado, o site não mostra esta seção."
              action={
                <ButtonLink href="/painel/site/portfolio/novo" icon={<Plus />}>
                  Novo projeto
                </ButtonLink>
              }
            />
          )
        }
      />
    </>
  );
}
