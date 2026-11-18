import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { PageHeader } from "@/components/ui/page-header";
import { requireUser } from "@/lib/auth";
import { getContract } from "@/server/contracts/admin";
import { getMediaValue } from "@/server/media";
import { getClientOptions, getProjectOptions, getProposalOptions } from "@/server/options";
import { updateContractAction } from "../../actions";
import { ContractForm } from "../../contract-form";
import { UnfilledFieldsAlert } from "../../fields-help";
import { LEGAL_REVIEW_NOTICE } from "../../ui";

export const metadata: Metadata = { title: "Editar contrato" };
export const instant = false;

export default async function EditContractPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const contract = await getContract(id);
  if (!contract) notFound();
  const [clients, projects, proposals, file] = await Promise.all([getClientOptions(), getProjectOptions(), getProposalOptions(), getMediaValue(contract.fileMediaId)]);

  return (
    <div className="max-w-3xl">
      <PageHeader title="Editar contrato" description={contract.title} back={{ href: `/painel/contratos/${contract.id}`, label: "Voltar ao contrato" }} />
      <Alert tone="alerta" className="mb-4">
        {LEGAL_REVIEW_NOTICE}
      </Alert>
      <UnfilledFieldsAlert body={contract.body} className="mb-4">
        Complete o cadastro do cliente, da proposta ou do projeto e salve de novo (os campos são preenchidos ao salvar), ou escreva o texto direto no lugar do campo.
      </UnfilledFieldsAlert>
      <ContractForm
        action={updateContractAction}
        id={contract.id}
        values={contract}
        file={file}
        clients={clients}
        projects={projects}
        proposals={proposals}
        cancelHref={`/painel/contratos/${contract.id}`}
        submitLabel="Salvar alterações"
      />
    </div>
  );
}
