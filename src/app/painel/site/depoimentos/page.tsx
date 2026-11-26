import { ExternalLink, MessageSquareQuote, Plus } from "lucide-react";
import type { Metadata } from "next";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { DataList, type DataListColumn } from "@/components/ui/data-list";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { requireUser } from "@/lib/auth";
import { TESTIMONIAL_KIND_LABELS } from "@/lib/domain";
import { truncate } from "@/lib/format";
import type { Testimonial } from "@/db/schema";
import { listTestimonials } from "@/server/site/admin/testimonials";
import { getSiteContentForEdit } from "@/server/site/content";
import { SectionHiddenNotice } from "../_colecoes/hidden-notice";
import { PUBLISHED_TONES } from "../_colecoes/messages";
import { MoveButtons, RowSwitch } from "../_colecoes/row-controls";
import { moveTestimonialAction, toggleTestimonialAction } from "./actions";
import { AuthorizationNotice } from "./notice";

export const metadata: Metadata = { title: "Depoimentos do site" };
export const instant = false;

export default async function TestimonialsPage() {
  await requireUser();
  const [rows, visibility] = await Promise.all([listTestimonials(), getSiteContentForEdit("visibility")]);

  const columns: DataListColumn<Testimonial>[] = [
    {
      key: "autor",
      header: "Depoimento",
      primary: true,
      cell: (item) => (
        <>
          <span className="block break-words">{item.authorName || "Sem nome"}</span>
          <span className="text-texto-suave block text-[0.8125rem] font-normal">
            {[item.authorRole, item.content ? truncate(item.content, 80) : ""].filter(Boolean).join(" · ") || TESTIMONIAL_KIND_LABELS[item.kind]}
          </span>
        </>
      ),
    },
    { key: "tipo", header: "Tipo", cell: (item) => TESTIMONIAL_KIND_LABELS[item.kind] },
    {
      key: "autorizacao",
      header: "Autorização",
      hideOnMobile: true,
      cell: (item) => (item.authorized ? <Badge tone="sucesso">Registrada</Badge> : <Badge tone="alerta">Falta registrar</Badge>),
    },
    {
      key: "situacao",
      header: "Situação",
      hideLabelOnMobile: true,
      cell: (item) => (
        <Badge tone={PUBLISHED_TONES[item.published ? "publicado" : "rascunho"]} dot>
          {item.published ? "Publicado" : "Rascunho"}
        </Badge>
      ),
    },
    { key: "publicar", header: "No site", interactive: true, cell: (item) => <RowSwitch id={item.id} checked={item.published} label={`Publicar o depoimento de ${item.authorName || "sem nome"}`} action={toggleTestimonialAction} /> },
    {
      key: "ordem",
      header: "Ordem",
      interactive: true,
      cell: (item) => {
        const index = rows.indexOf(item);
        return <MoveButtons id={item.id} name={item.authorName || "depoimento"} isFirst={index === 0} isLast={index === rows.length - 1} action={moveTestimonialAction} />;
      },
    },
  ];

  return (
    <>
      <PageHeader
        title="Depoimentos do site"
        description="O que clientes reais disseram sobre a NÓS Studio. Só aparecem os publicados e autorizados."
        actions={
          <>
            <ButtonLink href="/" external variant="secondary" icon={<ExternalLink />}>
              Ver no site
            </ButtonLink>
            <ButtonLink href="/painel/site/depoimentos/novo" icon={<Plus />}>
              Novo depoimento
            </ButtonLink>
          </>
        }
      />
      <SectionHiddenNotice hidden={!visibility.testimonials} title="A seção de depoimentos está oculta no site" />
      <AuthorizationNotice />
      <DataList
        caption="Depoimentos"
        columns={columns}
        rows={rows}
        rowKey={(item) => item.id}
        href={(item) => `/painel/site/depoimentos/${item.id}`}
        empty={
          <EmptyState
            variant="plain"
            icon={<MessageSquareQuote />}
            title="Nenhum depoimento cadastrado"
            description="A seção começa vazia de propósito: cadastre só depoimentos reais, com autorização do cliente. Enquanto nada estiver publicado, o site não mostra a seção."
            action={
              <ButtonLink href="/painel/site/depoimentos/novo" icon={<Plus />}>
                Novo depoimento
              </ButtonLink>
            }
          />
        }
      />
    </>
  );
}
