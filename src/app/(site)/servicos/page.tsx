import { CtaBand, Steps } from "@/components/site/blocks";
import { SiteButtonLink } from "@/components/site/button";
import { PageHeader, Section, SectionHeader } from "@/components/site/layout";
import type { CSSProperties } from "react";
import { Icon } from "@/components/site/marks";
import { ServicesBlock } from "@/components/site/services-block";
import { pad2, type SiteTone } from "@/components/site/text";
import { buildMetadata } from "@/lib/site/seo";
import { getPackages, getServices, getSiteContent } from "@/server/site/queries";
import "./services.css";

export const generateMetadata = () => buildMetadata("servicos");

/** Rótulos de interface (o restante da copy vem do painel). */
const PAGE_LINK_LABEL = "Conhecer";
const INDEX_LABEL = "Serviços nesta página";

/** Cores do campo de cada serviço enquanto não há capa (alternam para dar ritmo). */
const FIELD_TONES: SiteTone[] = ["roxo", "lavanda", "grafite"];
/** O serviço com página própria vira uma faixa de cor. */
const BAND_TONE: SiteTone = "grafite";

/**
 * Serviços: um bloco por serviço, na ordem definida no painel, com `id` = slug (a home e o menu apontam
 * para #fotografia, #video, #marketing, #eventos, #casamentos). Depois, "Como funciona" e a chamada final.
 * Estática: o serviço pré-selecionado no formulário é resolvido no navegador pelo <LeadForm> (?servico=).
 */
export default async function ServicesPage() {
  const [content, services, packages] = await Promise.all([getSiteContent(), getServices(), getPackages()]);
  const { visibility, servicesPage: page, howItWorks, home } = content;

  const steps = howItWorks.steps.filter((step) => step.title);
  const showHow = visibility.howItWorks && steps.length > 0;
  const showPackages = visibility.packages && packages.plans.length + packages.standalone.length > 0;
  /** Página própria de um serviço: só vira link se estiver publicada. */
  const pageLinkOf = (pagePath: string | null) => {
    if (!pagePath) return null;
    if (pagePath === "/casamentos" && !visibility.weddings) return null;
    return { label: PAGE_LINK_LABEL, href: pagePath };
  };
  const blocks = services.map((service) => ({
    service,
    pageLink: pageLinkOf(service.pagePath),
  }));
  const lastIsBand = Boolean(blocks.at(-1)?.pageLink);

  return (
    <>
      <PageHeader
        eyebrow={page.eyebrow}
        title={page.title}
        lead={page.intro}
        actions={<SiteButtonLink href={page.cta.href}>{page.cta.label}</SiteButtonLink>}
      >
        {services.length > 1 ? (
          <nav className="services__index" aria-label={INDEX_LABEL}>
            <ol style={{ "--cols": Math.min(services.length, 6) } as CSSProperties}>
              {services.map((service, i) => (
                <li key={service.id}>
                  <a href={`#${service.slug}`}>
                    <span className="services__index-n" aria-hidden="true">
                      {pad2(i + 1)}
                    </span>
                    <span className="services__index-title">{service.title}</span>
                    <Icon name="arrow-down" />
                  </a>
                </li>
              ))}
            </ol>
          </nav>
        ) : null}
      </PageHeader>

      {blocks.map(({ service, pageLink }, i) => {
        const band = pageLink ? BAND_TONE : undefined;
        const previousWasBand = i > 0 && Boolean(blocks[i - 1].pageLink);
        const tone = FIELD_TONES[i % FIELD_TONES.length];
        return (
          <ServicesBlock
            key={service.id}
            service={service}
            index={i}
            total={services.length}
            fieldTone={band && tone === band ? "lavanda" : tone}
            flip={i % 2 === 1}
            band={band}
            spaceTop={!band && previousWasBand ? "lg" : undefined}
            pageLink={pageLink}
          />
        );
      })}

      {showHow ? (
        <Section
          id="servicos-como-funciona"
          label={howItWorks.eyebrow}
          labelledBy="servicos-como-titulo"
          spaceTop={lastIsBand ? "lg" : "none"}
        >
          <SectionHeader id="servicos-como-titulo" title={howItWorks.title} />
          <Steps items={steps} action={<SiteButtonLink href={page.cta.href}>{page.cta.label}</SiteButtonLink>} />
        </Section>
      ) : null}

      <CtaBand
        id="servicos-fechamento"
        title={page.closingTitle}
        text={page.closingText}
        cta={page.cta}
        secondaryCta={showPackages ? { ...home.packages.cta, icon: "arrow" } : null}
      />
    </>
  );
}
