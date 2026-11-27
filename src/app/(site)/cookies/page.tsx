import type { Metadata } from "next";
import { LegalPage } from "@/components/site/legal-document";
import { fillPrivacyPlaceholders } from "@/lib/site/content";
import { SITE_PATHS } from "@/lib/site/paths";
import { buildMetadata } from "@/lib/site/seo";
import { getSiteContent } from "@/server/site/queries";
import "../legal.css";

export async function generateMetadata(): Promise<Metadata> {
  const { cookiesPage, general } = await getSiteContent();
  return buildMetadata({
    title: cookiesPage.title,
    description: `O que o site da ${general.brandName} guarda no seu navegador: sem cookies de rastreamento; só o essencial das áreas privadas.`,
    path: SITE_PATHS.cookies,
  });
}

/** Política de cookies: diz o que o site realmente usa (texto-base editável no painel). */
export default async function CookiesPage() {
  const { cookiesPage, general } = await getSiteContent();
  return (
    <LegalPage
      eyebrow="Cookies"
      title={cookiesPage.title}
      version={cookiesPage.version}
      body={fillPrivacyPlaceholders(cookiesPage.body, general)}
      prefix="cookies"
      tocLabel="Nesta página"
      closing={{ text: "Ficou com alguma dúvida sobre cookies?", label: "Fale com a gente", href: SITE_PATHS.contact }}
    />
  );
}
