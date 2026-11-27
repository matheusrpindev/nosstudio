import "server-only";
import { and, count, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { faqs, packages, portfolioProjects, services, testimonials } from "@/db/schema";
import type { HomeSectionId } from "@/lib/site/home-layout";
import { getSiteContentForEdit } from "@/server/site/content";

export type HomeSectionStatus = { hasContent: boolean; emptyReason: string };

const n = (rows: { n: number }[]) => rows[0]?.n ?? 0;

/**
 * Cada seção da página inicial tem conteúdo publicado AGORA? Mesmas regras de src/app/(site)/page.tsx (leitura
 * direta do banco, sem cache): uma seção ligada mas sem conteúdo não aparece no site, e o painel explica por quê.
 */
export async function getHomeSectionStatus(): Promise<Record<HomeSectionId, HomeSectionStatus>> {
  const [visibility, home, about, differentials, howItWorks, svc, plans, standalone, projects, testimonialsCount, faqCount] = await Promise.all([
    getSiteContentForEdit("visibility"),
    getSiteContentForEdit("home"),
    getSiteContentForEdit("about"),
    getSiteContentForEdit("differentials"),
    getSiteContentForEdit("howItWorks"),
    db.select({ n: count() }).from(services).where(eq(services.visible, true)),
    db.select({ n: count() }).from(packages).where(and(eq(packages.visible, true), eq(packages.kind, "plano"))),
    db.select({ n: count() }).from(packages).where(and(eq(packages.visible, true), eq(packages.kind, "avulso"))),
    db.select({ n: count() }).from(portfolioProjects).where(eq(portfolioProjects.published, true)),
    db.select({ n: count() }).from(testimonials).where(and(eq(testimonials.published, true), eq(testimonials.authorized, true))),
    db.select({ n: count() }).from(faqs).where(and(eq(faqs.published, true), eq(faqs.showOnHome, true), sql`trim(${faqs.answer}) <> ''`)),
  ]);

  const ok: HomeSectionStatus = { hasContent: true, emptyReason: "" };
  const empty = (emptyReason: string): HomeSectionStatus => ({ hasContent: false, emptyReason });
  const when = (condition: boolean, reason: string) => (condition ? ok : empty(reason));

  return {
    servicos: when(n(svc) > 0, "Nenhum serviço publicado. Publique um serviço em Editar site → Serviços."),
    portfolio: !visibility.portfolio
      ? empty("O Portfólio está desligado em Textos → Páginas visíveis.")
      : when(n(projects) > 0, "Nenhum projeto publicado no Portfólio."),
    diferenciais: when(differentials.items.some((item) => item.title.trim()), "Nenhum diferencial cadastrado."),
    fundadores: when(about.founders.some((founder) => founder.name.trim()) || home.founders.title.trim() !== "", "Sem fundadores nem título cadastrados."),
    processo: when(howItWorks.steps.some((step) => step.title.trim()), "Nenhuma etapa cadastrada."),
    planos: !visibility.packages ? empty("A página de Planos está desligada em Textos → Páginas visíveis.") : when(n(plans) > 0, "Nenhum plano mensal publicado."),
    avulsos: !visibility.packages
      ? empty("A página de Planos está desligada em Textos → Páginas visíveis.")
      : when(n(standalone) > 0, "Nenhum serviço avulso publicado."),
    eventos: when(visibility.weddings, "A página de Eventos e Casamentos está desligada em Textos → Páginas visíveis."),
    depoimentos: !visibility.testimonials
      ? empty("Depoimentos estão desligados em Textos → Páginas visíveis (o padrão, até haver relatos reais e autorizados).")
      : when(n(testimonialsCount) > 0, "Nenhum depoimento publicado e autorizado."),
    faq: !visibility.faq
      ? empty("As perguntas frequentes estão desligadas em Textos → Páginas visíveis.")
      : when(n(faqCount) > 0, "Nenhuma pergunta publicada (com resposta) marcada para a página inicial."),
    formulario: ok,
  };
}
