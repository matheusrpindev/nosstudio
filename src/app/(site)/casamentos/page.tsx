import { notFound } from "next/navigation";
import { ContactChannels, FaqAccordion, Steps, type ContactChannel } from "@/components/site/blocks";
import { SiteButtonLink, SiteLink } from "@/components/site/button";
import { Display, PageHeader, Section, SectionHeader } from "@/components/site/layout";
import { LeadForm } from "@/components/site/lead-form";
import { RingsMark } from "@/components/site/marks";
import { PhotoSlot } from "@/components/site/photo-slot";
import { revealProps } from "@/components/site/reveal";
import { paragraphs, sectionCounter } from "@/components/site/text";
import { WeddingsCoverage } from "@/components/site/weddings-coverage";
import { WeddingsCrew } from "@/components/site/weddings-crew";
import { instagramLink, whatsAppLink } from "@/lib/format";
import { buildMetadata } from "@/lib/site/seo";
import { getFaqs, getSiteContent, getSiteImages } from "@/server/site/queries";
import "./weddings.css";

export const generateMetadata = () => buildMetadata("casamentos");

const FORM_ID = "casamentos-formulario";

/**
 * Casamentos: página própria porque "a compra é diferente" — o casal quer entender equipe, estilo, cobertura,
 * entrega e condições antes de pedir uma proposta. Sem preço publicado (proposta personalizada) e sem foto de
 * casamento até existir material autorizado (PhotoSlot em estado vazio). Estática.
 */
export default async function WeddingsPage() {
  const [content, images, faqs] = await Promise.all([getSiteContent(), getSiteImages(), getFaqs()]);
  const { visibility, weddingsPage: page, about, home, contactPage, general } = content;
  if (!visibility.weddings) notFound();

  const next = sectionCounter();
  const approach = paragraphs(page.approach.text);
  const coverage = page.coverage.items.filter((item) => item.title);
  const steps = page.proposal.steps.filter((step) => step.title);
  const proposalText = paragraphs(page.proposal.text);
  const crew = about.founders.filter((founder) => founder.name);
  const weddingFaqs = visibility.faq ? faqs.filter((faq) => faq.showOnWeddings) : [];
  const instagram = instagramLink(general.instagram);
  const whatsapp = whatsAppLink(general.whatsapp, general.whatsappMessage);
  const channels: ContactChannel[] = [
    { label: "WhatsApp", value: contactPage.whatsappLabel, href: whatsapp, icon: "whatsapp" },
    { label: "Instagram", value: general.instagram, href: instagram, icon: "instagram" },
    { label: "E-mail", value: general.email, href: general.email ? `mailto:${general.email}` : "", icon: "mail" },
  ];
  const cta = { label: page.form.submitLabel, href: `#${FORM_ID}` };

  return (
    <>
      {/* Hero tipográfico + espaço de foto (a foto real entra por Painel → Site → Casamentos) */}
      <PageHeader
        eyebrow={page.eyebrow}
        title={page.title}
        lead={page.lead}
        accent="tail"
        actions={
          <SiteButtonLink href={cta.href} icon="arrow-down">
            {cta.label}
          </SiteButtonLink>
        }
      >
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

      {/* Abordagem */}
      {page.approach.title || approach.length > 0 ? (
        <Section id="casamentos-olhar" number={next()} label="Nosso olhar" labelledBy="casamentos-olhar-titulo">
          <SectionHeader id="casamentos-olhar-titulo" title={page.approach.title} />
          {approach.length > 0 ? (
            <div className="weddings__approach-text" {...revealProps()}>
              {approach.map((paragraph, i) => (
                <p key={i} className={i === 0 ? "s-lead" : undefined}>
                  {paragraph}
                </p>
              ))}
            </div>
          ) : null}
        </Section>
      ) : null}

      {/* O que a cobertura pode incluir */}
      {coverage.length > 0 ? (
        <Section
          id="casamentos-cobertura"
          tone="lavanda"
          number={next()}
          label="Cobertura"
          labelledBy="casamentos-cobertura-titulo"
        >
          <SectionHeader id="casamentos-cobertura-titulo" title={page.coverage.title} lead={page.coverage.intro} />
          <WeddingsCoverage items={coverage} note={page.coverage.note} />
        </Section>
      ) : null}

      {/* Como funciona a proposta */}
      {steps.length > 0 ? (
        <Section
          id="casamentos-proposta"
          number={next()}
          label="Proposta"
          labelledBy="casamentos-proposta-titulo"
          spaceTop={coverage.length > 0 ? "lg" : "none"}
        >
          <SectionHeader id="casamentos-proposta-titulo" title={page.proposal.title} lead={proposalText.join(" ")} />
          <Steps items={steps} action={<SiteButtonLink href={cta.href}>{cta.label}</SiteButtonLink>} />
        </Section>
      ) : null}

      {/* Quem estará no dia */}
      {crew.length > 0 ? (
        <Section id="casamentos-equipe" number={next()} label="No dia" labelledBy="casamentos-equipe-titulo">
          <SectionHeader id="casamentos-equipe-titulo" title={about.foundersTitle} />
          <WeddingsCrew founders={crew} images={images.founders} />
          <p className="weddings__crew-foot">
            <SiteLink href={home.founders.cta.href}>{home.founders.cta.label}</SiteLink>
          </p>
        </Section>
      ) : null}

      {/* FAQ de casamentos — só perguntas publicadas marcadas para esta página */}
      {weddingFaqs.length > 0 ? (
        <Section id="casamentos-faq" number={next()} label={home.faq.eyebrow} labelledBy="casamentos-faq-titulo">
          <SectionHeader id="casamentos-faq-titulo" title={home.faq.title} />
          <div className="s-faq__body">
            <div className="s-faq__side">
              <SiteLink href={cta.href}>{cta.label}</SiteLink>
            </div>
            <FaqAccordion items={weddingFaqs} name="faq-casamentos" />
          </div>
        </Section>
      ) : null}

      {/* Formulário de evento */}
      <Section
        id="casamentos-pedido"
        tone="roxo"
        number={next()}
        label="Pedir proposta"
        labelledBy="casamentos-pedido-titulo"
        className="s-contact"
      >
        <div className="s-contact__grid">
          <div className="s-contact__call weddings__form-call">
            <Display id="casamentos-pedido-titulo" accent="tail">
              {page.form.title}
            </Display>
            {page.form.text ? <p className="s-lead s-contact__lead">{page.form.text}</p> : null}
            <ContactChannels channels={channels} />
          </div>
          <LeadForm
            id={FORM_ID}
            variant="event"
            originPath="/casamentos"
            defaultInterest="casamentos"
            defaultEventType="Casamento"
            consentText={contactPage.consentText}
            submitLabel={page.form.submitLabel}
          />
        </div>
      </Section>
    </>
  );
}
