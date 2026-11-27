import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CtaBand } from "@/components/site/blocks";
import { PageHeader, Section, SectionHeader } from "@/components/site/layout";
import { PhotoSlot } from "@/components/site/photo-slot";
import { PortfolioBeforeAfter } from "@/components/site/portfolio-before-after";
import { PortfolioProjectJsonLd } from "@/components/site/portfolio-json-ld";
import { PortfolioProjectGallery } from "@/components/site/portfolio-project-gallery";
import { PortfolioShare } from "@/components/site/portfolio-share";
import { revealProps } from "@/components/site/reveal";
import { PortfolioGrid } from "@/components/site/showcase";
import { pad2, sectionCounter } from "@/components/site/text";
import { VideoEmbed } from "@/components/site/video-embed";
import { Markdown } from "@/components/markdown";
import { formatMonth } from "@/lib/dates";
import { PORTFOLIO_CATEGORY_LABELS } from "@/lib/domain";
import { SITE_PATHS } from "@/lib/site/paths";
import { projectVideos } from "@/lib/site/portfolio";
import { absoluteUrl, buildMetadata } from "@/lib/site/seo";
import { getPortfolio, getPortfolioProject, getPortfolioProjectPage, getSiteContent } from "@/server/site/queries";
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
 * `src/server/site/queries.ts` (`dynamicParams = false` não existe com Cache Components). Por isso fica como está.
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
    path: `${SITE_PATHS.portfolio}/${project.slug}`,
    image: project.cover?.url ?? null,
  });
}

/**
 * Página de um projeto publicado (briefing v2, seção 08): nome, categoria, cliente autorizado, data e serviços;
 * estudo de caso (objetivo, desafio, solução, resultados); vídeos; galeria com ampliação; antes e depois;
 * bastidores; compartilhamento e projetos relacionados. CADA bloco só aparece quando tem conteúdo — nada de
 * título solto. Trabalho de experiência anterior dos fundadores leva um aviso logo na abertura.
 * Slug desconhecido (ou portfólio desligado) → 404.
 */
