import { ListChecks } from "lucide-react";
import type { Metadata } from "next";
import { Alert } from "@/components/ui/alert";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { paramId, paramOneOf, type PageSearchParams } from "@/components/ui/search-params";
import { requirePermission } from "@/lib/auth";
import { todayISO } from "@/lib/dates";
import { FINANCE_TYPES } from "@/lib/domain";
import { getProposalInstallments } from "@/server/finance/admin";
import { getClientOptions, getProjectOptions, getProposalOptions } from "@/server/options";
import { saveEntryAction } from "../actions";
import { EntryForm } from "../entry-form";

export const metadata: Metadata = { title: "Novo lançamento" };
export const instant = false;

export default async function NewEntryPage({ searchParams }: { searchParams: PageSearchParams }) {
  await requirePermission("financeiro", "editar");
  const sp = await searchParams;
  const type = paramOneOf(FINANCE_TYPES, sp.tipo) ?? "receita";
  const proposalId = paramId(sp.proposta);
  const [clients, projects, proposals, installments] = await Promise.all([
    getClientOptions(),
    getProjectOptions(),
    getProposalOptions(),
    proposalId ? getProposalInstallments(proposalId) : null,
  ]);
  const payable = installments?.installments.filter((item) => item.amountCents > 0) ?? [];
  const clientId = paramId(sp.cliente) ?? installments?.proposal.clientId ?? null;
  const projectId = paramId(sp.projeto) ?? installments?.proposal.projectId ?? null;

  return (
    <div className="max-w-3xl">
      <PageHeader title="Novo lançamento" description="Uma receita (dinheiro que entra) ou uma despesa (dinheiro que sai). Sem data de pagamento, ele fica como previsto." back={{ href: "/painel/financeiro", label: "Financeiro" }} />

      {installments ? (
        <Alert
          tone="info"
          className="mb-4"
          title={`Proposta ${installments.proposal.number} — ${installments.proposal.title}`}
          action={
            payable.length > 0 ? (
              <ButtonLink href={`/painel/financeiro/novo/parcelas?proposta=${installments.proposal.id}`} icon={<ListChecks />}>
                Gerar parcelas da proposta
              </ButtonLink>
            ) : undefined
          }
        >
          {payable.length > 0
            ? `Esta proposta tem ${payable.length} ${payable.length === 1 ? "parcela" : "parcelas"}. Você pode criar todas como contas a receber de uma vez (com tela de conferência) ou lançar um valor avulso abaixo.`
            : "Esta proposta ainda não tem parcelas com valor. Cadastre as parcelas na proposta ou lance um valor avulso abaixo."}
        </Alert>
      ) : null}

      <Card>
        <EntryForm
          action={saveEntryAction}
          cancelHref="/painel/financeiro"
          clients={clients}
          projects={projects}
          proposals={proposals}
          receipt={null}
          defaults={{
            type,
            category: type === "receita" ? "servico" : "",
            description: installments ? `Proposta ${installments.proposal.number}${installments.proposal.clientName ? ` · ${installments.proposal.clientName}` : ""}` : "",
            amountCents: null,
            dueDate: todayISO(),
            paidAt: null,
            installmentLabel: "",
            method: null,
            supplier: "",
            clientId,
            projectId,
            proposalId: installments?.proposal.id ?? null,
            receiptUrl: "",
            notes: "",
          }}
        />
      </Card>
    </div>
  );
}
