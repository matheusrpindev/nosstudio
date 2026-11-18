import { Download } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { requireUser } from "@/lib/auth";
import { todayISO } from "@/lib/dates";
import { PROPOSAL_MODALITY_LABELS, PROPOSAL_STATUS_LABELS } from "@/lib/domain";
import { getClientOptions, getUserOptions } from "@/server/options";
import { getProposalEditorData } from "@/server/proposals/admin";
import { buildDraft } from "../draft";
import { PROPOSAL_STATUS_TONES, proposalNumberLabel } from "../ui";
import type { ControlData } from "./control";
import { ProposalEditor } from "./editor";

export const metadata: Metadata = { title: "Orçamento" };
export const instant = false;

export default async function ProposalEditorPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const data = await getProposalEditorData(id);
  if (!data) notFound();
  const [clients, users] = await Promise.all([getClientOptions(), getUserOptions()]);

  const { proposal } = data;
  const isTemplate = proposal.isTemplate;
  const templateName = proposal.templateName || proposal.title;

  const control: ControlData = {
    id: proposal.id,
    isTemplate,
    number: proposal.number,
    version: proposal.version,
    status: proposal.status,
    clientId: proposal.clientId,
    sentAt: proposal.sentAt?.toISOString() ?? null,
    respondedAt: proposal.respondedAt?.toISOString() ?? null,
    versions: data.versions.map((item) => ({
      id: item.id,
      version: item.version,
      status: item.status,
      createdAt: item.createdAt.toISOString(),
      sentAt: item.sentAt?.toISOString() ?? null,
    })),
    project: data.project,
    contractId: proposal.contractId,
    contracts: data.contracts,
    finance: data.finance,
    today: todayISO(),
    defaultTemplateName: isTemplate ? templateName : `${proposal.title}${data.client ? ` — ${data.client.name}` : ""}`.slice(0, 120),
  };

  return (
    <>
      <PageHeader
        title={isTemplate ? templateName : `Proposta ${proposalNumberLabel(proposal.number, proposal.version)}`}
        badge={
          isTemplate ? (
            <Badge tone="roxo">Modelo</Badge>
          ) : (
            <StatusBadge value={proposal.status} labels={PROPOSAL_STATUS_LABELS} tones={PROPOSAL_STATUS_TONES} />
          )
        }
        description={
          isTemplate
            ? `Modelo de ${PROPOSAL_MODALITY_LABELS[proposal.modality].toLowerCase()}. Ajuste os itens, as parcelas e os textos e salve.`
            : `${PROPOSAL_MODALITY_LABELS[proposal.modality]} · ${proposal.title}${data.client ? ` · ${data.client.name}` : ""}`
        }
        back={isTemplate ? { href: "/painel/orcamentos/modelos", label: "Modelos" } : { href: "/painel/orcamentos", label: "Orçamentos" }}
        actions={
          // `download`: link comum, sem prefetch — o <Link> chamaria a rota (e registraria "Baixou o PDF") só de a página abrir
          isTemplate ? null : (
            <ButtonLink href={`/painel/orcamentos/${proposal.id}/pdf?baixar=1`} download variant="secondary" icon={<Download />}>
              Baixar PDF
            </ButtonLink>
          )
        }
      />
      <ProposalEditor
        id={proposal.id}
        isTemplate={isTemplate}
        number={proposal.number}
        version={proposal.version}
        serverKey={String(proposal.updatedAt.getTime())}
        initialDraft={buildDraft(data)}
        clients={clients}
        users={users}
        today={todayISO()}
        control={control}
      />
    </>
  );
}
