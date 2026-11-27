/**
 * Grade de projetos da página /portfolio, com pesquisa e filtros por categoria.
 *
 * Server Component: os cartões são renderizados no servidor (a página continua estática e todos os projetos
 * estão no HTML). O que vai para o navegador é só o necessário para filtrar — id, categoria, texto pesquisável —
 * junto com o cartão já pronto; quem esconde/mostra é <PortfolioFilter> (Client Component).
 */
import { portfolioCategoryOptions, projectSearchText, type PublicPortfolioProject } from "@/lib/site/portfolio";
import { PortfolioCardBody } from "./portfolio-card";
import { PortfolioFilter, type PortfolioFilterLabels } from "./portfolio-filter";

export function PortfolioBrowser({ projects, labels }: { projects: PublicPortfolioProject[]; labels: PortfolioFilterLabels & { featured: string } }) {
  if (projects.length === 0) return null;
  const items = projects.map((project, index) => ({
    id: project.id,
    category: project.category,
    featured: project.featured,
    search: projectSearchText(project),
    card: (
      <PortfolioCardBody
        project={project}
        index={index}
        headingLevel={2}
        featuredLabel={project.featured ? labels.featured : undefined}
        sizes={project.featured ? "(min-width: 768px) 62vw, 100vw" : "(min-width: 1024px) 30vw, (min-width: 768px) 46vw, 100vw"}
      />
    ),
  }));
  return <PortfolioFilter items={items} options={portfolioCategoryOptions(projects)} labels={labels} />;
}
