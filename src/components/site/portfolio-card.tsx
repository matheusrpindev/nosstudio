/**
 * Miolo do cartão de projeto do portfólio (capa ou estado vazio da marca, selos, categoria, título e resumo),
 * sem o <li>: quem usa decide o invólucro — <PortfolioCard> (showcase.tsx) nas grades simples e
 * <PortfolioBrowser> na página /portfolio, onde o <li> é do filtro (Client Component).
 *
 * Selos: "destaque" (só onde `featuredLabel` é passado) e o selo discreto de experiência anterior dos fundadores,
 * que aparece em TODO lugar onde o cartão é usado — o visitante nunca confunde com trabalho da NÓS.
 * Server Component (usa <PhotoSlot>, que traz o <Logo>).
 */
import { PORTFOLIO_CATEGORY_LABELS, PORTFOLIO_PREVIOUS_BADGE } from "@/lib/domain";
import type { PublicPortfolioProject } from "@/lib/site/portfolio";
import { SmartLink } from "./button";
import { PhotoSlot, type PhotoRatio } from "./photo-slot";
import type { SiteTone } from "./text";
import "./portfolio-card.css";

const TONES: SiteTone[] = ["roxo", "lavanda", "grafite"];

export type PortfolioCardProject = Pick<PublicPortfolioProject, "id" | "slug" | "title" | "category" | "summary" | "clientName" | "projectDate" | "cover" | "origin">;

export function PortfolioCardBody({
  project,
  index = 0,
  ratio = "4 / 5",
  headingLevel = 3,
  sizes,
  featuredLabel,
}: {
  project: PortfolioCardProject;
  /** Posição na grade: alterna a cor do estado vazio. */
  index?: number;
  ratio?: PhotoRatio;
  headingLevel?: 2 | 3;
  sizes?: string;
  /** Texto do selo de destaque. Vazio/ausente = sem selo. */
  featuredLabel?: string;
}) {
  const Title = `h${headingLevel}` as "h2" | "h3";
  const year = project.projectDate?.slice(0, 4);
  return (
    <>
      <div className="s-work__cover">
        <PhotoSlot image={project.cover} ratio={ratio} tone={TONES[index % TONES.length]} monogram={project.title} sizes={sizes} />
        {featuredLabel ? <span className="s-work__flag">{featuredLabel}</span> : null}
        {project.origin === "experiencia_anterior" ? <span className="s-work__seal">{PORTFOLIO_PREVIOUS_BADGE}</span> : null}
      </div>
      <p className="s-meta s-work__meta">
        <b>{PORTFOLIO_CATEGORY_LABELS[project.category]}</b>
        {project.clientName ? <span>{project.clientName}</span> : null}
        {year ? <span>{year}</span> : null}
      </p>
      <Title className="s-h3 s-work__title">
        <SmartLink href={`/portfolio/${project.slug}`}>{project.title}</SmartLink>
      </Title>
      {project.summary ? <p className="s-work__text">{project.summary}</p> : null}
    </>
  );
}
