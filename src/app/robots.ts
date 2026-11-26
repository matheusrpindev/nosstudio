import type { MetadataRoute } from "next";
import { connection } from "next/server";
import { env } from "@/lib/env";

/**
 * Renderizado a cada requisição (`connection()`): `SITE_URL` costuma existir só em tempo de execução (Docker),
 * e um robots.txt pré-renderizado no build apontaria para http://localhost:3000.
 */
export default async function robots(): Promise<MetadataRoute.Robots> {
  await connection();
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/painel", "/equipe", "/cliente", "/login", "/convite", "/conta", "/recuperar-senha", "/redefinir-senha", "/api/", "/media/priv/"],
      },
    ],
    sitemap: `${env.siteUrl}/sitemap.xml`,
    host: env.siteUrl,
  };
}
