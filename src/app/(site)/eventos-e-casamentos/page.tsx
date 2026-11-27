import { notFound } from "next/navigation";
import { ContactChannels, FaqAccordion, Steps, type ContactChannel } from "@/components/site/blocks";
import { SiteButtonLink, SiteLink } from "@/components/site/button";
import { Display, PageHeader, Section, SectionHeader } from "@/components/site/layout";
import { LeadForm } from "@/components/site/lead-form";
import { AccentMark, RingsMark } from "@/components/site/marks";
import { PhotoSlot } from "@/components/site/photo-slot";
import { revealProps } from "@/components/site/reveal";
import { PortfolioGrid, TestimonialGrid } from "@/components/site/showcase";
import { paragraphs, sectionCounter } from "@/components/site/text";
import { WeddingsCoverage } from "@/components/site/weddings-coverage";
import { WeddingsCrew } from "@/components/site/weddings-crew";
import { instagramLink, whatsAppLink } from "@/lib/format";
import { FORM_ANCHORS, SITE_PATHS } from "@/lib/site/paths";
import { buildMetadata } from "@/lib/site/seo";
import { getFaqs, getPortfolio, getSiteContent, getSiteImages, getTestimonials } from "@/server/site/queries";
import "./events.css";

export const generateMetadata = () => buildMetadata("casamentos");

/** Rótulos de interface das seções (o restante da copy vem do painel). */
const LABELS = { proposal: "Proposta", crew: "No dia", gallery: "Galeria", form: "Consultar data" } as const;

/**
 * Eventos e Casamentos (briefing v2, seção 09). A página separa as duas frentes — eventos corporativos e sociais
 * (#eventos) e casamentos (#casamentos) —, cada uma com os seus formatos de cobertura, e termina no formulário
 * "Consultar disponibilidade da minha data". Galeria e depoimentos só aparecem com conteúdo real publicado.
 * O envio vira um lead no painel; NÃO reserva data nem cria compromisso na agenda. Estática.
 */
