import type { CSSProperties } from "react";
import { Logo } from "@/components/brand/logo";
import { ContactChannels, FaqAccordion, ServicePanels, StatementBanner, Steps, ValuesList, type ContactChannel } from "@/components/site/blocks";
import { SiteButtonLink, SiteLink } from "@/components/site/button";
import { Display, Section, SectionHeader } from "@/components/site/layout";
import { LeadForm } from "@/components/site/lead-form";
import { Icon, RecDot, ViewfinderFrame } from "@/components/site/marks";
import { PackageBoard } from "@/components/site/package-card";
import { PhotoSlot } from "@/components/site/photo-slot";
import { revealProps } from "@/components/site/reveal";
import { PortfolioGrid, TestimonialGrid } from "@/components/site/showcase";
import { SiteImage } from "@/components/site/site-image";
import { displayRole, pad2, paragraphs, sectionCounter, splitTitle, titleMetrics } from "@/components/site/text";
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

  // ---- hero
  const [line1, line2] = splitTitle(hero.title);
  const metrics = titleMetrics([line1, line2]);
  const heroTitle = (
    <>
      <span className="l1">{line1}</span>
      {line2 ? (
        <>
          {" "}
          <span className="l2">{line2}</span>
        </>
      ) : null}
    </>
  );
  const instagram = instagramLink(general.instagram);
  const whatsapp = whatsAppLink(general.whatsapp, general.whatsappMessage);
  const founders = about.founders.filter((founder) => founder.name);
  const heroCaption = [founders.map((founder) => founder.name).join(" + "), hero.mediaCaption].filter(Boolean);

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
      <section className="s-hero" aria-labelledby="hero-titulo">
        <div className="s-wrap s-hero__stage">
          <div className="s-hero__meta">
            <p className="s-meta">{hero.eyebrow}</p>
            {instagram ? (
              <a className="s-meta s-hero__insta" href={instagram} target="_blank" rel="noopener noreferrer">
                {general.instagram} <Icon name="arrow-ne" />
              </a>
            ) : null}
          </div>

          <h1
            className="s-hero__title"
            id="hero-titulo"
            style={{ "--hero-word": metrics.word, "--hero-line": metrics.line } as CSSProperties}
          >
            {heroTitle}
          </h1>
          {/* Eco do título: mesma caixa e mesma quebra, recortado pela borda do campo de cor. Decorativo. */}
          <p
            className="s-hero__title s-hero__echo"
            aria-hidden="true"
            style={{ "--hero-word": metrics.word, "--hero-line": metrics.line } as CSSProperties}
          >
            {heroTitle}
          </p>

          <div className="s-hero__text">
            {hero.lead ? <p className="s-lead">{hero.lead}</p> : null}
            {hero.text ? <p>{hero.text}</p> : null}
          </div>

          <div className="s-hero__actions">
            <SiteButtonLink href={hero.primaryCta.href} variant="secondary">
              {hero.primaryCta.label}
            </SiteButtonLink>
            <SiteButtonLink href={hero.secondaryCta.href}>{hero.secondaryCta.label}</SiteButtonLink>
          </div>

          {/* Mídia do hero: foto real dentro da moldura quando existir; sem foto, o estado gráfico da marca. */}
          <figure className="s-hero__field" data-tone="roxo" data-media={images.hero ? "photo" : "empty"}>
            {images.hero ? (
              <SiteImage image={images.hero} priority sizes="(min-width: 1024px) 45vw, 100vw" className="s-media" />
            ) : (
              <span className="s-hero__symbol" aria-hidden="true">
                <Logo variant="simbolo" tone="branco" label="" className="h-full w-auto" />
              </span>
            )}
            <ViewfinderFrame />
            <RecDot className="s-hero__rec" />
            {heroCaption.length > 0 ? (
              <figcaption className="s-hero__caption">
                {heroCaption.map((line) => (
                  <span key={line}>{line}</span>
                ))}
              </figcaption>
            ) : null}
          </figure>
        </div>
      </section>

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
              <h3 className="s-meta s-values__title">{about.values.eyebrow}</h3>
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
