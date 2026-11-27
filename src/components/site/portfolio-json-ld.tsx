import { PORTFOLIO_CATEGORY_LABELS } from "@/lib/domain";
import { env } from "@/lib/env";
import type { PublicPortfolioProject } from "@/lib/site/portfolio";
import { SITE_PATHS } from "@/lib/site/paths";
import { getSiteContent } from "@/server/site/queries";

/**
 * Dados estruturados (schema.org) da página de um projeto: a obra (`CreativeWork`) e a trilha de navegação.
 * Só o que está publicado e é verdade: o criador é a NÓS apenas nos trabalhos da NÓS (experiência anterior dos
 * fundadores não leva `creator`), o cliente não entra, e nada de avaliações ou números.
 * O JSON é escapado ("<" → <), como recomenda o guia de JSON-LD do Next.
 */
export async function PortfolioProjectJsonLd({ project }: { project: PublicPortfolioProject }) {
  const { general, navigation, portfolioPage } = await getSiteContent();
  const url = `${env.siteUrl}${SITE_PATHS.portfolio}/${project.slug}`;
  const absolute = (path: string) => (/^https?:/i.test(path) ? path : `${env.siteUrl}${path}`);
  const images = [project.cover, ...project.gallery].flatMap((image) => (image ? [absolute(image.url)] : []));
  const data = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CreativeWork",
        "@id": `${url}#projeto`,
        name: project.title,
        url,
        inLanguage: "pt-BR",
        genre: PORTFOLIO_CATEGORY_LABELS[project.category],
        ...(project.summary ? { description: project.summary } : {}),
        ...(images.length > 0 ? { image: images.slice(0, 6) } : {}),
        ...(project.projectDate ? { dateCreated: project.projectDate } : {}),
        ...(project.servicesDone.length > 0 ? { keywords: project.servicesDone.join(", ") } : {}),
        ...(project.origin === "nos" ? { creator: { "@type": "Organization", name: general.brandName, url: env.siteUrl } } : {}),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: navigation.home || general.brandName, item: `${env.siteUrl}/` },
          { "@type": "ListItem", position: 2, name: portfolioPage.eyebrow || navigation.portfolio || "Portfólio", item: `${env.siteUrl}${SITE_PATHS.portfolio}` },
          { "@type": "ListItem", position: 3, name: project.title, item: url },
        ],
      },
    ],
  };
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />;
}
