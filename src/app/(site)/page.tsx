import type { ReactNode } from "react";
import { ContactChannels, FaqAccordion, ServicePanels, StatementBanner, Steps, type ContactChannel } from "@/components/site/blocks";
import { SiteButtonLink, SiteLink } from "@/components/site/button";
import { DifferentialsList, ServiceIndex, StandaloneIndex } from "@/components/site/home-blocks";
import { HomeBanners } from "@/components/site/banner-section";
import { HomeHero } from "@/components/site/home-hero";
import { Accented, Display, Section, SectionHeader } from "@/components/site/layout";
import { LeadForm } from "@/components/site/lead-form";
import { PackageBoard } from "@/components/site/package-card";
import { PhotoSlot } from "@/components/site/photo-slot";
import { revealProps } from "@/components/site/reveal";
import { PortfolioGrid, TestimonialGrid } from "@/components/site/showcase";
import { displayRole, pad2, paragraphs, sectionCounter, splitStatement } from "@/components/site/text";
import { instagramLink, whatsAppLink } from "@/lib/format";
import { visibleHomeSections, type HomeSectionId } from "@/lib/site/home-layout";
import { SITE_PATHS } from "@/lib/site/paths";
import { homeFeaturedProjects } from "@/lib/site/portfolio";
import { buildMetadata } from "@/lib/site/seo";
import {
  getBanners,
  getFaqs,
  getHomeLayout,
  getPackages,
  getPortfolio,
  getServices,
  getSiteContent,
  getSiteImages,
  getTestimonials,
} from "@/server/site/queries";

export const generateMetadata = () => buildMetadata("home");

/** O que cada seção precisa saber da vizinhança para acertar numeração e respiro. */
type Slot = {
  /** "01", "02"… — só avança para as seções que renderizam. */
  number: string;
  /** A seção anterior terminou num bloco de cor (ou numa faixa de largura total)? Aí o papel pede respiro acima. */
  afterColor: boolean;
};
type HomeBlock = {
  /** Termina em bloco de cor (seção com `tone` ou com `bleed` no fim)? */
  endsInColor: boolean;
  render: (slot: Slot) => ReactNode;
};

/**
 * Página inicial. Ordem do briefing v2 (seção 03): barra de avisos e menu (moldura do site), banners, serviços,
 * portfólio em destaque, diferenciais, fundadores, processo de atendimento, planos, serviços avulsos, eventos,
 * clientes e depoimentos, perguntas frequentes, formulário, experiência interativa e rodapé.
 *
 * - A ORDEM e a VISIBILIDADE das seções vêm de `getHomeLayout()` (Editar site › Página inicial).
 * - Cada seção só existe em `blocks` quando tem conteúdo publicado: seção vazia não renderiza nem o título, e a
 *   numeração ("01 —", "02 —"…) continua sequencial.
 * - Topo: o carrossel de BANNERS (Editar site › Banners) quando há algum no ar; sem nenhum, o <HomeHero>. Em
 *   qualquer dos dois casos a página tem exatamente um <h1>.
 * - Ponto de encaixe da próxima etapa: EXPERIÊNCIA INTERATIVA (depois da última seção, antes do rodapé) — está
 *   marcado abaixo.
 */
