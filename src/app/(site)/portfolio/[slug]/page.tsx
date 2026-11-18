import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CtaBand } from "@/components/site/blocks";
import { PageHeader, Section } from "@/components/site/layout";
import { PhotoSlot } from "@/components/site/photo-slot";
import { PortfolioProjectGallery } from "@/components/site/portfolio-project-gallery";
import { revealProps } from "@/components/site/reveal";
import { sectionCounter } from "@/components/site/text";
import { VideoEmbed } from "@/components/site/video-embed";
import { Markdown } from "@/components/markdown";
import { formatMonth } from "@/lib/dates";
import { PORTFOLIO_CATEGORY_LABELS } from "@/lib/domain";
import { videoEmbedUrl } from "@/lib/format";
import { buildMetadata } from "@/lib/site/seo";
import { getPortfolio, getPortfolioProject, getSiteContent } from "@/server/site/queries";
import "../portfolio.css";

type Props = { params: Promise<{ slug: string }> };

/**
 * Com Cache Components, `generateStaticParams` precisa devolver pelo menos um item. Enquanto não há projeto
 * publicado, devolvemos um slug reservado — a página responde 404 para ele (e para qualquer slug desconhecido).
 * Projetos publicados depois do build são renderizados na primeira visita e guardados em cache (ISR); o
 * painel invalida o cache do site (`invalidateSite()`) ao publicar, despublicar ou editar.
 */
const PLACEHOLDER_SLUG = "__sem-projetos__";

/**
 * A página lê `params` fora de <Suspense> de propósito: assim cada slug vira uma entrada própria no cache (ISR) e
 * um slug inexistente é guardado como 404 de verdade. Os slugs publicados saem pré-renderizados; por isso a
 * validação "instant" é desligada para este segmento.
 *
 * Limite conhecido do Next 16 com Cache Components (não é defeito desta página): a PRIMEIRA visita a um slug que
 * ainda não está no cache — inexistente, ou de um projeto recém-despublicado/ocultado — é renderizada na hora, e
 * nesse caso o Next já começou a resposta com status 200 quando `notFound()` roda (vale mesmo com a casca vazia e
 * `instant = false`; ver "Status codes" em node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/loading.md).
 * O corpo já é a página "não encontrada", com `<meta name="robots" content="noindex">`, e da segunda visita em
 * diante a resposta sai do cache com 404. O único jeito documentado de devolver 404 já na primeira é checar o slug
 * no Proxy (src/proxy.ts) antes da renderização — o que exigiria consultar o banco a cada visita, fora do cache de
 * `src/server/site/queries.ts`. Por isso fica como está.
 */
export const instant = false;

export async function generateStaticParams() {
  const projects = await getPortfolio();
  return projects.length > 0 ? projects.map((project) => ({ slug: project.slug })) : [{ slug: PLACEHOLDER_SLUG }];
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const project = await getPortfolioProject(slug);
  if (!project) return { title: "Projeto não encontrado", robots: { index: false, follow: false } };
  return buildMetadata({
    title: project.title,
    description: project.summary || `${PORTFOLIO_CATEGORY_LABELS[project.category]} — ${project.title}`,
    path: `/portfolio/${project.slug}`,
    image: project.cover?.url ?? null,
  });
}

/** Página de um projeto publicado. Slug desconhecido (ou portfólio desligado) → 404. */
export default async function PortfolioProjectPage({ params }: Props) {
  const { slug } = await params;
  const [project, content] = await Promise.all([getPortfolioProject(slug), getSiteContent()]);
  if (!project || !content.visibility.portfolio) notFound();

  const { portfolioPage: page, home } = content;
  const next = sectionCounter();
  const category = PORTFOLIO_CATEGORY_LABELS[project.category];
  const date = project.projectDate ? formatMonth(project.projectDate) : "";
  const services = project.servicesDone.filter(Boolean);
  const hasVideo = Boolean(videoEmbedUrl(project.videoUrl));
  const hasAbout = Boolean(project.description.trim() || services.length > 0 || project.clientName || date);

  return (
    <>
      <PageHeader
        eyebrow={category}
        title={project.title}
        lead={project.summary}
        meta={
          <Link href="/portfolio" className="s-link">
            <span aria-hidden="true">←</span> Voltar ao portfólio
          </Link>
        }
      >
        <div className="portfolio-project__cover" {...revealProps()}>
          <PhotoSlot
            image={project.cover}
            alt={project.cover?.alt || project.title}
            ratio="16 / 9"
            tone="roxo"
            monogram={project.title}
            sizes="(min-width: 1440px) 1330px, 100vw"
            priority
          />
        </div>
      </PageHeader>

      {hasAbout ? (
        <Section id="projeto-sobre" number={next()} label="O projeto" labelledBy="projeto-sobre-titulo">
          <h2 id="projeto-sobre-titulo" className="sr-only">
            Sobre o projeto {project.title}
          </h2>
          <div className="portfolio-project__body">
            <dl className="portfolio-facts" {...revealProps()}>
              {project.clientName ? (
                <div>
                  <dt>Cliente</dt>
                  <dd>{project.clientName}</dd>
                </div>
              ) : null}
              <div>
                <dt>Categoria</dt>
                <dd>{category}</dd>
              </div>
              {date ? (
                <div>
                  <dt>Data</dt>
                  <dd>{date}</dd>
                </div>
              ) : null}
              {services.length > 0 ? (
                <div>
                  <dt>Serviços realizados</dt>
                  <dd>
                    <ul>
                      {services.map((service, i) => (
                        <li key={i}>{service}</li>
                      ))}
                    </ul>
                  </dd>
                </div>
              ) : null}
            </dl>
            {project.description.trim() ? (
              <div className="portfolio-project__text" {...revealProps(1)}>
                <Markdown className="s-prose">{project.description}</Markdown>
              </div>
            ) : null}
          </div>
        </Section>
      ) : null}

      {hasVideo ? (
        <Section id="projeto-video" number={next()} label="Vídeo" labelledBy="projeto-video-titulo">
          <h2 id="projeto-video-titulo" className="sr-only">
            Vídeo do projeto {project.title}
          </h2>
          <div className="portfolio-project__video" {...revealProps()}>
            <VideoEmbed url={project.videoUrl} title={`Vídeo do projeto ${project.title}`} poster={project.cover} />
          </div>
        </Section>
      ) : null}

      {project.gallery.length > 0 ? (
        <Section id="projeto-galeria" number={next()} label="Galeria" labelledBy="projeto-galeria-titulo">
          <h2 id="projeto-galeria-titulo" className="sr-only">
            Galeria do projeto {project.title}
          </h2>
          <PortfolioProjectGallery images={project.gallery} title={project.title} />
        </Section>
      ) : null}

      <CtaBand
        id="projeto-fechamento"
        title={home.closing.question}
        text={home.closing.text}
        cta={home.closing.cta}
        secondaryCta={{ label: page.eyebrow, href: "/portfolio", icon: "arrow" }}
      />
    </>
  );
}
