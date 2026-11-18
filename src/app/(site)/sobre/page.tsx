import { Markdown } from "@/components/markdown";
import { AboutFounders } from "@/components/site/about-founders";
import { AboutValues } from "@/components/site/about-values";
import { CtaBand, StatementBanner } from "@/components/site/blocks";
import { SiteButtonLink } from "@/components/site/button";
import { Display, PageHeader, Section, SectionHeader } from "@/components/site/layout";
import { AccentMark, RingsMark } from "@/components/site/marks";
import { PhotoSlot } from "@/components/site/photo-slot";
import { revealProps } from "@/components/site/reveal";
import { paragraphs, sectionCounter } from "@/components/site/text";
import { instagramLink } from "@/lib/format";
import { buildMetadata } from "@/lib/site/seo";
import { getSiteContent, getSiteImages } from "@/server/site/queries";
import "./about.css";

export const generateMetadata = () => buildMetadata("sobre");

/** Rótulos de interface das seções (o restante da copy vem do painel). */
const LABELS = {
  founders: "Fundadores",
  why: "Propósito",
  manifesto: "Manifesto",
} as const;

/**
 * Quem Somos: a história do casal é o maior diferencial da NÓS. Hero tipográfico (o par NÓS/nós é o visual),
 * os dois fundadores lado a lado com a bio completa, o porquê, o manifesto em bloco de cor, os valores e a
 * essência com a chamada final. Sem fotos, os espaços mostram o estado vazio da marca. Estática.
 */
export default async function AboutPage() {
  const [content, images] = await Promise.all([getSiteContent(), getSiteImages()]);
  const { about, general, home } = content;
  const next = sectionCounter();

  const founders = about.founders.filter((founder) => founder.name);
  const [introLead, ...introRest] = paragraphs(about.intro);
  const values = about.values.items.filter((item) => item.title);
  const manifesto = about.manifesto.text.trim();
  const hasManifesto = Boolean(manifesto || about.manifesto.closing);
  const hasEssence = Boolean(about.essence.title || about.essence.text || about.essence.signature);
  const instagram = instagramLink(general.instagram);
  /** "nós": o nome da marca em minúsculas ocupa o espaço da foto do casal enquanto ela não existe. */
  const nos = general.brandName.trim().split(/\s+/)[0]?.toLocaleLowerCase("pt-BR") ?? "";

  return (
    <>
      {/* 1 · Abertura: o título é o visual; a foto do casal (ou o "nós") ao lado da história */}
      <PageHeader eyebrow={about.eyebrow} title={about.title} accent="tail">
        <div className="about__opening">
          {introLead ? <Markdown className="about__lead">{introLead}</Markdown> : null}
          <PhotoSlot
            image={images.couple}
            alt={images.couple?.alt || founders.map((founder) => founder.name).join(" e ")}
            tone="roxo"
            ratio="3 / 2"
            symbol={nos ? <span className="about__nos">{nos}</span> : undefined}
            sizes="(min-width: 1024px) 50vw, 100vw"
            priority
            className="about__couple"
            caption={
              founders.length > 0 ? <strong>{founders.map((founder) => founder.name).join(" + ")}</strong> : undefined
            }
          />
          {introRest.length > 0 ? <Markdown className="s-prose about__intro">{introRest.join("\n\n")}</Markdown> : null}
        </div>
      </PageHeader>

      {/* 2 · Quem está por trás: Pedro e Laura lado a lado, com a bio completa */}
      {founders.length > 0 ? (
        <Section id="sobre-fundadores" number={next()} label={LABELS.founders} labelledBy="sobre-fundadores-titulo">
          <SectionHeader id="sobre-fundadores-titulo" title={about.foundersTitle} />
          <AboutFounders founders={founders} images={images.founders} />
        </Section>
      ) : null}

      {/* 3 · Por que nasceu a NÓS — coluna de leitura */}
      {about.why.text ? (
        <Section id="sobre-porque" number={next()} label={LABELS.why} labelledBy="sobre-porque-titulo">
          <div className="about__why">
            <div className="about__why-head">
              {about.why.title ? (
                <h2 id="sobre-porque-titulo" className="s-h2">
                  {about.why.title}
                </h2>
              ) : null}
              {/* o "nó" de NÓS: dois anéis entrelaçados (decorativo) */}
              <RingsMark className="about__why-mark" />
            </div>
            <Markdown className="s-prose about__why-text">{about.why.text}</Markdown>
          </div>
        </Section>
      ) : null}

      {/* 4 · Manifesto: trecho em destaque num bloco de cor; a frase final vira a faixa de duas metades */}
      {hasManifesto ? (
        <Section
          id="sobre-manifesto"
          tone="grafite"
          number={next()}
          label={LABELS.manifesto}
          labelledBy="sobre-manifesto-titulo"
          flush={!manifesto}
          bleed={<StatementBanner text={about.manifesto.closing} spaceTop={Boolean(manifesto)} />}
        >
          <h2 id="sobre-manifesto-titulo" className="sr-only">
            {LABELS.manifesto}
          </h2>
          {manifesto ? (
            <div className="about__manifesto" {...revealProps()}>
              <Markdown>{manifesto}</Markdown>
            </div>
          ) : null}
        </Section>
      ) : null}

      {/* 5 · Nosso jeito de trabalhar: os valores */}
      {values.length > 0 ? (
        <Section
          id="sobre-valores"
          number={next()}
          label={about.values.eyebrow}
          labelledBy="sobre-valores-titulo"
          spaceTop={hasManifesto ? "lg" : "none"}
        >
          <SectionHeader id="sobre-valores-titulo" title={about.values.title} />
          <AboutValues items={values} />
        </Section>
      ) : null}

      {/* 6 · Essência + chamada final */}
      {hasEssence ? (
        <Section
          id="sobre-essencia"
          tone="roxo"
          number={next()}
          label={general.brandName}
          labelledBy="sobre-essencia-titulo"
          className="about__essence"
        >
          <Display id="sobre-essencia-titulo" size="d0" accent="tail" className="about__essence-title">
            {about.essence.title}
          </Display>
          <div className="about__essence-body">
            <Markdown className="s-prose about__essence-text">{about.essence.text}</Markdown>
            <div className="about__essence-close">
              {about.essence.signature ? (
                <p className="about__signature">
                  <AccentMark className="about__signature-mark" />
                  <span>{about.essence.signature}</span>
                </p>
              ) : null}
              <div className="about__essence-actions">
                <SiteButtonLink href={home.closing.cta.href} block>
                  {home.closing.cta.label}
                </SiteButtonLink>
                {instagram ? (
                  <SiteButtonLink href={instagram} variant="secondary" icon="instagram" block>
                    {general.instagram}
                  </SiteButtonLink>
                ) : null}
              </div>
            </div>
          </div>
        </Section>
      ) : (
        <CtaBand id="sobre-fechamento" title={home.closing.question} text={home.closing.text} cta={home.closing.cta} />
      )}
    </>
  );
}
