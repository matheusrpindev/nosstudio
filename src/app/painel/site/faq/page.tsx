import { CircleHelp, ExternalLink, Plus } from "lucide-react";
import type { Metadata } from "next";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { DataList, type DataListColumn } from "@/components/ui/data-list";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { requireUser } from "@/lib/auth";
import type { Faq } from "@/db/schema";
import { listFaqs } from "@/server/site/admin/faqs";
import { getSiteContentForEdit } from "@/server/site/content";
import { SectionHiddenNotice } from "../_colecoes/hidden-notice";
import { PUBLISHED_LABELS, PUBLISHED_TONES } from "../_colecoes/messages";
import { MoveButtons, RowSwitch } from "../_colecoes/row-controls";
import { moveFaqAction, toggleFaqAction } from "./actions";

export const metadata: Metadata = { title: "FAQ do site" };
export const instant = false;

export default async function FaqPage() {
  await requireUser();
  const [rows, visibility] = await Promise.all([listFaqs(), getSiteContentForEdit("visibility")]);
  const suggestedDrafts = rows.filter((row) => !row.published && row.answer.trim()).length;

  const columns: DataListColumn<Faq>[] = [
    {
      key: "pergunta",
      header: "Pergunta",
      primary: true,
      cell: (faq) => (
        <>
          <span className="block break-words">{faq.question}</span>
          {!faq.answer.trim() ? <span className="text-alerta block text-[0.8125rem] font-normal">Sem resposta ainda</span> : null}
        </>
      ),
    },
    {
      key: "situacao",
      header: "Situação",
      hideLabelOnMobile: true,
      cell: (faq) => {
        const status = faq.published ? "publicado" : "rascunho";
        return <Badge tone={PUBLISHED_TONES[status]} dot>{faq.published ? "Publicada" : "Rascunho"}</Badge>;
      },
    },
    {
      key: "onde",
      header: "Aparece em",
      hideOnMobile: true,
      cell: (faq) =>
        faq.showOnHome || faq.showOnWeddings ? (
          <span className="flex flex-wrap gap-1.5">
            {faq.showOnHome ? <Badge tone="roxo">Início</Badge> : null}
            {faq.showOnWeddings ? <Badge tone="roxo">Casamentos</Badge> : null}
          </span>
        ) : (
          <span className="text-cinza">Nenhuma página (marque Início ou Casamentos)</span>
        ),
    },
    { key: "publicar", header: "No site", interactive: true, cell: (faq) => <RowSwitch id={faq.id} checked={faq.published} label={`Publicar a pergunta “${faq.question}”`} action={toggleFaqAction} /> },
    {
      key: "ordem",
      header: "Ordem",
      interactive: true,
      cell: (faq) => {
        const index = rows.indexOf(faq);
        return <MoveButtons id={faq.id} name={faq.question} isFirst={index === 0} isLast={index === rows.length - 1} action={moveFaqAction} />;
      },
    },
  ];

  return (
    <>
      <PageHeader
        title="Perguntas frequentes"
        description="Só perguntas publicadas e com resposta aparecem no site, na ordem desta lista: no resumo da página inicial e na página de Casamentos, conforme você marcar em cada pergunta."
        actions={
          <>
            <ButtonLink href="/#faq" external variant="secondary" icon={<ExternalLink />}>
              Ver no site
            </ButtonLink>
            <ButtonLink href="/painel/site/faq/novo" icon={<Plus />}>
              Nova pergunta
            </ButtonLink>
          </>
        }
      />
      <SectionHiddenNotice hidden={!visibility.faq} section="O FAQ" />
      {suggestedDrafts > 0 ? (
        <Alert tone="info" title="Respostas sugeridas são rascunhos" className="mb-5">
          As {suggestedDrafts === 1 ? "resposta sugerida" : `${suggestedDrafts} respostas sugeridas`} que já vieram preenchidas são só um ponto de partida. Leia, ajuste com Pedro e Laura e só então publique.
        </Alert>
      ) : null}
      <DataList
        caption="Perguntas frequentes"
        columns={columns}
        rows={rows}
        rowKey={(faq) => faq.id}
        href={(faq) => `/painel/site/faq/${faq.id}`}
        empty={
          <EmptyState
            variant="plain"
            icon={<CircleHelp />}
            title="Nenhuma pergunta cadastrada"
            description="Cadastre as dúvidas que os clientes mais fazem. Enquanto nada estiver publicado, o site não mostra a seção."
            action={
              <ButtonLink href="/painel/site/faq/novo" icon={<Plus />}>
                Nova pergunta
              </ButtonLink>
            }
          />
        }
      />
    </>
  );
}
