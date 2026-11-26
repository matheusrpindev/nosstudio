import { ExternalLink, FileText, Pencil, Trash2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { StatusBadge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { DescriptionList } from "@/components/ui/description-list";
import { ConfirmDialog } from "@/components/ui/dialog";
import { ActionForm, Field, SubmitButton } from "@/components/ui/form";
import { Select } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { DateText } from "@/components/ui/text";
import { Markdown } from "@/components/markdown";
import { requirePermission } from "@/lib/auth";
import { CONTRACT_KIND_LABELS, CONTRACT_STATUS_LABELS } from "@/lib/domain";
import { safeUrl } from "@/lib/format";
import { getContract } from "@/server/contracts/admin";
import { getMediaValue } from "@/server/media";
import { deleteContractAction, updateContractStatusAction } from "../actions";
import { UnfilledFieldsAlert } from "../fields-help";
import { CONTRACT_STATUS_TONES, LEGAL_REVIEW_NOTICE } from "../ui";
import { PrintButton } from "./print-button";

export const metadata: Metadata = { title: "Contrato" };
export const instant = false;

/** Impressão: some tudo, menos a folha do contrato (o menu do painel nunca sai no papel). Texto fixo, sem dados do banco. */
const PRINT_CSS = `
@media print {
  @page { margin: 18mm 16mm; }
  /* esconde tudo que não é a folha nem um elemento que a contém (os ancestrais ficam, sem recuos nem fundo) */
  body *:not(:has(#contrato-folha)):not(#contrato-folha):not(#contrato-folha *) { display: none !important; }
  html, body, body *:has(#contrato-folha) { display: block !important; position: static !important; width: auto !important; min-height: 0 !important; height: auto !important; margin: 0 !important; padding: 0 !important; max-width: none !important; background: #fff !important; overflow: visible !important; border: 0 !important; box-shadow: none !important; border-radius: 0 !important; }
  #contrato-folha { border: 0 !important; box-shadow: none !important; border-radius: 0 !important; padding: 0 !important; background: #fff !important; }
  #contrato-folha .prosa { color: #000; font-size: 11.5pt; line-height: 1.55; }
}
`;

export default async function ContractPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("contratos", "ver");
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const contract = await getContract(id);
  if (!contract) notFound();

  const file = await getMediaValue(contract.fileMediaId);
  const externalUrl = safeUrl(contract.externalUrl);
  const fileHref = file ? (file.mime === "application/pdf" || file.mime.startsWith("image/") ? `${file.url}?inline=1` : file.url) : null;
  const hasBody = contract.body.trim().length > 0;

  return (
    <>
      <style>{PRINT_CSS}</style>
      <PageHeader
        title={contract.title}
        badge={<StatusBadge value={contract.status} labels={CONTRACT_STATUS_LABELS} tones={CONTRACT_STATUS_TONES} />}
        description={
          <>
            {CONTRACT_KIND_LABELS[contract.kind]}
            {contract.versionLabel ? ` · ${contract.versionLabel}` : ""}
          </>
        }
        back={{ href: "/painel/contratos", label: "Contratos" }}
        actions={
          <>
            {hasBody ? <PrintButton /> : null}
            <ButtonLink href={`/painel/contratos/${contract.id}/editar`} icon={<Pencil />}>
              Editar
            </ButtonLink>
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr] lg:items-start">
        <div className="contents lg:flex lg:flex-col lg:gap-4">
          <Card as="section" aria-labelledby="dados-titulo" className="order-1">
            <CardHeader id="dados-titulo" title="Dados" />
            <DescriptionList
              items={[
                { label: "Tipo", value: CONTRACT_KIND_LABELS[contract.kind] },
                { label: "Versão", value: contract.versionLabel },
                { label: "Assinado em", value: contract.signedAt ? <DateText value={contract.signedAt} format="long" /> : null },
                {
                  label: "Vigência",
                  value:
                    contract.validFrom || contract.validUntil ? (
                      <>
                        {contract.validFrom ? <DateText value={contract.validFrom} /> : "…"} até {contract.validUntil ? <DateText value={contract.validUntil} /> : "prazo indeterminado"}
                      </>
                    ) : null,
                },
                { label: "Observações internas", value: contract.notes ? <span className="whitespace-pre-line">{contract.notes}</span> : null },
                { label: "Cadastrado em", value: <DateText value={contract.createdAt} format="datetime" /> },
              ]}
            />
          </Card>

          <Card as="section" aria-labelledby="texto-titulo" className="order-4 lg:order-2">
            <CardHeader
              id="texto-titulo"
              title="Texto do contrato"
              description="Visualização de leitura. O botão Imprimir gera uma página limpa, só com o texto."
            />
            <UnfilledFieldsAlert body={contract.body} className="mb-4">
              O cadastro não tinha esses dados quando o contrato foi salvo. Complete o cliente, a proposta ou o projeto e{" "}
              <Link className="link" href={`/painel/contratos/${contract.id}/editar`}>
                edite o contrato
              </Link>{" "}
              (salvar preenche de novo), ou escreva o texto direto no lugar do campo. Não envie nem imprima antes disso.
            </UnfilledFieldsAlert>
            {hasBody ? (
              <article id="contrato-folha" aria-label="Texto do contrato" className="border-borda rounded-campo border bg-superficie p-5 sm:p-8">
                <h2 className="text-texto text-xl leading-snug font-extrabold">{contract.title}</h2>
                <p className="text-texto-suave mt-1 mb-5 text-sm">
                  {CONTRACT_KIND_LABELS[contract.kind]}
                  {contract.versionLabel ? ` · ${contract.versionLabel}` : ""}
                  {contract.client ? ` · ${contract.client.name}` : ""}
                </p>
                <Markdown>{contract.body}</Markdown>
              </article>
            ) : (
              <p className="text-texto-suave text-sm">
                Este contrato não tem texto cadastrado. <Link className="link" href={`/painel/contratos/${contract.id}/editar`}>Editar</Link> para colar um modelo ou escrever o texto.
              </p>
            )}
            <Alert tone="alerta" className="mt-4">
              {LEGAL_REVIEW_NOTICE}
            </Alert>
          </Card>
        </div>

        <div className="contents lg:flex lg:flex-col lg:gap-4">
          <Card as="section" aria-labelledby="status-titulo" className="order-2">
            <CardHeader id="status-titulo" title="Andamento" />
            <ActionForm action={updateContractStatusAction} hidden={{ id: contract.id }} className="space-y-4">
              <Field name="status" label="Status do contrato">
                <Select options={CONTRACT_STATUS_LABELS} defaultValue={contract.status} />
              </Field>
              <SubmitButton variant="secondary" pendingLabel="Salvando…">
                Salvar status
              </SubmitButton>
            </ActionForm>
            <p className="text-texto-suave mt-4 text-[0.8125rem] leading-relaxed">A assinatura eletrônica ainda não está disponível nesta fase: anexe o documento assinado (PDF) ou cole o link dele.</p>
          </Card>

          <Card as="section" aria-labelledby="vinculos-titulo" className="order-3">
            <CardHeader id="vinculos-titulo" title="Vínculos" />
            <DescriptionList
              items={[
                { label: "Cliente", value: contract.client ? <Link className="link" href={`/painel/clientes/${contract.client.id}`}>{contract.client.name}</Link> : null },
                { label: "Projeto", value: contract.project ? <Link className="link" href={`/painel/projetos/${contract.project.id}`}>{contract.project.title}</Link> : null },
                { label: "Proposta", value: contract.proposal ? <Link className="link" href={`/painel/orcamentos/${contract.proposal.id}`}>{contract.proposal.number} — {contract.proposal.title}</Link> : null },
              ]}
            />
          </Card>

          <Card as="section" aria-labelledby="arquivo-titulo" className="order-5">
            <CardHeader id="arquivo-titulo" title="Documento assinado" />
            {fileHref || externalUrl ? (
              <div className="flex flex-col gap-2">
                {fileHref && file ? (
                  <ButtonLink href={fileHref} external variant="secondary" icon={<FileText />} className="justify-start text-left">
                    <span className="min-w-0 truncate">Abrir arquivo: {file.originalName}</span>
                  </ButtonLink>
                ) : null}
                {externalUrl ? (
                  <ButtonLink href={externalUrl} external variant="secondary" icon={<ExternalLink />}>
                    Abrir link externo
                  </ButtonLink>
                ) : null}
              </div>
            ) : (
              <p className="text-texto-suave text-sm">Nenhum arquivo ou link ainda. Use “Editar” para anexar o PDF assinado.</p>
            )}
          </Card>

          <Card as="section" aria-labelledby="excluir-titulo" className="order-6">
            <CardHeader id="excluir-titulo" title="Excluir contrato" description="Apaga o registro e o arquivo anexado. Não dá para desfazer." />
            <ConfirmDialog
              trigger={
                <Button variant="danger-ghost" icon={<Trash2 />} className="-ml-2">
                  Excluir contrato
                </Button>
              }
              title="Excluir este contrato?"
              description={
                <>
                  O contrato <strong className="text-texto">{contract.title}</strong> e o arquivo anexado serão apagados e não dá para desfazer.
                </>
              }
              confirmLabel="Excluir contrato"
              action={deleteContractAction}
              hidden={{ id: contract.id }}
            />
          </Card>
        </div>
      </div>
    </>
  );
}
