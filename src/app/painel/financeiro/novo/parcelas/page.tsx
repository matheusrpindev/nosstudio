import { CalendarClock, ListChecks } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ActionForm, FormActions, SubmitButton } from "@/components/ui/form";
import { Checkbox } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { paramId, type PageSearchParams } from "@/components/ui/search-params";
import { requireUser } from "@/lib/auth";
import { formatDate, todayISO } from "@/lib/dates";
import { formatBRL } from "@/lib/format";
import { getProposalInstallments } from "@/server/finance/admin";
import { generateInstallmentsAction } from "../../actions";

export const metadata: Metadata = { title: "Gerar parcelas da proposta" };
export const instant = false;

/** Tela de conferência: mostra o que será criado a partir das parcelas da proposta, e só cria depois de confirmar. */
export default async function InstallmentsPage({ searchParams }: { searchParams: PageSearchParams }) {
  await requireUser();
  const proposalId = paramId((await searchParams).proposta);
  if (!proposalId) notFound();
  const data = await getProposalInstallments(proposalId);
  if (!data) notFound();

  const today = todayISO();
  const { proposal, installments } = data;
  const usable = installments.filter((item) => item.amountCents > 0);
  const total = usable.filter((item) => !item.alreadyCreated).reduce((sum, item) => sum + item.amountCents, 0);

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Gerar parcelas da proposta"
        description={`Proposta ${proposal.number} — ${proposal.title}${proposal.clientName ? ` · ${proposal.clientName}` : ""}. Confira antes de criar: cada parcela marcada vira uma receita prevista (a receber).`}
        back={{ href: `/painel/financeiro/novo?proposta=${proposal.id}`, label: "Novo lançamento" }}
      />

      {usable.length === 0 ? (
        <EmptyState
          icon={<ListChecks />}
          title="Esta proposta não tem parcelas com valor"
          description="Cadastre as parcelas e vencimentos na própria proposta, ou volte e lance um valor avulso."
          action={
            <>
              <ButtonLink href={`/painel/orcamentos/${proposal.id}`}>Abrir proposta</ButtonLink>
              <ButtonLink href={`/painel/financeiro/novo?proposta=${proposal.id}`} variant="secondary">Lançar valor avulso</ButtonLink>
            </>
          }
        />
      ) : (
        <Card>
          <ActionForm action={generateInstallmentsAction} hidden={{ proposalId: proposal.id }}>
            <fieldset className="min-w-0">
              <legend className="label">Parcelas a criar</legend>
              <ul className="divide-borda mt-1 divide-y">
                {usable.map((item) => (
                  <li key={item.id}>
                    <Checkbox
                      name="parcela[]"
                      value={item.id}
                      defaultChecked={!item.alreadyCreated}
                      label={
                        <span className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
                          <span className="break-words">{item.label}</span>
                          <span className="font-extrabold tabular-nums">{formatBRL(item.amountCents)}</span>
                        </span>
                      }
                      hint={
                        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="inline-flex items-center gap-1">
                            <CalendarClock aria-hidden="true" className="size-3.5" />
                            {item.dueDate ? `Vence em ${formatDate(item.dueDate)}` : item.dueLabel ? `"${item.dueLabel}" — sem data: vai com a data de hoje (${formatDate(today)}); ajuste depois` : `Sem data: vai com a data de hoje (${formatDate(today)})`}
                          </span>
                          {item.alreadyCreated ? <Badge tone="alerta">Já lançada — desmarcada</Badge> : null}
                        </span>
                      }
                    />
                  </li>
                ))}
              </ul>
            </fieldset>
            {usable.some((item) => item.alreadyCreated) ? (
              <Alert tone="alerta">Parcelas já lançadas para esta proposta vêm desmarcadas para não duplicar. Marque de novo só se quiser criar outra cópia.</Alert>
            ) : null}
            <p className="text-texto-suave text-sm">
              Valores e datas vêm da proposta. A categoria será &quot;Serviço / projeto&quot; e o cliente da proposta fica vinculado. Total das parcelas ainda não lançadas: <strong className="text-texto">{formatBRL(total)}</strong>.
            </p>
            <FormActions>
              <SubmitButton icon={<ListChecks />} pendingLabel="Criando…">Criar lançamentos</SubmitButton>
              <ButtonLink href={`/painel/financeiro/novo?proposta=${proposal.id}`} variant="ghost">Cancelar</ButtonLink>
            </FormActions>
          </ActionForm>
        </Card>
      )}
    </div>
  );
}