export default async function PortfolioProjectPage({ params }: Props) {
  const { slug } = await params;
  const [found, content] = await Promise.all([getPortfolioProjectPage(slug), getSiteContent()]);
  if (!found || !content.visibility.portfolio) notFound();

  const { project, related } = found;
  const { portfolioPage: page, home } = content;
  const labels = page.detail;
  const next = sectionCounter();
  const category = PORTFOLIO_CATEGORY_LABELS[project.category];
  const date = project.projectDate ? formatMonth(project.projectDate) : "";
  const path = `${SITE_PATHS.portfolio}/${project.slug}`;
  const videos = projectVideos(project);
  const previous = project.origin === "experiencia_anterior";
  const caseBlocks = [
    { id: "objetivo", title: labels.objectiveTitle, text: project.objective, highlight: false },
    { id: "desafio", title: labels.challengeTitle, text: project.challenge, highlight: false },
    { id: "solucao", title: labels.solutionTitle, text: project.solution, highlight: false },
    { id: "resultados", title: labels.resultsTitle, text: project.results, highlight: true },
  ].filter((block) => block.text);

  return (
    <>
      <PortfolioProjectJsonLd project={project} />
      <PageHeader
        eyebrow={category}
        title={project.title}
        lead={project.summary}
        meta={
          <Link href={SITE_PATHS.portfolio} className="s-link portfolio-project__back">
            <span aria-hidden="true">←</span> {labels.backLabel || page.eyebrow}
          </Link>
        }
      >
        {previous ? (
          <aside className="portfolio-origin" data-tone="lavanda" aria-labelledby="projeto-origem-titulo" {...revealProps()}>
            <p id="projeto-origem-titulo" className="portfolio-origin__title">
              {labels.previousTitle}
            </p>
            <div className="portfolio-origin__text">
              {labels.previousText ? <p>{labels.previousText}</p> : null}
              {project.originNote ? <p className="portfolio-origin__note">{project.originNote}</p> : null}
            </div>
          </aside>
        ) : null}
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

      {/* 1 · O projeto: ficha (cliente só com autorização) + descrição */}
      <Section id="projeto-sobre" number={next()} label={labels.aboutTitle} labelledBy="projeto-sobre-titulo">
        <h2 id="projeto-sobre-titulo" className="sr-only">
          {labels.aboutTitle}: {project.title}
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
              <dd>
                <Link href={`${SITE_PATHS.portfolio}?categoria=${project.category}`}>{category}</Link>
              </dd>
            </div>
            {date ? (
              <div>
                <dt>Data</dt>
                <dd>{date}</dd>
              </div>
            ) : null}
            {project.servicesDone.length > 0 ? (
              <div>
                <dt>Serviços realizados</dt>
                <dd>
                  <ul>
                    {project.servicesDone.map((service, i) => (
                      <li key={i}>{service}</li>
                    ))}
                  </ul>
                </dd>
              </div>
            ) : null}
          </dl>
          {project.description ? (
            <div className="portfolio-project__text" {...revealProps(1)}>
              <Markdown className="s-prose">{project.description}</Markdown>
            </div>
          ) : null}
        </div>
      </Section>

      {/* 2 · Estudo de caso — só os blocos preenchidos; resultados em destaque */}
      {caseBlocks.length > 0 ? (
        <Section id="projeto-estudo" number={next()} label={labels.caseTitle} labelledBy="projeto-estudo-titulo">
          <h2 id="projeto-estudo-titulo" className="sr-only">
            {labels.caseTitle}: {project.title}
          </h2>
          <ol className="portfolio-case">
            {caseBlocks.map((block, i) => (
              <li key={block.id} id={`projeto-${block.id}`} className="portfolio-case__row" data-tone={block.highlight ? "lavanda" : undefined} {...revealProps(i % 2)}>
                <div className="portfolio-case__head">
                  <span className="portfolio-case__n" aria-hidden="true">
                    {pad2(i + 1)}
                  </span>
                  <h3 className="s-h3">{block.title}</h3>
                </div>
                <Markdown className="s-prose portfolio-case__text">{block.text}</Markdown>
              </li>
            ))}
          </ol>
        </Section>
      ) : null}

      {/* 3 · Vídeos — carregam só quando o visitante clica */}
      {videos.length > 0 ? (
        <Section id="projeto-video" number={next()} label={labels.videoTitle} labelledBy="projeto-video-titulo">
          <h2 id="projeto-video-titulo" className="sr-only">
            {labels.videoTitle}: {project.title}
          </h2>
          <div className="portfolio-videos" data-count={Math.min(videos.length, 3)}>
            {videos.map((url, i) => (
              <div key={url} className="portfolio-videos__item" {...revealProps(i % 2)}>
                <VideoEmbed
                  url={url}
                  title={videos.length > 1 ? `${project.title} — vídeo ${i + 1} de ${videos.length}` : project.title}
                  poster={i === 0 ? project.cover : null}
                />
              </div>
            ))}
          </div>
        </Section>
      ) : null}

      {/* 4 · Galeria com ampliação */}
      {project.gallery.length > 0 ? (
        <Section id="projeto-galeria" number={next()} label={labels.galleryTitle} labelledBy="projeto-galeria-titulo">
          <h2 id="projeto-galeria-titulo" className="sr-only">
            {labels.galleryTitle}: {project.title}
          </h2>
          <PortfolioProjectGallery images={project.gallery} label={`${labels.galleryTitle}: ${project.title}`} />
        </Section>
      ) : null}

      {/* 5 · Antes e depois */}
      {project.beforeAfter.length > 0 ? (
        <Section id="projeto-antes-depois" number={next()} label={labels.beforeAfterTitle} labelledBy="projeto-antes-depois-titulo">
          <h2 id="projeto-antes-depois-titulo" className="sr-only">
            {labels.beforeAfterTitle}: {project.title}
          </h2>
          <div className="portfolio-compares" data-count={Math.min(project.beforeAfter.length, 2)}>
            {project.beforeAfter.map((pair, i) => (
              <div key={`${pair.before.id}-${pair.after.id}-${i}`} {...revealProps(i % 2)}>
                <PortfolioBeforeAfter before={pair.before} after={pair.after} caption={pair.caption} beforeLabel={labels.beforeLabel} afterLabel={labels.afterLabel} />
              </div>
            ))}
          </div>
        </Section>
      ) : null}

      {/* 6 · Bastidores */}
      {project.backstage.length > 0 ? (
        <Section id="projeto-bastidores" number={next()} label={labels.backstageTitle} labelledBy="projeto-bastidores-titulo">
          <h2 id="projeto-bastidores-titulo" className="sr-only">
            {labels.backstageTitle}: {project.title}
          </h2>
          <PortfolioProjectGallery images={project.backstage} label={`${labels.backstageTitle}: ${project.title}`} variant="backstage" />
        </Section>
      ) : null}

      {/* Compartilhar — sem script de terceiros */}
      <section className="portfolio-share" aria-labelledby="projeto-compartilhar-titulo">
        <div className="s-wrap">
          <div className="portfolio-share__row">
            <h2 id="projeto-compartilhar-titulo" className="s-h4">
              {labels.shareTitle || "Compartilhar"}
            </h2>
            <PortfolioShare title={project.title} url={absoluteUrl(path)} />
          </div>
        </div>
      </section>

      {/* 7 · Projetos relacionados — escolhidos à mão ou da mesma categoria; só publicados */}
      {related.length > 0 ? (
        <Section id="projeto-relacionados" number={next()} label={labels.relatedTitle} labelledBy={labels.relatedTitle ? "projeto-relacionados-titulo" : undefined}>
          <SectionHeader id="projeto-relacionados-titulo" title={labels.relatedTitle} />
          <PortfolioGrid projects={related} />
        </Section>
      ) : null}

      <CtaBand
        id="projeto-fechamento"
        title={home.closing.question}
        text={home.closing.text}
        cta={home.closing.cta}
        secondaryCta={{ label: page.eyebrow, href: SITE_PATHS.portfolio, icon: "arrow" }}
      />
    </>
  );
}
