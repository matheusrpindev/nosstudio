import { ExternalLink, FolderOpen, Plus, SearchX } from "lucide-react";
import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterBar } from "@/components/ui/filter-bar";
import { PageHeader } from "@/components/ui/page-header";
import { paramOneOf, paramText, type PageSearchParams } from "@/components/ui/search-params";
import { requirePermission } from "@/lib/auth";
import { formatMonth } from "@/lib/dates";
import { PORTFOLIO_CATEGORIES, PORTFOLIO_CATEGORY_LABELS } from "@/lib/domain";
import { canEverywhere } from "@/lib/permissions";
import { getMediaValues } from "@/server/media";
import { listPortfolio } from "@/server/site/admin/portfolio";
import { getSiteContentForEdit } from "@/server/site/content";
import { SectionHiddenNotice } from "../_colecoes/hidden-notice";
import { featurePortfolioAction, movePortfolioAction, reorderPortfolioAction, togglePortfolioAction } from "./actions";
import { PortfolioList, type PortfolioRow } from "./list";
import { RealWorkNotice } from "./notice";

export const metadata: Metadata = { title: "Portfólio do site" };
export const instant = false;

const STATUS_OPTIONS = { publicado: "Publicados", rascunho: "Rascunhos" } as const;

export default async function PortfolioAdminPage({ searchParams }: { searchParams: PageSearchParams }) {
  const user = await requirePermission("site", "ver");
  const canEdit = canEverywhere(user, "site", "editar");
  const params = await searchParams;
  const filters = {
    category: paramOneOf(PORTFOLIO_CATEGORIES, params.categoria),
    status: paramOneOf(["publicado", "rascunho"] as const, params.situacao),
    q: paramText(params.q),
  };
  const [projects, visibility] = await Promise.all([listPortfolio(filters), getSiteContentForEdit("visibility")]);
  const filtered = Boolean(filters.category || filters.status || filters.q);
  const covers = new Map((await getMediaValues(projects.map((project) => project.coverMediaId))).map((media) => [media.id, media.url]));

  const rows: PortfolioRow[] = projects.map((project) => ({
    id: project.id,
    title: project.title,
    categoryLabel: PORTFOLIO_CATEGORY_LABELS[project.category] ?? project.category,
    clientName: project.clientName,
    showClient: project.showClient,
    date: project.projectDate ? formatMonth(project.projectDate) : "",
    published: project.published,
    featured: project.featured,
    previous: project.origin === "experiencia_anterior",
    coverUrl: project.coverMediaId ? (covers.get(project.coverMediaId) ?? null) : null,
  }));

  return (
    <div className="max-w-5xl">
      <PageHeader
        title="Portfólio do site"
        description="A ordem desta lista é a ordem em que os projetos aparecem no site: arraste pela alça ou use as setas. A estrela marca o destaque (cartão maior no portfólio e bloco da página inicial); a chave publica. Rascunhos ficam só aqui no painel."
        actions={
          <>
            <ButtonLink href="/portfolio" external variant="secondary" icon={<ExternalLink />}>
              Ver no site
            </ButtonLink>
            {canEdit ? (
              <ButtonLink href="/painel/site/portfolio/novo" icon={<Plus />}>
                Novo projeto
              </ButtonLink>
            ) : null}
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
      {rows.length === 0 ? (
        filtered ? (
          <EmptyState variant="plain" icon={<SearchX />} title="Nenhum projeto com esses filtros" description="Tente outro termo ou limpe os filtros." action={<ButtonLink href="/painel/site/portfolio" variant="secondary">Limpar filtros</ButtonLink>} />
        ) : (
          <EmptyState
            variant="plain"
            icon={<FolderOpen />}
            title="Nenhum projeto cadastrado"
            description="O portfólio começa vazio de propósito: cadastre só trabalhos reais, com autorização do cliente. Enquanto nada estiver publicado, o site não mostra esta seção."
            action={
              canEdit ? (
                <ButtonLink href="/painel/site/portfolio/novo" icon={<Plus />}>
                  Novo projeto
                </ButtonLink>
              ) : undefined
            }
          />
        )
      ) : (
        <>
          {filtered && canEdit ? <p className="text-texto-suave mb-3 text-sm">Para mudar a ordem, limpe a busca e os filtros: a ordem vale para a lista completa.</p> : null}
          <PortfolioList
            rows={rows}
            canEdit={canEdit}
            sortable={!filtered}
            moveAction={movePortfolioAction}
            reorderAction={reorderPortfolioAction}
            publishAction={togglePortfolioAction}
            featureAction={featurePortfolioAction}
          />
        </>
      )}
    </div>
  );
}
