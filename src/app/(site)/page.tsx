import { ContactChannels, FaqAccordion, ServicePanels, StatementBanner, Steps, ValuesList, type ContactChannel } from "@/components/site/blocks";
import { SiteButtonLink, SiteLink } from "@/components/site/button";
import { HomeHero } from "@/components/site/home-hero";
import { Display, Section, SectionHeader } from "@/components/site/layout";
import { LeadForm } from "@/components/site/lead-form";
import { PackageBoard } from "@/components/site/package-card";
import { PhotoSlot } from "@/components/site/photo-slot";
import { revealProps } from "@/components/site/reveal";
import { PortfolioGrid, TestimonialGrid } from "@/components/site/showcase";
import { displayRole, pad2, paragraphs, sectionCounter } from "@/components/site/text";
import { instagramLink, whatsAppLink } from "@/lib/format";
import { buildMetadata } from "@/lib/site/seo";
import {
  getFaqs,
  getPackages,
  getPortfolio,
  getServices,
  getSiteContent,
  getSiteImages,
  getTestimonials,
} from "@/server/site/queries";

export const generateMetadata = () => buildMetadata("home");

/**
 * Página inicial. Toda a copy vem de `getSiteContent()`; as seções respeitam `content.visibility` e somem
 * quando não há conteúdo publicado — a numeração ("01 —", "02 —"…) continua sequencial.
 */
