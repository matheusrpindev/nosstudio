import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Markdown } from "@/components/markdown";
import { ContactChannels, FaqAccordion, type ContactChannel } from "@/components/site/blocks";
import { SiteButtonLink, SiteLink } from "@/components/site/button";
import { DifferentialsList, ServiceIndex } from "@/components/site/home-blocks";
import { Display, PageHeader, Section, SectionHeader } from "@/components/site/layout";
import { LeadForm } from "@/components/site/lead-form";
import { PhotoSlot } from "@/components/site/photo-slot";
import { revealProps } from "@/components/site/reveal";
import { PortfolioGrid } from "@/components/site/showcase";
import { pad2, sectionCounter, type SiteTone } from "@/components/site/text";
import { VideoEmbed } from "@/components/site/video-embed";
import { instagramLink, safeHref, videoEmbedUrl, whatsAppLink } from "@/lib/format";
import { FORM_ANCHORS, SITE_PATHS, servicePath } from "@/lib/site/paths";
import { buildMetadata } from "@/lib/site/seo";
import { getLeadOriginNames, getServiceBySlug, getServices, getSiteContent } from "@/server/site/queries";
import "../services.css";

type Props = { params: Promise<{ slug: string }> };

/**
 * Com Cache Components, `generateStaticParams` precisa devolver pelo menos um item: sem serviço publicado, vai um
 * slug reservado (a página responde 404 para ele). Serviços criados no painel depois do build são renderizados na
 * primeira visita e guardados em cache; `invalidateSite()` renova tudo ao criar, editar, ocultar ou excluir.
 * (Mesmo padrão — e mesmo limite do status na primeira visita a um slug desconhecido — de /portfolio/[slug].)
 */
const PLACEHOLDER_SLUG = "__sem-servicos__";
export const instant = false;

/** Cores do campo enquanto o serviço não tem capa (alternam pela posição na lista). */
const FIELD_TONES: SiteTone[] = ["roxo", "lavanda", "grafite"];
/** Rótulo de interface da primeira seção (os títulos dos blocos vêm do painel). */
const ABOUT_LABEL = "O serviço";
/** Quantos "outros serviços" aparecem no fim da página (o link leva à lista completa). */
const OTHERS = 3;

export async function generateStaticParams() {
  const services = await getServices();
  return services.length > 0 ? services.map((service) => ({ slug: service.slug })) : [{ slug: PLACEHOLDER_SLUG }];
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const found = await getServiceBySlug(slug);
  if (!found) return { title: "Serviço não encontrado", robots: { index: false, follow: false } };
  const { service } = found;
  return buildMetadata({
    title: service.title,
    description: service.summary || service.items.slice(0, 6).join(", "),
    path: servicePath(service.slug),
    image: service.cover?.url ?? null,
  });
}

/**
 * Página de um serviço (briefing v2, seção 06): mídia, descrição, benefícios, possíveis entregas, trabalhos
 * relacionados, perguntas frequentes e orçamento. Benefícios, vídeo/galeria, trabalhos relacionados e FAQ só
 * aparecem quando preenchidos no painel — nada de bloco vazio com título solto. Serviço oculto ou slug
 * desconhecido → 404.
 */
