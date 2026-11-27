import type { Metadata } from "next";
import { LegalPage } from "@/components/site/legal-document";
import { fillPrivacyPlaceholders } from "@/lib/site/content";
import { SITE_PATHS } from "@/lib/site/paths";
import { buildMetadata } from "@/lib/site/seo";
import { getSiteContent } from "@/server/site/queries";
import "../legal.css";

export async function generateMetadata(): Promise<Metadata> {
  const { privacyPage, general } = await getSiteContent();
  return buildMetadata({
    title: privacyPage.title,
    description: `Como a ${general.brandName} trata os dados pessoais de quem visita o site ou entra em contato (LGPD).`,
    path: SITE_PATHS.privacy,
  });
}

/** Política de privacidade: título, versão e texto em markdown (placeholders `{{marca}}`/`{{email}}` preenchidos). */
export default async function PrivacyPage() {
  const { privacyPage, general } = await getSiteContent();
  return (
    <LegalPage
      eyebrow="Privacidade e LGPD"
      title={privacyPage.title}
      version={privacyPage.version}
      body={fillPrivacyPlaceholders(privacyPage.body, general)}
      prefix="privacidade"
      tocLabel="Nesta política"
      closing={{ text: "Ficou com alguma dúvida sobre os seus dados?", label: "Voltar ao contato", href: SITE_PATHS.contact }}
    />
  );
}
