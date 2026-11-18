/**
 * Grade de projetos da página /portfolio com filtro por categoria (só categorias que têm projeto publicado).
 * Server Component: os cartões são renderizados no servidor com `data-category`; o filtro é <PortfolioFilter />.
 */
import { PORTFOLIO_CATEGORIES, PORTFOLIO_CATEGORY_LABELS } from "@/lib/domain";
import type { PublicPortfolioProject } from "@/server/site/queries";
import { SmartLink } from "./button";
import { PhotoSlot } from "./photo-slot";
import { PortfolioFilter } from "./portfolio-filter";
import { revealProps } from "./reveal";
import type { SiteTone } from "./text";

const TONES: SiteTone[] = ["roxo", "lavanda", "grafite"];

export function PortfolioBrowser({ projects, allLabel = "Todos" }: { projects: PublicPortfolioProject[]; allLabel?: string }) {
  if (projects.length === 0) return null;
  const options = PORTFOLIO_CATEGORIES.map((value) => ({
    value: value as string,
    label: PORTFOLIO_CATEGORY_LABELS[value],
    count: projects.filter((project) => project.category === value).length,
  })).filter((option) => option.count > 0);

  return (
    <PortfolioFilter options={options} allLabel={allLabel} total={projects.length} groupLabel="Filtrar por categoria">
      <ul className="s-works portfolio__grid">
        {projects.map((project, i) => {
          const year = project.projectDate?.slice(0, 4);
          return (
            <li key={project.id} className="s-work portfolio__item" data-category={project.category} {...revealProps(i % 3)}>
              <PhotoSlot
                image={project.cover}
                alt={project.cover?.alt || project.title}
                ratio="4 / 5"
                tone={TONES[i % TONES.length]}
                monogram={project.title}
                sizes="(min-width: 1024px) 30vw, (min-width: 768px) 46vw, 100vw"
              />
              <p className="s-meta s-work__meta">
                <b>{PORTFOLIO_CATEGORY_LABELS[project.category]}</b>
                {project.clientName ? <span>{project.clientName}</span> : null}
                {year ? <span>{year}</span> : null}
              </p>
              <h2 className="s-h3 s-work__title">
                <SmartLink href={`/portfolio/${project.slug}`}>{project.title}</SmartLink>
              </h2>
              {project.summary ? <p className="s-work__text">{project.summary}</p> : null}
            </li>
          );
        })}
      </ul>
    </PortfolioFilter>
  );
}
