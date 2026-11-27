import { notFound } from "next/navigation";
import { CtaBand } from "@/components/site/blocks";
import { SiteButtonLink, SiteLink } from "@/components/site/button";
import { PageHeader, Section, SectionHeader } from "@/components/site/layout";
import { AccentMark } from "@/components/site/marks";
import { PackageBoard } from "@/components/site/package-card";
import { PackagesStandaloneList } from "@/components/site/packages-standalone-list";
import { PlanComparison } from "@/components/site/plan-comparison";
import { sectionCounter } from "@/components/site/text";
import { buildPlanComparison } from "@/lib/site/plans";
import { buildMetadata } from "@/lib/site/seo";
import { getPackages, getSiteContent } from "@/server/site/queries";
import "./plans.css";

export const generateMetadata = () => buildMetadata("pacotes");

/** Rótulos de interface (o restante da copy vem do painel). */
const PLANS_LABEL = "Planos mensais";
const COMPARE_LABEL = "Comparativo";
const STANDALONE_LABEL = "Por diária ou por projeto";

/**
 * Planos e serviços avulsos (briefing v2, seção 07). Planos mensais em quadro (o destaque é configurável no
 * painel), tabela comparativa montada a partir das entregas de cada plano e serviços avulsos em lista. Valor só
 * aparece quando publicado; no lugar entra o texto de `priceOnRequestLabel`. Quantidades, captação, revisões e
 * opcionais só quando preenchidos. Sem planos visíveis — ou com a página desligada — ela não existe (404). Estática.
 */
export default async function PlansPage() {
  const [content, packages] = await Promise.all([getSiteContent(), getPackages()]);
  const { visibility, packagesPage: page, home } = content;
  const { plans, standalone } = packages;
  if (!visibility.packages || plans.length + standalone.length === 0) notFound();

  const next = sectionCounter();
  const hasBoth = plans.length > 0 && standalone.length > 0;
  const showComparison = page.comparison.enabled && plans.length > 1 && buildPlanComparison(plans).rows.length > 0;
  const compareTitle = page.comparison.title || COMPARE_LABEL;

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
              <SiteButtonLink href="#planos-avulsos" variant="secondary" icon="arrow-down">
                {page.standaloneTitle}
              </SiteButtonLink>
            ) : null}
          </>
        }
      />

      {/* 1 · Planos mensais: quadro comparável, o plano em destaque "fura" o quadro */}
      {plans.length > 0 ? (
        <Section id="planos-mensais" number={next()} label={PLANS_LABEL} labelledBy="planos-mensais-titulo">
          <h2 id="planos-mensais-titulo" className="sr-only">
            {PLANS_LABEL}
          </h2>
          <PackageBoard
            packages={plans}
            recommendedLabel={page.recommendedLabel}
            priceOnRequestLabel={page.priceOnRequestLabel}
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

      {/* 2 · Tabela comparativa (liga/desliga no painel; só com dois ou mais planos e entregas cadastradas) */}
      {showComparison ? (
        <Section id="planos-comparativo" number={next()} label={COMPARE_LABEL} labelledBy="planos-comparativo-titulo">
          <SectionHeader id="planos-comparativo-titulo" title={compareTitle} lead={page.comparison.intro} />
          <PlanComparison plans={plans} caption={compareTitle} recommendedLabel={page.recommendedLabel} priceOnRequestLabel={page.priceOnRequestLabel} />
        </Section>
      ) : null}

      {/* 3 · Serviços avulsos: lista enxuta, cada linha leva ao formulário com o serviço já escolhido */}
      {standalone.length > 0 ? (
        <Section id="planos-avulsos" tone="lavanda" number={next()} label={STANDALONE_LABEL} labelledBy="planos-avulsos-titulo">
          <SectionHeader id="planos-avulsos-titulo" title={page.standaloneTitle} lead={page.standaloneIntro} />
          <PackagesStandaloneList packages={standalone} />
          {page.priceOnRequestLabel || (plans.length === 0 && page.note) ? (
            <p className="packages__note packages__note--after">
              <AccentMark className="packages__note-mark" />
              <span>{plans.length === 0 && page.note ? page.note : page.priceOnRequestLabel}</span>
            </p>
          ) : null}
        </Section>
      ) : null}

      <CtaBand id="planos-fechamento" title={page.closingTitle} text={page.closingText} cta={page.cta} />
    </>
  );
}
