import { notFound } from "next/navigation";
import { CtaBand } from "@/components/site/blocks";
import { PageHeader, Section } from "@/components/site/layout";
import { PortfolioBrowser } from "@/components/site/portfolio-browser";
import { buildMetadata } from "@/lib/site/seo";
import { getPortfolio, getSiteContent } from "@/server/site/queries";
import "./portfolio.css";

export const generateMetadata = () => buildMetadata("portfolio");

/**
 * Portfólio. Estático: só existe com a seção ligada E com projetos publicados — caso contrário responde 404
 * (nada de grade vazia; o menu e a home já omitem o item). O filtro por categoria roda no cliente.
 */
export default async function PortfolioPage() {
  const [content, projects] = await Promise.all([getSiteContent(), getPortfolio()]);
  const { visibility, portfolioPage: page, home } = content;
  if (!visibility.portfolio || projects.length === 0) notFound();

  return (
    <>
      <PageHeader eyebrow={page.eyebrow} title={page.title} lead={page.intro} accent="tail" />
      <Section id="portfolio-projetos" number="01" label="Projetos">
        <PortfolioBrowser projects={projects} />
      </Section>
      <CtaBand
        id="portfolio-fechamento"
        title={home.closing.title}
        text={home.closing.text}
        cta={home.closing.cta}
      />
    </>
  );
}
