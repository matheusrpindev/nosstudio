import type { Metadata } from "next";
import { LegalPage } from "@/components/site/legal-document";
import { fillPrivacyPlaceholders } from "@/lib/site/content";
import { SITE_PATHS } from "@/lib/site/paths";
import { buildMetadata } from "@/lib/site/seo";
import { getSiteContent } from "@/server/site/queries";
import "../legal.css";

export async function generateMetadata(): Promise<Metadata> {
  const { termsPage, general } = await getSiteContent();
  return buildMetadata({
    title: termsPage.title,
    description: `Regras de uso do site da ${general.brandName}: pedidos de orçamento, conteúdo, áreas privadas e direitos autorais.`,
    path: SITE_PATHS.terms,
  });
}

/** Termos de uso do site: mesmo esquema da política de privacidade (texto-base editável no painel). */
export default async function TermsPage() {
  const { termsPage, general } = await getSiteContent();
  return (
    <LegalPage
      eyebrow="Termos de uso"
      title={termsPage.title}
      version={termsPage.version}
      body={fillPrivacyPlaceholders(termsPage.body, general)}
      prefix="termos"
      tocLabel="Nestes termos"
      closing={{ text: "Ficou com alguma dúvida sobre estes termos?", label: "Fale com a gente", href: SITE_PATHS.contact }}
    />
  );
}
