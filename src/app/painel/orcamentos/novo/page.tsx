import type { Metadata } from "next";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { paramId, type PageSearchParams } from "@/components/ui/search-params";
import { requirePermission } from "@/lib/auth";
import { formatDate, addDays, todayISO } from "@/lib/dates";
import { getClientOptions } from "@/server/options";
import { getTemplateOptions } from "@/server/proposals/admin";
import { getSetting } from "@/server/settings";
import { NewProposalForm } from "./new-proposal-form";

export const metadata: Metadata = { title: "Novo orçamento" };
export const instant = false;

export default async function NewProposalPage({ searchParams }: { searchParams: PageSearchParams }) {
  await requirePermission("propostas", "editar");
  const params = await searchParams;
  const [clients, templates, settings] = await Promise.all([getClientOptions(), getTemplateOptions(), getSetting("proposal")]);
  // a URL é entrada do usuário: só vale se o id existir
  const clientId = clients.find((client) => client.value === paramId(params.cliente))?.value ?? null;
  const templateId = templates.find((template) => template.id === paramId(params.modelo))?.id ?? null;

  return (
    <div className="max-w-2xl">
      <PageHeader
        title="Novo orçamento"
        description="Três escolhas e o rascunho abre no editor. Nada é enviado ao cliente até você gerar o PDF."
        back={{ href: "/painel/orcamentos", label: "Orçamentos" }}
      />
      <Card>
        <NewProposalForm
          clients={clients}
          templates={templates}
          defaultClientId={clientId}
          defaultTemplateId={templateId}
          defaults={{ validUntil: formatDate(addDays(todayISO(), settings.validityDays)), entryPercent: settings.entryPercent }}
        />
      </Card>
    </div>
  );
}
