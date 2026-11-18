import { SiteLink } from "@/components/site/button";
import { PageHeader, Section } from "@/components/site/layout";
import { PrivacyDocument, privacyHeadings } from "@/components/site/privacy-document";
import { fillPrivacyPlaceholders } from "@/lib/site/content";
import { getSiteContent } from "@/server/site/queries";
import type { Metadata } from "next";
import "./privacy.css";

export async function generateMetadata(): Promise<Metadata> {
  const { privacyPage, general, seo } = await getSiteContent();
  const siteName = seo.siteName || general.brandName;
  return {
    title: `${privacyPage.title} · ${siteName}`,
    description: `Como a ${general.brandName} trata os dados pessoais de quem visita o site ou entra em contato (LGPD).`,
    alternates: { canonical: "/privacidade" },
  };
}

/** Política de privacidade: título, versão e texto em markdown (placeholders `{{marca}}`/`{{email}}` preenchidos). */
export default async function PrivacyPage() {
  const { privacyPage, general } = await getSiteContent();
  const body = fillPrivacyPlaceholders(privacyPage.body, general);
  const headings = privacyHeadings(body);

  return (
    <>
      <PageHeader
        title={privacyPage.title}
        meta={privacyPage.version ? <>Versão {privacyPage.version}</> : null}
        eyebrow="Privacidade e LGPD"
      />
      <Section id="privacidade-texto" labelledBy={undefined}>
        <div className="privacy__grid">
          {headings.length > 1 ? (
            <nav className="privacy__toc" aria-labelledby="privacidade-indice">
              <h2 id="privacidade-indice" className="s-meta privacy__toc-title">
                Nesta política
              </h2>
              <ol>
                {headings.map((heading) => (
                  <li key={heading.id}>
                    <a href={`#${heading.id}`}>{heading.title}</a>
                  </li>
                ))}
              </ol>
            </nav>
          ) : null}
          <div className="privacy__doc">
            <PrivacyDocument body={body} />
            <div className="privacy__foot">
              <p className="s-muted">Ficou com alguma dúvida sobre os seus dados?</p>
              <SiteLink href="/contato">Voltar ao contato</SiteLink>
            </div>
          </div>
        </div>
      </Section>
    </>
  );
}