export default async function ServicePage({ params }: Props) {
  const { slug } = await params;
  const [found, content, originNames] = await Promise.all([getServiceBySlug(slug), getSiteContent(), getLeadOriginNames()]);
  if (!found) notFound();
  const { service, index, total, others, related } = found;
  const { servicesPage: page, contactPage, general, visibility } = content;
  const labels = page.detail;
  const next = sectionCounter();

  const hasVideo = Boolean(videoEmbedUrl(service.videoUrl));
  const hasMedia = hasVideo || service.gallery.length > 0;
  const description = service.description.trim();
  const formHref = `#${FORM_ANCHORS.service}`;
  // página temática do serviço (ex.: Eventos e Casamentos) — só vira botão se for um caminho válido e publicado
  const themePath = safeHref(service.pagePath);
  const themeLink = themePath && !(themePath === SITE_PATHS.events && !visibility.weddings) ? themePath : null;
  const tone = FIELD_TONES[index % FIELD_TONES.length];

  const whatsapp = whatsAppLink(general.whatsapp, general.whatsappMessage);
  const instagram = instagramLink(general.instagram);
  const channels: ContactChannel[] = [
    { label: "WhatsApp", value: contactPage.whatsappLabel, href: whatsapp, icon: "whatsapp" },
    { label: "Instagram", value: general.instagram, href: instagram, icon: "instagram" },
    { label: "E-mail", value: general.email, href: general.email ? `mailto:${general.email}` : "", icon: "mail" },
  ];

  return (
    <>
      <PageHeader
        eyebrow={page.eyebrow}
        meta={
          <span aria-hidden="true">
            {pad2(index + 1)}/{pad2(total)}
          </span>
        }
        title={service.title}
        lead={service.summary}
        actions={
          <>
            <SiteButtonLink href={formHref} icon="arrow-down">
              {service.ctaLabel}
            </SiteButtonLink>
            {themeLink ? (
              <SiteButtonLink href={themeLink} variant="secondary">
                {labels.pageLinkLabel}
              </SiteButtonLink>
            ) : null}
          </>
        }
      />

      {/* 1 · Mídia + descrição + possíveis entregas */}
      <Section id="servico-sobre" number={next()} label={ABOUT_LABEL} labelledBy="servico-entregas-titulo">
        <div className="services__split">
          <PhotoSlot
            image={service.cover}
            alt={service.cover?.alt || service.title}
            tone={tone}
            monogram={service.title}
            index={pad2(index + 1)}
            sizes="(min-width: 1024px) 40vw, 100vw"
            priority
            className="services__media"
            {...revealProps()}
          />
          <div className="services__body">
            {description ? <Markdown className="s-prose services__desc services__desc--lead">{description}</Markdown> : null}
            <h2 id="servico-entregas-titulo" className="s-h3 services__sub">
              {labels.deliverablesTitle}
            </h2>
            {service.items.length > 0 ? (
              <ul className="services__list">
                {service.items.map((item, i) => (
                  <li key={i} {...revealProps(i % 4)}>
                    {item}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>
      </Section>

      {/* 2 · Benefícios — só quando cadastrados */}
      {service.benefits.length > 0 ? (
        <Section id="servico-beneficios" tone="grafite" number={next()} label={labels.benefitsTitle} labelledBy="servico-beneficios-titulo">
          <SectionHeader id="servico-beneficios-titulo" title={labels.benefitsTitle} />
          <DifferentialsList items={service.benefits} />
        </Section>
      ) : null}

      {/* 3 · Vídeo e galeria — só com material real enviado pelo painel */}
      {hasMedia ? (
        <Section
          id="servico-midia"
          number={next()}
          label={labels.mediaTitle}
          labelledBy="servico-midia-titulo"
          spaceTop={service.benefits.length > 0 ? "lg" : "none"}
        >
          <h2 id="servico-midia-titulo" className="sr-only">
            {labels.mediaTitle}
          </h2>
          <div className="services__extras">
            {hasVideo ? <VideoEmbed url={service.videoUrl} title={service.title} poster={service.cover} className="services__video" /> : null}
            {service.gallery.length > 0 ? (
              <ul className="services__gallery" aria-label={`${service.title}: galeria`}>
                {service.gallery.map((image, i) => (
                  <li key={`${image.id}-${i}`}>
                    <PhotoSlot
                      image={image}
                      ratio="4 / 5"
                      frame={false}
                      alt={image.alt || `${service.title} — foto ${i + 1}`}
                      sizes="(min-width: 1024px) 25vw, 50vw"
                      {...revealProps(i % 4)}
                    />
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </Section>
      ) : null}

      {/* 4 · Trabalhos relacionados — só projetos publicados no portfólio */}
      {related.length > 0 ? (
        <Section
          id="servico-trabalhos"
          number={next()}
          label={labels.relatedTitle}
          labelledBy="servico-trabalhos-titulo"
          spaceTop={!hasMedia && service.benefits.length > 0 ? "lg" : "none"}
        >
          <SectionHeader id="servico-trabalhos-titulo" title={labels.relatedTitle} />
          <PortfolioGrid projects={related} />
        </Section>
      ) : null}

      {/* 5 · Perguntas frequentes do serviço — só as que têm resposta */}
      {service.faq.length > 0 ? (
        <Section
          id="servico-faq"
          number={next()}
          label={labels.faqTitle}
          labelledBy="servico-faq-titulo"
          spaceTop={!hasMedia && related.length === 0 && service.benefits.length > 0 ? "lg" : "none"}
        >
          <SectionHeader id="servico-faq-titulo" title={labels.faqTitle} />
          <div className="s-faq__body">
            <div className="s-faq__side">
              <SiteLink href={formHref}>{service.ctaLabel}</SiteLink>
            </div>
            <FaqAccordion items={service.faq.map((item, i) => ({ id: i, ...item }))} name="faq-servico" />
          </div>
        </Section>
      ) : null}

      {/* 6 · Orçamento: o formulário já sabe de qual serviço se trata */}
      <Section id="servico-pedido" tone="roxo" number={next()} label={contactPage.eyebrow} labelledBy="servico-pedido-titulo" className="s-contact">
        <div className="s-contact__grid">
          <div className="s-contact__call services__quote-call">
            <Display id="servico-pedido-titulo" accent="marked">
              {labels.quoteTitle}
            </Display>
            {labels.quoteText ? <p className="s-lead s-contact__lead">{labels.quoteText}</p> : null}
            <ContactChannels channels={channels} />
          </div>
          <LeadForm
            id={FORM_ANCHORS.service}
            variant="full"
            originPath={servicePath(service.slug)}
            defaultInterest={service.interest}
            packageName={originNames.includes(service.title) ? service.title : undefined}
            consentText={contactPage.consentText}
            submitLabel={contactPage.submitLabel}
          />
        </div>
      </Section>

      {/* 7 · Outros serviços */}
      {others.length > 0 ? (
        <Section id="servico-outros" number={next()} label={labels.othersTitle} labelledBy="servico-outros-titulo" spaceTop="lg">
          <h2 id="servico-outros-titulo" className="sr-only">
            {labels.othersTitle}
          </h2>
          <ServiceIndex services={others.slice(0, OTHERS)} linkLabel={page.detailLabel} className="services__others" />
          <div className="s-panels__foot">
            <span />
            <SiteLink href={SITE_PATHS.services}>{content.home.highlights.cta.label}</SiteLink>
          </div>
        </Section>
      ) : null}
    </>
  );
}
