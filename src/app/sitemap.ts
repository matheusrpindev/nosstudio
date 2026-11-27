import type { MetadataRoute } from "next";
import { connection } from "next/server";
import { env } from "@/lib/env";
import { SITE_PATHS, servicePath } from "@/lib/site/paths";
import { getPortfolio, getServices, getSiteNav } from "@/server/site/queries";

/**
 * Só páginas que existem e estão visíveis: o menu já respeita a visibilidade (Planos, Portfólio, Eventos e
 * Casamentos), cada serviço PUBLICADO tem a sua página e as três páginas legais entram sempre. A "Área do
 * Cliente" (login) fica de fora — áreas privadas não são indexadas.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // A cada requisição: o `SITE_URL` de produção pode não existir durante o build (ver robots.ts).
  await connection();
  const [nav, services, portfolio] = await Promise.all([getSiteNav(), getServices(), getPortfolio()]);
  const paths = new Set<string>([...nav.map((item) => item.href), SITE_PATHS.privacy, SITE_PATHS.terms, SITE_PATHS.cookies]);
  for (const service of services) paths.add(servicePath(service.slug));
  for (const project of portfolio) paths.add(`/portfolio/${project.slug}`);
  return [...paths].map((path) => ({
    url: `${env.siteUrl}${path === "/" ? "" : path}`,
    changeFrequency: path.startsWith("/portfolio/") ? "yearly" : "monthly",
    priority: path === "/" ? 1 : path === SITE_PATHS.contact ? 0.9 : path.startsWith(`${SITE_PATHS.services}/`) ? 0.8 : 0.7,
  }));
}