export default async function EventsPage() {
  const [content, images, faqs, portfolio, testimonials] = await Promise.all([getSiteContent(), getSiteImages(), getFaqs(), getPortfolio(), getTestimonials()]);
  const { visibility, weddingsPage: page, about, home, contactPage, general } = content;
  if (!visibility.weddings) notFound();

  const next = sectionCounter();
  const eventsText = paragraphs(page.events.text);
  const eventFormats = page.events.items.filter((item) => item.title);
  const showEvents = Boolean(page.events.title || eventsText.length > 0 || eventFormats.length > 0);
  const approach = paragraphs(page.approach.text);
  const coverage = page.coverage.items.filter((item) => item.title);
  const showWeddings = Boolean(page.approach.title || approach.length > 0 || coverage.length > 0);
  const steps = page.proposal.steps.filter((step) => step.title);
  const proposalText = paragraphs(page.proposal.text);
  const crew = about.founders.filter((founder) => founder.name);
  const gallery = portfolio.filter((project) => project.category === "eventos" || project.category === "casamentos").slice(0, 6);
  const featuredTestimonials = testimonials.slice(0, 3);
  const eventFaqs = visibility.faq ? faqs.filter((faq) => faq.showOnWeddings) : [];
  const instagram = instagramLink(general.instagram);
  const whatsapp = whatsAppLink(general.whatsapp, general.whatsappMessage);
  const channels: ContactChannel[] = [
    { label: "WhatsApp", value: contactPage.whatsappLabel, href: whatsapp, icon: "whatsapp" },
    { label: "Instagram", value: general.instagram, href: instagram, icon: "instagram" },
    { label: "E-mail", value: general.email, href: general.email ? `mailto:${general.email}` : "", icon: "mail" },
  ];
  const formHref = `#${FORM_ANCHORS.events}`;
  const cta = { label: page.ctaLabel, href: formHref };
  // a seção de casamentos é um bloco de cor: a PRIMEIRA seção no papel depois dela pede respiro acima
  let afterColor = showWeddings;
  const top = () => {
    const space = afterColor ? ("lg" as const) : ("none" as const);
    afterColor = false;
    return space;
  };

  return (
    <>
      {/* A chamada da página + espaço de foto (a foto real entra por Editar site › Textos › Eventos e Casamentos) */}
      <PageHeader
        eyebrow={page.eyebrow}
        title={page.title}
        lead={page.lead}
        sentences
        actions={
          <SiteButtonLink href={cta.href} icon="arrow-down">
            {cta.label}
          </SiteButtonLink>
        }
      >
        {showEvents && showWeddings ? (
          <nav className="events__jump" aria-label="Nesta página">
            <a href="#eventos">
              <span aria-hidden="true">01</span>
              {page.events.title || page.events.eyebrow}
            </a>
            <a href="#casamentos">
              <span aria-hidden="true">02</span>
              {page.weddingsEyebrow}
            </a>
          </nav>
        ) : null}
        <div className="weddings__hero-media" {...revealProps()}>
          <PhotoSlot
            image={images.weddingsHero}
            ratio="16 / 9"
            tone="roxo"
            symbol={<RingsMark />}
            alt={images.weddingsHero?.alt || `${page.eyebrow} — ${general.brandName}`}
            sizes="(min-width: 1440px) 1330px, 100vw"
            priority
          />
        </div>
      </PageHeader>

      {/* 1 · Eventos corporativos e sociais: texto + formatos de cobertura */}
      {showEvents ? (
        <Section id="eventos" number={next()} label={page.events.eyebrow} labelledBy="eventos-eventos-titulo">
          <SectionHeader id="eventos-eventos-titulo" title={page.events.title} lead={eventsText[0]} />
          {eventsText.length > 1 ? (
            <div className="weddings__approach-text events__more" {...revealProps()}>
              {eventsText.slice(1).map((paragraph, i) => (
                <p key={i}>{paragraph}</p>
              ))}
            </div>
          ) : null}
          <WeddingsCoverage items={eventFormats} />
          <p className="events__cta">
            <SiteButtonLink href={cta.href} icon="arrow-down">
              {cta.label}
            </SiteButtonLink>
          </p>
        </Section>
      ) : null}

      {/* 2 · Casamentos: o olhar + o que a cobertura pode incluir (bloco lavanda) */}
      {showWeddings ? (
        <Section id="casamentos" tone="lavanda" number={next()} label={page.weddingsEyebrow} labelledBy="eventos-casamentos-titulo">
          <SectionHeader id="eventos-casamentos-titulo" title={page.approach.title} />
          {approach.length > 0 ? (
            <div className="weddings__approach-text" {...revealProps()}>
              {approach.map((paragraph, i) => (
                <p key={i} className={i === 0 ? "s-lead" : undefined}>
                  {paragraph}
                </p>
              ))}
            </div>
          ) : null}
          {coverage.length > 0 ? (
            <div className="events__coverage">
              <div className="events__coverage-head">
                {page.coverage.title ? <h3 className="s-h3">{page.coverage.title}</h3> : null}
                {page.coverage.intro ? <p className="s-muted">{page.coverage.intro}</p> : null}
              </div>
              <WeddingsCoverage items={coverage} note={page.coverage.note} headingLevel={4} />
            </div>
          ) : null}
        </Section>
      ) : null}

      {/* 3 · Como funciona a proposta */}
      {steps.length > 0 ? (
        <Section id="eventos-proposta" number={next()} label={LABELS.proposal} labelledBy="eventos-proposta-titulo" spaceTop={top()}>
          <SectionHeader id="eventos-proposta-titulo" title={page.proposal.title} lead={proposalText.join(" ")} />
          <Steps items={steps} action={<SiteButtonLink href={cta.href}>{cta.label}</SiteButtonLink>} />
        </Section>
      ) : null}

      {/* 4 · Quem estará no dia */}
      {crew.length > 0 ? (
        <Section id="eventos-equipe" number={next()} label={LABELS.crew} labelledBy="eventos-equipe-titulo" spaceTop={top()}>
          <SectionHeader id="eventos-equipe-titulo" title={about.foundersTitle} />
          <WeddingsCrew founders={crew} images={images.founders} />
          <p className="weddings__crew-foot">
            <SiteLink href={home.founders.cta.href}>{home.founders.cta.label}</SiteLink>
          </p>
        </Section>
      ) : null}

      {/* 5 · Galeria — só projetos reais de eventos e casamentos publicados no portfólio */}
      {gallery.length > 0 ? (
        <Section id="eventos-galeria" number={next()} label={LABELS.gallery} labelledBy="eventos-galeria-titulo" spaceTop={top()}>
          <SectionHeader id="eventos-galeria-titulo" title={page.galleryTitle} />
          <PortfolioGrid projects={gallery} />
          <div className="s-panels__foot">
            <span />
            <SiteLink href={SITE_PATHS.portfolio}>{home.portfolio.cta.label}</SiteLink>
          </div>
        </Section>
      ) : null}

      {/* 6 · Depoimentos — só relatos reais, publicados e autorizados */}
      {featuredTestimonials.length > 0 ? (
        <Section id="eventos-depoimentos" number={next()} label={home.testimonials.eyebrow} labelledBy="eventos-depoimentos-titulo" spaceTop={top()}>
          <SectionHeader id="eventos-depoimentos-titulo" title={home.testimonials.title} />
          <TestimonialGrid testimonials={featuredTestimonials} />
        </Section>
      ) : null}

      {/* 7 · Perguntas frequentes — só as publicadas e marcadas para esta página */}
      {eventFaqs.length > 0 ? (
        <Section id="eventos-faq" number={next()} label={home.faq.eyebrow} labelledBy="eventos-faq-titulo" spaceTop={top()}>
          <SectionHeader id="eventos-faq-titulo" title={home.faq.title} />
          <div className="s-faq__body">
            <div className="s-faq__side">
              <SiteLink href={cta.href}>{cta.label}</SiteLink>
            </div>
            <FaqAccordion items={eventFaqs} name="faq-eventos" />
          </div>
        </Section>
      ) : null}

      {/* 8 · Formulário: consulta de disponibilidade (vira lead; não reserva a data) */}
      <Section id="eventos-pedido" tone="roxo" number={next()} label={LABELS.form} labelledBy="eventos-pedido-titulo" className="s-contact">
        <div className="s-contact__grid">
          <div className="s-contact__call weddings__form-call">
            <Display id="eventos-pedido-titulo" accent="tail">
              {page.form.title}
            </Display>
            {page.form.text ? <p className="s-lead s-contact__lead">{page.form.text}</p> : null}
            {page.form.note ? (
              <p className="events__note">
                <AccentMark className="events__note-mark" />
                <span>{page.form.note}</span>
              </p>
            ) : null}
            <ContactChannels channels={channels} />
          </div>
          <LeadForm
            id={FORM_ANCHORS.events}
            variant="event"
            originPath={SITE_PATHS.events}
            consentText={contactPage.consentText}
            submitLabel={page.form.submitLabel}
          />
        </div>
      </Section>
    </>
  );
}
