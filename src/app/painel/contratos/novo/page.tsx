import { FileText } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { paramId, type PageSearchParams } from "@/components/ui/search-params";
import { requirePermission } from "@/lib/auth";
import { todayISO } from "@/lib/dates";
import { CONTRACT_KIND_LABELS } from "@/lib/domain";
import { fillContractBody, getLinkDefaults, getTemplate, listTemplates } from "@/server/contracts/admin";
import { findUnfilledFields } from "@/server/contracts/fields";
import { getClientOptions, getProjectOptions, getProposalOptions } from "@/server/options";
import { createContractAction } from "../actions";
import { ContractForm } from "../contract-form";
import { FieldToken } from "../fields-help";
import { LEGAL_REVIEW_NOTICE } from "../ui";

export const metadata: Metadata = { title: "Novo contrato" };
export const instant = false;

export default async function NewContractPage({ searchParams }: { searchParams: PageSearchParams }) {
  await requirePermission("contratos", "editar");
  const params = await searchParams;
  const [clients, projects, proposals, templates] = await Promise.all([getClientOptions(), getProjectOptions(), getProposalOptions(), listTemplates()]);

  const projectId = paramId(params.projeto);
  const proposalId = paramId(params.proposta);
  const defaults = await getLinkDefaults({ projectId, proposalId });
  const requestedClient = paramId(params.cliente);
  const clientId = clients.some((c) => c.value === requestedClient) ? (requestedClient ?? null) : defaults.clientId;
  const modeloId = paramId(params.modelo);
  const template = modeloId ? await getTemplate(modeloId) : null;

  // Campos automáticos ({{cliente}}, {{valor_total}}…): o que já dá para preencher com os vínculos que vieram na URL
  // aparece preenchido no texto; o resto é preenchido ao cadastrar, com os vínculos escolhidos no formulário.
  const links = { clientId, projectId: defaults.projectId, proposalId: defaults.proposalId };
  const body = template ? await fillContractBody(template.body, links, todayISO()) : "";
  const templateHasFields = template ? findUnfilledFields(template.body).length > 0 : false;
  const pending = findUnfilledFields(body);
  const linkedTo = [
    clientId ? `cliente ${clients.find((c) => c.value === clientId)?.label ?? ""}`.trim() : null,
    defaults.proposalId ? `proposta ${proposals.find((p) => p.value === defaults.proposalId)?.label ?? ""}`.trim() : null,
    defaults.projectId ? `projeto ${projects.find((p) => p.value === defaults.projectId)?.label ?? ""}`.trim() : null,
  ].filter((item): item is string => item !== null);

  return (
    <div className="max-w-3xl">
      <PageHeader title="Novo contrato" description="Escolha um modelo para copiar o texto (opcional) e preencha os dados." back={{ href: "/painel/contratos", label: "Contratos" }} />
      <Alert tone="alerta" className="mb-4">
        {LEGAL_REVIEW_NOTICE}
      </Alert>

      <Card className="mb-4">
        {templates.length === 0 ? (
          <p className="text-texto-suave text-sm">
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
        {template ? <p className="text-texto-suave mt-3 text-sm">Texto copiado do modelo “{template.title}”. Trocar o modelo recarrega o formulário com o texto dele.</p> : null}
        {template && templateHasFields ? (
          <div className="text-texto-suave mt-2 space-y-1.5 text-sm">
            {linkedTo.length > 0 ? (
              <p>
                Campos automáticos preenchidos com os dados de: <span className="text-texto font-semibold">{linkedTo.join(" · ")}</span>. Se mudar os vínculos abaixo, confira o texto.
              </p>
            ) : (
              <p>Este modelo tem campos automáticos. Escolha o cliente (e a proposta ou o projeto) em Vínculos: os campos são preenchidos quando você cadastrar o contrato.</p>
            )}
            {pending.length > 0 ? (
              <p className="flex flex-wrap items-center gap-1.5">
                <span>{linkedTo.length > 0 ? "Sem dado no cadastro por enquanto:" : "Campos do modelo:"}</span>
                {pending.map((field) => (
                  <FieldToken key={field.token}>{field.token}</FieldToken>
                ))}
              </p>
            ) : null}
          </div>
        ) : null}
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
          body,
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
