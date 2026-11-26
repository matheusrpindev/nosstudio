import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { DescriptionList } from "@/components/ui/description-list";
import { PageHeader } from "@/components/ui/page-header";
import { DateText, Money } from "@/components/ui/text";
import { requirePermission } from "@/lib/auth";
import { todayISO } from "@/lib/dates";
import { FINANCE_CATEGORY_LABELS, FINANCE_TYPE_LABELS } from "@/lib/domain";
import { formatBRL } from "@/lib/format";
import { getFinanceEntry } from "@/server/finance/admin";
import { entryStatus } from "@/server/finance/summary";
import { getMediaValue } from "@/server/media";
import { getClientOptions, getProjectOptions, getProposalOptions } from "@/server/options";
import { saveEntryAction } from "../actions";
import { EntryActions } from "../entry-actions";
import { EntryForm } from "../entry-form";
import { ENTRY_STATUS_LABELS, ENTRY_STATUS_TONES } from "../ui";

export const metadata: Metadata = { title: "Lançamento" };
export const instant = false;

export default async function EntryPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("financeiro", "ver");
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const entry = await getFinanceEntry(id);
  if (!entry) notFound();

  const today = todayISO();
  const [clients, projects, proposals, receipt] = await Promise.all([getClientOptions(), getProjectOptions(), getProposalOptions(), getMediaValue(entry.receiptMediaId)]);
  const status = entryStatus(entry, today);
  const links = [
    entry.clientId ? { label: "Cliente", value: <Link className="link" href={`/painel/clientes/${entry.clientId}`}>{clients.find((c) => c.value === entry.clientId)?.label ?? "Abrir cliente"}</Link> } : null,
    entry.projectId ? { label: "Projeto", value: <Link className="link" href={`/painel/projetos/${entry.projectId}`}>{projects.find((p) => p.value === entry.projectId)?.label ?? "Abrir projeto"}</Link> } : null,
    entry.proposalId ? { label: "Proposta", value: <Link className="link" href={`/painel/orcamentos/${entry.proposalId}`}>{proposals.find((p) => p.value === entry.proposalId)?.label ?? "Abrir proposta"}</Link> } : null,
  ].filter((item): item is { label: string; value: React.JSX.Element } => item !== null);

  return (
    <>
      <PageHeader
        title={entry.description}
        badge={
          <Badge tone={ENTRY_STATUS_TONES[status]} dot>
            {ENTRY_STATUS_LABELS[entry.type][status]}
          </Badge>
        }
        description={
          <>
            {FINANCE_TYPE_LABELS[entry.type]} · {FINANCE_CATEGORY_LABELS[entry.category]} · <Money cents={entry.amountCents} /> · vence em <DateText value={entry.dueDate} />
          </>
        }
        back={{ href: `/painel/financeiro?mes=${(entry.paidAt ?? entry.dueDate).slice(0, 7)}#lancamentos`, label: "Financeiro" }}
        actions={
          <EntryActions
            variant="header"
            today={today}
            entry={{ id: entry.id, type: entry.type, description: entry.description, amountLabel: formatBRL(entry.amountCents), dueDate: entry.dueDate, paid: entry.paidAt !== null, method: entry.method }}
          />
        }
      />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] lg:items-start">
        <Card>
          <EntryForm
            action={saveEntryAction}
            cancelHref="/painel/financeiro"
            clients={clients}
            projects={projects}
            proposals={proposals}
            receipt={receipt}
            defaults={{
              id: entry.id,
              type: entry.type,
              category: entry.category,
              description: entry.description,
              amountCents: entry.amountCents,
              dueDate: entry.dueDate,
              paidAt: entry.paidAt,
              installmentLabel: entry.installmentLabel,
              method: entry.method,
              supplier: entry.supplier,
              clientId: entry.clientId,
              projectId: entry.projectId,
              proposalId: entry.proposalId,
              receiptUrl: entry.receiptUrl,
              notes: entry.notes,
            }}
          />
        </Card>
        {links.length > 0 ? (
          <Card as="section" aria-labelledby="vinculos-titulo">
            <CardHeader id="vinculos-titulo" title="Vínculos" description="Onde este lançamento aparece no resto do painel." />
            <DescriptionList items={links} />
          </Card>
        ) : null}
      </div>
    </>
  );
}
