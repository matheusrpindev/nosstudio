import type { MetadataRoute } from "next";
import { env } from "@/lib/env";
import { getPortfolio, getSiteNav } from "@/server/site/queries";

/** Só páginas que existem e estão visíveis (o menu já respeita a visibilidade das seções). */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [nav, portfolio] = await Promise.all([getSiteNav(), getPortfolio()]);
  const paths = new Set<string>([...nav.map((item) => item.href), "/privacidade"]);
  for (const project of portfolio) paths.add(`/portfolio/${project.slug}`);
  return [...paths].map((path) => ({
    url: `${env.siteUrl}${path === "/" ? "" : path}`,
    changeFrequency: path.startsWith("/portfolio/") ? "yearly" : "monthly",
    priority: path === "/" ? 1 : path === "/contato" ? 0.9 : 0.7,
  }));
}