export default async function HomePage() {
  const [content, images, services, packages, faqs, portfolio, testimonials] = await Promise.all([
    getSiteContent(),
    getSiteImages(),
    getServices(),
    getPackages(),
    getFaqs(),
    getPortfolio(),
    getTestimonials(),
  ]);
  const { general, visibility, home, about, howItWorks, packagesPage, contactPage } = content;
  const { hero } = home;
  const next = sectionCounter();

  const instagram = instagramLink(general.instagram);
  const whatsapp = whatsAppLink(general.whatsapp, general.whatsappMessage);
  const founders = about.founders.filter((founder) => founder.name);

  // ---- o que entra na página
  const highlights = home.highlights.items.filter((item) => item.title);
  const showFounders = visibility.founders && (founders.length > 0 || home.founders.title);
  const showHow = visibility.howItWorks && howItWorks.steps.length > 0;
  const showPackages = visibility.packages && packages.plans.length > 0;
  const featuredProjects = portfolio.slice(0, 3); // já vem com os destaques primeiro
  const featuredTestimonials = testimonials.slice(0, 3);
  const homeFaqs = visibility.faq ? faqs.filter((faq) => faq.showOnHome) : [];

  const foundersText = paragraphs(home.founders.text);
  const closingLead = [home.closing.title, home.closing.text].filter(Boolean).join(" ");
  const channels: ContactChannel[] = [
    { label: "WhatsApp", value: contactPage.whatsappLabel, href: whatsapp },
    { label: "Instagram", value: general.instagram, href: instagram },
    { label: "E-mail", value: general.email, href: general.email ? `mailto:${general.email}` : "" },
  ];

  return (
    <>
      {/* 1 · Hero — "sua história" (papel) atravessa para dentro do "nosso olhar" (campo roxo com visor) */}
      <HomeHero
        eyebrow={hero.eyebrow}
        title={hero.title}
        lead={hero.lead}
        text={hero.text}
        primaryCta={hero.primaryCta}
        secondaryCta={hero.secondaryCta}
        image={images.hero}
        caption={[visibility.founders ? founders.map((founder) => founder.name).join(" + ") : "", hero.mediaCaption]}
        aside={instagram ? { label: general.instagram, href: instagram } : null}
      />

      {/* 2 · Três serviços em destaque + chamada para todos */}
      {highlights.length > 0 ? (
        <Section id="servicos" number={next()} label={home.highlights.eyebrow} labelledBy="servicos-titulo">
          <SectionHeader id="servicos-titulo" title={home.highlights.title} />
          <ServicePanels items={highlights} />
          <div className="s-panels__foot">
            <p className="s-meta s-panels__index">{services.map((service) => service.title).join(" · ")}</p>
            <SiteLink href={home.highlights.cta.href}>{home.highlights.cta.label}</SiteLink>
          </div>
        </Section>
      ) : null}

      {/* 3 · Fundadores + valores */}
      {showFounders ? (
        <Section id="quem-somos" number={next()} label={home.founders.eyebrow} labelledBy="quem-titulo">
          <Display id="quem-titulo" accent="tail" className="s-founders__title">
            {home.founders.title}
          </Display>
          <div className="s-founders__body">
            <div className="s-founders__text" {...revealProps()}>
              <div>
                {foundersText.map((paragraph, i) => (
                  <p key={i} className={i === 0 ? "s-lead" : undefined}>
                    {paragraph}
                  </p>
                ))}
              </div>
              <SiteLink href={home.founders.cta.href}>{home.founders.cta.label}</SiteLink>
            </div>
            {founders.length > 0 ? (
              <div className="s-diptych">
                {founders.map((founder, i) => (
                  <PhotoSlot
                    key={founder.name}
                    image={images.founders[i]}
                    alt={images.founders[i]?.alt || `Retrato de ${founder.name}`}
                    tone={i % 2 === 0 ? "roxo" : "lavanda"}
                    monogram={founder.name}
                    index={pad2(i + 1)}
                    sizes="(min-width: 1024px) 33vw, 50vw"
                    caption={
                      <>
                        <strong>{founder.name}</strong>
                        {founder.role ? <span>{displayRole(founder.role)}</span> : null}
                      </>
                    }
                    {...revealProps(i + 1)}
                  />
                ))}
              </div>
            ) : null}
          </div>
          {about.values.items.length > 0 ? (
            <div className="s-values">
              {about.values.eyebrow ? <h3 className="s-meta s-values__title">{about.values.eyebrow}</h3> : null}
              <ValuesList items={about.values.items} />
            </div>
          ) : null}
        </Section>
      ) : null}

      {/* 4 · Como funciona + frase de fechamento em destaque */}
      {showHow ? (
        <Section
          id="como-funciona"
          number={next()}
          label={howItWorks.eyebrow}
          labelledBy="como-titulo"
          bleed={<StatementBanner text={howItWorks.closing} spaceTop />}
        >
          <SectionHeader id="como-titulo" title={howItWorks.title} />
          <Steps
            items={howItWorks.steps}
            action={<SiteButtonLink href={home.closing.cta.href}>{home.closing.cta.label}</SiteButtonLink>}
          />
        </Section>
      ) : null}

      {/* 5 · Pacotes (só planos visíveis; preço conforme priceMode) */}
      {showPackages ? (
        <Section
          id="pacotes"
          number={next()}
          label={home.packages.eyebrow}
          labelledBy="pacotes-titulo"
          spaceTop={showHow && howItWorks.closing ? "lg" : "none"}
        >
          <SectionHeader id="pacotes-titulo" title={home.packages.title} lead={home.packages.text} />
          <PackageBoard packages={packages.plans} recommendedLabel={packagesPage.recommendedLabel} />
          <div className="s-plans__foot">
            {packages.standalone.length > 0 ? (
              <p>
                <strong>{packagesPage.standaloneIntro}</strong> {packages.standalone.map((item) => item.name).join(" · ")}
              </p>
            ) : (
              <span />
            )}
            <SiteLink href={home.packages.cta.href}>{home.packages.cta.label}</SiteLink>
          </div>
        </Section>
      ) : null}

      {/* 6 · Portfólio e depoimentos — só existem com conteúdo publicado e autorizado */}
      {featuredProjects.length > 0 ? (
        <Section id="portfolio" number={next()} label={home.portfolio.eyebrow} labelledBy="portfolio-titulo">
          <SectionHeader id="portfolio-titulo" title={home.portfolio.title} lead={home.portfolio.text} />
          <PortfolioGrid projects={featuredProjects} />
          <div className="s-panels__foot">
            <span />
            <SiteLink href={home.portfolio.cta.href}>{home.portfolio.cta.label}</SiteLink>
          </div>
        </Section>
      ) : null}
      {featuredTestimonials.length > 0 ? (
        <Section id="depoimentos" number={next()} label={home.testimonials.eyebrow} labelledBy="depoimentos-titulo">
          <SectionHeader id="depoimentos-titulo" title={home.testimonials.title} />
          <TestimonialGrid testimonials={featuredTestimonials} />
        </Section>
      ) : null}

      {/* 7 · FAQ resumida — só perguntas publicadas marcadas para a home */}
      {homeFaqs.length > 0 ? (
        <Section id="faq" number={next()} label={home.faq.eyebrow} labelledBy="faq-titulo">
          <SectionHeader id="faq-titulo" title={home.faq.title} />
          <div className="s-faq__body">
            <div className="s-faq__side">
              {contactPage.text ? <p>{contactPage.text}</p> : null}
              <SiteLink href={home.faq.cta.href}>{home.faq.cta.label}</SiteLink>
            </div>
            <FaqAccordion items={homeFaqs} name="faq-home" />
          </div>
        </Section>
      ) : null}

      {/* 8 · Fechamento: chamada + formulário compacto + canais */}
      <Section id="contato" tone="roxo" number={next()} label={contactPage.eyebrow} labelledBy="contato-titulo" className="s-contact">
        <div className="s-contact__grid">
          <div className="s-contact__call">
            {closingLead ? <p className="s-lead s-contact__lead">{closingLead}</p> : null}
            <Display id="contato-titulo" size="d0" className="s-contact__title">
              {home.closing.question}
            </Display>
            <ContactChannels channels={channels} />
          </div>
          <LeadForm
            variant="compact"
            originPath="/"
            title={home.closing.cta.label}
            consentText={contactPage.consentText}
            submitLabel={contactPage.submitLabel}
          />
        </div>
      </Section>
    </>
  );
}