export default async function HomePage() {
  const [content, layout, images, services, packages, faqs, portfolio, testimonials, banners] = await Promise.all([
    getSiteContent(),
    getHomeLayout(),
    getSiteImages(),
    getServices(),
    getPackages(),
    getFaqs(),
    getPortfolio(),
    getTestimonials(),
    getBanners(),
  ]);
  const { general, visibility, home, about, differentials, howItWorks, packagesPage, weddingsPage, servicesPage, contactPage } = content;
  const { hero } = home;

  const instagram = instagramLink(general.instagram);
  const whatsapp = whatsAppLink(general.whatsapp, general.whatsappMessage);
  const founders = about.founders.filter((founder) => founder.name);
  const foundersText = paragraphs(home.founders.text);
  const diffItems = differentials.items.filter((item) => item.title);
  const steps = howItWorks.steps.filter((step) => step.title);
  // projetos marcados como destaque, na ordem do painel (sem nenhum marcado, os primeiros da lista)
  const featuredProjects = homeFeaturedProjects(portfolio);
  const featuredTestimonials = testimonials.slice(0, 3);
  const homeFaqs = visibility.faq ? faqs.filter((faq) => faq.showOnHome) : [];
  const closingLead = [home.closing.title, home.closing.text].filter(Boolean).join(" ");
  const channels: ContactChannel[] = [
    { label: "WhatsApp", value: contactPage.whatsappLabel, href: whatsapp },
    { label: "Instagram", value: general.instagram, href: instagram },
    { label: "E-mail", value: general.email, href: general.email ? `mailto:${general.email}` : "" },
  ];
  const eventPanels = [
    { title: weddingsPage.events.title, text: weddingsPage.events.text, href: `${SITE_PATHS.events}#eventos` },
    { title: weddingsPage.weddingsEyebrow, text: weddingsPage.coverage.intro, href: `${SITE_PATHS.events}#casamentos` },
  ].filter((panel) => panel.title);

  const eventLines = splitStatement(home.events.title).filter((line): line is string => Boolean(line));

  // ---- seções disponíveis (com conteúdo publicado). Chave ausente = a seção não renderiza.
  const blocks: Partial<Record<HomeSectionId, HomeBlock>> = {};

  // Serviços: lista dos serviços publicados, cada um com a sua página
  if (services.length > 0) {
    blocks.servicos = {
      endsInColor: false,
      render: ({ number, afterColor }) => (
        <Section id="servicos" number={number} label={home.highlights.eyebrow} labelledBy="servicos-titulo" spaceTop={afterColor ? "lg" : "none"}>
          <SectionHeader id="servicos-titulo" title={home.highlights.title} lead={home.highlights.text} />
          <ServiceIndex services={services} linkLabel={servicesPage.detailLabel} />
          <div className="s-panels__foot">
            <span />
            <SiteLink href={home.highlights.cta.href}>{home.highlights.cta.label}</SiteLink>
          </div>
        </Section>
      ),
    };
  }

  // Portfólio em destaque — só existe com projetos publicados e autorizados
  if (featuredProjects.length > 0) {
    blocks.portfolio = {
      endsInColor: false,
      render: ({ number, afterColor }) => (
        <Section id="portfolio" number={number} label={home.portfolio.eyebrow} labelledBy="portfolio-titulo" spaceTop={afterColor ? "lg" : "none"}>
          <SectionHeader id="portfolio-titulo" title={home.portfolio.title} lead={home.portfolio.text} />
          <PortfolioGrid projects={featuredProjects} />
          <div className="s-panels__foot">
            <span />
            <SiteLink href={home.portfolio.cta.href}>{home.portfolio.cta.label}</SiteLink>
          </div>
        </Section>
      ),
    };
  }

  // Diferenciais — bloco grafite
  if (diffItems.length > 0) {
    blocks.diferenciais = {
      endsInColor: true,
      render: ({ number }) => (
        <Section id="diferenciais" tone="grafite" number={number} label={differentials.eyebrow} labelledBy="diferenciais-titulo">
          <SectionHeader id="diferenciais-titulo" title={differentials.title} />
          <DifferentialsList items={diffItems} />
        </Section>
      ),
    };
  }

  // Fundadores
  if (founders.length > 0 || home.founders.title) {
    blocks.fundadores = {
      endsInColor: false,
      render: ({ number, afterColor }) => (
        <Section id="quem-somos" number={number} label={home.founders.eyebrow} labelledBy="quem-titulo" spaceTop={afterColor ? "lg" : "none"}>
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
        </Section>
      ),
    };
  }

  // Processo de atendimento + frase de fechamento em destaque
  if (steps.length > 0) {
    blocks.processo = {
      endsInColor: Boolean(howItWorks.closing),
      render: ({ number, afterColor }) => (
        <Section
          id="como-funciona"
          number={number}
          label={howItWorks.eyebrow}
          labelledBy="como-titulo"
          spaceTop={afterColor ? "lg" : "none"}
          bleed={howItWorks.closing ? <StatementBanner text={howItWorks.closing} spaceTop /> : undefined}
        >
          <SectionHeader id="como-titulo" title={howItWorks.title} />
          <Steps items={steps} action={<SiteButtonLink href={home.closing.cta.href}>{home.closing.cta.label}</SiteButtonLink>} />
        </Section>
      ),
    };
  }

  // Planos (só os publicados; valor conforme o modo de exibição de cada um)
  if (visibility.packages && packages.plans.length > 0) {
    blocks.planos = {
      endsInColor: false,
      render: ({ number, afterColor }) => (
        <Section id="pacotes" number={number} label={home.packages.eyebrow} labelledBy="pacotes-titulo" spaceTop={afterColor ? "lg" : "none"}>
          <SectionHeader id="pacotes-titulo" title={home.packages.title} lead={home.packages.text} />
          <PackageBoard packages={packages.plans} recommendedLabel={packagesPage.recommendedLabel} priceOnRequestLabel={packagesPage.priceOnRequestLabel} />
          <div className="s-plans__foot">
            <span />
            <SiteLink href={home.packages.cta.href}>{home.packages.cta.label}</SiteLink>
          </div>
        </Section>
      ),
    };
  }

  // Serviços avulsos — bloco lavanda
  if (visibility.packages && packages.standalone.length > 0) {
    blocks.avulsos = {
      endsInColor: true,
      render: ({ number }) => (
        <Section id="avulsos" tone="lavanda" number={number} label={home.standalone.eyebrow} labelledBy="avulsos-titulo">
          <SectionHeader id="avulsos-titulo" title={home.standalone.title} lead={home.standalone.text} />
          <StandaloneIndex packages={packages.standalone} />
          <div className="s-panels__foot">
            <span />
            <SiteLink href={home.standalone.cta.href}>{home.standalone.cta.label}</SiteLink>
          </div>
        </Section>
      ),
    };
  }

  // Eventos e casamentos: a chamada + as duas portas de entrada da página
  if (visibility.weddings && (home.events.title || eventPanels.length > 0)) {
    blocks.eventos = {
      endsInColor: false,
      render: ({ number, afterColor }) => (
        <Section id="eventos" number={number} label={home.events.eyebrow} labelledBy="eventos-titulo" spaceTop={afterColor ? "lg" : "none"}>
          {/* a chamada ocupa a largura toda: cada frase na sua linha ("…que passam." / "E histórias que permanecem.") */}
          <h2 id="eventos-titulo" className="s-events__title">
            {eventLines.map((line, i) => (
              <span key={i}>
                <Accented text={line} />{" "}
              </span>
            ))}
          </h2>
          <ServicePanels
            items={eventPanels}
            looks={[
              { tone: "roxo", kind: "play" },
              { tone: "grafite", kind: "rings" },
            ]}
            className="s-events__panels"
          />
          <div className="s-events__foot">
            {home.events.text ? <p className="s-lead">{home.events.text}</p> : <span />}
            <SiteButtonLink href={home.events.cta.href}>{home.events.cta.label}</SiteButtonLink>
          </div>
        </Section>
      ),
    };
  }

  // Clientes e depoimentos — só existem com relatos publicados e autorizados
  if (featuredTestimonials.length > 0) {
    blocks.depoimentos = {
      endsInColor: false,
      render: ({ number, afterColor }) => (
        <Section id="depoimentos" number={number} label={home.testimonials.eyebrow} labelledBy="depoimentos-titulo" spaceTop={afterColor ? "lg" : "none"}>
          <SectionHeader id="depoimentos-titulo" title={home.testimonials.title} />
          <TestimonialGrid testimonials={featuredTestimonials} />
        </Section>
      ),
    };
  }

  // Perguntas frequentes — só as publicadas e marcadas para a home
  if (homeFaqs.length > 0) {
    blocks.faq = {
      endsInColor: false,
      render: ({ number, afterColor }) => (
        <Section id="faq" number={number} label={home.faq.eyebrow} labelledBy="faq-titulo" spaceTop={afterColor ? "lg" : "none"}>
          <SectionHeader id="faq-titulo" title={home.faq.title} />
          <div className="s-faq__body">
            <div className="s-faq__side">
              {contactPage.text ? <p>{contactPage.text}</p> : null}
              <SiteLink href={home.faq.cta.href}>{home.faq.cta.label}</SiteLink>
            </div>
            <FaqAccordion items={homeFaqs} name="faq-home" />
          </div>
        </Section>
      ),
    };
  }

  // Formulário: chamada + formulário compacto + canais — bloco roxo
  blocks.formulario = {
    endsInColor: true,
    render: ({ number }) => (
      <Section id="contato" tone="roxo" number={number} label={contactPage.eyebrow} labelledBy="contato-titulo" className="s-contact">
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
    ),
  };

  // ---- monta na ordem configurada, pulando o que está desligado ou sem conteúdo
  const next = sectionCounter();
  let afterColor = false; // o hero termina no papel
  const sections: ReactNode[] = [];
  for (const id of visibleHomeSections(layout)) {
    const block = blocks[id];
    if (!block) continue;
    sections.push(<HomeSectionSlot key={id}>{block.render({ number: next(), afterColor })}</HomeSectionSlot>);
    afterColor = block.endsInColor;
  }

  return (
    <>
      {/* BANNERS (Editar site › Banners): com algum banner no ar, o carrossel ocupa o topo; sem nenhum, fica a
          abertura padrão — "sua história" (papel) atravessa para dentro do "nosso olhar" (campo roxo com visor). */}
      {banners.length > 0 ? (
        <HomeBanners banners={banners} title={hero.title} eyebrow={hero.eyebrow} />
      ) : (
        <HomeHero
          eyebrow={hero.eyebrow}
          title={hero.title}
          lead={hero.lead}
          text={hero.text}
          primaryCta={hero.primaryCta}
          secondaryCta={hero.secondaryCta}
          image={images.hero}
          caption={[blocks.fundadores ? founders.map((founder) => founder.name).join(" + ") : "", hero.mediaCaption]}
          aside={instagram ? { label: general.instagram, href: instagram } : null}
        />
      )}

      {sections}

      {/* PONTO DE ENCAIXE · EXPERIÊNCIA INTERATIVA ("Antes de ir, deixe sua marca." — câmera, celular e contador
          de visitas): entra aqui, entre a última seção e o rodapé, na próxima etapa. */}
    </>
  );
}

/** Invólucro sem marcação: só dá uma `key` estável a cada seção da lista. */
function HomeSectionSlot({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
