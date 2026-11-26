import { ArrowRight, CircleCheck, ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardHeader, StatCard } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { requirePermission } from "@/lib/auth";
import { getSiteOverview } from "./overview";

export const metadata: Metadata = { title: "Editar site" };
export const instant = false;

const plural = (value: number, one: string, many: string) => `${value} ${value === 1 ? one : many}`;

export default async function SiteOverviewPage() {
  await requirePermission("site", "ver");
  const { counts, visibility, pending, sectionsEdited, sectionsTotal } = await getSiteOverview();

  const portfolioCaption = !visibility.portfolio
    ? "Portfólio oculto no site"
    : counts.portfolioPublished === 0
      ? "Ligado, mas sem projetos publicados: não aparece"
      : "Visível no site";
  const testimonialsCaption = !visibility.testimonials
    ? "Depoimentos ocultos no site"
    : counts.testimonialsPublished === 0
      ? "Ligado, mas sem depoimentos publicados: não aparece"
      : "Visíveis no site";
  const faqCaption = !visibility.faq ? "FAQ oculto no site" : counts.faqsPublished === 0 ? "Nenhuma publicada: o bloco não aparece" : "Visível no site";

  return (
    <>
      <PageHeader
        title="Editar site"
        description="Tudo o que o público vê no site é editado aqui: textos, imagens, avisos, serviços, pacotes e mais. Sem precisar de programador."
        actions={
          <ButtonLink href="/" external variant="secondary" icon={<ExternalLink />}>
            Ver o site
          </ButtonLink>
        }
      />

      <Card as="section" aria-labelledby="pendencias" className="mb-6">
        <CardHeader
          id="pendencias"
          title="Antes de divulgar o site"
          description="Pendências calculadas a partir do que já está cadastrado. Cada uma leva direto ao lugar de resolver."
          action={pending.length > 0 ? <Badge tone="alerta">{plural(pending.length, "pendência", "pendências")}</Badge> : null}
        />
        {pending.length === 0 ? (
          <div className="mt-4">
            <Alert tone="sucesso" title="Tudo pronto">
              <span className="inline-flex items-center gap-1.5">
                <CircleCheck aria-hidden="true" className="size-4" />
                Não há pendências de lançamento no momento.
              </span>
            </Alert>
          </div>
        ) : (
          <ul className="divide-borda mt-3 divide-y">
            {pending.map((item) => (
              <li key={item.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
                <div className="min-w-0">
                  <p className="text-texto flex flex-wrap items-center gap-2 text-sm font-bold">
                    {item.title}
                    {item.tone === "info" ? <Badge tone="neutral">Lembrete</Badge> : null}
                  </p>
                  <p className="text-texto-suave mt-1 text-sm leading-relaxed">{item.description}</p>
                </div>
                <ButtonLink href={item.href} variant="secondary" iconRight={<ArrowRight />} className="shrink-0 max-sm:w-full">
                  {item.actionLabel}
                </ButtonLink>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <h2 className="text-texto mb-3 text-base font-bold">Situação de cada área</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          label="Textos do site"
          value={`${sectionsEdited}/${sectionsTotal}`}
          caption={sectionsEdited === 0 ? "Todos os textos originais do briefing" : "seções editadas; as demais usam o texto original"}
          href="/painel/site/textos"
        />
        <StatCard
          label="Avisos"
          value={counts.announcementsActive}
          caption={`${plural(counts.announcementsActive, "ativo", "ativos")} de ${counts.announcementsTotal} no topo do site`}
          href="/painel/site/avisos"
        />
        <StatCard
          label="Serviços"
          value={counts.servicesVisible}
          caption={`${plural(counts.servicesVisible, "visível", "visíveis")} de ${counts.servicesTotal}`}
          href="/painel/site/servicos"
        />
        <StatCard
          label="Pacotes"
          value={counts.packagesVisible}
          caption={
            counts.packagesWithPrice === 0
              ? `${plural(counts.packagesVisible, "visível", "visíveis")} · todos “Sob consulta”`
              : `${plural(counts.packagesVisible, "visível", "visíveis")} · ${counts.packagesWithPrice} com valor`
          }
          href="/painel/site/pacotes"
        />
        <StatCard label="Perguntas frequentes" value={`${counts.faqsPublished} de ${counts.faqsTotal}`} caption={faqCaption} href="/painel/site/faq" />
        <StatCard label="Portfólio" value={counts.portfolioPublished} caption={`${plural(counts.portfolioPublished, "projeto publicado", "projetos publicados")} de ${counts.portfolioTotal} · ${portfolioCaption}`} href="/painel/site/portfolio" />
        <StatCard
          label="Depoimentos"
          value={counts.testimonialsPublished}
          caption={`${plural(counts.testimonialsPublished, "publicado", "publicados")} de ${counts.testimonialsTotal} · ${testimonialsCaption}`}
          href="/painel/site/depoimentos"
        />
      </div>

      <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
        <p className="text-texto-suave text-sm">Quer ligar ou desligar uma página inteira (Portfólio, Casamentos…)?</p>
        <ButtonLink href="/painel/site/textos/visibility" variant="secondary">
          Abrir “Visibilidade das seções”
        </ButtonLink>
      </div>
    </>
  );
}
