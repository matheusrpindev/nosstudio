/**
 * Cartões de portfólio e de depoimento. Só recebem conteúdo PUBLICADO (as funções de
 * src/server/site/queries.ts já filtram) — os blocos que os usam não devem renderizar quando a lista vem vazia.
 */
import { Paragraphs } from "@/components/markdown";
import { cn } from "@/lib/cn";
import type { PublicPortfolioProject, PublicTestimonial } from "@/server/site/queries";
import { AccentMark } from "./marks";
import type { PhotoRatio } from "./photo-slot";
import { PortfolioCardBody } from "./portfolio-card";
import { revealProps } from "./reveal";
import { SiteImage } from "./site-image";
import { VideoEmbed } from "./video-embed";

/**
 * Cartão de projeto: capa (ou o estado vazio da marca), categoria, título e resumo. O cartão inteiro é o link.
 * O miolo (com o selo de experiência anterior dos fundadores) é o mesmo da grade de /portfolio: <PortfolioCardBody>.
 */
export function PortfolioCard({
  project,
  index = 0,
  ratio = "4 / 5",
  headingLevel = 3,
  sizes,
}: {
  project: PublicPortfolioProject;
  /** Posição na grade: alterna a cor do estado vazio e o atraso da animação. */
  index?: number;
  ratio?: PhotoRatio;
  headingLevel?: 2 | 3;
  sizes?: string;
}) {
  return (
    <li className="s-work" {...revealProps(index % 3)}>
      <PortfolioCardBody project={project} index={index} ratio={ratio} headingLevel={headingLevel} sizes={sizes} />
    </li>
  );
}

export function PortfolioGrid({
  projects,
  headingLevel,
  className,
}: {
  projects: PublicPortfolioProject[];
  headingLevel?: 2 | 3;
  className?: string;
}) {
  if (projects.length === 0) return null;
  return (
    <ul className={cn("s-works", className)}>
      {projects.map((project, i) => (
        <PortfolioCard key={project.id} project={project} index={i} headingLevel={headingLevel} />
      ))}
    </ul>
  );
}

/**
 * Depoimento real e autorizado. Três formatos: texto (citação), print de conversa (imagem com descrição
 * acessível) e vídeo (carrega só ao clicar).
 */
export function TestimonialCard({ testimonial, index = 0 }: { testimonial: PublicTestimonial; index?: number }) {
  const { kind, image, content, videoUrl, authorName, authorRole, mediaAlt } = testimonial;
  return (
    <li className="s-quote" {...revealProps(index % 3)}>
      <span className="s-quote__mark" aria-hidden="true">
        <AccentMark />
        <AccentMark />
      </span>
      {kind === "video" && videoUrl ? (
        <VideoEmbed url={videoUrl} title={authorName ? `Depoimento de ${authorName}` : "Depoimento em vídeo"} poster={image} />
      ) : null}
      {kind === "print" && image ? (
        <SiteImage
          image={image}
          alt={mediaAlt || image.alt}
          sizes="(min-width: 1024px) 22rem, 100vw"
          className="s-quote__print"
        />
      ) : null}
      {content ? (
        <blockquote>
          <Paragraphs>{content}</Paragraphs>
        </blockquote>
      ) : null}
      {authorName || authorRole ? (
        <footer>
          {authorName ? <strong>{authorName}</strong> : null}
          {authorRole ? <span>{authorRole}</span> : null}
        </footer>
      ) : null}
    </li>
  );
}

export function TestimonialGrid({ testimonials, className }: { testimonials: PublicTestimonial[]; className?: string }) {
  if (testimonials.length === 0) return null;
  return (
    <ul className={cn("s-quotes", className)} data-count={Math.min(testimonials.length, 3)}>
      {testimonials.map((testimonial, i) => (
        <TestimonialCard key={testimonial.id} testimonial={testimonial} index={i} />
      ))}
    </ul>
  );
}
