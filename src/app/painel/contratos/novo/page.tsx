import { FileText } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { paramId, type PageSearchParams } from "@/components/ui/search-params";
import { requireUser } from "@/lib/auth";
import { CONTRACT_KIND_LABELS } from "@/lib/domain";
import { getLinkDefaults, getTemplate, listTemplates } from "@/server/contracts/admin";
import { getClientOptions, getProjectOptions, getProposalOptions } from "@/server/options";
import { createContractAction } from "../actions";
import { ContractForm } from "../contract-form";
import { LEGAL_REVIEW_NOTICE } from "../ui";

export const metadata: Metadata = { title: "Novo contrato" };
export const instant = false;

export default async function NewContractPage({ searchParams }: { searchParams: PageSearchParams }) {
  await requireUser();
  const params = await searchParams;
  const [clients, projects, proposals, templates] = await Promise.all([getClientOptions(), getProjectOptions(), getProposalOptions(), listTemplates()]);

  const projectId = paramId(params.projeto);
  const proposalId = paramId(params.proposta);
  const defaults = await getLinkDefaults({ projectId, proposalId });
  const requestedClient = paramId(params.cliente);
  const clientId = clients.some((c) => c.value === requestedClient) ? (requestedClient ?? null) : defaults.clientId;
  const modeloId = paramId(params.modelo);
  const template = modeloId ? await getTemplate(modeloId) : null;

  return (
    <div className="max-w-3xl">
      <PageHeader title="Novo contrato" description="Escolha um modelo para copiar o texto (opcional) e preencha os dados." back={{ href: "/painel/contratos", label: "Contratos" }} />
      <Alert tone="alerta" className="mb-4">
        {LEGAL_REVIEW_NOTICE}
      </Alert>

      <Card className="mb-4">
        {templates.length === 0 ? (
          <p className="text-cinza text-sm">
            Ainda não há modelos de texto. <Link className="link" href="/painel/contratos/modelos/novo">Crie o primeiro modelo</Link> ou escreva o contrato direto abaixo.
          </p>
        ) : (
          // GET simples: recarrega esta página com ?modelo= e mantém os vínculos já escolhidos pela URL
          <form method="get" className="flex flex-col gap-3 sm:flex-row sm:items-end">
            {clientId ? <input type="hidden" name="cliente" value={clientId} /> : null}
            {projectId ? <input type="hidden" name="projeto" value={projectId} /> : null}
            {proposalId ? <input type="hidden" name="proposta" value={proposalId} /> : null}
            <div className="min-w-0 flex-1">
              <label htmlFor="modelo" className="label">
                Começar de um modelo
              </label>
              <select id="modelo" name="modelo" className="input" defaultValue={template ? String(template.id) : ""}>
                <option value="">Em branco (sem modelo)</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title} — {CONTRACT_KIND_LABELS[t.kind]}
                    {t.versionLabel ? ` (${t.versionLabel})` : ""}
                  </option>
                ))}
              </select>
            </div>
            <Button type="submit" variant="secondary" icon={<FileText />}>
              Usar modelo
            </Button>
          </form>
        )}
        {template ? <p className="text-cinza mt-3 text-sm">Texto copiado do modelo “{template.title}”. Trocar o modelo recarrega o formulário com o texto dele.</p> : null}
      </Card>

      <ContractForm
        formKey={`modelo-${template?.id ?? 0}`}
        action={createContractAction}
        values={{
          title: template ? template.title : defaults.title ? `Contrato — ${defaults.title}` : "",
          kind: template?.kind ?? "outro",
          versionLabel: template?.versionLabel ?? "",
          clientId,
          projectId: defaults.projectId,
          proposalId: defaults.proposalId,
          status: "rascunho",
          signedAt: null,
          validFrom: null,
          validUntil: null,
          externalUrl: "",
          body: template?.body ?? "",
          notes: "",
        }}
        file={null}
        clients={clients}
        projects={projects}
        proposals={proposals}
        cancelHref="/painel/contratos"
        submitLabel="Cadastrar contrato"
      />
    </div>
  );
}
