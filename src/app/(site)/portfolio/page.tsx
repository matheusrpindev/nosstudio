import { notFound } from "next/navigation";
import { CtaBand } from "@/components/site/blocks";
import { PageHeader, Section } from "@/components/site/layout";
import { PortfolioBrowser } from "@/components/site/portfolio-browser";
import { buildMetadata } from "@/lib/site/seo";
import { getPortfolio, getSiteContent } from "@/server/site/queries";
import "./portfolio.css";

export const generateMetadata = () => buildMetadata("portfolio");

/**
 * Portfólio (briefing v2, seção 08): "Nosso olhar em prática." — grade com pesquisa e filtros por categoria.
 *
 * Estático: só existe com a seção ligada E com projetos publicados — caso contrário responde 404 (nada de grade
 * vazia; o menu, a home e o mapa do site já omitem o item). A pesquisa e os filtros rodam no navegador sobre a
 * lista completa (o estado vai na URL: `?categoria=&q=`), então a página não lê `searchParams` no servidor.
 */
export default async function PortfolioPage() {
  const [content, projects] = await Promise.all([getSiteContent(), getPortfolio()]);
  const { visibility, portfolioPage: page, home } = content;
  if (!visibility.portfolio || projects.length === 0) notFound();

  return (
    <>
      <PageHeader eyebrow={page.eyebrow} title={page.title} lead={page.intro} accent="tail" />
      <Section id="portfolio-projetos" number="01" label={page.projectsLabel || page.eyebrow}>
        <PortfolioBrowser
          projects={projects}
          labels={{
            search: page.searchLabel,
            placeholder: page.searchPlaceholder,
            all: page.allLabel,
            featured: page.featuredLabel,
            noResultsTitle: page.noResultsTitle,
            noResultsText: page.noResultsText,
            clear: page.clearLabel,
          }}
        />
      </Section>
      <CtaBand id="portfolio-fechamento" title={home.closing.title} text={home.closing.text} cta={home.closing.cta} />
    </>
  );
}
