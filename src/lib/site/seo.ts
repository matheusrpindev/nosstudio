/**
 * Metadados (SEO e compartilhamento) das páginas públicas, a partir do conteúdo editável em Painel → Site → SEO.
 * Uso: `export const generateMetadata = () => buildMetadata("sobre");`
 */
import "server-only";
import type { Metadata } from "next";
import { env } from "@/lib/env";
import type { SiteContent } from "@/lib/site/content";
import { getSiteContent, getSiteImages } from "@/server/site/queries";

export type SeoPage = keyof SiteContent["seo"]["pages"];

export const SEO_PATHS: Record<SeoPage, string> = {
  home: "/",
  sobre: "/sobre",
  servicos: "/servicos",
  pacotes: "/pacotes",
  casamentos: "/casamentos",
  portfolio: "/portfolio",
  contato: "/contato",
};

type CustomPage = {
  title: string;
  description?: string;
  /** Caminho da página (para o canonical), ex.: "/portfolio/meu-projeto". */
  path: string;
  /** Imagem de compartilhamento específica (URL absoluta ou caminho). */
  image?: string | null;
  noindex?: boolean;
};

export async function buildMetadata(page: SeoPage | CustomPage): Promise<Metadata> {
  const [content, images] = await Promise.all([getSiteContent(), getSiteImages()]);
  const { seo, general } = content;
  const custom = typeof page === "object";
  const path = custom ? page.path : SEO_PATHS[page];
  const pageSeo = custom ? { title: page.title, description: page.description ?? "" } : seo.pages[page];
  const siteName = seo.siteName || general.brandName;

  const isHome = !custom && page === "home";
  const title = isHome ? pageSeo.title || siteName : `${pageSeo.title} · ${siteName}`;
  const description = pageSeo.description || seo.pages.home.description;
  const image = (custom && page.image) || images.share?.url || "/og";

  return {
    title,
    description,
    alternates: { canonical: path },
    robots: custom && page.noindex ? { index: false, follow: false } : undefined,
    verification: seo.googleVerification ? { google: seo.googleVerification } : undefined,
    openGraph: {
      type: "website",
      locale: "pt_BR",
      siteName,
      title,
      description,
      url: path,
      images: [{ url: image, width: 1200, height: 630, alt: `${general.brandName} — ${general.tagline}` }],
    },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}

/** URL absoluta de um caminho do site. */
export function absoluteUrl(path: string): string {
  return `${env.siteUrl}${path.startsWith("/") ? path : `/${path}`}`;
}
