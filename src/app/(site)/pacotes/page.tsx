import { notFound } from "next/navigation";
import { CtaBand } from "@/components/site/blocks";
import { SiteButtonLink, SiteLink } from "@/components/site/button";
import { PageHeader, Section, SectionHeader } from "@/components/site/layout";
import { AccentMark } from "@/components/site/marks";
import { PackageBoard } from "@/components/site/package-card";
import { PackagesStandaloneList } from "@/components/site/packages-standalone-list";
import { sectionCounter } from "@/components/site/text";
import { buildMetadata } from "@/lib/site/seo";
import { getPackages, getSiteContent } from "@/server/site/queries";
import "./packages.css";

export const generateMetadata = () => buildMetadata("pacotes");

/** Rótulos de interface (o restante da copy vem do painel). */
const PLANS_LABEL = "Planos mensais";
const STANDALONE_LABEL = "Por diária ou por projeto";

/**
 * Pacotes e planos. Planos mensais em quadro comparável (preço conforme `priceMode`; quantidades, captação e
 * revisões só quando preenchidas no painel) e serviços avulsos em lista. Sem pacotes visíveis — ou com a
 * seção desligada em Visibilidade — a página não existe (404). Estática.
 */
export default async function PackagesPage() {
  const [content, packages] = await Promise.all([getSiteContent(), getPackages()]);
  const { visibility, packagesPage: page, home } = content;
  const { plans, standalone } = packages;
  if (!visibility.packages || plans.length + standalone.length === 0) notFound();

  const next = sectionCounter();
  const hasBoth = plans.length > 0 && standalone.length > 0;

  return (
    <>
      <PageHeader
        eyebrow={page.eyebrow}
        title={page.title}
        lead={page.intro}
        actions={
          <>
            <SiteButtonLink href={page.cta.href}>{page.cta.label}</SiteButtonLink>
            {hasBoth && page.standaloneTitle ? (
              <SiteButtonLink href="#pacotes-avulsos" variant="secondary" icon="arrow-down">
                {page.standaloneTitle}
              </SiteButtonLink>
            ) : null}
          </>
        }
      />

      {/* 1 · Planos mensais: quadro comparável, o recomendado em destaque */}
      {plans.length > 0 ? (
        <Section id="pacotes-planos" number={next()} label={PLANS_LABEL} labelledBy="pacotes-planos-titulo">
          <h2 id="pacotes-planos-titulo" className="sr-only">
            {PLANS_LABEL}
          </h2>
          <PackageBoard
            packages={plans}
            recommendedLabel={page.recommendedLabel}
            detail="full"
            className="packages__board"
          />
          {page.note || home.highlights.cta.label ? (
            <div className="packages__foot">
              {page.note ? (
                <p className="packages__note">
                  <AccentMark className="packages__note-mark" />
                  <span>{page.note}</span>
                </p>
              ) : (
                <span />
              )}
              <SiteLink href={home.highlights.cta.href}>{home.highlights.cta.label}</SiteLink>
            </div>
          ) : null}
        </Section>
      ) : null}

      {/* 2 · Serviços avulsos: lista enxuta, cada linha leva ao formulário com o serviço já escolhido */}
      {standalone.length > 0 ? (
        <Section
          id="pacotes-avulsos"
          tone="lavanda"
          number={next()}
          label={STANDALONE_LABEL}
          labelledBy="pacotes-avulsos-titulo"
        >
          <SectionHeader id="pacotes-avulsos-titulo" title={page.standaloneTitle} lead={page.standaloneIntro} />
          <PackagesStandaloneList packages={standalone} />
          {plans.length === 0 && page.note ? (
            <p className="packages__note packages__note--after">
              <AccentMark className="packages__note-mark" />
              <span>{page.note}</span>
            </p>
          ) : null}
        </Section>
      ) : null}

      <CtaBand id="pacotes-fechamento" title={page.closingTitle} text={page.closingText} cta={page.cta} />
    </>
  );
}
