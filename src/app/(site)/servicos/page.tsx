import { CtaBand, Steps } from "@/components/site/blocks";
import { SiteButtonLink, SiteLink } from "@/components/site/button";
import { PageHeader, Section, SectionHeader } from "@/components/site/layout";
import { revealProps } from "@/components/site/reveal";
import { pad2 } from "@/components/site/text";
import { SITE_PATHS, servicePath } from "@/lib/site/paths";
import { buildMetadata } from "@/lib/site/seo";
import { getPackages, getServices, getSiteContent } from "@/server/site/queries";
import "./services.css";

export const generateMetadata = () => buildMetadata("servicos");

/**
 * Serviços: o catálogo. Uma linha por serviço publicado, na ordem definida no painel — número, nome, resumo e as
 * possíveis entregas — e o link para a página própria (/servicos/<slug>). As âncoras (#fotografia, #audiovisual…)
 * continuam valendo. Depois, o processo de atendimento e a chamada final. Estática.
 */
export default async function ServicesPage() {
  const [content, services, packages] = await Promise.all([getSiteContent(), getServices(), getPackages()]);
  const { visibility, servicesPage: page, howItWorks, home } = content;

  const steps = howItWorks.steps.filter((step) => step.title);
  const showPackages = visibility.packages && packages.plans.length + packages.standalone.length > 0;

  return (
    <>
      <PageHeader
        eyebrow={page.eyebrow}
        title={page.title}
        lead={page.intro}
        actions={<SiteButtonLink href={page.cta.href}>{page.cta.label}</SiteButtonLink>}
      />

      {services.length > 0 ? (
        <section className="s-section services__catalog" aria-label={page.eyebrow}>
          <div className="s-wrap">
            <ol className="services__rows">
              {services.map((service, i) => {
                const titleId = `servicos-${service.slug}-titulo`;
                return (
                  <li key={service.id} id={service.slug} className="services__row" aria-labelledby={titleId}>
                    <span className="s-rule" aria-hidden="true" {...revealProps()} />
                    <p className="services__row-n" aria-hidden="true">
                      <span>{pad2(i + 1)}</span>/{pad2(services.length)}
                    </p>
                    <div className="services__row-head">
                      <h2 id={titleId} className="services__title">
                        {service.title}
                      </h2>
                      <SiteLink href={servicePath(service.slug)} aria-label={`${page.detailLabel}: ${service.title}`} className="services__row-link">
                        {page.detailLabel}
                      </SiteLink>
                    </div>
                    <div className="services__row-body">
                      {service.summary ? <p className="s-lead services__summary">{service.summary}</p> : null}
                      {service.items.length > 0 ? (
                        <ul className="services__list services__list--cols" aria-label={`${service.title}: ${page.detail.deliverablesTitle}`}>
                          {service.items.map((item, j) => (
                            <li key={j}>{item}</li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
        </section>
      ) : null}

      {steps.length > 0 ? (
        <Section id="servicos-como-funciona" label={howItWorks.eyebrow} labelledBy="servicos-como-titulo">
          <SectionHeader id="servicos-como-titulo" title={howItWorks.title} />
          <Steps items={steps} action={<SiteButtonLink href={page.cta.href}>{page.cta.label}</SiteButtonLink>} />
        </Section>
      ) : null}

      <CtaBand
        id="servicos-fechamento"
        title={page.closingTitle}
        text={page.closingText}
        cta={page.cta}
        secondaryCta={showPackages ? { label: home.packages.cta.label, href: SITE_PATHS.plans, icon: "arrow" } : null}
      />
    </>
  );
}
